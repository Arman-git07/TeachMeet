import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer } from "socket.io";

export const config = {
  api: {
    bodyParser: false,
  },
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
      console.log("✅ User connected:", socket.id);

      socket.on("join", (roomId) => {
        socket.join(roomId);
        console.log(`👥 ${socket.id} joined room ${roomId}`);
        socket.to(roomId).emit("user-joined", socket.id);
      });

      socket.on("offer", (remoteId, sdp) => {
        io.to(remoteId).emit("offer", socket.id, sdp);
      });

      socket.on("answer", (remoteId, sdp) => {
        io.to(remoteId).emit("answer", socket.id, sdp);
      });

      socket.on("ice-candidate", (remoteId, candidate) => {
        io.to(remoteId).emit("ice-candidate", socket.id, candidate);
      });
      
      socket.on("screen-share-started", ({ roomId, mode }) => {
        socket.to(roomId).emit("participant-started-sharing", { participantId: socket.id, mode });
      });

      socket.on("screen-share-stopped", ({ roomId }) => {
          socket.to(roomId).emit("participant-stopped-sharing", { participantId: socket.id });
      });

      socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            socket.to(room).emit("user-left", socket.id);
          }
        });
      });
      
      socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
        io.sockets.emit("user-left", socket.id);
      });
    });
  }
  res.end();
}
