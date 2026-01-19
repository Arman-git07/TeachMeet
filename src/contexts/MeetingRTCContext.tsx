
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

interface RecordingControls {
  start: () => Promise<void>;
  stop: (destination: 'private' | 'public') => Promise<void>;
}

interface MeetingRTCContextType {
  rtc: MeshRTC | null;
  setRtc: (rtc: MeshRTC | null) => void;
  chatHistory: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaveRecordingDialogOpen, setIsSaveRecordingDialogOpen] = useState(false);
  const [recordingControls, setRecordingControls] = useState<RecordingControls>({
    start: async () => console.warn('startRecording not implemented'),
    stop: async (destination) => console.warn('stopRecording not implemented'),
  });

  const addChatMessage = useCallback((message: ChatMessage) => {
    setChatHistory(prev => [...prev, message]);
  }, []);

  return (
    <MeetingRTCContext.Provider value={{ 
      rtc, setRtc, 
      chatHistory, addChatMessage,
      isChatOpen, setIsChatOpen,
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
