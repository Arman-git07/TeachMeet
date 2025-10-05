// src/lib/webrtc/screenShare.ts
// Final production-ready ScreenShareHelper
// - Keeps existing UI/buttons/logic untouched
// - Exposes requestScreenSharePermission() and stopScreenShare()
// - Supports Replace Camera OR Share Alongside modes (user chooses via confirm prompt)
// - Host approval + host forced-stop + multiple simultaneous shares
// - Works with MeshRTC methods: replaceTrack(track), restoreCameraTrack()
// - If available, will use mesh.addScreenTrackToAll / removeScreenTrackFromAll for "alongside" mode
// - Provides optional callbacks for UI indicator updates

import { MeshRTC } from "./mesh";
import type { Socket } from "socket.io-client";

type Mode = "replace" | "alongside";

interface ScreenShareHelperConfig {
  mesh: MeshRTC;
  socket: Socket;
  meetingId: string;
  userId: string;
  isHost: () => boolean;
  // UI hook callbacks (optional). These are NOT used to change buttons; they simply inform your UI.
  onLocalShareStarted?: (mode: Mode) => void;
  onLocalShareStopped?: () => void;
  onRemoteShareStarted?: (participantId: string) => void;
  onRemoteShareStopped?: (participantId: string) => void;
  // Handlers to create/remove remote tiles (if your app needs to attach streams manually)
  addRemoteScreenTile?: (participantId: string, stream: MediaStream) => void;
  removeRemoteScreenTile?: (participantId: string) => void;
  // Optional function that shows host modal; called with { participantId, displayName }
  showHostScreenShareRequestModal?: (payload: { participantId: string; displayName?: string }) => void;
}

export class ScreenShareHelper {
  private mesh: MeshRTC;
  private socket: Socket;
  private meetingId: string;
  private userId: string;
  private isHostFn: () => boolean;

  // Callbacks / UI hooks
  private onLocalShareStarted?: (mode: Mode) => void;
  private onLocalShareStopped?: () => void;
  private onRemoteShareStarted?: (participantId: string) => void;
  private onRemoteShareStopped?: (participantId: string) => void;
  private addRemoteScreenTile?: (participantId: string, stream: MediaStream) => void;
  private removeRemoteScreenTile?: (participantId: string) => void;
  private showHostScreenShareRequestModal?: (payload: { participantId: string; displayName?: string }) => void;

  // Internal state
  private currentScreenTrack: MediaStreamTrack | null = null;
  private currentScreenStream: MediaStream | null = null;
  private currentMode: Mode | null = null;
  private approvedToShare: boolean = false;
  private requestPending: boolean = false;

  constructor(cfg: ScreenShareHelperConfig) {
    this.mesh = cfg.mesh;
    this.socket = cfg.socket;
    this.meetingId = cfg.meetingId;
    this.userId = cfg.userId;
    this.isHostFn = cfg.isHost;

    this.onLocalShareStarted = cfg.onLocalShareStarted;
    this.onLocalShareStopped = cfg.onLocalShareStopped;
    this.onRemoteShareStarted = cfg.onRemoteShareStarted;
    this.onRemoteShareStopped = cfg.onRemoteShareStopped;
    this.addRemoteScreenTile = cfg.addRemoteScreenTile;
    this.removeRemoteScreenTile = cfg.removeRemoteScreenTile;
    this.showHostScreenShareRequestModal = cfg.showHostScreenShareRequestModal;

    this.setupSocketListeners();
  }

  // ---------------------------
  // Public API used by UI buttons
  // ---------------------------

