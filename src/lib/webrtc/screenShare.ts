// src/lib/webrtc/screenShare.ts
"use client";

import { MeshRTC } from "./mesh";
import { Socket } from "socket.io-client";

interface ScreenShareHelperConfig {
  mesh: MeshRTC;
  socket: any;
  meetingId: string;
  userId: string;
  isHost: () => boolean;
  addRemoteScreenTile: (participantId: string, stream: MediaStream) => void;
  removeRemoteScreenTile: (participantId: string) => void;
  showHostScreenShareRequestModal: (data: { participantId: string; name: string }) => void;
}

export class ScreenShareHelper {
  private mesh: MeshRTC;
  private socket: any;
  private meetingId: string;
  private userId: string;
  private isHost: () => boolean;
  private addRemoteScreenTile: (participantId: string, stream: MediaStream) => void;
  private removeRemoteScreenTile: (participantId: string) => void;
  private showHostScreenShareRequestModal: (data: { participantId: string; name: string }) => void;
  private currentScreenTrack: MediaStreamTrack | null = null;
  private approvedToShare = false;

  constructor(config: ScreenShareHelperConfig) {
    this.mesh = config.mesh;
    this.socket = config.socket;
    this.meetingId = config.meetingId;
    this.userId = config.userId;
    this.isHost = config.isHost;
    this.addRemoteScreenTile = config.addRemoteScreenTile;
    this.removeRemoteScreenTile = config.removeRemoteScreenTile;
    this.showHostScreenShareRequestModal = config.showHostScreenShareRequestModal;

    this.setupSocketEvents();
  }

  // --------------------------------------------------------------
  // 🧠 PUBLIC METHOD 1: Called when user clicks "Share Screen"
  // --------------------------------------------------------------
  async requestScreenSharePermission() {
    if (this.isHost()) {
      // Host can share directly
      await this.startScreenShare();
    } else {
      // Participant must request approval
      this.socket.emit("screen-share-request", {
        meetingId: this.meetingId,
        participantId: this.userId,
      });
      alert("📩 Request sent to host for screen sharing permission.");
    }
  }

  // --------------------------------------------------------------
  // 🧠 PUBLIC METHOD 2: Called when user clicks "Stop Screen Share"
  // --------------------------------------------------------------
  stopScreenShare() {
    if (this.currentScreenTrack) {
      this.currentScreenTrack.stop();
      this.mesh.restoreCameraTrack();
      this.socket.emit("stopped-screen-share", {
        meetingId: this.meetingId,
        userId: this.userId,
      });
      this.currentScreenTrack = null;
      this.approvedToShare = false;
    }
  }

  // --------------------------------------------------------------
  // 🔒 Internal: Start screen share after approval or if host
  // --------------------------------------------------------------
  private async startScreenShare() {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      this.currentScreenTrack = screenTrack;

      // Replace outgoing track
      this.mesh.replaceTrack(screenTrack);

      // Handle user stopping share manually
      screenTrack.onended = () => this.stopScreenShare();

      // Emit event for UI indicator
      this.socket.emit("started-screen-share", {
        meetingId: this.meetingId,
        userId: this.userId,
      });

      console.log("✅ Screen sharing started");
    } catch (err) {
      console.error("❌ Screen share failed:", err);
      alert("Screen share failed. Please ensure you've granted permission and try again.");
    }
  }

  // --------------------------------------------------------------
  // 📡 Socket Listeners for approval & remote shares
  // --------------------------------------------------------------
  public setupSocketEvents() {
    // Host receives screen share request
    this.socket.on("screen-share-request", ({ participantId, name } : {participantId: string, name: string}) => {
      if (this.isHost()) {
        this.showHostScreenShareRequestModal({ participantId, name });
      }
    });

    // Participant receives approval from host
    this.socket.on("screen-share-approval", async ({ participantId, approved }: {participantId: string, approved: boolean}) => {
      if (participantId === this.userId && approved) {
        this.approvedToShare = true;
        await this.startScreenShare();
      } else if (participantId === this.userId && !approved) {
        alert("❌ Host denied your screen sharing request.");
      }
    });

    // Host forces a participant to stop sharing
    this.socket.on("force-stop-screen-share", ({ participantId } : {participantId: string}) => {
      if (participantId === this.userId) {
        this.stopScreenShare();
        alert("⛔ Host stopped your screen sharing.");
      }
    });

    // Remote participant started sharing
    this.socket.on("participant-started-sharing", ({ participantId } : {participantId: string}) => {
      if (participantId !== this.userId) {
        // The actual stream is added via ontrack in MeshRTC. We just need to render it.
        // The logic in MeetingClient will handle finding the stream and adding the tile.
      }
    });

    // Remote participant stopped sharing
    this.socket.on("participant-stopped-sharing", ({ participantId } : {participantId: string}) => {
      this.removeRemoteScreenTile(participantId);
    });
  }

  // --------------------------------------------------------------
  // 👑 Host stopping another participant’s screen
  // --------------------------------------------------------------
  hostStopParticipantShare(participantId: string) {
    if (this.isHost()) {
      this.socket.emit("host-force-stop-share", {
        meetingId: this.meetingId,
        targetParticipantId: participantId,
      });
    }
  }

  public cleanup() {
      if (!this.socket) return;
      this.socket.off("screen-share-request");
      this.socket.off("screen-share-approval");
      this.socket.off("force-stop-screen-share");
      this.socket.off("participant-started-sharing");
      this.socket.off("participant-stopped-sharing");
  }
}
