
"use client";

import { io, Socket } from "socket.io-client";

type RemotePeer = {
  pc: RTCPeerConnection;
  stream: MediaStream;
};

type MeshOptions = {
  roomId: string;
  userId: string;
  onRemoteStream: (socketId: string, stream: MediaStream) => void;
  onRemoteLeft?: (socketId: string) => void;
};


export class MeshRTC {
  private socket: Socket;
  private roomId: string;
  private userId: string;
  public localStream: MediaStream | null = null;
  private peers: Map<string, RemotePeer> = new Map();
  private iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId: string) => void;
  public originalVideoTrack?: MediaStreamTrack | null;
  public socketId: string | null = null;
  private videoTrack: MediaStreamTrack | null = null;

  constructor(opts: MeshOptions) {
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.onRemoteStream = opts.onRemoteStream;
    this.onRemoteLeft = opts.onRemoteLeft;
    
    // Connect to the existing Socket.IO server path
    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    });

    this.registerSocketEvents();
  }

  /** Initialize local media and join the room */
  public async init(stream: MediaStream) {
    this.localStream = stream;
    this.originalVideoTrack = this.localStream.getVideoTracks()[0] || null;
    this.videoTrack = this.originalVideoTrack;
    
    this.socket.emit("join", this.roomId);
    
    // Since init is called after connection, we might need to create offers to existing users
    this.socket.on("room-users", (users: string[]) => {
        users.forEach(remoteId => {
            if (remoteId !== this.socket.id) {
                const pc = this.createPeerConnection(remoteId);
                this.addLocalTracks(pc);
            }
        });
    });
  }

  /** Clean up everything */
  public leave() {
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.socket.disconnect();
    this.localStream?.getTracks().forEach(track => track.stop());
  }

  /** When a new user joins */
  private registerSocketEvents() {
    this.socket.on("connect", () => {
      this.socketId = this.socket.id;
    });
    
    this.socket.on("user-joined", async (remoteId: string) => {
      if (remoteId === this.socketId) return;
      console.log(`[MeshRTC] User ${remoteId} joined, creating offer.`);
      const pc = this.createPeerConnection(remoteId);
      this.addLocalTracks(pc);
      // Let negotiationneeded handle the offer creation
    });

    this.socket.on("offer", async (remoteId: string, offer: RTCSessionDescriptionInit) => {
      console.log(`[MeshRTC] Received offer from ${remoteId}.`);
      const pc = this.createPeerConnection(remoteId);
      this.addLocalTracks(pc); // ✅ CRITICAL FIX — attach own tracks before answering
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit("answer", remoteId, pc.localDescription);
    });

    this.socket.on("answer", async (remoteId: string, answer: RTCSessionDescriptionInit) => {
      console.log(`[MeshRTC] Received answer from ${remoteId}.`);
      const peer = this.peers.get(remoteId);
      if (!peer) return;
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.socket.on("ice-candidate", async (remoteId: string, candidate: RTCIceCandidateInit) => {
      const peer = this.peers.get(remoteId);
      if (!peer || !candidate) return;
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    this.socket.on("user-left", (remoteId: string) => {
      console.log(`[MeshRTC] User ${remoteId} left.`);
      const peer = this.peers.get(remoteId);
      if (peer) {
        peer.pc.close();
        this.peers.delete(remoteId);
      }
      if (this.onRemoteLeft) {
        this.onRemoteLeft(remoteId);
      }
    });

    this.socket.on("connect_error", (err) => {
        console.warn("WebRTC signaling is currently disabled because the backend socket server is not running or unreachable. Real-time communication will not work.", err.message);
    });
  }

  /** Create new peer connection */
  private createPeerConnection(remoteId: string): RTCPeerConnection {
    // If peer already exists, return it
    if(this.peers.has(remoteId)) {
        return this.peers.get(remoteId)!.pc;
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.onicecandidate = (e) => {
      if (e.candidate) this.socket.emit("ice-candidate", remoteId, e.candidate);
    };

    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      this.onRemoteStream(remoteId, remoteStream);
    };
    
    pc.onnegotiationneeded = async () => {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.socket.emit("offer", remoteId, pc.localDescription);
        } catch(err) {
            console.error("onnegotiationneeded error:", err);
        }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.peers.delete(remoteId);
        if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
      }
    };

    this.peers.set(remoteId, { pc, stream: remoteStream });
    return pc;
  }

  /** Attach all local tracks (video/audio) to peer connection */
  private addLocalTracks(pc: RTCPeerConnection) {
    if (!this.localStream) return;
    this.localStream.getTracks().forEach((track) => {
      // Use track.clone() for robustness across browsers
      const senderExists = pc.getSenders().some((s) => s.track && s.track.id === track.id);
      if (!senderExists) {
          pc.addTrack(track.clone(), this.localStream!);
      }
    });
  }

  public async replaceTrack(newTrack: MediaStreamTrack) {
    this.videoTrack = newTrack;
    for (const { pc } of this.peers.values()) {
        const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
        if (sender) {
            await sender.replaceTrack(newTrack).catch(e => console.error("Failed to replace track:", e));
        }
    }
  }

  public async restoreCameraTrack() {
    if (this.originalVideoTrack) {
        await this.replaceTrack(this.originalVideoTrack);
    }
  }
  
  public getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}
