
"use client";

import { io, Socket } from "socket.io-client";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  negotiating: boolean;
};

export class MeshRTC {
  private socket: Socket;
  public roomId: string;
  private userId: string;
  public localStream: MediaStream | null = null;
  private peers: Map<string, PeerEntry> = new Map();
  private iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId: string) => void;
  public socketId: string | null = null;

  // queue for incoming signals that arrive before localStream is ready
  private ready: boolean = false;
  private pendingSignals: Array<() => Promise<void>> = [];

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
    });

    this.registerSocketEvents();
    try { (window as any).__mesh = this; console.log("[mesh] exported instance to window.__mesh"); } catch {}
  }
  
  private runOrQueue(handler: () => Promise<void> | void) {
    if (!this.ready) {
      console.log("[mesh] queued incoming signal until localStream ready");
      this.pendingSignals.push(() => Promise.resolve(handler()));
      return;
    }
    try {
      const r = handler();
      if (r && typeof (r as any).then === "function") return (r as Promise<void>);
    } catch (e) {
      console.error("[mesh] runOrQueue handler error", e);
    }
  }

  public async init(localStream: MediaStream) {
    this.localStream = localStream;
    this.ready = true;
    console.log("[mesh] init(): localStream ready, tracks:", this.localStream?.getTracks().map(t => t.kind));

    if (this.pendingSignals.length > 0) {
      console.log(`[mesh] processing ${this.pendingSignals.length} queued signals`);
      const queued = [...this.pendingSignals];
      this.pendingSignals = [];
      for (const fn of queued) {
        try { await fn(); } catch (e) { console.error("[mesh] queued signal error", e); }
      }
    }
  }

  private registerSocketEvents() {
    this.socket.on("connect", () => { 
        this.socketId = this.socket.id; 
        this.socket.emit("join-room", this.roomId, this.socketId);
    });

    this.socket.on("user-joined", (remoteId: string) => {
        this.runOrQueue(async () => {
            if (!remoteId || remoteId === this.socket.id) return;
            console.log("[mesh] user-joined", remoteId);
            await this.createPeerAndOffer(remoteId);
        });
    });

    this.socket.on("offer", (remoteId: string, offer: RTCSessionDescriptionInit) => {
        this.runOrQueue(() => this.handleOffer(remoteId, offer));
    });

    this.socket.on("answer", (remoteId: string, answer: RTCSessionDescriptionInit) => {
        this.runOrQueue(async () => {
            console.log("[mesh] Received answer from:", remoteId);
            const entry = this.peers.get(remoteId);
            if (!entry) return console.warn("[mesh] answer for unknown peer", remoteId);
            try { await entry.pc.setRemoteDescription(answer); } catch (e) { console.error("[mesh] setRemoteDescription(answer) error", e); }
        });
    });

    this.socket.on("ice-candidate", (remoteId: string, candidate: RTCIceCandidateInit) => {
        this.runOrQueue(async () => {
            const entry = this.peers.get(remoteId);
            if (!entry) return;
            try { await entry.pc.addIceCandidate(candidate); } catch (e) { console.warn("[mesh] addIceCandidate failed for", remoteId, e); }
        });
    });
    
    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[mesh] Signaling is disabled, backend socket server is not running or unreachable.", err.message);
    });
  }

  private createPeerEntry(remoteId: string): PeerEntry {
    if (this.peers.has(remoteId)) return this.peers.get(remoteId)!;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null, negotiating: false };

    pc.addEventListener("track", (ev) => {
      const kinds = (ev.streams && ev.streams[0]) ? ev.streams[0].getTracks().map(t => t.kind) : (ev.track ? [ev.track.kind] : []);
      console.log("[mesh] ontrack from", remoteId, "event tracks:", kinds, "ev.streams:", (ev.streams && ev.streams.length));
      
      try {
        if (ev.streams && ev.streams.length > 0) {
          entry.stream = ev.streams[0];
        } else {
          if (ev.track) remoteStream.addTrack(ev.track);
          entry.stream = remoteStream;
        }
        try { this.onRemoteStream?.(remoteId, entry.stream); } catch (e) { console.error("[mesh] onRemoteStream callback error", e); }
      } catch (e) {
        console.error("[mesh] track handler error", e);
      }
    });

    pc.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) this.socket?.emit("ice-candidate", remoteId, ev.candidate);
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        this.cleanupPeer(remoteId);
        try { this.onRemoteLeft?.(remoteId); } catch (e) { console.error("[mesh] onRemoteLeft error", e); }
      }
    });

    pc.addEventListener("negotiationneeded", async () => {
      if (entry.negotiating) return;
      entry.negotiating = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket?.emit("offer", remoteId, offer);
        console.log("[mesh] negotiationneeded -> sent offer to", remoteId);
      } catch (err) {
        console.error("[mesh] negotiationneeded error for", remoteId, err);
      } finally {
        entry.negotiating = false;
      }
    });

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => {
          const t = typeof (track as any).clone === "function" ? (track as any).clone() : track;
          try { pc.addTrack(t, this.localStream as MediaStream); } catch (e) { console.warn("[mesh] addTrack to pc failed", e); }
        });
        console.log("[mesh] Attaching local tracks to new pc for", remoteId, this.localStream.getTracks().map(t => t.kind));
      } catch (err) {
        console.warn("[mesh] error attaching local tracks to pc:", err);
      }
    }

    this.peers.set(remoteId, entry);
    return entry;
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    console.log("[mesh] Received offer from", peerId);
    let entry = this.peers.get(peerId);
    if (!entry) entry = this.createPeerEntry(peerId);

    const pc = entry.pc;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    try {
      const hasVideoTransceiver = pc.getTransceivers().some(t => {
        return (t.sender && t.sender.track?.kind === "video") || t.receiver?.track?.kind === "video" || (t as any).mid === "video" || (t as any).kind === "video";
      });

      if (!hasVideoTransceiver) {
        pc.addTransceiver("video", { direction: "sendrecv" });
        console.log("[mesh] (offer handler) added video transceiver (sendrecv) to ensure m=video");
      }

      const hasAudioTransceiver = pc.getTransceivers().some(t => {
        return (t.sender && t.sender.track?.kind === "audio") || t.receiver?.track?.kind === "audio" || (t as any).kind === "audio";
      });
      if (!hasAudioTransceiver) {
        pc.addTransceiver("audio", { direction: "sendrecv" });
        console.log("[mesh] (offer handler) added audio transceiver (sendrecv) to ensure m=audio");
      }
    } catch (err) {
      console.warn("[mesh] (offer handler) transceiver setup failed:", err);
    }
    
    if (this.localStream) {
      try {
        const existingKinds = pc.getSenders().map(s => s.track?.kind).filter(Boolean);
        for (const track of this.localStream.getTracks()) {
          if (!existingKinds.includes(track.kind)) {
            const toAdd = (typeof (track as any).clone === "function") ? (track as any).clone() : track;
            try {
              pc.addTrack(toAdd, this.localStream);
              console.log("[mesh] (offer handler) explicitly attaching local track before answer:", track.kind);
            } catch (e) {
              console.warn("[mesh] (offer handler) addTrack failed for", track.kind, e);
            }
          } else {
             console.log("[mesh] (offer handler) sender for", track.kind, "already present");
          }
        }
      } catch (err) {
        console.warn("[mesh] (offer handler) attaching local tracks failed:", err);
      }
    } else {
      console.warn("[mesh] (offer handler) WARNING: localStream is not available when handling offer");
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket?.emit("answer", peerId, answer);
    console.log("[mesh] (offer handler) Sent answer to", peerId);
    console.log("[mesh] (offer handler) localDescription SDP contains video?:", (pc.localDescription?.sdp || "").includes("\r\nm=video"));
  }

  private async createPeerAndOffer(remoteId: string) {
    if (this.peers.has(remoteId)) return;
    const entry = this.createPeerEntry(remoteId);
    
    console.log("[mesh] createPeerAndOffer: senders before offer:", entry.pc.getSenders().map(s=> s.track ? `${s.track.kind}:${s.track.enabled}` : 'null'));

    await new Promise(r => setTimeout(r, 200));

    try {
      if (!entry.pc.localDescription || !entry.pc.localDescription.sdp) {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        console.log("[mesh] localDescription SDP contains video?:", !!(entry && entry.pc.localDescription && entry.pc.localDescription.sdp?.includes('\r\nm=video')));
        this.socket?.emit("offer", remoteId, offer);
        console.log("[mesh] createPeerAndOffer -> explicit offer sent to", remoteId);
      } else {
        console.log("[mesh] createPeerAndOffer -> negotiation already handled for", remoteId);
      }
    } catch (err) {
      console.error("[mesh] createPeerAndOffer error for", remoteId, err);
    }
  }

  public leave() {
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.socket.disconnect();
    this.localStream?.getTracks().forEach(track => track.stop());
  }

  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (entry) {
      entry.pc.close();
      this.peers.delete(remoteId);
    }
  }

  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) return;
    console.log("[mesh] addTrack called, track:", track.kind, "localStreamTrackKinds:", this.localStream?.getTracks().map(t=>t.kind));
    try { this.localStream.addTrack(track); } catch (e) { console.warn("[mesh] localStream.addTrack failed", e); }

    for (const [id, entry] of this.peers.entries()) {
      try {
        const t = typeof (track as any).clone === "function" ? (track as any).clone() : track;
        entry.pc.addTrack(t, this.localStream as MediaStream);
        try {
          const offer = await entry.pc.createOffer();
          await entry.pc.setLocalDescription(offer);
          this.socket?.emit("offer", id, offer);
          console.log("[mesh] addTrack -> renegotiation offer sent to", id);
        } catch (err) {
          console.error("[mesh] renegotiation after addTrack failed:", err);
        }
      } catch (err) {
        console.warn("[mesh] addTrack per-peer failed", id, err);
      }
    }
  }

  public async replaceTrack(newTrack: MediaStreamTrack) {
    for (const { pc } of this.peers.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
      if (sender) await sender.replaceTrack(newTrack).catch(e => console.error("Failed to replace track:", e));
    }
  }

  public async restoreCameraTrack() {
    const originalVideoTrack = this.localStream?.getVideoTracks()[0];
    if (originalVideoTrack) await this.replaceTrack(originalVideoTrack);
  }

  public getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}
