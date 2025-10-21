
"use client";

import { io, Socket } from "socket.io-client";

type Remote = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  negotiating: boolean; 
};

type MeshOptions = {
  roomId: string;
  userId: string;
  userName: string;
  onRemoteStream: (remoteSocketId: string, stream: MediaStream) => void;
  onRemoteLeft: (remoteSocketId: string) => void;
  onUserJoined?: (remoteSocketId: string) => void;
};

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export class MeshRTC {
  public socket!: Socket;
  private localStream?: MediaStream;
  private originalVideoTrack?: MediaStreamTrack;
  private remotes = new Map<string, Remote>();
  public roomId!: string;
  private userId!: string;
  private initialized = false;

  constructor(private opts: MeshOptions) {}

  async init(stream: MediaStream) {
    if (this.initialized) return;
    this.initialized = true;

    this.localStream = stream;
    this.originalVideoTrack = stream.getVideoTracks()[0];

    // Connect to a non-existent server to prevent errors, as the backend is disabled.
    this.socket = io("http://localhost:9999", { path: "/api/socketio", autoConnect: false, auth: { name: this.opts.userName } });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;
    
    console.warn("WebRTC signaling is currently disabled because the backend socket server is not running. Real-time communication will not work.");

    return this.localStream;
  }
  
  public getLocalVideoTrack(): MediaStreamTrack | undefined {
    return this.localStream?.getVideoTracks()[0];
  }

  public isCameraOn(): boolean {
    const track = this.getLocalVideoTrack();
    return !!(track && track.enabled);
  }

  public async replaceTrack(newTrack: MediaStreamTrack) {
    if (!this.localStream) throw new Error("No local stream available.");
    
    try {
      const oldTrack = this.localStream.getVideoTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
      }
      this.localStream.addTrack(newTrack);
    } catch (e) {
      console.warn("[mesh] localStream update warning:", e);
    }
  }

  public async restoreCameraTrack() {
    if (!this.originalVideoTrack) {
      console.warn("[mesh] ⚠️ No originalVideoTrack stored — cannot restore camera.");
      return;
    }
    await this.replaceTrack(this.originalVideoTrack);
  }

  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) throw new Error("No local stream available.");
    const already = this.localStream.getTracks().some(t => t.id === track.id);
    if (!already) this.localStream.addTrack(track);
  }

  public async removeTrack(track: MediaStreamTrack | null) {
    if (this.localStream && track) {
        this.localStream.getTracks().forEach(t => {
            if (t.id === track.id) {
            this.localStream!.removeTrack(t);
            }
        });
    }
  }

  private cleanupRemote(socketId: string) {
    const remote = this.remotes.get(socketId);
    if (remote) {
        remote.pc.close();
        this.remotes.delete(socketId);
    }
  }

  leave() {
    this.remotes.forEach(({ pc }) => pc.close());
    this.remotes.clear();
    
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = undefined;
    this.initialized = false;
    this.socket?.disconnect();
  }
}
