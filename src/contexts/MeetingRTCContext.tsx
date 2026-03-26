'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { MeshRTC } from '@/lib/webrtc/mesh';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;   // ⭐ add this
  text: string;
  createdAt?: number;
  timestamp?: number;      // ⭐ add this
  isPrivate?: boolean;     // ⭐ add this
recipientId?: string;
};

interface RecordingControls {
  start: () => Promise<void>;
  stop: (destination: 'private' | 'public' | 'device') => Promise<void>;
  discard: () => Promise<void>;
}

interface MeetingRTCContextType {
  rtc: MeshRTC | null;
  setRtc: (rtc: MeshRTC | null) => void;

  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;

  isUploading: boolean;
  setIsUploading: (isUploading: boolean) => void;

  recordingControls: RecordingControls;
  setRecordingControls: (controls: RecordingControls) => void;

  isSaveRecordingDialogOpen: boolean;
  setIsSaveRecordingDialogOpen: (isOpen: boolean) => void;

  // ✅ Chat system
  chatHistory: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}

const MeetingRTCContext = createContext<MeetingRTCContextType | undefined>(undefined);

export const MeetingRTCProvider = ({ children }: { children: ReactNode }) => {

  const params = useParams();
  const meetingId = params?.meetingId as string;

  const pathname = usePathname();
  const { user } = useAuth();   // ✅ MOVE HERE (before useEffect)

  const [rtc, setRtc] = useState<MeshRTC | null>(null);
const rtcRef = useRef<MeshRTC | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaveRecordingDialogOpen, setIsSaveRecordingDialogOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
 const [isChatOpen, setIsChatOpen] = useState(false);

useEffect(() => {
  if (!user || !meetingId) return;

  // 🚫 prevent re-creation
  if (rtcRef.current) return;

  console.log("🧠 Creating RTC instance...");

  const rtcInstance = new MeshRTC({
    roomId: meetingId,
    userId: user.uid,

    onRemoteStream: (userId, stream) => {
      console.log("🎥 Remote stream:", userId, stream);
    },

    onRemoteLeft: (remoteId) => {
      console.log("👋 User left:", remoteId);
    },

    onData: (data: any) => {
      if (data?.type === "chat-message") {
        setChatHistory((prev) => {
          if (prev.some((m) => m.id === data.payload.id)) return prev;
          return [...prev, data.payload];
        });
      }
    }
  });

  rtcRef.current = rtcInstance;
  setRtc(rtcInstance);

  return () => {
    console.log("🧹 Cleaning up RTC");
    rtcRef.current?.leave();
    rtcRef.current = null;
  };
}, [user?.uid, meetingId]);
  
const addChatMessage = (message: ChatMessage) => {
  setChatHistory((prev) => [...prev, message]);

  if (rtcRef.current) {
  rtcRef.current.broadcast({
      type: "chat-message",
      payload: message
    });
  }
};
  const [recordingControls, setRecordingControls] = useState<RecordingControls>({
    start: async () => console.warn('startRecording not implemented'),
    stop: async (destination) => console.warn('stopRecording not implemented'),
    discard: async () => console.warn('discardRecording not implemented'),
  });

  // 📡 GLOBAL HEARTBEAT: Update lastSeen every 10 seconds while in a meeting
  useEffect(() => {
    if (!rtc || !user || !rtc.roomId) return;

    const interval = setInterval(async () => {
      try {
        const participantRef = doc(db, 'meetings', rtc.roomId, 'participants', user.uid);
        await updateDoc(participantRef, {
          lastSeen: serverTimestamp(),
          isActive: true
        });
      } catch (err) {
        console.warn("Heartbeat update failed:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [rtc, user]);

  // 🚦 NAVIGATION PROTECTOR: Keep connection alive during sub-navigation,
  // but teardown if navigating away from the meeting entire path.
  useEffect(() => {
    if (rtc && !pathname.includes(`/dashboard/meeting/${rtc.roomId}`)) {
      console.log("🚦 Navigating away from meeting. Tearing down RTC.");
      
      // If we are navigating directly to the home page, flag it for the review prompt
      if (pathname === '/' && typeof window !== 'undefined') {
        sessionStorage.setItem('teachmeet-just-left-meeting', 'true');
      }

      rtcRef.current?.leave();
rtcRef.current = null;
setRtc(null);
    }
  }, [pathname, rtc]);

  return (
  <MeetingRTCContext.Provider value={{
    rtc, setRtc,

    isRecording, setIsRecording,
    isUploading, setIsUploading,

    recordingControls, setRecordingControls,

    isSaveRecordingDialogOpen,
    setIsSaveRecordingDialogOpen,

    chatHistory,
    addChatMessage,
    isChatOpen,
    setIsChatOpen
  }}>
    {children}
  </MeetingRTCContext.Provider>
);
};

export const useMeetingRTC = () => {
  const context = useContext(MeetingRTCContext);
  if (context === undefined) {
    throw new Error('useMeetingRTC must be used within a MeetingRTCProvider');
  }
  return context;
};
