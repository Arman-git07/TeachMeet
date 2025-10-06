
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
  
  // --- Robust Track Management ---

  public async replaceTrack(newTrack: MediaStreamTrack) {
    if (!this.localStream) throw new Error("No local stream available.");
  
    const oldTrack = this.localStream.getVideoTracks()[0];
    const peers = Array.from(this.remotes.entries());
  
    for (const [socketId, remote] of peers) {
      try {
        const pc: RTCPeerConnection = remote.pc;
        if (!pc) {
          console.warn(`⚠️ No RTCPeerConnection for peer ${socketId}`);
          continue;
        }
  
        const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
  
        if (sender) {
          await sender.replaceTrack(newTrack);
          console.log(`✅ Replaced track on sender for peer ${socketId}`);
        } else {
          try {
            pc.addTrack(newTrack, new MediaStream([newTrack]));
            console.log(`✅ Added new screen track to pc for peer ${socketId} (no existing sender)`);
          } catch (err) {
            console.warn(`⚠️ pc.addTrack failed for peer ${socketId}:`, err);
          }
        }
      } catch (err) {
        console.error(`❌ Error replacing/adding track for peer ${socketId}:`, err);
      }
    }
  
    try {
      if (oldTrack && oldTrack !== newTrack) {
        try { this.localStream.removeTrack(oldTrack); } catch (e) { /* ignore */ }
      }
      const already = this.localStream.getVideoTracks().some(t => t.id === newTrack.id);
      if (!already) {
        try { this.localStream.addTrack(newTrack); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn("⚠️ Failed to update localStream tracks:", e);
    }
  
    for (const [socketId, remote] of peers) {
      const pc: RTCPeerConnection | undefined = remote.pc;
      if (!pc) continue;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
  
        // The existing `onnegotiationneeded` handler is already configured to emit 'signal:offer'
        // which our server (`socket.ts`) handles. No need to emit a custom 'webrtc-offer' event.
        // The browser will fire the `negotiationneeded` event automatically.
        // Forcing it can be complex, so we rely on the standard flow.
        // If it doesn't fire, we may need a manual trigger.
        console.log(`↪ Relying on 'onnegotiationneeded' to send offer to ${socketId}`);
      } catch (err) {
        console.error(`❌ Renegotiation failed for peer ${socketId}:`, err);
      }
    }
  }

  public async restoreCameraTrack() {
    if (!this.originalVideoTrack) {
      console.warn("⚠️ No original camera track to restore.");
      return;
    }
  
    try {
      await this.replaceTrack(this.originalVideoTrack);
      console.log("✅ Camera track restored via replaceTrack()");
    } catch (err) {
      console.error("❌ Failed to restore camera track, attempting fallback re-add:", err);
      await this.addTrack(this.originalVideoTrack).catch(e => console.error("Fallback addTrack failed:", e));
    }
  }

  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) throw new Error("No local stream available.");
  
    const peers = Array.from(this.remotes.entries());
    for (const [socketId, remote] of peers) {
      try {
        const pc = remote.pc;
        if (!pc) continue;
        pc.addTrack(track, new MediaStream([track]));
        console.log(`✅ addTrack called for peer ${socketId}`);
        // Let onnegotiationneeded handle the offer
      } catch (err) {
        console.error(`❌ addTrack failed for ${socketId}:`, err);
      }
    }
  
    try {
      const already = this.localStream.getTracks().some(t => t.id === track.id);
      if (!already) this.localStream.addTrack(track);
    } catch (e) { /* ignore */ }
  }

  public async removeTrack(track: MediaStreamTrack | null) {
    const peers = Array.from(this.remotes.entries());
  
    for (const [socketId, remote] of peers) {
      try {
        const pc = remote.pc;
        if (!pc) continue;
  
        const sender = pc.getSenders().find(s => {
          if (!s) return false;
          if (track) return s.track && s.track.id === track.id;
          return s.track && s.track.kind === "video";
        });
  
        if (sender) {
          try {
            pc.removeTrack(sender);
            console.log(`✅ removeTrack called for peer ${socketId}`);
          } catch (e) {
            console.warn(`⚠️ pc.removeTrack failed for ${socketId}`, e);
          }
        } else {
          console.warn(`⚠️ No matching sender found to remove for ${socketId}`);
        }
        // Let onnegotiationneeded handle the offer
      } catch (err) {
        console.error(`❌ removeTrack failed for ${socketId}:`, err);
      }
    }
  
    if (this.localStream && track) {
      try {
        this.localStream.getTracks().forEach(t => {
          if (t.id === track.id) {
            try { this.localStream.removeTrack(t); } catch (e) {}
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
