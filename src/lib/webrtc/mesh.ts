
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
  // Keep a map of screen senders per peer connection (keyed by pc)
  private screenSenders = new WeakMap<RTCPeerConnection, RTCRtpSender[]>();


  constructor(private opts: MeshOptions) {}

  public getAllPeerConnections(): RTCPeerConnection[] {
    return Array.from(this.remotes.values()).map(r => r.pc);
  }

  public getPeerConnectionById(peerId: string): RTCPeerConnection | undefined {
    return this.remotes.get(peerId)?.pc;
  }

  async init(stream: MediaStream) {
    if (this.initialized) return;
    this.initialized = true;

    this.localStream = stream;

    this.socket = io({ path: "/api/socketio", auth: { name: this.opts.userId } });

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

  public addScreenTrackToAll(screenTrack: MediaStreamTrack, stream?: MediaStream) {
    const added: { pc: RTCPeerConnection; sender: RTCRtpSender }[] = [];
    this.getAllPeerConnections().forEach((pc) => {
      try {
        const sender = pc.addTrack(screenTrack, stream ?? new MediaStream([screenTrack]));
        const arr = this.screenSenders.get(pc) ?? [];
        arr.push(sender);
        this.screenSenders.set(pc, arr);
        added.push({ pc, sender });
      } catch (e) {
        console.warn("MeshRTC.addScreenTrackToAll: failed to add track for pc", e);
      }
    });
    return added;
  }

  public removeScreenTrackFromAll(screenTrack?: MediaStreamTrack) {
    this.getAllPeerConnections().forEach((pc) => {
      const arr = this.screenSenders.get(pc);
      if (!arr || arr.length === 0) return;
      const remaining: RTCRtpSender[] = [];
      arr.forEach((sender) => {
        try {
          const senderTrack = sender.track;
          if (!screenTrack || senderTrack === screenTrack) {
            pc.removeTrack(sender);
          } else {
            remaining.push(sender);
          }
        } catch (e) {
          console.warn("MeshRTC.removeScreenTrackFromAll: removeTrack failed", e);
        }
      });
      if (remaining.length === 0) this.screenSenders.delete(pc);
      else this.screenSenders.set(pc, remaining);
    });
  }

  public forceStopShareForPeer(peerId: string) {
    const pc = this.getPeerConnectionById(peerId);
    if (!pc) return;
    const arr = this.screenSenders.get(pc);
    if (!arr) return;
    arr.forEach((sender) => {
      try {
        pc.removeTrack(sender);
      } catch (e) {
        console.warn("MeshRTC.forceStopShareForPeer removeTrack failed", e);
      }
    });
    this.screenSenders.delete(pc);
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
