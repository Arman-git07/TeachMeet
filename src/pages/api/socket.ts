
// /pages/api/socket.ts (Next.js API route)
import { Server as IOServer } from "socket.io";
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "../../types";

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server as any, { path: "/api/socketio" });

    io.on("connection", (socket) => {
      socket.on("join-room", ({ roomId, userId }) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", { userId, socketId: socket.id });
      });

      socket.on("leave-room", ({ roomId, userId }) => {
        socket.leave(roomId);
        socket.to(roomId).emit("user-left", { userId, socketId: socket.id });
      });

      socket.on("signal:offer", ({ roomId, to, from, sdp }) => {
        io.to(to).emit("signal:offer", { from, sdp, socketId: socket.id });
      });

      socket.on("signal:answer", ({ roomId, to, from, sdp }) => {
        io.to(to).emit("signal:answer", { from, sdp, socketId: socket.id });
      });

      socket.on("signal:ice", ({ roomId, to, from, candidate }) => {
        io.to(to).emit("signal:ice", { from, candidate, socketId: socket.id });
      });

      socket.on("disconnecting", () => {
        const rooms = [...socket.rooms].filter((r) => r !== socket.id);
        rooms.forEach((roomId) => {
          socket.to(roomId).emit("user-left", { socketId: socket.id });
        });
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}
