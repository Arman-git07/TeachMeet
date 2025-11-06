
"use client";

import { io, Socket } from "socket.io-client";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  negotiating: boolean;
};

type MeshOptions = {
  roomId: string;
  userId: string;
  onRemoteStream: (socketId: string, stream: MediaStream) => void;
  onRemoteLeft?: (socketId: string) => void;
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

  constructor(opts: MeshOptions) {
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.onRemoteStream = opts.onRemoteStream;
    this.onRemoteLeft = opts.onRemoteLeft;
    
    // Connect to the existing Socket.IO server path
    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    });

    this.registerSocketEvents();
  }

  // Create PeerEntry and RTCPeerConnection
  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // remote MediaStream that we'll fill on track events
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null, negotiating: false };

    // ontrack: assemble remote stream and notify UI
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

    // ICE candidate forwarding
    pc.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) {
        this.socket?.emit("ice-candidate", remoteId, ev.candidate);
        console.log("[mesh] sent ice-candidate to", remoteId);
      }
    });

    // connection cleanup
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        console.warn("[mesh] connectionstatechange -> cleaning peer", remoteId, pc.connectionState);
        this.cleanupPeer(remoteId);
        this.onRemoteLeft?.(remoteId);
      }
    });

    // Always attach negotiationneeded for every peer => reliable offers
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

    // If we already have a local stream, attach cloned tracks right away
    if (this.localStream) {
      try {
        console.log("[mesh] Attaching local tracks to new pc for", remoteId, this.localStream.getTracks().map(t => t.kind));
        this.localStream.getTracks().forEach((track) => {
          const t = typeof (track as any).clone === "function" ? (track as any).clone() : track;
          try { pc.addTrack(t, this.localStream as MediaStream); console.log("[mesh] Added track to peerConnection:", t.kind, "->", remoteId); } catch (e) { console.warn("[mesh] addTrack failed", e); }
        });
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

    // small breathing room to ensure browser has processed track attachments
    await new Promise((r) => setTimeout(r, 200));

    try {
      // If negotiation didn't already set localDescription, create and send offer explicitly
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

  /** Initialize local media and join the room */
  public async init(stream: MediaStream) {
    this.localStream = stream;
    this.socket.emit("join-room", this.roomId, this.userId);
  }

  /** Clean up everything */
  public leave() {
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.socket.disconnect();
    this.localStream?.getTracks().forEach(track => track.stop());
  }

  /** When a new user joins */
  private registerSocketEvents() {
    this.socket.on("connect", () => {
      this.socketId = this.socket.id;
    });
    
    this.socket?.on("user-joined", (remoteId: string) => {
      console.log("[mesh] user-joined", remoteId);
      // create peer & offer (createPeerAndOffer contains a small delay)
      this.createPeerAndOffer(remoteId).catch(err => console.error("[mesh] createPeerAndOffer error", err));
    });

    this.socket?.on("offer", async (remoteId: string, offer: RTCSessionDescriptionInit) => {
      try {
        console.log("[mesh] Received offer from", remoteId, offer.type);

        // create or reuse peer
        let entry = this.peers.get(remoteId);
        if (!entry) {
          entry = this.createPeerEntry(remoteId, false);
        }
        const pc = entry.pc;

        // IMPORTANT: Make sure local tracks are attached to answering PC before creating answer.
        if (this.localStream) {
          console.log("[mesh] (offer handler) Attaching local tracks before answer:", this.localStream.getTracks().map(t => t.kind));
          this.localStream.getTracks().forEach((track) => {
            try {
              const t = typeof (track as any).clone === "function" ? (track as any).clone() : track;
              if (!pc.getSenders().find(s => s.track === t)) {
                pc.addTrack(t, this.localStream as MediaStream);
                console.log("[mesh] (offer handler) added track to pc:", t.kind);
              }
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
    });

    this.socket.on("answer", async (remoteId: string, answer: RTCSessionDescriptionInit) => {
      console.log("[mesh] Received answer from:", remoteId);
      const peer = this.peers.get(remoteId);
      if (!peer) return;
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.socket.on("ice-candidate", async (remoteId: string, candidate: RTCIceCandidateInit) => {
      const peer = this.peers.get(remoteId);
      if (peer && candidate) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[mesh] Error adding ICE candidate:", e);
        }
      }
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
        const clone = (typeof (track as any).clone === "function") ? (track as any).clone() : track;
        entry.pc.addTrack(clone, this.localStream);
        console.log("[mesh] added track to pc and will renegotiate ->", id, clone.kind);
        // Trigger a controlled renegotiation
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