  /**
   * Called by the confirmation dialog's Share button.
   * This function will:
   * - Ask the user (native confirm) whether to Replace camera or Share alongside
   * - If host -> start immediately
   * - If participant -> emit a request to host and wait for approval
   *
   * NOTE: This is triggered by a user gesture from your existing Share button.
   */
  public async requestScreenSharePermission(): Promise<void> {
    try {
      // Ask the user which mode they want. Using native confirm so we don't change existing UI.
      // OK => Replace camera. Cancel => Share alongside camera.
      const wantsReplace = window.confirm(
        "Do you want to replace your camera with screen share? (OK = Replace camera, Cancel = Share alongside camera)"
      );
      const chosenMode: Mode = wantsReplace ? "replace" : "alongside";
      this.currentMode = chosenMode;

      if (this.isHostFn()) {
        // Host can share directly
        this.approvedToShare = true;
        await this.safeStartScreenShare(chosenMode, true);
        return;
      }

      // Participant: request approval from host
      this.requestPending = true;
      this.socket.emit("request-screen-share", {
        meetingId: this.meetingId,
        participantId: this.userId,
        mode: chosenMode,
      });
      // Let the user know request sent (UI can also show pending using your own state)
      // Use alert only as a last-resort notification (non-blocking)
      try {
        // Provide user-friendly quick notification without changing UI
        // Many apps use a toast; if you have one, replace this alert in your UI integration
        // but we keep alert to ensure user knows request was sent (non-invasive).
        // You can remove/replace this later in your own UI.
        // eslint-disable-next-line no-alert
        alert("Screen share request sent to host.");
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error("requestScreenSharePermission error:", err);
    }
  }

  /**
   * Called by Stop Sharing button.
   * This stops local sharing, removes tracks, restores camera if replaced, and notifies others.
   */
  public async stopScreenShare(): Promise<void> {
    try {
      // If nothing to stop, still emit notification for safety
      if (!this.currentScreenTrack && !this.currentScreenStream) {
        // still emit stopped so UI updates
        this.socket.emit("screen-share-stopped", {
          meetingId: this.meetingId,
          participantId: this.userId,
        });
        this.onLocalShareStopped?.();
        return;
      }

      // stop the track and cleanup
      try {
        if (this.currentScreenTrack && this.currentScreenTrack.readyState !== "ended") {
          this.currentScreenTrack.stop();
        }
      } catch (e) {
        console.warn("stopScreenShare: error stopping track", e);
      }

      // If we used alongside/addTrack API, try to remove with mesh.removeScreenTrackFromAll
      if (this.currentMode === "alongside" && typeof (this.mesh as any).removeScreenTrackFromAll === "function") {
        try {
          (this.mesh as any).removeScreenTrackFromAll(this.currentScreenTrack ?? undefined);
        } catch (e) {
          console.warn("stopScreenShare: mesh.removeScreenTrackFromAll failed, fallback restore", e);
          if (typeof (this.mesh as any).restoreCameraTrack === "function") (this.mesh as any).restoreCameraTrack();
        }
      } else {
        // fallback: restore camera track if replaceTrack was used
        if (typeof (this.mesh as any).restoreCameraTrack === "function") {
          try {
            (this.mesh as any).restoreCameraTrack();
          } catch (e) {
            console.warn("stopScreenShare: mesh.restoreCameraTrack failed", e);
          }
        } else {
          console.warn("stopScreenShare: no restoreCameraTrack on mesh — skipped");
        }
      }

      // cleanup
      if (this.currentScreenStream) {
        try {
          this.currentScreenStream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
        } catch {}
      }

      this.currentScreenStream = null;
      this.currentScreenTrack = null;
      this.currentMode = null;
      this.approvedToShare = false;
      this.requestPending = false;

      // notify server/others
      this.socket.emit("screen-share-stopped", {
        meetingId: this.meetingId,
        participantId: this.userId,
      });

      this.onLocalShareStopped?.();
    } catch (err) {
      console.error("stopScreenShare error:", err);
    }
  }

  // ---------------------------
  // Internal helpers
  // ---------------------------

  /**
   * Primary internal start method - robust and safe.
   * - mode: 'replace' or 'alongside'
   * - called either directly (host) or after approval (participant)
   * - must be invoked as a result of a user gesture for getDisplayMedia in some browsers;
   *   if the browser blocks it after async approval, user will be asked to click 'Share' again.
   */
  private async safeStartScreenShare(mode: Mode, initiatedByUserGesture: boolean): Promise<void> {
    try {
      if (this.currentScreenTrack) {
        // Already sharing
        return;
      }

      // Request display media (this may require a user gesture in some browsers)
      let displayStream: MediaStream | null = null;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false, // change to true if you want to support tab audio — be mindful of browser behaviour
        });
      } catch (err: any) {
        // Browser blocked getDisplayMedia - often due to no user gesture or permission denied
        console.error("getDisplayMedia error:", err);
        if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
          alert("Screen sharing permission denied or blocked. Please allow screen sharing in your browser.");
        } else if (err && err.name === "NotFoundError") {
          alert("No screen/window/tab available to share.");
        } else {
          // If this was called after async approval (no user gesture), many browsers block
          // — in that case, instruct the user to click Share again (so it's a fresh user gesture).
          if (!initiatedByUserGesture) {
            alert("Unable to start screen share automatically. Please click Share Screen again to start sharing.");
          } else {
            alert("Screen share failed. Please try again.");
          }
        }
        return;
      }

      if (!displayStream) {
        alert("Screen share failed — no display stream returned.");
        return;
      }

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        alert("Screen share failed — no video track obtained.");
        return;
      }

      // Save references
      this.currentScreenStream = displayStream;
      this.currentScreenTrack = screenTrack;
      this.currentMode = mode;

      // Two modes:
      // - replace: use existing mesh.replaceTrack(track) and restoreCameraTrack()
      // - alongside: if mesh.addScreenTrackToAll exists, use it to add an additional sender
      if (mode === "alongside" && typeof (this.mesh as any).addScreenTrackToAll === "function") {
        try {
          (this.mesh as any).addScreenTrackToAll(screenTrack, displayStream);
        } catch (e) {
          console.warn("safeStartScreenShare: addScreenTrackToAll failed, falling back to replace", e);
          // fallback
          if (typeof (this.mesh as any).replaceTrack === "function") {
            (this.mesh as any).replaceTrack(screenTrack);
          } else {
            throw new Error("mesh.replaceTrack is not available for fallback");
          }
        }
      } else {
        // default: replace camera
        if (typeof (this.mesh as any).replaceTrack === "function") {
          (this.mesh as any).replaceTrack(screenTrack);
        } else {
          throw new Error("mesh.replaceTrack is not available");
        }
      }

      // Listen for the user stopping share from browser UI
      screenTrack.onended = () => {
        // Clean stop
        this.stopScreenShare();
      };

      this.approvedToShare = false;
      this.requestPending = false;

      // Notify server & UI
      this.socket.emit("screen-share-started", {
        meetingId: this.meetingId,
        participantId: this.userId,
      });

      // Also emit legacy/alternate event names to support various server naming
      try {
        this.socket.emit("started-screen-share", { meetingId: this.meetingId, participantId: this.userId });
      } catch {}

      // Callback to let UI show "You're sharing" indicator
      this.onLocalShareStarted?.(mode);

      // Notify other participants to create remote tiles (server may also broadcast a separate event)
      this.socket.emit("notify-screen-share-started", { meetingId: this.meetingId, participantId: this.userId });
    } catch (err) {
      console.error("safeStartScreenShare error:", err);
      alert("Screen share failed. Please ensure you've granted permission and try again.");
      // cleanup partial state
      try {
        if (this.currentScreenStream) {
          this.currentScreenStream.getTracks().forEach((t) => t.stop());
        }
      } catch {}
      this.currentScreenStream = null;
      this.currentScreenTrack = null;
      this.currentMode = null;
      this.approvedToShare = false;
      this.requestPending = false;
    }
  }

  // ---------------------------
  // Socket setup + handlers
  // ---------------------------

  private setupSocketListeners() {
    // Participant receives approval/denial - support multiple common event names
    this.socket.on("screen-share-approved", async (payload: any) => {
      // payload might include mode or meetingId
      try {
        if (payload && payload.participantId && payload.participantId !== this.userId) return;
      } catch {}
      // auto-start with the mode chosen earlier (if user clicked the confirm)
      const modeFromServer: Mode | undefined = payload?.mode;
      const chosenMode = modeFromServer ?? (this.currentMode ?? "replace");
      // Attempt to start; we can't guarantee the browser allows automatic start after async approval,
      // so we tell safeStartScreenShare that this may not be a user gesture
      await this.safeStartScreenShare(chosenMode, false);
    });

    this.socket.on("screen-share-denied", (payload: any) => {
      try {
        if (payload && payload.participantId && payload.participantId !== this.userId) return;
      } catch {}
      this.requestPending = false;
      this.approvedToShare = false;
      // notify user
      try {
        // eslint-disable-next-line no-alert
        alert("Host denied your screen sharing request.");
      } catch {}
    });

    // Legacy names / alternate flows: host responds via "screen-share-response" or "approve-screen-share"
    this.socket.on("screen-share-response", async (payload: any) => {
      // payload: { meetingId, targetId, approved, mode }
      if (payload?.targetId && payload.targetId !== this.userId) return;
      if (payload?.approved) {
        const chosen = (payload.mode as Mode) ?? (this.currentMode ?? "replace");
        await this.safeStartScreenShare(chosen, false);
      } else {
        this.requestPending = false;
        this.approvedToShare = false;
        try {
          // eslint-disable-next-line no-alert
          alert("Host denied your screen sharing request.");
        } catch {}
      }
    });

    // Newer server naming "approve-screen-share"
    this.socket.on("approve-screen-share", async (payload: any) => {
      // payload: { meetingId, participantId, approved, mode }
      if (payload?.participantId && payload.participantId !== this.userId) return;
      if (payload?.approved) {
        const chosen = (payload.mode as Mode) ?? (this.currentMode ?? "replace");
        await this.safeStartScreenShare(chosen, false);
      } else {
        this.requestPending = false;
        this.approvedToShare = false;
        try {
          // eslint-disable-next-line no-alert
          alert("Host denied your screen sharing request.");
        } catch {}
      }
    });

    // Host receives request (this client is host) - show host modal if provided
    this.socket.on("screen-share-request", (payload: any) => {
      // payload: { meetingId, participantId, displayName?, mode? }
      // Only show if this client is host
      if (!this.isHostFn()) return;
      const participantId = payload?.participantId ?? payload?.userId;
      const displayName = payload?.displayName ?? payload?.name;
      if (this.showHostScreenShareRequestModal) {
        try {
          this.showHostScreenShareRequestModal({ participantId, displayName });
        } catch (e) {
          console.warn("showHostScreenShareRequestModal error", e);
        }
      } else {
        // If no modal hook provided, we emit an event to the host UI or fallback to console
        console.info("screen-share-request received for host:", participantId, displayName);
      }
    });

    // Host forces a participant to stop sharing
    // Server might emit either "force-stop-screen-share" (to tell participant to stop) or "stop-screen-share-forced".
    this.socket.on("stop-screen-share-forced", (payload: any) => {
      const pid = payload?.participantId ?? payload?.targetId;
      if (!pid) return;
      if (pid === this.userId) {
        // If this client is the one forced, stop immediately
        this.stopScreenShare();
        try {
          // eslint-disable-next-line no-alert
          alert("Host has stopped your screen sharing.");
        } catch {}
      } else {
        // remove remote tile if relevant
        this.onRemoteShareStopped?.(pid);
        this.removeRemoteScreenTile?.(pid);
      }
    });

    this.socket.on("force-stop-screen-share", (payload: any) => {
      const pid = payload?.participantId ?? payload?.targetId;
      if (!pid) return;
      if (pid === this.userId) {
        this.stopScreenShare();
        try {
          // eslint-disable-next-line no-alert
          alert("Host has stopped your screen sharing.");
        } catch {}
      }
    });

    // A remote participant started sharing - optional handler for UI
    this.socket.on("screen-share-started", (payload: any) => {
      const pid = payload?.participantId ?? payload?.userId;
      if (pid && pid !== this.userId) {
        this.onRemoteShareStarted?.(pid);
        // The MeshRTC onRemoteStream handler will typically create the remote tile,
        // but this hook is here if your app's UI needs to react separately.
      }
    });

    // A remote participant stopped sharing - optional handler for UI
    this.socket.on("screen-share-stopped", (payload: any) => {
      const pid = payload?.participantId ?? payload?.userId;
      if (pid && pid !== this.userId) {
        this.onRemoteShareStopped?.(pid);
        this.removeRemoteScreenTile?.(pid); // ensure tile is removed
      }
    });
  }

  /**
   * Called by the host from the UI to stop a specific participant's screen share.
   * @param {string} participantId The ID of the participant to stop.
   */
  public hostStopParticipantShare(participantId: string): void {
    if (!this.isHostFn()) return;
    this.socket.emit("force-stop-screen-share", {
      meetingId: this.meetingId,
      targetId: participantId,
    });
  }
}
