
// src/lib/webrtc/mesh.ts
"use client";

import { io, Socket } from "socket.io-client";

/**
 * Lightweight MeshRTC helper.
 *
 * Constructor opts:
 *  - roomId: string
 *  - userId: string
 *  - onRemoteStream: (socketId: string, stream: MediaStream) => void
 *  - onRemoteLeft: (socketId: string) => void
 *
 * Usage:
 *   const rtc = new MeshRTC({ roomId, userId, onRemoteStream, onRemoteLeft });
 *   rtc.init(localStream);
 *   // on leave: rtc.leave();
 */
type MeshOptions = {
  roomId: string;
  userId: string;
  onRemoteStream: (socketId: string, stream: MediaStream) => void;
  onRemoteLeft?: (socketId: string) => void;
  iceServers?: RTCIceServer[];
};

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  dataChannel?: RTCDataChannel | null;
};

export class MeshRTC {
  public roomId: string;
  private userId: string;
  private onRemoteStream: (socketId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId: string) => void;
  public socket: Socket | null = null;
  private peers = new Map<string, PeerEntry>();
  private localStream: MediaStream | null = null;
  private defaultIceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  private iceServers: RTCIceServer[];
  public originalVideoTrack?: MediaStreamTrack | null;
  public socketId: string | null = null;

  constructor(opts: MeshOptions) {
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.onRemoteStream = opts.onRemoteStream;
    this.onRemoteLeft = opts.onRemoteLeft;
    this.iceServers = opts.iceServers ?? this.defaultIceServers;
  }

