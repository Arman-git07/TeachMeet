"use client";

import { io, Socket } from "socket.io-client";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  negotiating: boolean;
  iceCandidateQueue: RTCIceCandidateInit[];
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
  private onRemoteLeft?: (socketId: string) => void;
  public socketId: string | null = null;

  private _ready = false; 
  private _pendingSignals: Array<() => void> = []; 

  constructor(opts: {
    roomId: string;
    userId: string;
    onRemoteStream: (socketId: string, stream: MediaStream) => void;
    onRemoteLeft?: (socketId: string) => void;
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
    
    // For all existing peers, ensure they get the tracks
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
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      while (entry.iceCandidateQueue.length) {
        const cand = entry.iceCandidateQueue.shift();
        if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket?.emit("answer", fromId, answer);
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
      await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error("[mesh] Answer handling failed:", e);
    }
  }

  private async _handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const entry = this.peers.get(fromId);
    if (!entry) return;
    try {
      if (entry.pc.remoteDescription) {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        entry.iceCandidateQueue.push(candidate);
      }
    } catch (e) {
      console.error("[mesh] ICE handling failed:", e);
    }
  }

  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null, negotiating: false, iceCandidateQueue: [] };

    pc.ontrack = (ev) => {
      // Ensure we catch the track and attach it to our local remoteStream proxy
      if (ev.track) {
        remoteStream.addTrack(ev.track);
      }
      // Use provided streams or fallback to our proxy
      const streamToNotify = ev.streams[0] || remoteStream;
      entry.stream = streamToNotify;
      this.onRemoteStream(remoteId, streamToNotify);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.socket.emit("ice-candidate", remoteId, ev.candidate);
    };

    pc.onnegotiationneeded = async () => {
      if (entry.negotiating) return;
      entry.negotiating = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit("offer", remoteId, offer);
      } catch (err) {
        console.error("[mesh] Negotiation failed:", err);
      } finally {
        entry.negotiating = false;
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
      const existingSender = senders.find(s => s.track?.kind === track.kind || (s as any).kind === track.kind);
      
      if (!existingSender) {
        const sender = pc.addTrack(track, this.localStream!);
        if (track.kind === 'video') entry.videoSender = sender;
        else if (track.kind === 'audio') entry.audioSender = sender;
      } else {
        // Track references for future replaceTrack calls
        if (track.kind === 'video') entry.videoSender = existingSender;
        else if (track.kind === 'audio') entry.audioSender = existingSender;
      }
    });
  }

  public leave() {
    this.peers.forEach(({ pc }) => pc.close());
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
