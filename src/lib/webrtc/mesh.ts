
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

  // This method now uses the same events as registerSocketEvents.
  // It ensures that subsequent offers/answers from renegotiation are handled.
  // The primary handlers are in registerSocketEvents. This is a safety measure.
  
  this.socket?.on?.("signal:offer", async (payload: any) => {
    try {
      const from = payload.from ?? payload.sender ?? payload.to;
      if (from === this.socket.id) return; // Don't process our own offers
      const remote = this.remotes.get(from);
      if (!remote) {
        console.warn("[mesh] Offer from unknown peer", from);
        return;
      }
      // The main logic is already in registerSocketEvents, we just log here.
      console.log("[mesh-renegotiate] ◀ Received subsequent OFFER from", from);
    } catch (err) {
      console.error("[mesh] Error in re-handling offer:", err);
    }
  });

  this.socket?.on?.("signal:answer", async (payload: any) => {
     try {
      const from = payload.from ?? payload.sender ?? payload.to;
      if (from === this.socket.id) return;
       const remote = this.remotes.get(from);
       if (!remote) {
        console.warn("[mesh] Answer from unknown peer", from);
        return;
      }
      // The main logic is already in registerSocketEvents, we just log here.
      console.log("[mesh-renegotiate] ◀ Received subsequent ANSWER from", from);
    } catch (err) {
      console.error("[mesh] Error in re-handling answer:", err);
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
        }
      } else {
        try {
          pc.addTrack(newTrack, new MediaStream([newTrack]));
          console.log(`[mesh] ✅ addTrack(newTrack) for ${socketId}`);
        } catch (err) {
          console.warn(`[mesh] addTrack failed for ${socketId}:`, err);
        }
      }

      // Now renegotiate: createOffer/setLocalDescription/send offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // send to peer
        this.socket?.emit?.("signal:offer", { roomId: this.roomId, to: socketId, from: this.socket?.id ?? null, sdp: offer });
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
      this.socket?.emit?.("signal:offer", { roomId: this.roomId, to: socketId, from: this.socket?.id ?? null, sdp: offer });
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
        this.socket?.emit?.("signal:offer", { roomId: this.roomId, to: socketId, from: this.socket?.id ?? null, sdp: offer });
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
