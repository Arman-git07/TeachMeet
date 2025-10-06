
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

    this.socket = io({ path: "/api/socketio", auth: { name: this.opts.userName } });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;

    this.registerSocketEvents();
    this.socket.emit("join-room", { roomId: this.roomId, userId: this.userId });
    
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
  
/* --- Robust track replace/add/remove + signaling helpers --- */
/* Paste inside your MeshRTC class. Assumes:
   - this.socket is your signaling socket
   - this.remotes is Map<socketId, { pc: RTCPeerConnection, ... }>
   - this.localStream is MediaStream for local preview
   - this.originalVideoTrack is where you saved the original camera track earlier (optional)
*/

private _setupSignalingBound = false;

private setupSignalingHandlers() {
  if (this._setupSignalingBound) return;
  this._setupSignalingBound = true;

  // Incoming offer -> setRemoteDescription -> createAnswer -> send answer
  this.socket?.on?.("webrtc-offer", async (payload: any) => {
    try {
      const from = payload.from ?? payload.sender ?? payload.to; // try common keys
      const sdp: RTCSessionDescriptionInit = payload.sdp ?? payload.offer;
      console.log("[mesh] ◀ Received OFFER from", from, "sdp-type:", sdp?.type);

      // Ensure a remote entry / pc exists for this peer
      if (!this.remotes.has(from)) {
        console.warn("[mesh] No remote entry for", from, " — ensure you create it before signaling.");
        // Optionally create remote here if your app supports dynamic creation:
        // this.createPeerFor(from);
      }
      const remote = this.remotes.get(from);
      if (!remote || !remote.pc) {
        console.error("[mesh] No RTCPeerConnection for", from);
        return;
      }
      const pc: RTCPeerConnection = remote.pc;

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[mesh] setRemoteDescription OK for", from);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[mesh] created + setLocalDescription (answer) for", from);

      // Reply with answer
      this.socket.emit?.("webrtc-answer", { to: from, from: this.socket.id ?? null, sdp: answer });
      console.log("[mesh] → Sent ANSWER to", from);
    } catch (err) {
      console.error("[mesh] Error handling incoming offer:", err);
    }
  });

  // Incoming answer -> setRemoteDescription
  this.socket?.on?.("webrtc-answer", async (payload: any) => {
    try {
      const from = payload.from ?? payload.sender ?? payload.to;
      const sdp: RTCSessionDescriptionInit = payload.sdp ?? payload.answer;
      console.log("[mesh] ◀ Received ANSWER from", from, "sdp-type:", sdp?.type);

      const remote = this.remotes.get(from);
      if (!remote || !remote.pc) {
        console.warn("[mesh] No remote pc to apply answer for", from);
        return;
      }
      await remote.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[mesh] setRemoteDescription(answer) OK for", from);
    } catch (err) {
      console.error("[mesh] Error handling incoming answer:", err);
    }
  });

  // ICE candidate passing (if you use it)
  this.socket?.on?.("webrtc-ice-candidate", async (payload: any) => {
    try {
      const from = payload.from;
      const candidate = payload.candidate;
      if (!from || !candidate) return;
      const remote = this.remotes.get(from);
      if (!remote || !remote.pc) {
        console.warn("[mesh] ICE candidate arrived for unknown peer", from);
        return;
      }
      await remote.pc.addIceCandidate(candidate).catch(e => console.warn("addIceCandidate failed:", e));
      console.log("[mesh] addIceCandidate for", from);
    } catch (err) {
      console.error("[mesh] error adding ice candidate:", err);
    }
  });
}

/**
 * replaceTrack(newTrack)
 * - Replaces video track for every peer if sender exists
 * - Adds a new track (pc.addTrack or addTransceiver) if no sender
 * - Creates an offer and sends it to the peer so remote receives the new track
 */
