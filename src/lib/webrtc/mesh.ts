
"use client";

import { io, Socket } from "socket.io-client";

type Remote = {
  pc: RTCPeerConnection;
  stream: MediaStream;
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

    // Connect to the signaling server (assuming it's running on the same host)
    // NOTE: This will fail if the socket.io server isn't running.
    this.socket = io({ path: "/api/socketio", auth: { name: this.opts.userName } });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;
    
    this.socket.on("connect", () => {
      console.log("Connected to signaling server with ID:", this.socket.id);
      this.socket.emit("join", this.roomId);
    });
    
    this.socket.on("user-joined", this.onUserJoined.bind(this));
    this.socket.on("user-left", this.onUserLeft.bind(this));
    this.socket.on("offer", this.onOffer.bind(this));
    this.socket.on("answer", this.onAnswer.bind(this));
    this.socket.on("ice-candidate", this.onIceCandidate.bind(this));
    this.socket.on("connect_error", (err) => {
        console.warn("WebRTC signaling is currently disabled because the backend socket server is not running or unreachable. Real-time communication will not work.", err.message);
    });

    return this.localStream;
  }

  private async onUserJoined(remoteSocketId: string) {
    if (remoteSocketId === this.socket.id) return;
    console.log("A new user joined, sending offer...", remoteSocketId);
    this.opts.onUserJoined?.(remoteSocketId);
    await this.createOffer(remoteSocketId);
  }

  private onUserLeft(remoteSocketId: string) {
    console.log("User left:", remoteSocketId);
    this.cleanupRemote(remoteSocketId);
    this.opts.onRemoteLeft(remoteSocketId);
  }

  private async onOffer(remoteSocketId: string, sdp: RTCSessionDescriptionInit) {
    console.log("Received offer from", remoteSocketId);
    const pc = this.createPeerConnection(remoteSocketId);
    pc.setRemoteDescription(new RTCSessionDescription(sdp))
      .then(() => pc.createAnswer())
      .then((answer) => pc.setLocalDescription(answer))
      .then(() => {
        this.socket.emit("answer", remoteSocketId, pc.localDescription);
      })
      .catch((err) => console.error("Offer processing failed", err));
  }

  private async onAnswer(remoteSocketId: string, sdp: RTCSessionDescriptionInit) {
    console.log("Received answer from", remoteSocketId);
    const remote = this.remotes.get(remoteSocketId);
    if (remote) {
      remote.pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(e => console.error("Set remote description failed", e));
    }
  }

  private async onIceCandidate(remoteSocketId: string, candidate: RTCIceCandidateInit) {
    console.log("Received ICE candidate from", remoteSocketId);
    const remote = this.remotes.get(remoteSocketId);
    if (remote) {
      remote.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Add ICE candidate failed", e));
    }
  }

  private createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    if (this.remotes.has(remoteSocketId)) {
      return this.remotes.get(remoteSocketId)!.pc;
    }
    
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const stream = new MediaStream();
    this.remotes.set(remoteSocketId, { pc, stream });
    
    // Add local tracks to the connection
    this.localStream?.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
    });

    pc.ontrack = (event) => {
        console.log("Track received from", remoteSocketId);
        event.streams[0].getTracks().forEach(track => {
            stream.addTrack(track);
        });
        this.opts.onRemoteStream(remoteSocketId, stream);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            this.socket.emit("ice-candidate", remoteSocketId, event.candidate.toJSON());
        }
    };
    
    pc.onnegotiationneeded = async () => {
      // This event can fire multiple times and is tricky to handle perfectly.
      // The primary offer is now sent directly from onUserJoined.
      // This handler can be used for re-negotiation if features like screen sharing are added later.
      console.log("Negotiation needed for:", remoteSocketId);
    };

    return pc;
  }
  
  private async createOffer(remoteSocketId: string) {
    const pc = this.createPeerConnection(remoteSocketId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("offer", remoteSocketId, pc.localDescription);
    } catch(err) {
      console.error("Create offer failed", err);
    }
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
    
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (oldTrack) {
      this.localStream.removeTrack(oldTrack);
    }
    this.localStream.addTrack(newTrack);

    // Also update all senders on existing peer connections
    this.remotes.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(newTrack).catch(e => console.error("Failed to replace track on sender:", e));
      }
    });
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

    this.remotes.forEach(({ pc }) => {
        pc.addTrack(track, this.localStream!);
    });
  }

  public async removeTrack(track: MediaStreamTrack | null) {
    if (this.localStream && track) {
        this.localStream.removeTrack(track);
        this.remotes.forEach(({ pc }) => {
            const sender = pc.getSenders().find(s => s.track?.id === track.id);
            if (sender) {
                pc.removeTrack(sender);
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
