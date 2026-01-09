
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
  chatHistory: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const MeetingRTCContext = createContext<MeetingRTCContextType | undefined>(undefined);

export const MeetingRTCProvider = ({ children }: { children: ReactNode }) => {
  const [rtc, setRtc] = useState<MeshRTC | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  /**
   * The single, safe entry point for adding a message to the chat history.
   * This is used by both the sender (for optimistic UI) and the receiver.
   * It prevents duplicate messages, which is crucial in a mesh network where a message might be received more than once.
   */
  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatHistory(prev => {
      // Prevent duplicates by checking message ID
      if (prev.some(m => m.id === msg.id)) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  return (
    <MeetingRTCContext.Provider value={{ rtc, setRtc, chatHistory, addChatMessage, setChatHistory }}>
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
