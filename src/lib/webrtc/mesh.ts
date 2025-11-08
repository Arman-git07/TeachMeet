
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
  private ready = false;
  private pendingSignals: Array<() => void> = [];

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

  public async init(localStream: MediaStream) {
    this.localStream = localStream;
    this.ready = true;
    console.log("[mesh] init(): localStream ready, track kinds:", localStream.getTracks().map(t => t.kind));

    // Process queued incoming signals in FIFO order
    if (this.pendingSignals.length) {
      console.log(`[mesh] processing ${this.pendingSignals.length} queued signals`);
      const queued = this.pendingSignals.slice();
      this.pendingSignals = [];
      for (const fn of queued) {
        try { fn(); } catch (e) { console.error("[mesh] queued signal error", e); }
      }
    }
    
    // After init, explicitly join the room
    this.socket.emit("join-room", this.roomId, this.userId);
  }
  
  private runWhenReady(fn: () => void) {
    if (!this.ready) {
      // queue the handler to run later when init() makes us ready
      this.pendingSignals.push(fn);
      console.log("[mesh] queued incoming signal until localStream ready");
      return;
    }
    // run immediately
    try { fn(); } catch (e) { console.error("[mesh] queued-run error", e); }
  }


  private registerSocketEvents() {
    this.socket.on("connect", () => { this.socketId = this.socket.id; });

    this.socket.on("user-joined", (remoteId: string) => {
      this.runWhenReady(() => this.handleUserJoined(remoteId));
    });

    this.socket.on("offer", (remoteId: string, offer: RTCSessionDescriptionInit) => {
      this.runWhenReady(() => this.handleOffer(remoteId, offer));
    });

    this.socket.on("answer", (remoteId: string, answer: RTCSessionDescriptionInit) => {
      this.runWhenReady(() => this.handleAnswer(remoteId, answer));
    });

    this.socket.on("ice-candidate", (remoteId: string, candidate: RTCIceCandidateInit) => {
      this.runWhenReady(() => this.handleCandidate(remoteId, candidate));
    });

    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[mesh] Signaling is disabled, backend socket server is not running or unreachable.", err.message);
    });
  }

  private async handleUserJoined(remoteId: string) {
    console.log("[mesh] handling user-joined:", remoteId);
    await this.createPeerAndOffer(remoteId);
  }

  private async handleOffer(remoteId: string, offer: RTCSessionDescriptionInit) {
    if (!this.localStream) {
        console.warn("[mesh] handleOffer called but localStream missing — re-queuing");
        this.pendingSignals.push(() => this.handleOffer(remoteId, offer));
        return;
    }
    
    console.log("[mesh] handling offer from", remoteId);
    const pc = this.createPeerEntry(remoteId, false).pc;

    if (this.localStream) {
        console.log("[mesh] (offer handler) Attaching local tracks before answer:", this.localStream.getTracks().map(t => t.kind));
        this.localStream.getTracks().forEach((track) => {
            try {
                pc.addTrack(track, this.localStream!);
            } catch (e) {
                console.warn("[mesh] (offer handler) addTrack failed", e);
            }
        });
    }

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.socket.emit("answer", remoteId, answer);
    console.log("[mesh] Sent answer to", remoteId);
  }

  private async handleAnswer(remoteId: string, answer: RTCSessionDescriptionInit) {
    console.log("[mesh] handling answer from", remoteId);
    const peer = this.peers.get(remoteId);
    if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleCandidate(remoteId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(remoteId);
    if (peer && candidate) {
        try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.warn("[mesh] Error adding ICE candidate:", e);
        }
    }
  }

  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null, negotiating: false };

    pc.addEventListener("track", (ev) => {
      console.log("[mesh] ontrack from", remoteId, "event:", ev);
      if (ev.streams && ev.streams.length > 0) {
        entry.stream = ev.streams[0];
      } else {
        if (ev.track) remoteStream.addTrack(ev.track);
        entry.stream = remoteStream;
      }
      try { this.onRemoteStream(remoteId, entry.stream!); } catch (e) { console.error("onRemoteStream error", e); }
    });

    pc.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) {
        this.socket?.emit("ice-candidate", remoteId, ev.candidate);
      }
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        console.warn("[mesh] connectionstatechange -> cleaning peer", remoteId, pc.connectionState);
        this.cleanupPeer(remoteId);
        this.onRemoteLeft?.(remoteId);
      }
    });

    pc.addEventListener("negotiationneeded", async () => {
      if (entry.negotiating || !isInitiator) return;
      entry.negotiating = true;
      try {
        console.log("[mesh] negotiationneeded -> creating offer for", remoteId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket?.emit("offer", remoteId, offer);
      } catch (err) {
        console.error("[mesh] negotiationneeded error for", remoteId, err);
      } finally {
        entry.negotiating = false;
      }
    });

    if (this.localStream) {
      console.log("[mesh] Attaching local tracks to new pc for", remoteId, this.localStream.getTracks().map(t => t.kind));
      this.localStream.getTracks().forEach((track) => {
        try { pc.addTrack(track, this.localStream!); } catch (e) { console.warn("[mesh] addTrack failed", e); }
      });
    }

    this.peers.set(remoteId, entry);
    return entry;
  }

  private async createPeerAndOffer(remoteId: string) {
    if (this.peers.has(remoteId)) return;
    this.createPeerEntry(remoteId, true);
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
    try { this.localStream.addTrack(track); }
    catch (e) { console.warn("[mesh] localStream.addTrack warning", e); }

    for (const [id, entry] of this.peers.entries()) {
      try {
        entry.pc.addTrack(track, this.localStream);
      } catch (err) { console.error("[mesh] addTrack failed for", id, err); }
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
