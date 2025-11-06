
"use client";

import { io, Socket } from "socket.io-client";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  negotiating: boolean;
};

type QueuedEvent = {
  type: "user-joined" | "offer" | "answer" | "ice-candidate";
  payload: any[];
};

export class MeshRTC {
  private socket: Socket;
  public roomId: string;
  private userId: string;
  public localStream: MediaStream | null = null;
  private peers: Map<string, PeerEntry> = new Map();
  private iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId:string) => void;
  public socketId: string | null = null;
  private isInitialized = false;
  private eventQueue: QueuedEvent[] = [];

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

  public async init(stream: MediaStream) {
    this.localStream = stream;
    this.isInitialized = true;
    this.processEventQueue();
    this.socket.emit("join-room", this.roomId, this.userId);
  }

  private processEventQueue() {
    console.log(`[mesh] Processing ${this.eventQueue.length} queued events.`);
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        // @ts-ignore
        this.handleSocketEvent(event.type, ...event.payload);
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
        console.log("[mesh] sent ice-candidate to", remoteId);
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
      if (entry.negotiating) return;
      entry.negotiating = true;
      try {
        console.log("[mesh] negotiationneeded -> creating offer for", remoteId);
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
      console.log("[mesh] Attaching local tracks to new pc for", remoteId, this.localStream.getTracks().map(t => t.kind));
      this.localStream.getTracks().forEach((track) => {
        const t = typeof (track as any).clone === "function" ? (track as any).clone() : track;
        try { pc.addTrack(t, this.localStream as MediaStream); console.log("[mesh] Added track to peerConnection:", t.kind, "->", remoteId); } catch (e) { console.warn("[mesh] addTrack failed", e); }
      });
    }

    this.peers.set(remoteId, entry);
    return entry;
  }
  
  private async createPeerAndOffer(remoteId: string) {
    if (this.peers.has(remoteId)) return;

    const entry = this.createPeerEntry(remoteId, true);

    await new Promise((r) => setTimeout(r, 200));

    try {
      if (!entry.pc.localDescription || !entry.pc.localDescription.sdp) {
        console.log("[mesh] createPeerAndOffer -> explicit offer to", remoteId);
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        this.socket?.emit("offer", remoteId, offer);
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
  
  private handleSocketEvent(type: QueuedEvent['type'], ...args: any[]) {
      switch(type) {
          case 'user-joined':
              this.onUserJoined(args[0]);
              break;
          case 'offer':
              this.onOffer(args[0], args[1]);
              break;
          case 'answer':
              this.onAnswer(args[0], args[1]);
              break;
          case 'ice-candidate':
              this.onIceCandidate(args[0], args[1]);
              break;
      }
  }

  private onUserJoined(remoteId: string) {
    console.log("[mesh] user-joined", remoteId);
    this.createPeerAndOffer(remoteId).catch(err => console.error("[mesh] createPeerAndOffer error", err));
  }

  private async onOffer(remoteId: string, offer: RTCSessionDescriptionInit) {
    try {
      console.log("[mesh] Received offer from", remoteId, offer.type);
      let entry = this.peers.get(remoteId);
      if (!entry) {
        entry = this.createPeerEntry(remoteId, false);
      }
      const pc = entry.pc;

      if (this.localStream) {
        console.log("[mesh] (offer handler) Attaching local tracks before answer:", this.localStream.getTracks().map(t => t.kind));
        this.localStream.getTracks().forEach((track) => {
          try {
            // @ts-ignore
            const t = typeof track.clone === "function" ? track.clone() : track;
            pc.addTrack(t, this.localStream as MediaStream);
            console.log("[mesh] (offer handler) added track to pc:", t.kind);
          } catch (e) {
            console.warn("[mesh] (offer handler) addTrack failed", e);
          }
        });
      } else {
        console.warn("[mesh] (offer handler) no localStream available when answering offer");
      }

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket?.emit("answer", remoteId, answer);
      console.log("[mesh] Sent answer to", remoteId);
    } catch (err) {
      console.error("[mesh] offer handler error", err);
    }
  }

  private async onAnswer(remoteId: string, answer: RTCSessionDescriptionInit) {
    console.log("[mesh] Received answer from:", remoteId);
    const peer = this.peers.get(remoteId);
    if (!peer) return;
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  private async onIceCandidate(remoteId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(remoteId);
    if (peer && candidate) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[mesh] Error adding ICE candidate:", e);
      }
    }
  }

  private registerSocketEvents() {
    this.socket.on("connect", () => {
      this.socketId = this.socket.id;
    });

    const events: Array<QueuedEvent['type']> = ["user-joined", "offer", "answer", "ice-candidate"];
    events.forEach(type => {
        this.socket.on(type, (...args: any[]) => {
            if (!this.isInitialized) {
                this.eventQueue.push({ type, payload: args });
                console.log(`[mesh] Queued event: ${type}`);
            } else {
                // @ts-ignore
                this.handleSocketEvent(type, ...args);
            }
        });
    });

    this.socket.on("user-left", (remoteId: string) => {
        console.log(`[mesh] User ${remoteId} left.`);
        this.cleanupPeer(remoteId);
        if (this.onRemoteLeft) {
            this.onRemoteLeft(remoteId);
        }
    });

    this.socket.on("connect_error", (err) => {
        console.warn("[mesh] Signaling is disabled, backend socket server is not running or unreachable.", err.message);
    });
  }

  private cleanupPeer(remoteId: string) {
    const peer = this.peers.get(remoteId);
    if(peer) {
        peer.pc.close();
        this.peers.delete(remoteId);
    }
  }

  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) return;
    try {
      this.localStream.addTrack(track);
    } catch (e) {
      console.warn("[mesh] localStream.addTrack warning", e);
    }

    for (const [id, entry] of this.peers.entries()) {
      try {
        // @ts-ignore
        const clone = typeof track.clone === "function" ? track.clone() : track;
        entry.pc.addTrack(clone, this.localStream);
        console.log("[mesh] added track to pc and will renegotiate ->", id, clone.kind);
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        this.socket?.emit("offer", id, offer);
      } catch (err) {
        console.error("[mesh] renegotiation after addTrack failed for", id, err);
      }
    }
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
    const originalVideoTrack = this.localStream?.getVideoTracks()[0];
    if (originalVideoTrack) {
        await this.replaceTrack(originalVideoTrack);
    }
  }
  
  public getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}
