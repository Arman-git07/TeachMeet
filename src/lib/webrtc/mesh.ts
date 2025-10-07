
"use client";

import { io, Socket } from "socket.io-client";

type Remote = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  negotiating: boolean; // Add this flag
};

type MeshOptions = {
  roomId: string;
  userId: string;
  userName: string; // Add userName
  onRemoteStream: (remoteSocketId: string, stream: MediaStream) => void;
  onRemoteLeft: (remoteSocketId: string) => void;
  onUserJoined?: (remoteSocketId: string) => void;
};

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export class MeshRTC {
  public socket!: Socket;
  private localStream?: MediaStream;
  private originalVideoTrack?: MediaStreamTrack;
  private remotes = new Map<string, Remote>();
  public roomId!: string;
  private userId!: string;
  private initialized = false;

  constructor(private opts: MeshOptions) {}

  async init(stream: MediaStream) {
    if (this.initialized) return;
    this.initialized = true;

    this.localStream = stream;
    this.originalVideoTrack = stream.getVideoTracks()[0];

    // Connect to a non-existent server to prevent errors, as the backend is disabled.
    this.socket = io("http://localhost:9999", { path: "/api/socketio", autoConnect: false, auth: { name: this.opts.userName } });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;

    // Do not register events or join rooms as the server is not available.
    // this.registerSocketEvents();
    // this.socket.emit("join-room", { roomId: this.roomId, userId: this.userId });
    
    console.warn("WebRTC signaling is currently disabled because the backend socket server is not running. Real-time communication will not work.");

    return this.localStream;
  }

  private registerSocketEvents() {
    this.socket.on("user-joined", async ({ socketId }) => {
      this.opts.onUserJoined?.(socketId);
      await this.makePeerIfMissing(socketId, true);
    });

    this.socket.on("user-left", ({ socketId }) => {
      this.cleanupRemote(socketId);
      this.opts.onRemoteLeft(socketId);
    });

    this.socket.on("signal:offer", async ({ from, sdp }) => {
      const remote = await this.makePeerIfMissing(from, false);
      const { pc, negotiating } = remote;

      const isPolite = this.socket.id > from;
      if (negotiating || pc.signalingState !== "stable") {
        if (isPolite) {
           console.log("Backing off as polite peer", this.socket.id, "vs", from);
           return;
        } else {
           console.log("Ignoring offer as impolite peer", this.socket.id, "vs", from);
           return;
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit("signal:answer", {
        roomId: this.roomId,
        to: from,
        from: this.socket.id,
        sdp: pc.localDescription,
      });
    });

    this.socket.on("signal:answer", async ({ from, sdp }) => {
      const remote = this.remotes.get(from);
      if (!remote) return;
      await remote.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    this.socket.on("signal:ice", async ({ from, candidate }) => {
      const remote = this.remotes.get(from);
      if (!remote || !candidate) return;
      try {
        await remote.pc.addIceCandidate(candidate);
      } catch {}
    });
  }

  private async makePeerIfMissing(remoteSocketId: string, isCaller: boolean) {
    let remote = this.remotes.get(remoteSocketId);
    if (remote) return remote;

    const pc = new RTCPeerConnection({ iceServers: ICE });
    
    const remoteStream = new MediaStream();

    remote = { pc, stream: remoteStream, negotiating: false };
    this.remotes.set(remoteSocketId, remote);

    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      this.opts.onRemoteStream(remoteSocketId, remoteStream);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit("signal:ice", {
          roomId: this.roomId,
          to: remoteSocketId,
          from: this.socket.id,
          candidate: e.candidate,
        });
      }
    };
    
    pc.onnegotiationneeded = async () => {
        try {
            remote!.negotiating = true;
            const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
            if (pc.signalingState !== "stable") return;
            await pc.setLocalDescription(offer);
            this.socket.emit("signal:offer", {
                roomId: this.roomId,
                to: remoteSocketId,
                from: this.socket.id,
                sdp: pc.localDescription,
            });
        } catch (err) {
            console.error(err);
        } finally {
            remote!.negotiating = false;
        }
    };

    return remote;
  }
  
  public getLocalVideoTrack(): MediaStreamTrack | undefined {
    return this.localStream?.getVideoTracks()[0];
  }

  public isCameraOn(): boolean {
    const track = this.getLocalVideoTrack();
    return !!(track && track.enabled);
  }

/* ======= begin paste into MeshRTC class (src/lib/webrtc/mesh.ts) ======= */

/**
 * Dual-emit helpers: emit both new and legacy event names so whichever server you run will forward it.
 */
private emitOfferToPeer(to: string, payload: { sdp: RTCSessionDescriptionInit }) {
  try {
    this.socket?.emit?.("webrtc-offer", { to, from: this.socket?.id ?? null, sdp: payload.sdp });
  } catch (e) {
    console.warn("emit webrtc-offer failed:", e);
  }
  try {
    // legacy server expects signal:offer
    this.socket?.emit?.("signal:offer", { to, from: this.socket?.id ?? null, sdp: payload.sdp, roomId: this.roomId });
  } catch (e) {
    console.warn("emit signal:offer failed:", e);
  }
}

private emitAnswerToPeer(to: string, payload: { sdp: RTCSessionDescriptionInit }) {
  try {
    this.socket?.emit?.("webrtc-answer", { to, from: this.socket?.id ?? null, sdp: payload.sdp });
  } catch (e) {
    console.warn("emit webrtc-answer failed:", e);
  }
  try {
    this.socket?.emit?.("signal:answer", { to, from: this.socket?.id ?? null, sdp: payload.sdp, roomId: this.roomId });
  } catch (e) {
    console.warn("emit signal:answer failed:", e);
  }
}

/**
 * Robust signaling handlers (listen for both new and legacy events).
 * Call this once during MeshRTC initialization or before doing offers.
 */
private _setupSignalingBound = false;
private setupSignalingHandlers() {
  if (this._setupSignalingBound) return;
  this._setupSignalingBound = true;

  // Helper to handle an incoming offer payload (normalizes different shapes)
  const handleIncomingOffer = async (payload: any, eventName: string) => {
    try {
      const from = payload.from ?? payload.sender ?? payload.to ?? payload.socketId;
      const sdp: RTCSessionDescriptionInit = payload.sdp ?? payload.offer;
      console.log(`[mesh] ◀ Received OFFER (${eventName}) from`, from, " type:", sdp?.type);

      if (!from || !sdp) {
        console.warn("[mesh] malformed offer payload:", payload);
        return;
      }

      // If remote PC not created yet, warn — ideally you create peer ahead of time (makePeerIfMissing)
      if (!this.remotes.has(from)) {
        console.warn("[mesh] Offer from unknown peer — make sure a remote/pc is created for", from);
        // Optionally create the peer here if your app supports it:
        // await this.makePeerIfMissing(from, false);
      }
      const remote = this.remotes.get(from);
      if (!remote || !remote.pc) {
        console.error("[mesh] No pc available for", from);
        return;
      }
      const pc: RTCPeerConnection = remote.pc;

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[mesh] setRemoteDescription OK for", from);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[mesh] created answer & setLocalDescription for", from);

      // reply using dual emit
      this.emitAnswerToPeer(from, { sdp: answer });
      console.log("[mesh] → Sent ANSWER to", from);
    } catch (err) {
      console.error("[mesh] Error handling incoming offer:", err);
    }
  };

  // Helper to handle incoming answer (normalize payload)
  const handleIncomingAnswer = async (payload: any, eventName: string) => {
    try {
      const from = payload.from ?? payload.sender ?? payload.to ?? payload.socketId;
      const sdp: RTCSessionDescriptionInit = payload.sdp ?? payload.answer;
      console.log(`[mesh] ◀ Received ANSWER (${eventName}) from`, from, " type:", sdp?.type);

      if (!from || !sdp) {
        console.warn("[mesh] malformed answer payload:", payload);
        return;
      }

      const remote = this.remotes.get(from);
      if (!remote || !remote.pc) {
        console.warn("[mesh] No pc available to apply answer for", from);
        return;
      }
      await remote.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[mesh] setRemoteDescription(answer) OK for", from);
    } catch (err) {
      console.error("[mesh] Error handling incoming answer:", err);
    }
  };

  // Register both new and legacy event names
  this.socket?.on?.("webrtc-offer", (p: any) => void handleIncomingOffer(p, "webrtc-offer"));
  this.socket?.on?.("signal:offer", (p: any) => void handleIncomingOffer(p, "signal:offer"));
  this.socket?.on?.("webrtc-answer", (p: any) => void handleIncomingAnswer(p, "webrtc-answer"));
  this.socket?.on?.("signal:answer", (p: any) => void handleIncomingAnswer(p, "signal:answer"));

  // ICE candidates: accept both shapes
  this.socket?.on?.("webrtc-ice", async (payload: any) => {
    try {
      const from = payload.from ?? payload.sender ?? payload.to;
      const candidate = payload.candidate;
      const remote = this.remotes.get(from);
      if (remote?.pc && candidate) {
        await remote.pc.addIceCandidate(candidate).catch(e => console.warn("addIceCandidate failed:", e));
        console.log("[mesh] addIceCandidate from", from);
      }
    } catch (e) { console.error("[mesh] webrtc-ice handler error:", e); }
  });
  this.socket?.on?.("signal:ice", async (payload: any) => {
    try {
      const from = payload.from;
      const candidate = payload.candidate;
      const remote = this.remotes.get(from);
      if (remote?.pc && candidate) {
        await remote.pc.addIceCandidate(candidate).catch(e => console.warn("addIceCandidate failed:", e));
        console.log("[mesh] addIceCandidate (signal) from", from);
      }
    } catch (e) { console.error("[mesh] signal:ice handler error:", e); }
  });
}

/**
 * replaceTrack(newTrack)
 * - Replace track on each peer's sender if exists
 * - If no sender, create transceiver/addTrack then renegotiate
 * - Always send offers (dual event names) so peers get notified
 */
public async replaceTrack(newTrack: MediaStreamTrack) {
  this.setupSignalingHandlers(); // ensure handlers bound
  if (!this.localStream) throw new Error("No local stream available.");
  console.log("[mesh] replaceTrack() newTrack.id=", newTrack?.id);

  const peers = Array.from(this.remotes.entries());
  for (const [socketId, remote] of peers) {
    try {
      const pc: RTCPeerConnection | undefined = remote?.pc;
      if (!pc) {
        console.warn("[mesh] skip replace for", socketId, "(no pc)");
        continue;
      }

      // find existing video sender
      let sender = pc.getSenders().find(s => s.track && s.track.kind === "video");

      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
          console.log(`[mesh] ✅ sender.replaceTrack succeeded for ${socketId}`);
        } catch (err) {
          console.warn(`[mesh] sender.replaceTrack failed for ${socketId}:`, err);
          // fallback remove/add
          try {
            pc.removeTrack(sender);
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`[mesh] fallback remove/addTrack done for ${socketId}`);
          } catch (e) {
            console.error(`[mesh] fallback addTrack failed for ${socketId}:`, e);
          }
        }
      } else {
        // no sender: try transceiver, then addTrack fallback
        try {
          const trans = pc.addTransceiver("video", { direction: "sendrecv" });
          if (trans?.sender) {
            await trans.sender.replaceTrack(newTrack);
            console.log(`[mesh] ✅ Created transceiver and attached track for ${socketId}`);
          } else {
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`[mesh] ✅ addTrack(newTrack) for ${socketId}`);
          }
        } catch (err) {
          console.warn(`[mesh] addTransceiver/addTrack attempt failed for ${socketId}:`, err);
          try {
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`[mesh] fallback addTrack succeeded for ${socketId}`);
          } catch (e) {
            console.error(`[mesh] fallback addTrack totally failed for ${socketId}:`, e);
          }
        }
      }

      // Renegotiate for this peer: createOffer, setLocalDescription, emit dual event
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.emitOfferToPeer(socketId, { sdp: offer });
        console.log(`[mesh] ↪ Sent OFFER to ${socketId}`);
      } catch (err) {
        console.error(`[mesh] ❌ Failed to create/send offer to ${socketId}:`, err);
      }
    } catch (err) {
      console.error(`[mesh] Unexpected error replacing track for ${socketId}:`, err);
    }
  }

  // Update localStream preview: remove old video track and add the new one if needed
  try {
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (oldTrack && oldTrack.id !== newTrack.id) {
      try { this.localStream.removeTrack(oldTrack); } catch (e) { /* ignore */ }
    }
    const already = this.localStream.getVideoTracks().some(t => t.id === newTrack.id);
    if (!already) {
      try { this.localStream.addTrack(newTrack); } catch (e) { /* ignore */ }
    }
    console.log("[mesh] localStream updated with new track");
  } catch (e) {
    console.warn("[mesh] localStream update warning:", e);
  }
}

