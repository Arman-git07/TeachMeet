
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

const getPersistentBlockedUsersKey = (currentUserId: string) => `teachmeet-blocked-users-${currentUserId}`;

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { rtc } = useMeetingRTC();
  const [blockedUsers, setBlockedUsers] = useState<Map<string, BlockEntry>>(new Map());
  const [usersWhoBlockedMe, setUsersWhoBlockedMe] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.uid) {
      const key = getPersistentBlockedUsersKey(user.uid);
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Record<string, BlockEntry>;
          const persistentBlocks = new Map<string, BlockEntry>();
          for (const [userId, entry] of Object.entries(parsed)) {
            // Ensure only valid entries are loaded
            if (entry && entry.userId && entry.scope === 'allMeetings') {
              persistentBlocks.set(userId, entry);
            }
          }
          setBlockedUsers(prev => new Map([...prev, ...persistentBlocks]));
        } catch (e) {
          console.error("Failed to parse persistent blocked users:", e);
        }
      }
    }
  }, [user?.uid]);
  
  useEffect(() => {
    if (!rtc || !rtc.socket) return;
    
    const handleBlockList = (blockList: string[]) => {
      setUsersWhoBlockedMe(new Set(blockList));
    };

    const handleUserBlockedMe = (blockerId: string) => {
      setUsersWhoBlockedMe(prev => new Set(prev).add(blockerId));
    };

    const handleUserUnblockedMe = (unblockerId: string) => {
      setUsersWhoBlockedMe(prev => {
        const newSet = new Set(prev);
        newSet.delete(unblockerId);
        return newSet;
      });
    };
    
    rtc.socket.on('initial-block-list', handleBlockList);
    rtc.socket.on('user-blocked-me', handleUserBlockedMe);
    rtc.socket.on('user-unblocked-me', handleUserUnblockedMe);

    return () => {
      rtc.socket.off('initial-block-list', handleBlockList);
      rtc.socket.off('user-blocked-me', handleUserBlockedMe);
      rtc.socket.off('user-unblocked-me', handleUserUnblockedMe);
    };
  }, [rtc]);


  const blockUser = useCallback((userId: string, settings: BlockSettings, scope: BlockScope) => {
    if (!user?.uid || !rtc?.socket) return;

    const newEntry: BlockEntry = { userId, settings, scope };
    
    setBlockedUsers(prev => new Map(prev).set(userId, newEntry));
    rtc.socket.emit('block-user', { blockedUserId: userId });
    
    if (scope === 'allMeetings') {
      const key = getPersistentBlockedUsersKey(user.uid);
      try {
        const stored = localStorage.getItem(key) || '{}';
        const parsed = JSON.parse(stored);
        parsed[userId] = newEntry;
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch(e) {
        console.error("Failed to save persistent block:", e);
      }
    }
  }, [user?.uid, rtc]);

  const unblockUser = useCallback((userId: string) => {
    if (!user?.uid || !rtc?.socket) return;

    setBlockedUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
    rtc.socket.emit('unblock-user', { unblockedUserId: userId });

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
  }, [user?.uid, rtc]);

  const isBlockedByMe = useCallback((userId: string, feature: keyof BlockSettings): boolean => {
    const entry = blockedUsers.get(userId);
    return entry?.settings[feature] ?? false;
  }, [blockedUsers]);
  
  const amIBlockedBy = useCallback((userId: string, feature: keyof BlockSettings): boolean => {
    // This is a simplification. The server should ideally send the specific settings.
    // For now, if someone blocks us, we assume all features are blocked for safety.
    return usersWhoBlockedMe.has(userId);
  }, [usersWhoBlockedMe]);


  const getBlockSettings = useCallback((userId: string): BlockEntry | undefined => {
    return blockedUsers.get(userId);
  }, [blockedUsers]);
  

  const value = { blockedUsers, usersWhoBlockedMe, blockUser, unblockUser, isBlockedByMe, amIBlockedBy, getBlockSettings };

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
