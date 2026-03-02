
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer, Socket } from "socket.io";
import type { ChatMessage } from "@/contexts/MeetingRTCContext";

// A simple in-memory store for block relationships within a room.
const roomBlocks = new Map<string, Map<string, Set<string>>>(); // Map<roomId, Map<blockerId, Set<blockedId>>>

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (!res.socket.server.io) {
    console.log("🔌 Initializing new Socket.IO server...");
    const io = new IOServer(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      socket.on("join-room", (roomId: string, userId: string) => {
        socket.join(roomId);
        // @ts-ignore
        socket.data.userId = userId;
        // @ts-ignore
        socket.data.roomId = roomId;
        
        if (!roomBlocks.has(roomId)) {
            roomBlocks.set(roomId, new Map());
        }
        
        // Notify others that a new user has joined
        socket.to(roomId).emit("user-joined", userId);

        // Tell the new user who has blocked them
        const roomBlockMap = roomBlocks.get(roomId);
        const usersWhoBlockedMe: string[] = [];
        roomBlockMap?.forEach((blockedSet, blockerId) => {
            if (blockedSet.has(userId)) {
                usersWhoBlockedMe.push(blockerId);
            }
        });
        socket.emit('initial-block-list', usersWhoBlockedMe);
      });
      
      socket.on('block-user', ({ blockedUserId }: { blockedUserId: string }) => {
          const { userId: blockerId, roomId } = socket.data as { userId: string, roomId: string };
          if (!blockerId || !roomId || !blockedUserId) return;
          
          const roomBlockMap = roomBlocks.get(roomId);
          if (!roomBlockMap) return;

          if (!roomBlockMap.has(blockerId)) {
              roomBlockMap.set(blockerId, new Set());
          }
          roomBlockMap.get(blockerId)!.add(blockedUserId);
          
          const blockedSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === blockedUserId);
          if (blockedSocket) {
              blockedSocket.emit('user-blocked-me', blockerId);
          }
      });

      socket.on('unblock-user', ({ unblockedUserId }: { unblockedUserId: string }) => {
          const { userId: unblockerId, roomId } = socket.data as { userId: string, roomId: string };
          if (!unblockerId || !roomId || !unblockedUserId) return;
          
          const roomBlockMap = roomBlocks.get(roomId);
          if (!roomBlockMap) return;
          
          roomBlockMap.get(unblockerId)?.delete(unblockedUserId);
          
          const unblockedSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === unblockedUserId);
          if (unblockedSocket) {
              unblockedSocket.emit('user-unblocked-me', unblockerId);
          }
      });

      socket.on('chat-message', (message: ChatMessage) => {
        const { roomId } = socket.data as { roomId: string };
        if (!roomId) return;
        
        if (message.isPrivate && message.recipientId) {
            const recipientSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === message.recipientId);
            if (recipientSocket) {
                recipientSocket.emit('chat-message', message);
            }
        } else {
            socket.to(roomId).emit('chat-message', message);
        }
      });

      socket.on("offer", (remoteId: string, offer: any) => {
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === remoteId);
        if (targetSocket) {
          targetSocket.emit("offer", socket.data.userId, offer);
        }
      });
      
      socket.on("answer", (remoteId: string, answer: any) => {
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === remoteId);
        if (targetSocket) {
          targetSocket.emit("answer", socket.data.userId, answer);
        }
      });

      socket.on("ice-candidate", (remoteId: string, candidate: any) => {
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === remoteId);
        if (targetSocket) {
          targetSocket.emit("ice-candidate", socket.data.userId, candidate);
        }
      });

      socket.on("disconnect", () => {
        const { roomId, userId } = socket.data as { roomId: string, userId: string };
        if (roomId && userId) {
          // Notify other peers to close WebRTC tracks immediately
          socket.to(roomId).emit("user-left", userId);

          const roomBlockMap = roomBlocks.get(roomId);
          if(roomBlockMap) {
            roomBlockMap.delete(userId);
            roomBlockMap.forEach(blockedSet => blockedSet.delete(userId));
          }
        }
      });
    });
  }
  res.end();
}
