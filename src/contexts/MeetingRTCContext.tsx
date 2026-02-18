'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { MeshRTC } from '@/lib/webrtc/mesh';

interface RecordingControls {
  start: () => Promise<void>;
  stop: (destination: 'private' | 'public') => Promise<void>;
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
  });

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
