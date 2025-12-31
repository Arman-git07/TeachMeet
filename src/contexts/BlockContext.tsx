
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

const LOCAL_STORAGE_BLOCK_KEY = 'teachmeet-persistent-blocks';

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { rtc } = useMeetingRTC();
  const [blockedUsers, setBlockedUsers] = useState<Map<string, BlockEntry>>(new Map());
  const [usersWhoBlockedMe, setUsersWhoBlockedMe] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (!user) return;
    try {
        const storedBlocks = localStorage.getItem(`${LOCAL_STORAGE_BLOCK_KEY}-${user.uid}`);
        if (storedBlocks) {
            const parsed = JSON.parse(storedBlocks);
            setBlockedUsers(new Map(parsed));
        }
    } catch (e) {
        console.error("Failed to load persistent blocks from localStorage", e);
    }
  }, [user]);

  useEffect(() => {
    if (!rtc) return;

    const handleInitialBlockList = (blockerIds: string[]) => {
      setUsersWhoBlockedMe(new Set(blockerIds));
    };
    const handleUserBlockedMe = (blockerId: string) => {
      setUsersWhoBlockedMe(prev => new Set(prev).add(blockerId));
    };
    const handleUserUnblockedMe = (unblockerId: string) => {
      setUsersWhoBlockedMe(prev => {
        const next = new Set(prev);
        next.delete(unblockerId);
        return next;
      });
    };

    rtc.socket.on('initial-block-list', handleInitialBlockList);
    rtc.socket.on('user-blocked-me', handleUserBlockedMe);
    rtc.socket.on('user-unblocked-me', handleUserUnblockedMe);

    return () => {
      rtc.socket.off('initial-block-list', handleInitialBlockList);
      rtc.socket.off('user-blocked-me', handleUserBlockedMe);
      rtc.socket.off('user-unblocked-me', handleUserUnblockedMe);
    };
  }, [rtc]);
  
  const blockUser = useCallback((userId: string, settings: BlockSettings, scope: BlockScope) => {
    const newEntry: BlockEntry = { userId, settings, scope };
    
    setBlockedUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, newEntry);
        if (scope === 'allMeetings' && user) {
            localStorage.setItem(`${LOCAL_STORAGE_BLOCK_KEY}-${user.uid}`, JSON.stringify(Array.from(newMap.entries())));
        }
        return newMap;
    });

    rtc?.socket.emit('block-user', { blockedUserId: userId });
  }, [user, rtc]);

  const unblockUser = useCallback((userId: string) => {
     setBlockedUsers(prev => {
        const newMap = new Map(prev);
        const entry = newMap.get(userId);
        if (entry) {
            newMap.delete(userId);
            if (entry.scope === 'allMeetings' && user) {
                localStorage.setItem(`${LOCAL_STORAGE_BLOCK_KEY}-${user.uid}`, JSON.stringify(Array.from(newMap.entries())));
            }
        }
        return newMap;
    });
    rtc?.socket.emit('unblock-user', { unblockedUserId: userId });
  }, [user, rtc]);
  
  const getBlockSettings = useCallback((userId: string): BlockEntry | undefined => {
      return blockedUsers.get(userId);
  }, [blockedUsers]);

  const isBlockedByMe = useCallback((userId: string, feature: keyof BlockSettings): boolean => {
    const entry = blockedUsers.get(userId);
    return !!entry && entry.settings[feature];
  }, [blockedUsers]);
  
  const amIBlockedBy = useCallback((userId: string, feature: keyof BlockSettings): boolean => {
    // For now, we assume if someone blocks you, they block private chat.
    // This can be expanded if the server sends granular block settings.
    if (feature === 'privateChat' && usersWhoBlockedMe.has(userId)) {
        return true;
    }
    // Extend for other features if needed
    return false;
  }, [usersWhoBlockedMe]);

  return (
    <BlockContext.Provider value={{ blockedUsers, usersWhoBlockedMe, blockUser, unblockUser, isBlockedByMe, amIBlockedBy, getBlockSettings }}>
      {children}
    </BlockContext.Provider>
  );
};

export const useBlock = (): BlockContextType => {
  const context = useContext(BlockContext);
  if (context === undefined) {
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
