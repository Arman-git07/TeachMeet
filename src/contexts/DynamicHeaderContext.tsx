
'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DynamicHeaderContextType {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
  // Could add a slot for right-aligned content in the future if needed
  // headerActions: ReactNode | null;
  // setHeaderActions: (actions: ReactNode | null) => void;
}

const DynamicHeaderContext = createContext<DynamicHeaderContextType | undefined>(undefined);

export const DynamicHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  // const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);

  return (
    <DynamicHeaderContext.Provider value={{ headerContent, setHeaderContent /*, headerActions, setHeaderActions */ }}>
      {children}
    </DynamicHeaderContext.Provider>
  );
};

export const useDynamicHeader = () => {
  const context = useContext(DynamicHeaderContext);
  if (context === undefined) {
    throw new Error('useDynamicHeader must be used within a DynamicHeaderProvider');
  }
  return context;
};