  // Initialize socket and join the room (called once)
  private initSocketIfNeeded() {
    if (this.socket) return;

    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      this.socketId = this.socket?.id || null;
      this.socket?.emit("join", this.roomId);
    });

    this.setupSocketListeners();

    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });

    this.socket.on("connect_error", (err) => {
        console.warn("WebRTC signaling is currently disabled because the backend socket server is not running or unreachable. Real-time communication will not work.", err.message);
    });
  }
  
  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on("offer", async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      await this.handleOffer(remoteId, sdp);
    });

    this.socket.on("answer", async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      await this.handleAnswer(remoteId, sdp);
    });

    this.socket.on("ice-candidate", async (remoteId: string, candidate: RTCIceCandidateInit) => {
      await this.handleCandidate(remoteId, candidate);
    });

    this.socket.on("user-joined", async (remoteId: string) => {
      if (!remoteId || remoteId === this.socket?.id || this.peers.has(remoteId)) return;
      
      console.log(`[MeshRTC] user-joined: preparing to connect with ${remoteId}`);
      
      // Wait for localStream to be ready to avoid race conditions
      if (!this.localStream) {
        await this.waitForLocalStream();
      }

      // Delay slightly to ensure browser has time to attach media tracks before creating the offer.
      setTimeout(() => {
        console.log(`[MeshRTC] Delayed offer creation for ${remoteId}`);
        this.createPeerAndOffer(remoteId);
      }, 500); 
    });
  }

  private async waitForLocalStream(): Promise<void> {
    let tries = 0;
    while (!this.localStream && tries < 20) {
      await new Promise(res => setTimeout(res, 100));
      tries++;
    }
    if (!this.localStream) {
      console.error("[MeshRTC] Local stream was not available after waiting.");
    }
  }

  private async handleOffer(remoteId: string, sdp: RTCSessionDescriptionInit) {
    try {
      let entry = this.peers.get(remoteId);
      if (!entry) {
        entry = this.createPeerEntry(remoteId); // No longer passing isInitiator
      }
      const pc = entry.pc;

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket?.emit("answer", remoteId, pc.localDescription);
    } catch (err) {
      console.error("Failed to handle offer:", err);
    }
  }

  private async handleAnswer(remoteId: string, sdp: RTCSessionDescriptionInit) {
    try {
      const entry = this.peers.get(remoteId);
      if (!entry) return;
      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error("Failed to handle answer:", err);
    }
  }

  private async handleCandidate(remoteId: string, candidate: RTCIceCandidateInit) {
     try {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Failed to add remote ICE candidate", err);
      }
  }


  public init(localStream: MediaStream) {
    this.initSocketIfNeeded();
    this.localStream = localStream;
    console.log("[MeshRTC] Local stream initialized with tracks:", this.localStream.getTracks().map(t => t.kind));
    this.originalVideoTrack = localStream.getVideoTracks()[0];

    // Retroactively add tracks to any peers that might have been created before the stream was ready
    this.peers.forEach((entry) => {
      if (!entry) return;
      const pc = entry.pc;
      try {
        this.localStream?.getTracks().forEach(track => {
            if (!pc.getSenders().find(s => s.track === track)) {
                pc.addTrack(track, this.localStream as MediaStream);
            }
        });
      } catch (err) {
        console.warn("Failed to add local tracks to existing peer during init:", err);
      }
    });
  }

  private createPeerEntry(remoteId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    let remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null };

    pc.ontrack = (event) => {
      console.log(`[MeshRTC] ontrack from ${remoteId}. Tracks received:`, event.track.kind);
      if (event.streams && event.streams.length > 0) {
        remoteStream = event.streams[0];
      } else {
        remoteStream.addTrack(event.track);
      }
      entry.stream = remoteStream;
      
      console.log(`[MeshRTC] Calling onRemoteStream for ${remoteId} with stream ID ${remoteStream.id}. Total tracks:`, remoteStream.getTracks().length);
      try { this.onRemoteStream(remoteId, remoteStream); } catch (e) { console.error("onRemoteStream error", e); }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        console.log(`[MeshRTC] Sending ice-candidate to ${remoteId}`);
        this.socket?.emit("ice-candidate", remoteId, ev.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        this.cleanupPeer(remoteId);
        try { this.onRemoteLeft?.(remoteId); } catch(e) { console.error("onRemoteLeft error", e); }
      }
    };
  
    // *** THE CRITICAL FIX: ALWAYS ATTACH THIS HANDLER ***
    pc.onnegotiationneeded = async () => {
      try {
        console.log(`[MeshRTC] onnegotiationneeded triggered for ${remoteId}, creating offer...`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket?.emit("offer", remoteId, offer);
      } catch (err) {
        console.error(`[MeshRTC] onnegotiationneeded error for ${remoteId}:`, err);
      }
    };

    this.peers.set(remoteId, entry);
    return entry;
  }
  
  private async createPeerAndOffer(remoteId: string) {
    if (this.peers.has(remoteId)) return;

    console.log(`[MeshRTC] Creating peer connection and offering to ${remoteId}`);

    const entry = this.createPeerEntry(remoteId);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          // *** THE SECOND CRITICAL FIX: CLONE THE TRACK ***
          entry.pc.addTrack(track.clone(), this.localStream as MediaStream);
          console.log(`[MeshRTC] Attached cloned ${track.kind} track to peer ${remoteId}`);
        } catch (e) {
          console.error(`[MeshRTC] addTrack error for ${remoteId}:`, e);
        }
      });
    } else {
      console.warn("[MeshRTC] createPeerAndOffer called but localStream is still not available!");
    }
  }

  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try { entry.pc.getSenders().forEach(s => { try { s.track?.stop?.(); } catch {} }); } catch {}
    try { entry.pc.close(); } catch {}
    this.peers.delete(remoteId);
  }

  public leave() {
    this.peers.forEach((_, id) => this.cleanupPeer(id));
    if (this.socket) {
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
  }
  
  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) return;
    this.localStream.addTrack(track);
    for (const [id, entry] of this.peers.entries()) {
      // Use clone here as well for robustness
      entry.pc.addTrack(track.clone(), this.localStream);
      // Renegotiation will be handled automatically by onnegotiationneeded
    }
  }

  public async removeTrack(track: MediaStreamTrack) {
    if (!this.localStream || !track) return;
    
    // Find the original track to remove, not a clone
    const senderToStop = Array.from(this.peers.values())[0]?.pc.getSenders().find(s => s.track?.id === track.id);
    if (senderToStop?.track) {
        this.localStream.removeTrack(senderToStop.track);
    }
    
    this.peers.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.id === track.id);
        if (sender) pc.removeTrack(sender);
    });
  }
  
  public async replaceTrack(newTrack: MediaStreamTrack) {
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

export default MeshRTC;
