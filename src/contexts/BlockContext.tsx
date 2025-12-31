
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMeetingRTC } from './MeetingRTCContext';

export interface BlockSettings {
  privateChat: boolean;
  publicChat: boolean;
  video: boolean;
  audio: boolean;
}

export type BlockScope = 'thisMeeting' | 'allMeetings';

interface BlockEntry {
  userId: string;
  settings: BlockSettings;
  scope: BlockScope;
}

interface BlockContextType {
  blockedUsers: Map<string, BlockEntry>;
  usersWhoBlockedMe: Set<string>;
  blockUser: (userId: string, settings: BlockSettings, scope: BlockScope) => void;
  unblockUser: (userId: string) => void;
  isBlockedByMe: (userId: string, feature: keyof BlockSettings) => boolean;
  amIBlockedBy: (userId: string, feature: keyof BlockSettings) => boolean;
  getBlockSettings: (userId: string) => BlockEntry | undefined;
}

const BlockContext = createContext<BlockContextType | undefined>(undefined);

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  // All functionality is removed, but provider remains to avoid crashes.
  const value = {
    blockedUsers: new Map(),
    usersWhoBlockedMe: new Set(),
    blockUser: () => {},
    unblockUser: () => {},
    isBlockedByMe: () => false,
    amIBlockedBy: () => false,
    getBlockSettings: () => undefined,
  };

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};

export const useBlock = (): BlockContextType => {
  const context = useContext(BlockContext);
  if (context === undefined) {
    // This provides a fallback for components that might use this context
    // outside of a meeting, preventing a hard crash.
    return {
      blockedUsers: new Map(),
      usersWhoBlockedMe: new Set(),
      blockUser: () => {},
      unblockUser: () => {},
      isBlockedByMe: () => false,
      amIBlockedBy: () => false,
      getBlockSettings: () => undefined,
    };
  }
  return context;
};
