
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

      // --- Join Room ---
      socket.on("join", (roomId) => {
        socket.join(roomId);
        console.log(`👥 ${socket.id} joined room ${roomId}`);
        socket.to(roomId).emit("user-joined", socket.id);
      });

      // --- WebRTC Signaling Events ---
      // Offer: (remoteSocketId, offer)
      socket.on("offer", (remoteSocketId, offer) => {
        if (!remoteSocketId) return;
        // send to the specific socket
        socket.to(remoteSocketId).emit("offer", socket.id, offer);
      });

      // Answer: (remoteSocketId, answer)
      socket.on("answer", (remoteSocketId, answer) => {
        if (!remoteSocketId) return;
        socket.to(remoteSocketId).emit("answer", socket.id, answer);
      });

      // ICE Candidate: (remoteSocketId, candidate)
      socket.on("ice-candidate", (remoteSocketId, candidate) => {
        if (!remoteSocketId) return;
        socket.to(remoteSocketId).emit("ice-candidate", socket.id, candidate);
      });
      
      socket.on("screen-share-started", ({ roomId, mode }) => {
        socket.to(roomId).emit("participant-started-sharing", { participantId: socket.id, mode });
      });

      socket.on("screen-share-stopped", ({ roomId }) => {
          socket.to(roomId).emit("participant-stopped-sharing", { participantId: socket.id });
      });

      // --- Handle User Leaving ---
      socket.on("disconnect", () => {
        console.log(`❌ ${socket.id} disconnected`);
        // find rooms the socket was in (ignore socket.id room)
        for (const room of socket.rooms) {
          if (room === socket.id) continue;
          socket.to(room).emit("user-left", socket.id);
        }
      });
    });
  }
  res.end();
}
