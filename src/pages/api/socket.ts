
// /pages/api/socket.ts (Next.js API route)
import { Server as IOServer } from "socket.io";
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "../../types";

export const config = { api: { bodyParser: false } };

// This is a simplified in-memory store for rooms. In production, use Redis or another persistent store.
const rooms = new Map<string, { hostSocketId: string; participants: Map<string, string> }>();

function getHostSocketId(roomId: string): string | undefined {
  return rooms.get(roomId)?.hostSocketId;
}

function getSocketIdForParticipant(roomId: string, participantId: string): string | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  // Find socket ID by user ID
  for (const [uid, sid] of room.participants.entries()) {
    if (uid === participantId) return sid;
  }
  return undefined;
}

function isSocketHostForMeeting(socket: any, roomId: string): boolean {
  return rooms.get(roomId)?.hostSocketId === socket.id;
}


export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server as any, { path: "/api/socketio" });

    io.on("connection", (socket) => {
      socket.on("join-room", ({ roomId, userId }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, { hostSocketId: socket.id, participants: new Map() });
        }
        rooms.get(roomId)!.participants.set(userId, socket.id);
        
        socket.to(roomId).emit("user-joined", { userId, socketId: socket.id });
      });

      socket.on("leave-room", ({ roomId, userId }) => {
        socket.leave(roomId);
        const room = rooms.get(roomId);
        if (room) {
          room.participants.delete(userId);
          if (room.hostSocketId === socket.id || room.participants.size === 0) {
            rooms.delete(roomId);
          }
        }
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

      // Screen sharing events
      socket.on("request-screen-share", ({ meetingId, participantId }) => {
        const hostSocketId = getHostSocketId(meetingId);
        if (hostSocketId) {
          const name = socket.handshake.auth.name || participantId;
          io.to(hostSocketId).emit("screen-share-request", { meetingId, participantId, name });
        }
      });

      socket.on("approve-screen-share", ({ meetingId, participantId, approved }) => {
        const participantSocketId = getSocketIdForParticipant(meetingId, participantId);
        if (participantSocketId) {
          io.to(participantSocketId).emit("screen-share-approval", { meetingId, approved });
        }
      });

      socket.on("notify-screen-share-started", ({ meetingId, participantId }) => {
        socket.to(meetingId).emit("participant-started-sharing", { participantId });
      });

      socket.on("notify-screen-share-stopped", ({ meetingId, participantId }) => {
        socket.to(meetingId).emit("participant-stopped-sharing", { participantId });
      });

      socket.on("host-stop-participant-share", ({ meetingId, targetParticipantId }) => {
        if (!isSocketHostForMeeting(socket, meetingId)) return;
        const participantSocketId = getSocketIdForParticipant(meetingId, targetParticipantId);
        if (participantSocketId) {
          io.to(participantSocketId).emit("force-stop-screen-share", { meetingId });
          socket.to(meetingId).emit("participant-stopped-sharing", { participantId: targetParticipantId });
        }
      });
      
      socket.on("disconnecting", () => {
        const roomsToNotify = [...socket.rooms].filter((r) => r !== socket.id);
        roomsToNotify.forEach((roomId) => {
          socket.to(roomId).emit("user-left", { socketId: socket.id });
           const room = rooms.get(roomId);
           if (room) {
             for(let [userId, sockId] of room.participants.entries()){
               if(sockId === socket.id){
                 room.participants.delete(userId);
                 break;
               }
             }
             if (room.hostSocketId === socket.id || room.participants.size === 0) {
               rooms.delete(roomId);
             }
           }
        });
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}