public async replaceTrack(newTrack: MediaStreamTrack) {
  // Ensure signaling handlers are bound
  this.setupSignalingHandlers();

  if (!this.localStream) throw new Error("No local stream available.");

  console.log("[mesh] replaceTrack() called. newTrack.id=", newTrack?.id);

  const peers = Array.from(this.remotes.entries());

  for (const [socketId, remote] of peers) {
    try {
      const pc: RTCPeerConnection = remote.pc;
      if (!pc) {
        console.warn("[mesh] skip replace for", socketId, "(no pc)");
        continue;
      }

      // Find existing video sender
      let sender = pc.getSenders().find(s => s.track && s.track.kind === "video");

      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
          console.log(`[mesh] ✅ Replaced sender.track for peer ${socketId}`);
        } catch (err) {
          console.warn(`[mesh] sender.replaceTrack failed for ${socketId}:`, err);
          // Fallback: try to remove/add
          try {
            pc.removeTrack(sender);
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`[mesh] fallback: removed old sender & added newTrack for ${socketId}`);
          } catch (e) {
            console.error(`[mesh] fallback addTrack failed for ${socketId}:`, e);
          }
        }
      } else {
        // No sender — create a transceiver or addTrack and renegotiate
        try {
          // Prefer transceiver for consistent behavior
          const trans = pc.addTransceiver("video", { direction: "sendrecv" });
          if (trans && trans.sender) {
            await trans.sender.replaceTrack(newTrack);
            console.log(`[mesh] ✅ Created transceiver and attached newTrack for ${socketId}`);
          } else {
            // Fallback
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`[mesh] ✅ addTrack(newTrack) for ${socketId}`);
          }
        } catch (err) {
          console.warn(`[mesh] addTransceiver/addTrack failed for ${socketId}:`, err);
          try {
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`[mesh] fallback addTrack succeeded for ${socketId}`);
          } catch (e) {
            console.error(`[mesh] fallback addTrack totally failed for ${socketId}:`, e);
          }
        }
      }

      // Now renegotiate: createOffer/setLocalDescription/send offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // send to peer
        this.socket?.emit?.("webrtc-offer", { to: socketId, from: this.socket?.id ?? null, sdp: offer });
        console.log(`[mesh] ↪ Sent OFFER to ${socketId}`);
      } catch (err) {
        console.error(`[mesh] ❌ Failed to create/send offer to ${socketId}:`, err);
      }
    } catch (err) {
      console.error(`[mesh] Unexpected error replacing track for ${socketId}:`, err);
    }
  }

  // Update localStream preview: remove old video track and add new one if needed
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
 * - Adds track to each pc and renegotiates
 */
public async addTrack(track: MediaStreamTrack) {
  this.setupSignalingHandlers();
  if (!this.localStream) throw new Error("No local stream available.");
  const peers = Array.from(this.remotes.entries());
  for (const [socketId, remote] of peers) {
    const pc = remote.pc;
    if (!pc) continue;
    try {
      pc.addTrack(track, new MediaStream([track]));
      console.log(`[mesh] addTrack called for ${socketId}`);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket?.emit?.("webrtc-offer", { to: socketId, from: this.socket?.id ?? null, sdp: offer });
      console.log(`[mesh] ↪ Sent OFFER to ${socketId} after addTrack`);
    } catch (err) {
      console.error(`[mesh] addTrack/offer failed for ${socketId}:`, err);
    }
  }
  // localStream
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
    const pc = remote.pc;
    if (!pc) continue;
    try {
      const sender = pc.getSenders().find(s => {
        if (!s || !s.track) return false;
        if (track) return s.track.id === track.id;
        return s.track.kind === "video";
      });
      if (sender) {
        try {
          pc.removeTrack(sender);
          console.log(`[mesh] removeTrack called for ${socketId}`);
        } catch (e) {
          console.warn(`[mesh] pc.removeTrack failed for ${socketId}:`, e);
        }
      } else {
        console.warn(`[mesh] No sender to remove for ${socketId}`);
      }
      // renegotiate
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket?.emit?.("webrtc-offer", { to: socketId, from: this.socket?.id ?? null, sdp: offer });
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
