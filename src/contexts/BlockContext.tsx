
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface BlockContextType {
  blockedUsers: Set<string>;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  isBlocked: (userId: string) => boolean;
}

const BlockContext = createContext<BlockContextType | undefined>(undefined);

const getStorageKey = (userId: string | undefined) => userId ? `teachmeet-blocked-users-${userId}` : null;

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const storageKey = getStorageKey(user?.uid);
    if (storageKey) {
      try {
        const storedBlocked = localStorage.getItem(storageKey);
        if (storedBlocked) {
          setBlockedUsers(new Set(JSON.parse(storedBlocked)));
        }
      } catch (e) {
        console.error("Failed to parse blocked users from localStorage", e);
      }
    }
  }, [user]);

  const updateStorage = (newSet: Set<string>) => {
    const storageKey = getStorageKey(user?.uid);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
    }
  };

  const blockUser = useCallback((userId: string) => {
    setBlockedUsers(prev => {
      const newSet = new Set(prev);
      newSet.add(userId);
      updateStorage(newSet);
      return newSet;
    });
  }, [user?.uid]);

  const unblockUser = useCallback((userId: string) => {
    setBlockedUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      updateStorage(newSet);
      return newSet;
    });
  }, [user?.uid]);

  const isBlocked = useCallback((userId: string) => {
    return blockedUsers.has(userId);
  }, [blockedUsers]);

  return (
    <BlockContext.Provider value={{ blockedUsers, blockUser, unblockUser, isBlocked }}>
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
