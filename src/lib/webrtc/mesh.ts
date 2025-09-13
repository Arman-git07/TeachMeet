
"use client";

import { io, Socket } from "socket.io-client";

type Remote = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  videoEl?: HTMLVideoElement | null;
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
  private locals: { mic: boolean; cam: boolean; stream?: MediaStream } = { mic: true, cam: true };
  private remotes = new Map<string, Remote>();
  private roomId!: string;
  private userId!: string;
  private initialized = false;

  constructor(private opts: MeshOptions) {}

  async init(initialMicOn: boolean, initialCamOn: boolean) {
    if (this.initialized) return;
    this.initialized = true;

    this.locals.mic = initialMicOn;
    this.locals.cam = initialCamOn;

    // IMPORTANT: create socket once
    await fetch("/api/socket"); // boot API route
    this.socket = io({ path: "/api/socketio" });

    this.roomId = this.opts.roomId;
    this.userId = this.opts.userId;

    // Prepare local media before joining (permissions)
    await this.ensureLocalStream(this.locals.mic, this.locals.cam);

    this.registerSocketEvents();
    this.socket.emit("join-room", { roomId: this.roomId, userId: this.userId });
    
    return this.locals.stream;
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
      const { pc, negotiating } = await this.makePeerIfMissing(from, false);

      const isPolite = this.socket.id > from;
      if (negotiating || pc.signalingState !== "stable") {
        if (isPolite) {
           console.log("Backing off as polite peer", this.socket.id, "vs", from);
           return;
        } else {
           console.log("Ignoring offer as impolite peer", this.socket.id, "vs", from);
           // Allow our own offer to proceed
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

    if (wantMic === false && wantCam === false) {
      this.locals.stream?.getTracks().forEach(track => track.stop());
      this.locals.stream = new MediaStream(); // Keep an empty stream object
      return this.locals.stream;
    }

    try {
        this.locals.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.locals.mic = wantMic;
        this.locals.cam = wantCam;
    } catch (e) {
        console.error("Could not get user media", e);
        // If we fail, create an empty stream to avoid errors down the line
        if (!this.locals.stream) {
            this.locals.stream = new MediaStream();
        }
        this.locals.mic = false;
        this.locals.cam = false;
    }
    
    return this.locals.stream;
  }

  getLocalStream() {
    return this.locals.stream;
  }

  async toggleMic(on: boolean) {
    this.locals.mic = on;
    await this.updateStream();
  }

  async toggleCam(on: boolean) {
    this.locals.cam = on;
    await this.updateStream();
  }
  
  private async updateStream() {
    if (this.locals.stream) {
        this.locals.stream.getTracks().forEach(track => track.stop());
    }

    await this.ensureLocalStream(this.locals.mic, this.locals.cam);

    for (const remote of this.remotes.values()) {
        const senders = remote.pc.getSenders();
        const newTracks = this.locals.stream?.getTracks() || [];
        
        // Replace tracks for existing senders
        for (const sender of senders) {
            const newTrack = newTracks.find(t => t.kind === sender.track?.kind);
            if (newTrack) {
                if(sender.track?.id !== newTrack.id) {
                    await sender.replaceTrack(newTrack);
                }
            } else if (sender.track) {
                // If there's no new track of this kind, remove the track
                 try {
                    remote.pc.removeTrack(sender);
                } catch(e) { console.error("Error removing track", e); }
            }
        }
        
        // Add new tracks for new kinds
        for (const track of newTracks) {
            if (!senders.some(s => s.track && s.track.kind === track.kind)) {
                try {
                    remote.pc.addTrack(track, this.locals.stream!);
                } catch(e) { console.error("Error adding track", e); }
            }
        }
    }
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
    if (video && s) {
      video.srcObject = s;
      video.muted = true; // self-view muted to avoid echo
      video.playsInline = true;
      video.autoplay = true;
    }
  }
}
