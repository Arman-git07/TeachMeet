"use client";

import { io, Socket } from "socket.io-client";
import type { ChatMessage } from "@/app/dashboard/meeting/[meetingId]/chat/MeetingChatPanel";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  negotiating: boolean;
};

export class MeshRTC {
  public socket: Socket;
  public roomId: string;
  private userId: string;
  public localStream: MediaStream | null = null;
  private peers: Map<string, PeerEntry> = new Map();
  private iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteLeft?: (socketId: string) => void;
  public socketId: string | null = null;
  public removeTrack?: (track: MediaStreamTrack) => void;

  private _ready = false; 
  private _pendingSignals: Array<() => void> = []; 

  // Chat related properties
  public hasRegisteredChatHandlers = false;
  private onNewPublicMessageCallback: ((message: ChatMessage) => void) | null = null;
  private onNewPrivateMessageCallback: ((message: ChatMessage) => void) | null = null;
  private userDisplayName: string;
  private userPhotoURL?: string;

  constructor(opts: {
    roomId: string;
    userId: string;
    onRemoteStream: (socketId: string, stream: MediaStream) => void;
    onRemoteLeft?: (socketId: string) => void;
  }) {
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.onRemoteStream = opts.onRemoteStream;
    this.onRemoteLeft = opts.onRemoteLeft;

    // These need to be set from useAuth, passed into constructor
    this.userDisplayName = "User"; // Placeholder
    
    this.socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      query: { userId: this.userId } // Pass userId for identification
    });

    this.registerSocketEvents();
    try { (window as any).__mesh = this; console.log("[mesh] exported instance to window.__mesh"); } catch {}
  }

  public registerChatHandlers(onNewMessage: (message: ChatMessage) => void) {
      this.onNewPublicMessageCallback = onNewMessage;
      this.onNewPrivateMessageCallback = onNewMessage;
      this.hasRegisteredChatHandlers = true;
  }
  
  public sendPublicMessage(text: string) {
    if (!this.socket.connected || !text.trim()) return;

    const message: Omit<ChatMessage, 'isMe'> = {
      id: `${this.socket.id}-${Date.now()}`,
      senderId: this.userId,
      senderName: this.userDisplayName,
      senderAvatar: this.userPhotoURL,
      text: text,
      timestamp: new Date(),
      isPrivate: false,
    };
    this.socket.emit("public-chat-message", this.roomId, message);
    if(this.onNewPublicMessageCallback) {
        this.onNewPublicMessageCallback({ ...message, isMe: true });
    }
  }

  public sendPrivateMessage(recipientId: string, text: string) {
    if (!this.socket.connected || !text.trim()) return;

    const message: Omit<ChatMessage, 'isMe'> = {
      id: `${this.socket.id}-${Date.now()}`,
      senderId: this.userId,
      senderName: this.userDisplayName,
      senderAvatar: this.userPhotoURL,
      recipientId: recipientId,
      text: text,
      timestamp: new Date(),
      isPrivate: true,
    };
    this.socket.emit("private-chat-message", this.roomId, message);
     if(this.onNewPrivateMessageCallback) {
        this.onNewPrivateMessageCallback({ ...message, isMe: true });
    }
  }
  
  public async init(localStream: MediaStream, displayName: string, photoURL?: string) {
    this.localStream = localStream;
    this.userDisplayName = displayName;
    this.userPhotoURL = photoURL;
    console.log("[mesh] init(): localStream ready, tracks:", this.localStream?.getTracks().map(t => t.kind));
    
    this._ready = true;
    if (this._pendingSignals.length > 0) {
      console.log("[mesh] init(): processing", this._pendingSignals.length, "queued signals");
      while (this._pendingSignals.length) {
        const fn = this._pendingSignals.shift();
        try { fn && fn(); } catch (e) { console.error("[mesh] queued signal handler failed", e); }
      }
    }
  }

  private registerSocketEvents() {
    this.socket.on("connect", () => { 
        this.socketId = this.socket.id; 
        this.socket.emit("join-room", this.roomId, this.socket.id);
    });

    this.socket.on("new-public-message", (message: Omit<ChatMessage, 'isMe'>) => {
        if (this.onNewPublicMessageCallback && message.senderId !== this.userId) {
            this.onNewPublicMessageCallback({ ...message, isMe: false });
        }
    });

    this.socket.on("new-private-message", (message: Omit<ChatMessage, 'isMe'>) => {
        if (this.onNewPrivateMessageCallback) {
            this.onNewPrivateMessageCallback({ ...message, isMe: false });
        }
    });

    this.socket.on("user-joined", (remoteId: string) => {
      const handler = () => this._handleUserJoined(remoteId);
      if (!this._ready) {
        console.log("[mesh] queued incoming user-joined until localStream ready");
        this._pendingSignals.push(handler);
      } else {
        handler();
      }
    });

    this.socket.on("offer", (fromId: string, offer: RTCSessionDescriptionInit) => {
      const handler = () => this._handleOffer(fromId, offer);
      if (!this._ready) {
        console.log("[mesh] queued incoming offer until localStream ready");
        this._pendingSignals.push(handler);
      } else {
        handler();
      }
    });

    this.socket.on("answer", (fromId: string, answer: RTCSessionDescriptionInit) => {
      const handler = () => this._handleAnswer(fromId, answer);
      if (!this._ready) { this._pendingSignals.push(handler); console.log("[mesh] queued incoming answer"); } else handler();
    });

    this.socket.on("ice-candidate", (fromId: string, candidate: RTCIceCandidateInit) => {
      const handler = () => this._handleIceCandidate(fromId, candidate);
      if (!this._ready) { this._pendingSignals.push(handler); console.log("[mesh] queued incoming ice-candidate"); } else handler();
    });
    
    this.socket.on("user-left", (remoteId: string) => {
      this.cleanupPeer(remoteId);
      if (this.onRemoteLeft) this.onRemoteLeft(remoteId);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[mesh] Signaling is disabled, backend socket server is not running or unreachable.", err.message);
    });
  }

  private async _handleOffer(fromId: string, offer: RTCSessionDescriptionInit) {
    console.log("[mesh] Received offer from", fromId);

    let entry = this.peers.get(fromId);
    if (!entry) {
      entry = this.createPeerEntry(fromId, false);
      this.peers.set(fromId, entry);
    }
    const pc = entry.pc;
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("[mesh] setRemoteDescription done for", fromId);

      await this.waitForLocalStreamAttachment(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket?.emit("answer", fromId, answer);
      console.log("[mesh] _handleOffer: sent answer to", fromId);
    } catch (err) {
      console.error("[mesh] _handleOffer error for", fromId, err);
    }
  }

  private async _handleUserJoined(remoteId: string) {
    if (!remoteId || remoteId === this.socket?.id || this.peers.has(remoteId)) return;

    const entry = this.createPeerEntry(remoteId, true);
    this.peers.set(remoteId, entry);
  }

  private async _handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const entry = this.peers.get(fromId);
    if (!entry) { console.warn("[mesh] got answer but no pc for", fromId); return; }
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("[mesh] setRemoteDescription(answer) from", fromId);
    } catch (e) { console.error("[mesh] handleAnswer error", e); }
  }

  private async _handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const entry = this.peers.get(fromId);
    if (!entry) { console.warn("[mesh] got ice-candidate but no pc for", fromId); return; }
    try {
      if (entry.pc.remoteDescription) {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        const queue = (entry as any).iceCandidateQueue || [];
        queue.push(candidate);
        (entry as any).iceCandidateQueue = queue;
      }
    } catch (e) { console.error("[mesh] handleIceCandidate error", e); }
  }

  private createPeerEntry(remoteId: string, isInitiator: boolean): PeerEntry {
    if (this.peers.has(remoteId)) return this.peers.get(remoteId)!;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: null, negotiating: false };

    pc.addEventListener("track", (ev) => {
      ev.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      entry.stream = remoteStream;
      try { this.onRemoteStream?.(remoteId, entry.stream); } catch (e) { console.error("[mesh] onRemoteStream callback error", e); }
    });

    pc.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) this.socket?.emit("ice-candidate", remoteId, ev.candidate);
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        this.cleanupPeer(remoteId);
        try { this.onRemoteLeft?.(remoteId); } catch (e) { console.error("[mesh] onRemoteLeft error", e); }
      }
    });

    pc.addEventListener("negotiationneeded", async () => {
      if (entry.negotiating || !isInitiator) return;
      entry.negotiating = true;
      try {
        await this.waitForLocalStreamAttachment(pc);
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

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try { pc.addTrack(track, this.localStream!); } catch (e) { console.warn("[mesh] addTrack to pc failed", e); }
      });
      console.log("[mesh] Attaching local tracks to new pc for", remoteId, this.localStream.getTracks().map(t => t.kind));
    }

    this.peers.set(remoteId, entry);
    return entry;
  }
  
  private async waitForLocalStreamAttachment(pc: RTCPeerConnection, timeout = 2000): Promise<void> {
    if (pc.getSenders().length > 0 && pc.getSenders().some(s => s.track)) {
      return Promise.resolve();
    }
    const pollInterval = 100;
    const endTime = Date.now() + timeout;
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (pc.getSenders().length > 0 && pc.getSenders().some(s => s.track)) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() > endTime) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for local stream attachment to peer connection."));
        }
      }, pollInterval);
    });
  }


  public leave() {
    this.peers.forEach(({ pc }) => {
        try { pc.close(); } catch (e) {}
    });
    this.peers.clear();
    if(this.socket.connected) {
        this.socket.disconnect();
    }
    this.localStream?.getTracks().forEach(track => track.stop());
  }

  private cleanupPeer(remoteId: string) {
    const entry = this.peers.get(remoteId);
    if (entry) {
      try { entry.pc.close(); } catch (e) {}
      this.peers.delete(remoteId);
    }
  }

  public async addTrack(track: MediaStreamTrack) {
    if (!this.localStream) return;
    this.localStream.addTrack(track);

    for (const [id, entry] of this.peers.entries()) {
        entry.pc.addTrack(track, this.localStream);
    }
  }

  public async replaceTrack(newTrack: MediaStreamTrack) {
    for (const { pc } of this.peers.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
      if (sender) await sender.replaceTrack(newTrack).catch(e => console.error("Failed to replace track:", e));
    }
  }

  public async restoreCameraTrack() {
    const originalVideoTrack = this.localStream?.getVideoTracks()[0];
    if (originalVideoTrack) await this.replaceTrack(originalVideoTrack);
  }

  public getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localStream?.getVideoTracks()[0] || null;
  }
}