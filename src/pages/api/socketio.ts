
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

const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';


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

      socket.on("join-room", (roomId: string, currentUserId: string) => {
        socket.join(roomId);
        // @ts-ignore - extending socket object
        socket.data = { roomId, userId: currentUserId, displayName, photoURL };

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            hostId: currentUserId,
            permissions: { [currentUserId]: true },
            elements: [],
            users: new Map(),
          });
          console.log(`Room ${roomId} created. Host is ${currentUserId}`);
        }
        
        const roomState = rooms.get(roomId)!;
        roomState.users.set(currentUserId, { socketId: socket.id, displayName: displayName as string, photoURL: photoURL as string });

        socket.emit('initial-state', { permissions: roomState.permissions });
        socket.to(roomId).emit("user-joined", currentUserId);
        console.log(`${currentUserId} (socket ${socket.id}) joined room ${roomId}`);
      });
      
      socket.on("private-chat-message", (roomId: string, message: any) => {
        const roomState = rooms.get(roomId);
        if (!roomState) return;

        const recipientSocket = getSocketByUserId(io, roomId, message.recipientId);

        if (recipientSocket) {
            recipientSocket.emit("new-private-message", message);
            // Also send back to sender to confirm
            socket.emit("new-private-message", message);

             // For notification system, we can emit a separate event or handle here
            const notificationPayload = {
              type: 'privateMessage',
              id: `pm-${Date.now()}`,
              title: `New message from ${message.senderName}`,
              timestamp: Date.now(),
              from: message.senderName,
              senderId: message.senderId,
              meetingId: roomId,
              meetingTopic: message.topic // Assuming topic is passed in message
            };
            recipientSocket.emit('notify-activity', 'privateMessage', notificationPayload);
        }
      });


      socket.on("public-chat-message", (roomId, message) => {
        socket.to(roomId).emit("new-public-message", message);
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
          if (roomState && roomState.permissions[userId]) {
            roomState.permissions[participantId] = canDraw;
            io.to(roomId).emit('permission-update', roomState.permissions);
          }
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
            delete roomState.permissions[userId];
            roomState.users.delete(userId);

            if (roomState.hostId === userId) {
                const otherUsers = Array.from(roomState.users.keys());
                const newHost = otherUsers[0] || null;
                roomState.hostId = newHost;
                if(newHost) roomState.permissions[newHost] = true;
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
