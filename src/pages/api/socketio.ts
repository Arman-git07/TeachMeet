
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer, Socket } from "socket.io";

// A simple in-memory store for block relationships within a room.
// In a production app, this should be moved to a more persistent store like Redis.
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
      console.log("Socket connected:", socket.id);
      
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

        console.log(`${userId} (socket ${socket.id}) joined room ${roomId}`);
      });
      
      socket.on("public-chat-message", (roomId, message) => {
        io.to(roomId).emit("new-public-message", message);
      });
      
      socket.on("private-chat-message", (roomId, message) => {
        const { senderId, recipientId } = message;
        const roomBlockMap = roomBlocks.get(roomId);

        // Check if recipient has blocked sender OR sender has blocked recipient
        const isBlocked = roomBlockMap?.get(recipientId)?.has(senderId) || roomBlockMap?.get(senderId)?.has(recipientId);

        if (isBlocked) {
            socket.emit('message-blocked', { recipientId });
            return;
        }

        const recipientSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === recipientId);
        if (recipientSocket) {
            recipientSocket.emit("new-private-message", message);
        }
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

      socket.on('draw', (data) => {
        // @ts-ignore
        const { userId } = socket.data || {};
        if (data.ownerId && userId) {
            const ownerRoomId = `whiteboard-owner-${data.ownerId}`;
            const ownerSocketId = Array.from(io.sockets.adapter.rooms.get(ownerRoomId) || [])[0];
            if (ownerSocketId) {
                io.to(ownerSocketId).emit('draw-from-collaborator', { ...data, collaboratorId: userId });
            }
        }
      });
      
      socket.on('set-permission', ({ ownerId, participantId, canDraw }) => {
        const participantSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === participantId);
        if (participantSocket) {
            participantSocket.emit('permission-update', { canDraw, ownerId });
        }
      });

      socket.on("offer", (remoteId: string, offer: any) => {
        io.to(remoteId).emit("offer", socket.id, offer);
      });
      
      socket.on("answer", (remoteId: string, answer: any) => {
        io.to(remoteId).emit("answer", socket.id, answer);
      });

      socket.on("ice-candidate", (remoteId: string, candidate: any) => {
        io.to(remoteId).emit("ice-candidate", socket.id, candidate);
      });

      socket.on("disconnect", () => {
        const { roomId, userId } = socket.data as { roomId: string, userId: string };
        if (roomId && userId) {
          socket.to(roomId).emit("user-left", userId);

          // Clean up block lists on disconnect
          const roomBlockMap = roomBlocks.get(roomId);
          if(roomBlockMap) {
            roomBlockMap.delete(userId); // Remove this user's blocks
            roomBlockMap.forEach(blockedSet => blockedSet.delete(userId)); // Remove this user from others' blocks
          }
        }
        console.log("Disconnected:", socket.id);
      });
    });
  }
  res.end();
}
