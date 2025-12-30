
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

// A non-functional implementation that returns empty/noop functions
const useBlockHook = (): BlockContextType => {
    return {
        blockedUsers: new Set(),
        blockUser: () => {},
        unblockUser: () => {},
        isBlocked: () => false,
    };
};

export const BlockProvider = ({ children }: { children: ReactNode }) => {
  const value = useBlockHook();
  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};

export const useBlock = (): BlockContextType => {
  const context = useContext(BlockContext);
  if (context === undefined) {
    // This provides a default non-functional value if used outside provider,
    // though our layout should prevent that.
    return useBlockHook();
  }
  return context;
};
