'use client';
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { MeshRTC } from '@/lib/webrtc/mesh';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: number;
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
}

const MeetingRTCContext = createContext<MeetingRTCContextType | undefined>(undefined);

export const MeetingRTCProvider = ({ children }: { children: ReactNode }) => {
  const [rtc, setRtc] = useState<MeshRTC | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaveRecordingDialogOpen, setIsSaveRecordingDialogOpen] = useState(false);
  const [recordingControls, setRecordingControls] = useState<RecordingControls>({
    start: async () => console.warn('startRecording not implemented'),
    stop: async (destination) => console.warn('stopRecording not implemented'),
    discard: async () => console.warn('discardRecording not implemented'),
  });

  const pathname = usePathname();
  const { user } = useAuth();

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

      rtc.leave();
      setRtc(null);
    }
  }, [pathname, rtc]);

  return (
    <MeetingRTCContext.Provider value={{ 
      rtc, setRtc, 
      isRecording, setIsRecording,
      isUploading, setIsUploading,
      recordingControls, setRecordingControls,
      isSaveRecordingDialogOpen, setIsSaveRecordingDialogOpen
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
