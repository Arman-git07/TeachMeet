"use client";

import { io, Socket } from "socket.io-client";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream;
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
    
    // Attach existing tracks to any peers that might have been created while media was loading
    for (const entry of this.peers.values()) {
      this.attachLocalTracksToPeer(entry);
    }

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
      const handler = () => this._handleUserJoined(remoteId);
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
      console.log(`[Mesh] received user-left for ${remoteId}`);
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });
  }

  private async _handleOffer(fromId: string, offer: RTCSessionDescriptionInit) {
    let entry = this.peers.get(fromId);
    if (!entry) {
      entry = this.createPeerEntry(fromId, false);
      this.peers.set(fromId, entry);
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
      console.error("[mesh] Offer handling failed:", err);
    }
  }

  private async _handleUserJoined(remoteId: string) {
    if (!remoteId || remoteId === this.userId || this.peers.has(remoteId)) return;
    const entry = this.createPeerEntry(remoteId, true);
    this.peers.set(remoteId, entry);
  }

  private async _handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const entry = this.peers.get(fromId);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(answer);
    } catch (e) {
      console.error("[mesh] Answer handling failed:", e);
    }
  }

  private async _handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const entry = this.peers.get(fromId);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(candidate);
    } catch (e) {
      if (!entry.ignoreOffer) {
        console.error("[mesh] ICE handling failed:", e);
      }
    }
  }

  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    
    // FIX: Authoritative stream construction
    const remoteStream = new MediaStream();
    
    const entry: PeerEntry = { 
      pc, 
      stream: remoteStream, 
      makingOffer: false, 
      ignoreOffer: false, 
      isSettingRemoteAnswerPending: false 
    };

    pc.ontrack = (ev) => {
      console.log(`[Mesh] Track received from ${remoteId}: ${ev.track.kind}`);
      if (ev.track) {
        const existingTrack = remoteStream.getTracks().find(t => t.id === ev.track.id);
        if (!existingTrack) {
          remoteStream.addTrack(ev.track);
        }
      }
      // Notify callback so UI Tile can refresh its srcObject
      this.onRemoteStream(remoteId, remoteStream);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.socket.emit("ice-candidate", remoteId, ev.candidate);
    };

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        this.socket.emit("offer", remoteId, pc.localDescription);
      } catch (err) {
        console.error("[mesh] Negotiation failed:", err);
      } finally {
        entry.makingOffer = false;
      }
    };

    if (this.localStream) {
      this.attachLocalTracksToPeer(entry);
    }

    return entry;
  }

  private attachLocalTracksToPeer(entry: PeerEntry) {
    if (!this.localStream) return;
    
    const pc = entry.pc;
    const senders = pc.getSenders();

    this.localStream.getTracks().forEach(track => {
      const existingSender = senders.find(s => s.track?.kind === track.kind);
      
      if (!existingSender) {
        const sender = pc.addTrack(track, this.localStream!);
        if (track.kind === 'video') entry.videoSender = sender;
        else if (track.kind === 'audio') entry.audioSender = sender;
      } else {
        if (existingSender.track?.id !== track.id) {
            existingSender.replaceTrack(track).catch(e => console.error("[mesh] Track replacement failed", e));
        }
        if (track.kind === 'video') entry.videoSender = existingSender;
        else if (track.kind === 'audio') entry.audioSender = existingSender;
      }
    });
  }

  public leave() {
    this.peers.forEach(({ pc, stream }) => {
        pc.close();
        stream.getTracks().forEach(t => t.stop());
    });
    this.peers.clear();
    if (this.socket.connected) this.socket.disconnect();
    this.localStream?.getTracks().forEach(track => track.stop());
  }

  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (entry) {
      console.log(`[Mesh] authoritative cleanup for ${remoteId}`);
      entry.pc.close();
      entry.stream.getTracks().forEach(t => t.stop());
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
