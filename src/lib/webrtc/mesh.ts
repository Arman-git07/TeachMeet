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
  public userId: string;
  private onRemoteStream: (socketId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId: string) => void;
  public socket: Socket | null = null;
  private peers = new Map<string, PeerEntry>();
  private localStream: MediaStream | null = null;
  private defaultIceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  private iceServers: RTCIceServer[];
  private originalVideoTrack?: MediaStreamTrack | null;

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

    // Connect to the server endpoint you created (ensure path matches)
    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      // join room on connect
      this.socket?.emit("join", this.roomId);
    });

    // someone joined -> create a peer and initiate offer to them
    this.socket.on("user-joined", (remoteId: string) => {
      if (!remoteId || remoteId === this.socket?.id) return;
      // create peer and immediately offer to that user
      this.createPeerAndOffer(remoteId);
    });

    // receiving an offer from somebody (we are callee)
    this.socket.on("offer", async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      try {
        // if peer exists, reuse, else create
        let entry = this.peers.get(remoteId);
        if (!entry) {
          entry = this.createPeerEntry(remoteId, false);
        }
        const pc = entry.pc;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        // send answer back (server expects (remoteId, sdp) signature)
        this.socket?.emit("answer", remoteId, pc.localDescription);
      } catch (err) {
        console.error("Failed to handle offer:", err);
      }
    });

    // receiving an answer to our offer
    this.socket.on("answer", async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      try {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Failed to handle answer:", err);
      }
    });

    // ICE candidate forwarded from remote peer
    this.socket.on("ice-candidate", async (remoteId: string, candidate: RTCIceCandidateInit) => {
      try {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Failed to add remote ICE candidate", err);
      }
    });

    // a user left the room - clean up
    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });

    // Optional: Log connection errors
    this.socket.on("connect_error", (err) => {
        console.warn("WebRTC signaling is currently disabled because the backend socket server is not running or unreachable. Real-time communication will not work.", err.message);
    });
  }

  // Public: call with the local MediaStream
  public init(localStream: MediaStream) {
    this.initSocketIfNeeded();
    this.localStream = localStream;
    this.originalVideoTrack = localStream.getVideoTracks()[0];

    // Add local tracks to existing peers (if any)
    this.peers.forEach((entry) => {
      if (!entry) return;
      const pc = entry.pc;
      const existingSenders = pc.getSenders().filter(s => s.track && (s.track.kind === "audio" || s.track.kind === "video"));
      existingSenders.forEach(s => {
        try { pc.removeTrack(s); } catch {}
      });
      try {
        this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream as MediaStream));
      } catch (err) {
        console.warn("Failed to add local tracks to peer", err);
      }
    });
  }

  // Create PeerEntry and RTCPeerConnection
  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream as MediaStream));
      } catch (err) {
        console.warn("Error adding local tracks to PC:", err);
      }
    }

    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null };

    pc.addEventListener("track", (ev) => {
      ev.streams?.forEach(s => {
        s.getTracks().forEach(t => remoteStream.addTrack(t));
      });
      if (ev.track && !ev.streams?.length) {
        remoteStream.addTrack(ev.track);
      }
      entry.stream = remoteStream;
      this.onRemoteStream(remoteId, remoteStream);
    });

    pc.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) {
        this.socket?.emit("ice-candidate", remoteId, ev.candidate);
      }
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        this.cleanupPeer(remoteId);
        this.onRemoteLeft?.(remoteId); // Ensure callback is fired on state change
      }
    });

    this.peers.set(remoteId, entry);
    return entry;
  }

  // Create peer then create+send an offer immediately
  private async createPeerAndOffer(remoteId: string) {
    if (!this.socket || this.peers.has(remoteId)) return;
    
    const entry = this.createPeerEntry(remoteId, true);
    try {
      const pc = entry.pc;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("offer", remoteId, pc.localDescription);
    } catch (err) {
      console.error("Failed to create/send offer:", err);
      this.cleanupPeer(remoteId);
    }
  }

  // Remove and close peer
  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try {
      entry.pc.getSenders().forEach(s => {
        try { s.track?.stop?.(); } catch {}
      });
    } catch {}
    try { entry.pc.close(); } catch {}
    this.peers.delete(remoteId);
  }

  // Public leave / cleanup
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
    this.peers.forEach(({ pc }) => {
        pc.addTrack(track, this.localStream!);
    });
  }

  public async removeTrack(track: MediaStreamTrack) {
    if (!this.localStream || !track) return;
    this.localStream.removeTrack(track);
    this.peers.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track === track);
        if (sender) pc.removeTrack(sender);
    });
  }
  
  public async replaceTrack(newTrack: MediaStreamTrack) {
    this.peers.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
      if (sender) {
        sender.replaceTrack(newTrack).catch(e => console.error("Failed to replace track:", e));
      }
    });
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
