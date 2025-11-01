'use client';
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
    console.log("Initializing Socket.IO server...");
    const io = new IOServer(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      socket.on("join", (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
        socket.to(roomId).emit("user-joined", socket.id);
      });

      socket.on("offer", (remoteSocketId, sdp) => {
        socket.to(remoteSocketId).emit("offer", socket.id, sdp);
      });

      socket.on("answer", (remoteSocketId, sdp) => {
        socket.to(remoteSocketId).emit("answer", socket.id, sdp);
      });

      socket.on("ice-candidate", (remoteSocketId, candidate) => {
        socket.to(remoteSocketId).emit("ice-candidate", socket.id, candidate);
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
        console.log("A user disconnected:", socket.id);
      });
    });
  }
  res.end();
}
