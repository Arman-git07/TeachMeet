
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { MeshRTC } from '@/lib/webrtc/mesh';
import type { ChatMessage } from '@/app/dashboard/meeting/[meetingId]/chat/MeetingChatPanel';

interface MeetingRTCContextType {
  rtc: MeshRTC | null;
  setRtc: (rtc: MeshRTC | null) => void;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const MeetingRTCContext = createContext<MeetingRTCContextType | undefined>(undefined);

export const MeetingRTCProvider = ({ children }: { children: ReactNode }) => {
  const [rtc, setRtc] = useState<MeshRTC | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  return (
    <MeetingRTCContext.Provider value={{ rtc, setRtc, chatHistory, setChatHistory }}>
      {children}
    </MeetingRTCContext.Provider>
  );
};

export const useMeetingRTC = () => {
  const context = useContext(MeetingRTCContext);
  if (context === undefined) {
    // This provides a fallback for components that might use this context
    // outside of a meeting, preventing a hard crash.
    return {
        rtc: null,
        setRtc: () => {},
        chatHistory: [],
        setChatHistory: () => {}
    } as MeetingRTCContextType;
  }
  return context;
};
