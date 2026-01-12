
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { MeshRTC } from '@/lib/webrtc/mesh';

// This is the shape of the message object for the chat.
// It will be used consistently across the application.
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string; // For private messages
  text: string;
  timestamp: number; // Using number (Date.now()) for simplicity
  isPrivate: boolean;
}

interface MeetingRTCContextType {
  rtc: MeshRTC | null;
  setRtc: (rtc: MeshRTC | null) => void;
}

const MeetingRTCContext = createContext<MeetingRTCContextType | undefined>(undefined);

export const MeetingRTCProvider = ({ children }: { children: ReactNode }) => {
  const [rtc, setRtc] = useState<MeshRTC | null>(null);

  return (
    <MeetingRTCContext.Provider value={{ rtc, setRtc }}>
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
