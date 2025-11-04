
// src/lib/webrtc/mesh.ts
"use client";

import { io, Socket } from "socket.io-client";

/**
 * Lightweight MeshRTC helper.
 *
 * Constructor opts:
 *  - roomId: string
 *  - userId: string
 *  - onRemoteStream: (socketId: string, stream: MediaStream) => void
 *  - onRemoteLeft: (socketId: string) => void
 *
 * Usage:
 *   const rtc = new MeshRTC({ roomId, userId, onRemoteStream, onRemoteLeft });
 *   rtc.init(localStream);
 *   // on leave: rtc.leave();
 */
type MeshOptions = {
  roomId: string;
  userId: string;
  onRemoteStream: (socketId: string, stream: MediaStream) => void;
  onRemoteLeft?: (socketId: string) => void;
  iceServers?: RTCIceServer[];
};

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  dataChannel?: RTCDataChannel | null;
};

export class MeshRTC {
  private roomId: string;
  private userId: string;
  private onRemoteStream: (socketId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId: string) => void;
  private socket: Socket | null = null;
  private peers = new Map<string, PeerEntry>();
  private localStream: MediaStream | null = null;
  private defaultIceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  private iceServers: RTCIceServer[];
  public originalVideoTrack?: MediaStreamTrack | null;
  public socketId: string | null = null;

  constructor(opts: MeshOptions) {
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.onRemoteStream = opts.onRemoteStream;
    this.onRemoteLeft = opts.onRemoteLeft;
    this.iceServers = opts.iceServers ?? this.defaultIceServers;
  }

