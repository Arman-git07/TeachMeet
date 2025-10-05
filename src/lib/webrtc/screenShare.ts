
// src/lib/webrtc/screenShare.ts
"use client";

import { MeshRTC } from "./mesh";
import { Socket } from "socket.io-client";

export interface ScreenShareHelperProps {
  mesh: MeshRTC | null;
  socket: Socket | null;
  meetingId: string;
  userId: string;
  isHost: () => boolean;
  addRemoteScreenTile: (peerId: string, stream: MediaStream) => void;
  removeRemoteScreenTile: (peerId: string) => void;
  showHostScreenShareRequestModal?: (opts: { participantId: string; name: string; }) => void;
  setIsSharing: (isSharing: boolean) => void;
}

export class ScreenShareHelper {
  private mesh: MeshRTC | null;
  private socket: Socket | null;
  private meetingId: string;
  private userId: string;
  private isHostFn: () => boolean;
  private addRemoteScreenTile: (peerId: string, stream: MediaStream) => void;
  private removeRemoteScreenTile: (peerId: string) => void;
  private showHostScreenShareRequestModal?: (opts: { participantId: string; name: string }) => void;
  private setIsSharingState: (isSharing: boolean) => void;

  private screenStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private isSharing: boolean = false;
  private permissionGranted: boolean = false;

  constructor(props: ScreenShareHelperProps) {
    this.mesh = props.mesh;
    this.socket = props.socket;
    this.meetingId = props.meetingId;
    this.userId = props.userId;
    this.isHostFn = props.isHost;
    this.addRemoteScreenTile = props.addRemoteScreenTile;
    this.removeRemoteScreenTile = props.removeRemoteScreenTile;
    this.showHostScreenShareRequestModal = props.showHostScreenShareRequestModal;
    this.setIsSharingState = props.setIsSharing;

    this.initSocketListeners();
  }

  private initSocketListeners() {
    if (!this.socket) return;
    // Participant receives approval/denial
    this.socket.on("screen-share-approval", ({ approved }: { approved: boolean }) => {
      this.permissionGranted = approved;
      if (approved) this.startScreenShare();
      else alert("Host denied screen sharing request.");
    });

    // Host receives request
    this.socket.on("screen-share-request", ({ participantId, name }: { participantId: string; name: string }) => {
      if (this.showHostScreenShareRequestModal) {
        this.showHostScreenShareRequestModal({ participantId, name });
      }
    });

    // Participant forced stop by host
    this.socket.on("force-stop-screen-share", () => {
      if (this.isSharing) this.stopScreenShare(true);
    });

    // Remote participant started/stopped sharing
    this.socket.on("participant-started-sharing", ({ participantId }: {participantId: string}) => {
      // This is a backup; primary handling should be in ontrack
      // You can add logic here if needed, but ontrack is more reliable for streams.
    });
    this.socket.on("participant-stopped-sharing", ({ participantId }: {participantId: string}) => {
      this.removeRemoteScreenTile(participantId);
    });
  }

  public cleanup() {
      if (!this.socket) return;
      this.socket.off("screen-share-approval");
      this.socket.off("screen-share-request");
      this.socket.off("force-stop-screen-share");
      this.socket.off("participant-started-sharing");
      this.socket.off("participant-stopped-sharing");
  }

  // Called when participant clicks confirmation dialog Share button
  public requestScreenSharePermission() {
    if (this.isHostFn()) {
      this.startScreenShare();
      return;
    }
    this.socket?.emit("request-screen-share", { meetingId: this.meetingId, participantId: this.userId });
  }

  // Starts actual screen share
  public async startScreenShare() {
    try {
      if (this.isSharing) return;
      if (!this.isHostFn() && !this.permissionGranted) {
        console.warn("Screen share blocked: waiting for host approval");
        this.requestScreenSharePermission();
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error("No screen track available");

      this.screenStream = screenStream;
      this.screenTrack = screenTrack;

      // Add screen track to all peer connections
      this.mesh?.addScreenTrackToAll(screenTrack, screenStream);

      screenTrack.onended = () => this.stopScreenShare();

      this.isSharing = true;
      this.setIsSharingState(true);

      // Notify others
      this.socket?.emit("notify-screen-share-started", { meetingId: this.meetingId, participantId: this.userId });
    } catch (err: any) {
      console.error("startScreenShare failed:", err);
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        alert("Screen sharing permission denied. Please allow screen sharing in your browser.");
      } else if (err.name === "NotFoundError") {
        alert("No screen or window found to share.");
      } else {
        alert("Screen share failed — please ensure you've granted permission and try again.");
      }
      this.isSharing = false;
      this.setIsSharingState(false);
      this.permissionGranted = false;
    }
  }

  // Stop local screen share
  public async stopScreenShare(forced: boolean = false) {
    try {
      if (!this.screenTrack && !this.screenStream) return;

      if (this.screenTrack && this.screenTrack.readyState !== "ended") this.screenTrack.stop();
      if (this.screenStream) this.screenStream.getTracks().forEach(t => t.stop());

      this.mesh?.removeScreenTrackFromAll(this.screenTrack ?? undefined);

      this.screenTrack = null;
      this.screenStream = null;
      this.isSharing = false;
      this.setIsSharingState(false);
      if (!forced) this.permissionGranted = false;

      this.socket?.emit("notify-screen-share-stopped", { meetingId: this.meetingId, participantId: this.userId });
    } catch (err) {
      console.error("stopScreenShare failed", err);
    }
  }
  
  // Host responds to a request
  public hostRespondToShareRequest(participantId: string, allow: boolean) {
    this.socket?.emit("approve-screen-share", { meetingId: this.meetingId, participantId, approved: allow });
  };

  // Host forces stop participant's share
  public hostStopParticipantShare(targetParticipantId: string) {
    if (!this.isHostFn()) return;
    this.socket?.emit("host-stop-participant-share", { meetingId: this.meetingId, targetParticipantId });
    this.removeRemoteScreenTile(targetParticipantId);
  }
}
