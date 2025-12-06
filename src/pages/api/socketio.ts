
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer } from "socket.io";

const rooms = new Map<string, Set<string>>(); // roomId -> Set of userIds

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
        // @ts-ignore - extending socket object
        socket.data = { roomId, userId };

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(userId);

        // Notify all others in the room
        socket.to(roomId).emit("user-joined", userId);
        console.log(`${userId} (socket ${socket.id}) joined room ${roomId}`);
      });
      
      socket.on('draw', (data) => {
        // @ts-ignore
        const { roomId } = socket.data || {};
        if (roomId) {
          socket.to(roomId).emit('draw-event', data);
        }
      });

      socket.on("offer", (remoteId: string, offer: any) => {
        // @ts-ignore
        const { userId } = socket.data || {};
        if (!userId) return;
        // Forward offer to the specific user (remoteId) from the sender (userId)
        io.to(remoteId).emit("offer", userId, offer);
      });
      
      socket.on("answer", (remoteId: string, answer: any) => {
        // @ts-ignore
        const { userId } = socket.data || {};
        if (!userId) return;
        io.to(remoteId).emit("answer", userId, answer);
      });

      socket.on("ice-candidate", (remoteId: string, candidate: any) => {
        // @ts-ignore
        const { userId } = socket.data || {};
        if (!userId) return;
        io.to(remoteId).emit("ice-candidate", userId, candidate);
      });

      socket.on("disconnect", () => {
        // @ts-ignore
        const { roomId, userId } = socket.data || {};
        if (roomId && userId && rooms.has(roomId)) {
          rooms.get(roomId)!.delete(userId);
          socket.to(roomId).emit("user-left", userId);
        }
        console.log("Disconnected:", socket.id);
      });
    });
  }
  res.end();
}
