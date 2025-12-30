
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer, Socket } from "socket.io";

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
        socket.to(roomId).emit("user-joined", userId);
        console.log(`${userId} (socket ${socket.id}) joined room ${roomId}`);
      });
      
      socket.on("public-chat-message", (roomId, message) => {
        // Broadcast to everyone in the room, including the sender
        io.to(roomId).emit("new-public-message", message);
      });
      
      socket.on("private-chat-message", (roomId, message) => {
        const recipientSocket = Array.from(io.sockets.sockets.values()).find(s => (s.data as any).userId === message.recipientId);
        if (recipientSocket) {
            recipientSocket.emit("new-private-message", message);
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
        // @ts-ignore
        const { roomId, userId } = socket.data || {};
        if (roomId && userId) {
          socket.to(roomId).emit("user-left", userId);
        }
        console.log("Disconnected:", socket.id);
      });
    });
  }
  res.end();
}
