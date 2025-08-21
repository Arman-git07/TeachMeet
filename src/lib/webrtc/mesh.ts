
"use client";

import { io, Socket } from "socket.io-client";

type Remote = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  videoEl?: HTMLVideoElement | null;
};

type MeshOptions = {
  roomId: string;
  userId: string;
  onRemoteStream: (remoteSocketId: string, stream: MediaStream) => void;
  onRemoteLeft: (remoteSocketId: string) => void;
};

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
];

export class MeshRTC {
  private socket!: Socket;
  private locals: { mic: boolean; cam: boolean; stream?: MediaStream } = { mic: true, cam: true };
  private remotes = new Map<string, Remote>();
  private roomId!: string;
  private userId!: string;
  private initialized = false;

  constructor(private opts: MeshOptions) {}

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // IMPORTANT: create socket once
    await fetch("/api/socket"); // boot API route
    this.socket = io({ path: "/api/socketio" });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;

    // Prepare local media before joining (permissions)
    await this.ensureLocalStream(true, true);

    this.registerSocketEvents();
    this.socket.emit("join-room", { roomId: this.roomId, userId: this.userId });
  }

  private registerSocketEvents() {
    this.socket.on("user-joined", async ({ socketId }) => {
      // create offer to the newcomer
      await this.makePeerIfMissing(socketId, true);
    });

    this.socket.on("user-left", ({ socketId }) => {
      this.cleanupRemote(socketId);
      this.opts.onRemoteLeft(socketId);
    });

    this.socket.on("signal:offer", async ({ from, sdp }) => {
      const { pc } = await this.makePeerIfMissing(from, false);
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

    // Forward local tracks to this peer
    this.locals.stream?.getTracks().forEach((t) => pc.addTrack(t, this.locals.stream!));

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

    // Negotiate (caller creates offer)
    if (isCaller) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      this.socket.emit("signal:offer", {
        roomId: this.roomId,
        to: remoteSocketId,
        from: this.socket.id,
        sdp: pc.localDescription,
      });
    }

    remote = { pc, stream: remoteStream };
    this.remotes.set(remoteSocketId, remote);
    return remote;
  }

  private cleanupRemote(socketId: string) {
    const remote = this.remotes.get(socketId);
    if (remote) {
        remote.pc.close();
        this.remotes.delete(socketId);
    }
  }

  private async ensureLocalStream(wantMic: boolean, wantCam: boolean) {
    const constraints: MediaStreamConstraints = {
      audio: wantMic,
      video: wantCam ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    };

    if (!this.locals.stream) {
      // first time
      this.locals.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.locals.mic = wantMic;
      this.locals.cam = wantCam;
      return this.locals.stream;
    }

    // Toggle: enable/disable existing tracks (no renegotiation required)
    this.locals.stream.getAudioTracks().forEach((t) => (t.enabled = wantMic));
    this.locals.stream.getVideoTracks().forEach((t) => (t.enabled = wantCam));
    this.locals.mic = wantMic;
    this.locals.cam = wantCam;

    // If you turned video ON and there was no video track yet, add one and replace on senders.
    if (wantCam && this.locals.stream.getVideoTracks().length === 0) {
      const cam = await navigator.mediaDevices.getUserMedia({ video: constraints.video });
      const v = cam.getVideoTracks()[0];
      this.locals.stream.addTrack(v);
      this.remotes.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(v);
        else pc.addTrack(v, this.locals.stream!);
      });
    }

    // Same for mic
    if (wantMic && this.locals.stream.getAudioTracks().length === 0) {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const a = mic.getAudioTracks()[0];
      this.locals.stream.addTrack(a);
      this.remotes.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "audio");
        if (sender) sender.replaceTrack(a);
        else pc.addTrack(a, this.locals.stream!);
      });
    }

    return this.locals.stream;
  }

  getLocalStream() {
    return this.locals.stream!;
  }

  async toggleMic(on: boolean) {
    await this.ensureLocalStream(on, this.locals.cam);
  }

  async toggleCam(on: boolean) {
    await this.ensureLocalStream(this.locals.mic, on);
  }

  leave() {
    try {
      this.socket?.emit("leave-room", { roomId: this.roomId, userId: this.userId });
    } catch {}
    this.remotes.forEach(({ pc }) => pc.close());
    this.remotes.clear();
    this.locals.stream?.getTracks().forEach((t) => t.stop());
    this.locals.stream = undefined;
    this.initialized = false;
    this.socket?.disconnect();
  }

  // Attach convenience
  attachLocal(video: HTMLVideoElement) {
    const s = this.getLocalStream();
    video.srcObject = s;
    video.muted = true; // self-view muted to avoid echo
    video.playsInline = true;
    video.autoplay = true;
  }
}