/**
 * restoreCameraTrack()
 */
public async restoreCameraTrack() {
  if (!this.originalVideoTrack) {
    console.warn("[mesh] ⚠️ No originalVideoTrack stored — cannot restore camera.");
    return;
  }
  console.log("[mesh] restoreCameraTrack called");
  try {
    await this.replaceTrack(this.originalVideoTrack);
    console.log("[mesh] ✅ restoreCameraTrack completed");
  } catch (err) {
    console.error("[mesh] restoreCameraTrack failed:", err);
    // fallback: addTrack original
    try { await this.addTrack(this.originalVideoTrack); } catch (e) { console.error("[mesh] fallback addTrack failed:", e); }
  }
}

/**
 * addTrack(track)
 */
public async addTrack(track: MediaStreamTrack) {
  this.setupSignalingHandlers();
  if (!this.localStream) throw new Error("No local stream available.");

  const peers = Array.from(this.remotes.entries());
  for (const [socketId, remote] of peers) {
    try {
      const pc = remote.pc;
      if (!pc) continue;
      pc.addTrack(track, new MediaStream([track]));
      console.log(`[mesh] addTrack called for ${socketId}`);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.emitOfferToPeer(socketId, { sdp: offer });
      console.log(`[mesh] ↪ Sent OFFER to ${socketId} after addTrack`);
    } catch (err) {
      console.error(`[mesh] addTrack/offer failed for ${socketId}:`, err);
    }
  }

  // localStream add
  try {
    const already = this.localStream.getTracks().some(t => t.id === track.id);
    if (!already) this.localStream.addTrack(track);
  } catch (e) { /* ignore */ }
}

