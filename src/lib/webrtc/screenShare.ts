// src/lib/webrtc/screenShare.ts
import type { MeshRTC } from "./mesh";

export type ShareMode = "replace" | "alongside";

export class ScreenShareHelper {
  private mesh: MeshRTC;
  private screenStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private originalTrack: MediaStreamTrack | null = null;
  private isSharingFlag = false;
  private onStopCallbacks: Array<() => void> = [];

  constructor(mesh: MeshRTC) {
    this.mesh = mesh;
  }

  isScreenSharing() {
    return this.isSharingFlag;
  }

  // Register UI callbacks (e.g. to show/hide stop button on tile)
  onStop(cb: () => void) {
    this.onStopCallbacks.push(cb);
    return () => {
      this.onStopCallbacks = this.onStopCallbacks.filter(c => c !== cb);
    };
  }

  private notifyStop() {
    this.onStopCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  // Start sharing given a MediaStream (call getDisplayMedia from UI - direct gesture)
  async startSharingWithStream(mode: ShareMode, stream: MediaStream) {
    if (!stream) throw new Error("No stream provided to startSharingWithStream");

    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("No video track in provided stream");

    // attach onended so if user stops from browser UI, we clean up
    track.onended = () => {
      void this.stopSharing();
    };

    this.screenStream = stream;
    this.screenTrack = track;

    // If replace, store original camera track (if available)
    if (mode === "replace") {
      try {
        this.originalTrack = this.mesh.getLocalVideoTrack?.() ?? null;
      } catch (err) {
        console.warn("Could not read original local track:", err);
        this.originalTrack = null;
      }
    }

    try {
      if (mode === "replace") {
        // Replace camera with screen
        await this.mesh.replaceTrack(this.screenTrack);
      } else {
        // Send screen as an additional track on existing connection
        await this.mesh.addTrack?.(this.screenTrack);
      }
      this.isSharingFlag = true;

       // Optional: emit socket/event if mesh exposes socket
      this.mesh.socket?.emit?.("screen-share-started", {
        roomId: this.mesh.roomId,
        mode,
      });

       console.log("Screen sharing started (mode:", mode, ")");
    } catch (err) {
      console.error("Failed to start screen sharing:", err);
      // clean up if failed
      if (this.screenTrack) {
        try { this.screenTrack.stop(); } catch {}
      }
      this.screenStream = null;
      this.screenTrack = null;
      throw err;
    }
  }

   // Convenience: call getDisplayMedia and start sharing — keep for backward compatibility,
   // but **prefer** calling getDisplayMedia directly from UI (see modal code).
  async requestAndStart(mode: ShareMode = "replace", constraints = { video: true, audio: false }) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      await this.startSharingWithStream(mode, stream);
    } catch (err) {
      console.error("User denied or getDisplayMedia failed:", err);
      throw err;
    }
  }

  async stopSharing() {
    if (!this.isSharingFlag) return;

    try {
      // Stop the screen track if still running
      if (this.screenTrack) {
        try { this.screenTrack.onended = null; } catch {}
        try { this.screenTrack.stop(); } catch {}
      }
      if (this.screenStream) {
        try {
          this.screenStream.getTracks().forEach(t => {
            try { t.stop(); } catch {}
          });
        } catch (e) { /* ignore */ }
      }

       // If we replaced camera, restore the original camera track
      if (this.originalTrack) {
        try {
          await this.mesh.restoreCameraTrack?.();
        } catch (err) {
          console.error("Failed to restore camera track:", err);
          // fallback: try replaceTrack with originalTrack
          try { await this.mesh.replaceTrack(this.originalTrack); } catch (e) { console.error(e); }
        }
      } else {
        // If we were sending alongside, ask mesh to remove the screen track sender
        if(this.screenTrack) {
          try {
            await this.mesh.removeTrack?.(this.screenTrack);
          } catch (err) {
            console.warn("mesh.removeTrack failed (maybe not implemented):", err);
          }
        }
      }

       // Update local flags
      this.screenStream = null;
      this.screenTrack = null;
      this.originalTrack = null;
      this.isSharingFlag = false;

       // Notify UI callbacks
      this.notifyStop();

       // Optional event to peers
      this.mesh.socket?.emit?.("screen-share-stopped", { roomId: this.mesh.roomId });

       console.log("Screen sharing stopped.");
    } catch (err) {
      console.error("Error stopping screen share:", err);
      // still attempt to reset flags
      this.screenStream = null;
      this.screenTrack = null;
      this.originalTrack = null;
      this.isSharingFlag = false;
      this.notifyStop();
    }
  }
}
