
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer, Socket } from "socket.io";

// Store room state in memory
interface RoomState {
  hostId: string | null;
  permissions: Record<string, boolean>; // userId -> canDraw
  elements: any[]; // Store whiteboard elements
  users: Map<string, { socketId: string, displayName?: string, photoURL?: string }>; // userId -> socketId
}
const rooms = new Map<string, RoomState>();


const getSocketByUserId = (io: IOServer, roomId: string, userId: string): Socket | undefined => {
    const roomState = rooms.get(roomId);
    const socketId = roomState?.users.get(userId)?.socketId;
    if (!socketId) return undefined;
    return io.sockets.sockets.get(socketId);
};


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
      const { userId, displayName, photoURL } = socket.handshake.query;

      socket.on("join-room", (roomId: string, currentUserId?: string) => {
        socket.join(roomId);
        const effectiveUserId = currentUserId || userId;
        // @ts-ignore - extending socket object
        socket.data = { roomId, userId: effectiveUserId, displayName, photoURL };

        if (!rooms.has(roomId) && effectiveUserId) {
          rooms.set(roomId, {
            hostId: effectiveUserId as string,
            permissions: { [effectiveUserId as string]: true },
            elements: [],
            users: new Map(),
          });
          console.log(`Room ${roomId} created. Host is ${effectiveUserId}`);
        }
        
        if (effectiveUserId) {
            const roomState = rooms.get(roomId)!;
            roomState.users.set(effectiveUserId as string, { socketId: socket.id, displayName: displayName as string, photoURL: photoURL as string });
        }

        socket.to(roomId).emit("user-joined", effectiveUserId);
        console.log(`${effectiveUserId} (socket ${socket.id}) joined room ${roomId}`);
      });
      
      socket.on("private-chat-message", (roomId: string, message: any) => {
        const roomState = rooms.get(roomId);
        if (!roomState) return;

        const recipientSocket = getSocketByUserId(io, roomId, message.recipientId);

        if (recipientSocket) {
            recipientSocket.emit("new-private-message", message);
        }
        // Always send back to sender to confirm it was sent and to display it
        socket.emit("new-private-message", message);
      });


      socket.on("public-chat-message", (roomId, message) => {
        // Broadcast to everyone in the room, including the sender
        io.to(roomId).emit("new-public-message", message);
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
        // @ts-ignore
        const { roomId, userId } = socket.data || {};
        if (roomId && userId) {
          socket.to(roomId).emit("user-left", userId);
          const roomState = rooms.get(roomId);
          if (roomState) {
            if (roomState.users.has(userId)) {
                roomState.users.delete(userId);
            }
          }
        }
        console.log("Disconnected:", socket.id);
      });
    });
  }
  res.end();
}
