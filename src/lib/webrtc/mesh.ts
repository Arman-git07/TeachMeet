"use client";

import { io, Socket } from "socket.io-client";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  videoSender?: RTCRtpSender;
  audioSender?: RTCRtpSender;
};

export class MeshRTC {
  public socket: Socket;
  public roomId: string;
  private userId: string;
  public localStream: MediaStream | null = null;
  private peers: Map<string, PeerEntry> = new Map();
  private iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (remoteId: string) => void;
  public socketId: string | null = null;

  private _ready = false; 
  private _pendingSignals: Array<() => void> = []; 

  constructor(opts: {
    roomId: string;
    userId: string;
    onRemoteStream: (userId: string, stream: MediaStream) => void;
    onRemoteLeft?: (remoteId: string) => void;
  }) {
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.onRemoteStream = opts.onRemoteStream;
    this.onRemoteLeft = opts.onRemoteLeft;
    
    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      query: { userId: this.userId, roomId: this.roomId }
    });

    this.registerSocketEvents();
  }

  public async init(localStream: MediaStream, displayName: string, photoURL?: string) {
    this.localStream = localStream;
    this._ready = true;
    
    while (this._pendingSignals.length) {
      const fn = this._pendingSignals.shift();
      fn?.();
    }
  }

  private registerSocketEvents() {
    this.socket.on("connect", () => { 
        this.socketId = this.socket.id; 
        this.socket.emit("join-room", this.roomId, this.userId);
    });

    this.socket.on("user-joined", (remoteId: string) => {
      const handler = () => this._initiateNewPeer(remoteId);
      if (!this._ready) this._pendingSignals.push(handler);
      else handler();
    });

    this.socket.on("offer", (fromId: string, offer: RTCSessionDescriptionInit) => {
      const handler = () => this._handleOffer(fromId, offer);
      if (!this._ready) this._pendingSignals.push(handler);
      else handler();
    });

    this.socket.on("answer", (fromId: string, answer: RTCSessionDescriptionInit) => {
      const handler = () => this._handleAnswer(fromId, answer);
      if (!this._ready) this._pendingSignals.push(handler);
      else handler();
    });

    this.socket.on("ice-candidate", (fromId: string, candidate: RTCIceCandidateInit) => {
      const handler = () => this._handleIceCandidate(fromId, candidate);
      if (!this._ready) this._pendingSignals.push(handler);
      else handler();
    });
    
    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });
  }

  private async _initiateNewPeer(remoteId: string) {
    if (!remoteId || remoteId === this.userId || this.peers.has(remoteId)) return;
    
    console.log(`[Mesh] Initiating peer connection to ${remoteId}`);
    const entry = this.createPeerEntry(remoteId);
    this.peers.set(remoteId, entry);

    // 🎯 CRITICAL: Add tracks before forcing negotiation
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        const sender = entry.pc.addTrack(track, this.localStream!);
        if (track.kind === 'video') entry.videoSender = sender;
        else if (track.kind === 'audio') entry.audioSender = sender;
      });
    }

    // 🎯 CRITICAL: Forced Negotiation Logic
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      this.socket.emit("offer", remoteId, entry.pc.localDescription);
    } catch (err) {
      console.error("[Mesh] Failed to create forced offer:", err);
    } finally {
      entry.makingOffer = false;
    }
  }

  private async _handleOffer(fromId: string, offer: RTCSessionDescriptionInit) {
    let entry = this.peers.get(fromId);
    if (!entry) {
      entry = this.createPeerEntry(fromId);
      this.peers.set(fromId, entry);
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          const sender = entry!.pc.addTrack(track, this.localStream!);
          if (track.kind === 'video') entry!.videoSender = sender;
          else if (track.kind === 'audio') entry!.audioSender = sender;
        });
      }
    }
    
    const pc = entry.pc;
    const polite = this.userId > fromId;
    const offerCollision = (offer.type === "offer") && (entry.makingOffer || pc.signalingState !== "stable");

    entry.ignoreOffer = !polite && offerCollision;
    if (entry.ignoreOffer) return;

    try {
      await pc.setRemoteDescription(offer);
      if (offer.type === "offer") {
        await pc.setLocalDescription();
        this.socket.emit("answer", fromId, pc.localDescription);
      }
    } catch (err) {
      console.error("[Mesh] Offer handling failed:", err);
    }
  }

  private async _handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const entry = this.peers.get(fromId);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(answer);
    } catch (e) {
      console.error("[Mesh] Answer handling failed:", e);
    }
  }

  private async _handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const entry = this.peers.get(fromId);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(candidate);
    } catch (e) {
      if (!entry.ignoreOffer) {
        console.error("[Mesh] ICE handling failed:", e);
      }
    }
  }

  private createPeerEntry(remoteId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    
    const entry: PeerEntry = { 
      pc, 
      stream: null, 
      makingOffer: false, 
      ignoreOffer: false, 
      isSettingRemoteAnswerPending: false 
    };

    // 🎯 Simplified ontrack as requested
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        this.onRemoteStream(remoteId, stream);
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.socket.emit("ice-candidate", remoteId, ev.candidate);
    };

    pc.onnegotiationneeded = async () => {
      if (entry.makingOffer) return;
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        this.socket.emit("offer", remoteId, pc.localDescription);
      } catch (err) {
        console.error("[Mesh] Renegotiation failed:", err);
      } finally {
        entry.makingOffer = false;
      }
    };

    return entry;
  }

  public leave() {
    this.peers.forEach(({ pc }) => {
        pc.close();
    });
    this.peers.clear();
    if (this.socket.connected) this.socket.disconnect();
    this.localStream?.getTracks().forEach(track => track.stop());
  }

  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (entry) {
      entry.pc.close();
      this.peers.delete(remoteId);
    }
  }

  public async replaceTrack(newTrack: MediaStreamTrack | null, kind: 'video' | 'audio') {
    for (const entry of this.peers.values()) {
      const sender = kind === 'video' ? entry.videoSender : entry.audioSender;
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (e) {
          console.error(`[mesh] replaceTrack failed for ${kind}:`, e);
        }
      }
    }
  }

  public getLocalVideoTrack() {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}