  // Initialize socket and join the room (called once)
  private initSocketIfNeeded() {
    if (this.socket) return;

    // Connect to the server endpoint you created (ensure path matches)
    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      this.socketId = this.socket?.id || null;
      // join room on connect
      this.socket?.emit("join", this.roomId);
    });

    // someone joined -> create a peer and initiate offer to them
    this.socket.on("user-joined", (remoteId: string) => {
      if (!remoteId || remoteId === this.socket?.id) return;
      if (this.peers.has(remoteId)) return;

      console.log(`[MeshRTC] user-joined: preparing to connect with ${remoteId}`);

      // ✅ Wait for local tracks to fully attach before sending offer
      setTimeout(() => {
        console.log(`[MeshRTC] Delayed offer creation for ${remoteId}`);
        this.createPeerAndOffer(remoteId);
      }, 500); // 0.5s delay ensures video track is included in offer
    });


    // receiving an offer from somebody (we are callee)
    this.socket.on("offer", async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      try {
        // if peer exists, reuse, else create
        let entry = this.peers.get(remoteId);
        if (!entry) {
          entry = this.createPeerEntry(remoteId, false);
        }
        const pc = entry.pc;

        // Ensure local tracks are attached before setting remote description
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                if (!pc.getSenders().find(s => s.track === track)) {
                    pc.addTrack(track, this.localStream!);
                }
            });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        // send answer back (server expects (remoteId, sdp) signature)
        this.socket?.emit("answer", remoteId, pc.localDescription);
      } catch (err) {
        console.error("Failed to handle offer:", err);
      }
    });

    // receiving an answer to our offer
    this.socket.on("answer", async (remoteId: string, sdp: RTCSessionDescriptionInit) => {
      try {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Failed to handle answer:", err);
      }
    });

    // ICE candidate forwarded from remote peer
    this.socket.on("ice-candidate", async (remoteId: string, candidate: RTCIceCandidateInit) => {
      try {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Failed to add remote ICE candidate", err);
      }
    });

    // a user left the room - clean up
    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });

    // Optional: Log connection errors
    this.socket.on("connect_error", (err) => {
        console.warn("WebRTC signaling is currently disabled because the backend socket server is not running or unreachable. Real-time communication will not work.", err.message);
    });
  }

  // Public: call with the local MediaStream
  public init(localStream: MediaStream) {
    this.initSocketIfNeeded();
    this.localStream = localStream;
    this.originalVideoTrack = localStream.getVideoTracks()[0];

    // Add local tracks to existing peers (if any)
    this.peers.forEach((entry) => {
      if (!entry) return;
      const pc = entry.pc;
      try {
        this.localStream?.getTracks().forEach(track => {
            if (!pc.getSenders().find(s => s.track === track)) {
                pc.addTrack(track, this.localStream as MediaStream)
            }
        });
      } catch (err) {
        console.warn("Failed to add local tracks to existing peer", err);
      }
    });
  }

  // Peer creation logic (called before making or receiving offers)
  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
  
    // Add local media tracks (if any)
    if (this.localStream) {
      try {
        const tracks = this.localStream.getTracks();
        console.log(`[MeshRTC] Attaching ${tracks.length} local tracks to peer ${remoteId}`);
        tracks.forEach(track => {
          pc.addTrack(track, this.localStream as MediaStream);
        });
      } catch (err) {
        console.warn("Error adding local tracks to PC:", err);
      }
    } else {
      console.warn("[MeshRTC] No localStream available when creating peer for", remoteId);
    }
  
    // Prepare a remote MediaStream container
    let remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null };
  
    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`[mesh] ontrack from ${remoteId}`, event.streams?.[0] || event.track);
      // If event.streams provided, use it; otherwise create from event.track
      if (event.streams && event.streams.length > 0) {
        remoteStream = event.streams[0];
      } else if (event.track) {
        remoteStream.addTrack(event.track);
      }
  
      entry.stream = remoteStream;
      console.log(`[MeshRTC] Remote video received from ${remoteId}:`, event.streams?.[0]);
      // Call the callback so MeetingClient receives the MediaStream
      try { this.onRemoteStream(remoteId, remoteStream); } catch (e) { console.error("onRemoteStream error", e); }
    };
  
    // ICE candidate forwarding
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket?.emit("ice-candidate", remoteId, ev.candidate);
      }
    };
  
    // Connection state cleanup
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        this.cleanupPeer(remoteId);
        try { this.onRemoteLeft?.(remoteId); } catch(e) { console.error("onRemoteLeft error", e); }
      }
    };
  
    // If this side is the initiator, ensure negotiation creates and sends offer
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // emit to exactly the remote peer
          this.socket?.emit("offer", remoteId, offer);
        } catch (err) {
          console.error("pc.onnegotiationneeded error:", err);
        }
      };
    }
  
    this.peers.set(remoteId, entry);
    return entry;
  }

  // Create peer then create+send an offer immediately
  private async createPeerAndOffer(remoteId: string) {
    if (this.peers.has(remoteId)) return;
    
    const entry = this.createPeerEntry(remoteId, true);
  }


  // Remove and close peer
  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try {
      entry.pc.getSenders().forEach(s => {
        try { s.track?.stop?.(); } catch {}
      });
    } catch {}
    try { entry.pc.close(); } catch {}
    this.peers.delete(remoteId);
  }

  // Public leave / cleanup
  public leave() {
    this.peers.forEach((_, id) => this.cleanupPeer(id));
    if (this.socket) {
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
  }
  
  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) return;
    this.localStream.addTrack(track);
    for (const [id, entry] of this.peers.entries()) {
      entry.pc.addTrack(track, this.localStream);
      // Trigger renegotiation
      try {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        this.socket?.emit("offer", id, offer);
      } catch (err) {
        console.error("Renegotiation after addTrack failed:", err);
      }
    }
  }

  public async removeTrack(track: MediaStreamTrack) {
    if (!this.localStream || !track) return;
    this.localStream.removeTrack(track);
    this.peers.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track === track);
        if (sender) pc.removeTrack(sender);
    });
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
    if (this.originalVideoTrack) {
        await this.replaceTrack(this.originalVideoTrack);
    }
  }

  public getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}

export default MeshRTC;
