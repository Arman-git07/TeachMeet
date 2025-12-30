
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

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
  blockUser: (userId: string, settings: BlockSettings, scope: BlockScope) => void;
  unblockUser: (userId: string) => void;
  isBlocked: (userId: string, feature: keyof BlockSettings) => boolean;
  getBlockSettings: (userId: string) => BlockEntry | undefined;
}

const BlockContext = createContext<BlockContextType | undefined>(undefined);

const getPersistentBlockedUsersKey = (currentUserId: string) => `teachmeet-blocked-users-${currentUserId}`;

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Map<string, BlockEntry>>(new Map());

  useEffect(() => {
    if (user?.uid) {
      const key = getPersistentBlockedUsersKey(user.uid);
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const persistentBlocks = new Map<string, BlockEntry>(Object.entries(parsed));
          setBlockedUsers(prev => new Map([...prev, ...persistentBlocks]));
        } catch (e) {
          console.error("Failed to parse persistent blocked users:", e);
        }
      }
    }
  }, [user?.uid]);

  const blockUser = useCallback((userId: string, settings: BlockSettings, scope: BlockScope) => {
    if (!user?.uid) return;

    const newEntry: BlockEntry = { userId, settings, scope };
    
    // Update in-memory state for immediate effect
    setBlockedUsers(prev => new Map(prev).set(userId, newEntry));
    
    // If persistent, update localStorage
    if (scope === 'allMeetings') {
      const key = getPersistentBlockedUsersKey(user.uid);
      const stored = localStorage.getItem(key) || '{}';
      try {
        const parsed = JSON.parse(stored);
        parsed[userId] = newEntry;
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch(e) {
        console.error("Failed to save persistent block:", e);
      }
    }
  }, [user?.uid]);

  const unblockUser = useCallback((userId: string) => {
    if (!user?.uid) return;

    // Remove from in-memory state
    setBlockedUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });

    // Remove from persistent storage
    const key = getPersistentBlockedUsersKey(user.uid);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        delete parsed[userId];
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch (e) {
        console.error("Failed to remove persistent block:", e);
      }
    }
  }, [user?.uid]);

  const isBlocked = useCallback((userId: string, feature: keyof BlockSettings): boolean => {
    const entry = blockedUsers.get(userId);
    return entry?.settings[feature] ?? false;
  }, [blockedUsers]);

  const getBlockSettings = useCallback((userId: string): BlockEntry | undefined => {
    return blockedUsers.get(userId);
  }, [blockedUsers]);
  

  const value = { blockedUsers, blockUser, unblockUser, isBlocked, getBlockSettings };

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};

export const useBlock = (): BlockContextType => {
  const context = useContext(BlockContext);
  if (context === undefined) {
    throw new Error('useBlock must be used within a BlockProvider');
  }
  return context;
};
