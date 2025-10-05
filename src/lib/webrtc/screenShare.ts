
import { MeshRTC } from "./mesh";

export class ScreenShareHelper {
  private mesh: MeshRTC;
  private screenStream: MediaStream | null = null;
  private originalTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private isSharing = false;
  private displayName: string;

  constructor(mesh: MeshRTC, displayName: string) {
    this.mesh = mesh;
    this.displayName = displayName;
  }

  async requestScreenSharePermission(mode: "replace" | "alongside" = "replace") {
    try {
      // ✅ Ask for screen share permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (!stream) throw new Error("No screen selected.");

      this.screenStream = stream;
      this.screenTrack = stream.getVideoTracks()[0];

      if (!this.screenTrack) throw new Error("Failed to get screen track.");

      // 📡 Listen for when user manually stops from browser UI
      this.screenTrack.onended = () => {
        this.stopScreenShare();
      };

      // ✅ Store the original camera track before replacing
      if (mode === "replace") {
        this.originalTrack = this.mesh.getLocalVideoTrack?.() || null;
        await this.mesh.replaceTrack(this.screenTrack);
      } else {
        // ✅ Add alongside camera (send both)
        // @ts-ignore
        await this.mesh.addTrack?.(this.screenTrack);
      }

      this.isSharing = true;

      // 🔔 Emit socket event that screen started (optional)
      this.mesh.socket?.emit("screen-share-started", {
        meetingId: this.mesh.roomId,
        displayName: this.displayName,
      });

      // 🟢 Visual indicator (optional toast)
      console.log("✅ Screen sharing started.");

    } catch (err) {
      console.error("❌ Screen share failed:", err);
      alert("Please ensure you've granted permission and selected a screen.");
    }
  }

  async stopScreenShare() {
    if (!this.isSharing) return;

    try {
      if (this.screenTrack) {
        this.screenTrack.stop();
      }
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(t => t.stop());
      }

      // 🔁 Restore original camera track if replaced
      if (this.originalTrack) {
        await this.mesh.restoreCameraTrack?.();
      }

      this.isSharing = false;

      // 🔔 Notify peers screen sharing stopped
      this.mesh.socket?.emit("screen-share-stopped", {
        meetingId: this.mesh.roomId,
        displayName: this.displayName,
      });

      console.log("🛑 Screen sharing stopped.");
    } catch (err) {
      console.error("❌ Failed to stop screen share:", err);
    }
  }

  isScreenSharing() {
    return this.isSharing;
  }
}
