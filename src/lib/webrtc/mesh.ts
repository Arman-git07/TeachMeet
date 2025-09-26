
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
  onRemoteStream: (remoteSocketId: string, stream: MediaStream) => void;
  onRemoteLeft: (remoteSocketId: string) => void;
  onUserJoined?: (remoteSocketId: string) => void;
};

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export class MeshRTC {
  private socket!: Socket;
  private localStream?: MediaStream;
  private remotes = new Map<string, Remote>();
  private roomId!: string;
  private userId!: string;
  private initialized = false;

  constructor(private opts: MeshOptions) {}

  async init(stream: MediaStream) {
    if (this.initialized) return;
    this.initialized = true;

    this.localStream = stream;

    // IMPORTANT: create socket once
    this.socket = io({ path: "/api/socketio" });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;

    this.registerSocketEvents();
    this.socket.emit("join-room", { roomId: this.roomId, userId: this.userId });
    
    return this.localStream;
  }

  private registerSocketEvents() {
    this.socket.on("user-joined", async ({ socketId }) => {
      this.opts.onUserJoined?.(socketId);
      // create offer to the newcomer
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
           // Allow our own offer to proceed
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
    // Keep a map of peer connections to share with screen share logic
    if (!(window as any).__PEER_CONNECTIONS__) {
      (window as any).__PEER_CONNECTIONS__ = [];
    }
    (window as any).__PEER_CONNECTIONS__.push(pc);

    const remoteStream = new MediaStream();

    remote = { pc, stream: remoteStream, negotiating: false };
    this.remotes.set(remoteSocketId, remote);

    // Forward local tracks to this peer
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    // Receive tracks
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      this.opts.onRemoteStream(remoteSocketId, remoteStream);
    };

    // ICE
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
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
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
  
  public replaceTrack(track: MediaStreamTrack) {
    this.remotes.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track).catch(e => console.error("replaceTrack failed:", e));
      }
    });
  }

  private cleanupRemote(socketId: string) {
    const remote = this.remotes.get(socketId);
    if (remote) {
        if ((window as any).__PEER_CONNECTIONS__) {
          (window as any).__PEER_CONNECTIONS__ = (window as any).__PEER_CONNECTIONS__.filter((pc: RTCPeerConnection) => pc !== remote.pc);
        }
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
    if ((window as any).__PEER_CONNECTIONS__) {
      (window as any).__PEER_CONNECTIONS__ = [];
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = undefined;
    this.initialized = false;
    this.socket?.disconnect();
  }
}