/**
 * removeTrack(track)
 */
public async removeTrack(track: MediaStreamTrack | null) {
  this.setupSignalingHandlers();
  const peers = Array.from(this.remotes.entries());
  for (const [socketId, remote] of peers) {
    try {
      const pc = remote.pc;
      if (!pc) continue;

      const sender = pc.getSenders().find(s => {
        if (!s?.track) return false;
        if (track) return s.track.id === track.id;
        return s.track.kind === "video";
      });

      if (sender) {
        try {
          pc.removeTrack(sender);
          console.log(`[mesh] removeTrack called for ${socketId}`);
        } catch (e) {
          console.warn(`[mesh] pc.removeTrack failed for ${socketId}`, e);
        }
      } else {
        console.warn(`[mesh] No matching sender found to remove for ${socketId}`);
      }

      // renegotiate
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.emitOfferToPeer(socketId, { sdp: offer });
        console.log(`[mesh] ↪ Sent OFFER to ${socketId} after removeTrack`);
      } catch (e) {
        console.error(`[mesh] renegotiate after removeTrack failed for ${socketId}:`, e);
      }
    } catch (err) {
      console.error(`[mesh] removeTrack loop error for ${socketId}:`, err);
    }
  }

  // remove from localStream
  if (this.localStream && track) {
    try {
      this.localStream.getTracks().forEach(t => {
        if (t.id === track.id) {
          try { this.localStream.removeTrack(t); } catch (e) { }
        }
      });
    } catch (e) { /* ignore */ }
  }
}

/* ======= end paste ======= */


  private cleanupRemote(socketId: string) {
    const remote = this.remotes.get(socketId);
    if (remote) {
        remote.pc.close();
        this.remotes.delete(socketId);
    }
  }

  leave() {
    try {
      this.socket?.emit("leave-room", { roomId: this.roomId, userId: this.userId });
    } catch {}
    this.remotes.forEach(({ pc }) => pc.close());
    this.remotes.clear();
    
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = undefined;
    this.initialized = false;
    this.socket?.disconnect();
  }
}
