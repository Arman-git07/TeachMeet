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
    const isReinit = !!this.localStream;
    this.localStream = localStream;
    
    if (isReinit) {
        console.log("[mesh] Re-initializing tracks for existing peers...");
    } else {
        console.log("[mesh] Initializing with local stream. Count of existing peers to sync:", this.peers.size);
    }
    
    // Attach tracks to any peers that were created before the stream was ready or during re-init
    for (const entry of this.peers.values()) {
      const pc = entry.pc;
      const senders = pc.getSenders();
      
      this.localStream.getTracks().forEach(track => {
        const existingSender = senders.find(s => {
            // Find by kind if track is missing (due to replaceTrack(null))
            if (s.track) return s.track.kind === track.kind;
            // Fallback: assume the sender without a track of the other kind is our target
            // But storing explicitly in entry is better, which we do below.
            return false;
        });

        // We check our explicit trackers first
        const typedSender = track.kind === 'video' ? entry.videoSender : entry.audioSender;

        if (!typedSender && !existingSender) {
          const sender = pc.addTrack(track, this.localStream!);
          if (track.kind === 'video') entry.videoSender = sender;
          else if (track.kind === 'audio') entry.audioSender = sender;
        } else {
          // Sync tracker if it was missing but sender existed
          if (track.kind === 'video') entry.videoSender = typedSender || existingSender;
          else if (track.kind === 'audio') entry.audioSender = typedSender || existingSender;
        }
      });
    }

    if (!isReinit) {
        this._ready = true;
        while (this._pendingSignals.length) {
          const fn = this._pendingSignals.shift();
          fn?.();
        }
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
      ev.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      entry.stream = remoteStream;
      this.onRemoteStream(remoteId, entry.stream);
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
      this.localStream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, this.localStream!);
        if (track.kind === 'video') entry.videoSender = sender;
        else if (track.kind === 'audio') entry.audioSender = sender;
      });
    }

    return entry;
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

  public async replaceTrack(newTrack: MediaStreamTrack | null, kind?: 'video' | 'audio') {
    const targetKind = kind || (newTrack ? newTrack.kind as 'video' | 'audio' : null);
    if (!targetKind) return;

    for (const entry of this.peers.values()) {
      const sender = targetKind === 'video' ? entry.videoSender : entry.audioSender;
      
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (e) {
          console.error(`[mesh] replaceTrack failed for ${targetKind}:`, e);
        }
      } else if (newTrack && this.localStream) {
        try {
          const newSender = entry.pc.addTrack(newTrack, this.localStream);
          if (targetKind === 'video') entry.videoSender = newSender;
          else if (targetKind === 'audio') entry.audioSender = newSender;
        } catch (e) {
          console.error(`[mesh] addTrack fallback failed for ${targetKind}:`, e);
        }
      }
    }
  }

  public async addTrack(track: MediaStreamTrack, stream: MediaStream) {
    for (const entry of this.peers.values()) {
      const pc = entry.pc;
      const exists = pc.getSenders().some(s => s.track === track);
      if (!exists) {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video') entry.videoSender = sender;
        else if (track.kind === 'audio') entry.audioSender = sender;
      }
    }
  }

  public async removeTrack(track: MediaStreamTrack) {
    for (const entry of this.peers.values()) {
      const pc = entry.pc;
      const sender = pc.getSenders().find(s => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
        if (track.kind === 'video') entry.videoSender = undefined;
        else if (track.kind === 'audio') entry.audioSender = undefined;
      }
    }
  }

  public async renegotiateAll() {
    console.log("[mesh] Manually triggering renegotiation for all peers...");
    for (const [remoteId, entry] of this.peers.entries()) {
      if (!entry.negotiating) {
        try {
          entry.negotiating = true;
          const offer = await entry.pc.createOffer();
          await entry.pc.setLocalDescription(offer);
          this.socket.emit("offer", remoteId, offer);
        } catch (e) {
          console.error(`[mesh] Renegotiation failed for ${remoteId}:`, e);
        } finally {
          entry.negotiating = false;
        }
      }
    }
  }

  public async restoreCameraTrack() {
    const track = this.localStream?.getVideoTracks()[0];
    if (track) await this.replaceTrack(track, 'video');
  }

  public getLocalVideoTrack() {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}
