
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer, Socket } from "socket.io";
import type { ChatMessage } from "@/contexts/MeetingRTCContext";

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
            // Find socket of recipient and sender to deliver private message
            const recipientSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === message.recipientId);
            if (recipientSocket) {
                recipientSocket.emit('chat-message', message);
            }
            // The sender already added it to their own UI, so no need to emit back to them.
        } else {
            // Broadcast public message to everyone in the room except the sender
            socket.to(roomId).emit('chat-message', message);
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
        // Find the specific socket for the user ID and emit to it
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
