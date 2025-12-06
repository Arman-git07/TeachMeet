
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types";
import { Server as IOServer } from "socket.io";

// Store room state in memory
interface RoomState {
  hostId: string | null;
  permissions: Record<string, boolean>; // userId -> canDraw
  elements: any[]; // Store whiteboard elements
}
const rooms = new Map<string, RoomState>();

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
          rooms.set(roomId, {
            hostId: userId, // First user to join is host
            permissions: { [userId]: true },
            elements: [],
          });
          console.log(`Room ${roomId} created. Host is ${userId}`);
        }
        
        const roomState = rooms.get(roomId)!;
        socket.emit('initial-state', roomState);

        socket.to(roomId).emit("user-joined", userId);
        console.log(`${userId} (socket ${socket.id}) joined room ${roomId}`);
      });
      
      socket.on('draw', (data) => {
        // @ts-ignore
        const { roomId, userId } = socket.data || {};
        if (roomId && userId) {
            const roomState = rooms.get(roomId);
            if (roomState && roomState.permissions[userId]) {
                socket.to(roomId).emit('draw-event', data);
            }
        }
      });
      
      socket.on('set-permission', ({ participantId, canDraw }) => {
        // @ts-ignore
        const { roomId, userId } = socket.data || {};
        if (roomId && userId) {
          const roomState = rooms.get(roomId);
          if (roomState && roomState.hostId === userId) { // Only host can set permissions
            roomState.permissions[participantId] = canDraw;
            io.to(roomId).emit('permission-update', roomState.permissions);
          }
        }
      });


      socket.on("offer", (remoteId: string, offer: any) => {
        // @ts-ignore
        const { userId } = socket.data || {};
        if (!userId) return;
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
        if (roomId && userId) {
          socket.to(roomId).emit("user-left", userId);
          const roomState = rooms.get(roomId);
          if (roomState) {
            delete roomState.permissions[userId];
            // If host leaves, a new host could be elected, but for now we just remove them
            if (roomState.hostId === userId) {
                // Simple logic: make the next person host, or clear if empty
                const otherUsers = Object.keys(roomState.permissions).filter(id => id !== userId);
                roomState.hostId = otherUsers[0] || null;
                if(roomState.hostId) {
                  roomState.permissions[roomState.hostId] = true;
                }
            }
             io.to(roomId).emit('permission-update', roomState.permissions);
          }
        }
        console.log("Disconnected:", socket.id);
      });
    });
  }
  res.end();
}
