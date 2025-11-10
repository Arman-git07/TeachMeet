
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
    if (this.pendingSignals.length > 0) {
      console.log("[mesh] init(): localStream ready, processing", this.pendingSignals.length, "queued signals");
      const queued = [...this.pendingSignals];
      this.pendingSignals = [];
      for (const fn of queued) {
        try { await fn(); } catch (e) { console.error("[mesh] queued signal processing error", e); }
      }
    } else {
      console.log("[mesh] init(): localStream ready, no queued signals");
    }
    this.socket.emit("join-room", this.roomId, this.userId);
  }

  private registerSocketEvents() {
    this.socket.on("connect", () => { this.socketId = this.socket.id; });

    this.socket.on("user-joined", (remoteId: string) => {
        this.runOrQueue(async () => {
            if (!remoteId || remoteId === this.socket?.id) return;
            console.log("[mesh] user-joined", remoteId);
            await this.createPeerAndOffer(remoteId);
        });
    });

    this.socket.on("offer", (remoteId: string, offer: RTCSessionDescriptionInit) => {
        this.runOrQueue(async () => {
            console.log("[mesh] Received offer from", remoteId);
            const entry = this.createPeerEntry(remoteId, false);

            if (this.localStream) {
                try {
                    this.localStream.getTracks().forEach(t => {
                        const clone = typeof (t as any).clone === "function" ? (t as any).clone() : t;
                        try { entry.pc.addTrack(clone, this.localStream as MediaStream); } catch (e) { console.warn("[mesh] addTrack (offer handler) failed", e); }
                    });
                    console.log("[mesh] (offer handler) Attaching local tracks before answer:", this.localStream.getTracks().map(t => t.kind));
                } catch (e) {
                    console.warn("[mesh] (offer handler) error attaching local tracks", e);
                }
            } else {
                console.warn("[mesh] (offer handler) no localStream available when answering offer");
            }

            try {
                await entry.pc.setRemoteDescription(offer);
                const answer = await entry.pc.createAnswer();
                await entry.pc.setLocalDescription(answer);
                this.socket?.emit("answer", remoteId, answer);
                console.log("[mesh] Sent answer to", remoteId);
            } catch (err) {
                console.error("[mesh] offer handler error for", remoteId, err);
            }
        });
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

  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    if (this.peers.has(remoteId)) return this.peers.get(remoteId)!;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null, negotiating: false };

    pc.addEventListener("track", (ev) => {
      try {
        if (ev.streams && ev.streams.length > 0) {
          entry.stream = ev.streams[0];
        } else {
          if (ev.track) remoteStream.addTrack(ev.track);
          entry.stream = remoteStream;
        }
        try { this.onRemoteStream?.(remoteId, entry.stream); } catch (e) { console.error("[mesh] onRemoteStream callback error", e); }
        console.log("[mesh] ontrack from", remoteId, "tracks:", entry.stream?.getTracks().map(t => t.kind));
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

  private async createPeerAndOffer(remoteId: string) {
    if (this.peers.has(remoteId)) return;
    const entry = this.createPeerEntry(remoteId, true);

    await new Promise(r => setTimeout(r, 200));

    try {
      if (!entry.pc.localDescription || !entry.pc.localDescription.sdp) {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
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
    const peer = this.peers.get(remoteId);
    if (peer) {
      peer.pc.close();
      this.peers.delete(remoteId);
    }
  }

  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) return;
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
