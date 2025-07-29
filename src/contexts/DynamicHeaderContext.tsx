
'use client';
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface DynamicHeaderContextType {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
  headerAction: ReactNode | null;
  setHeaderAction: (action: ReactNode | null) => void;
}

const DynamicHeaderContext = createContext<DynamicHeaderContextType | undefined>(undefined);

export const DynamicHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  const [headerAction, setHeaderAction] = useState<ReactNode | null>(null);

  const setHeaderContentCallback = useCallback((content: ReactNode | null) => {
    setHeaderContent(content);
  }, []);

  const setHeaderActionCallback = useCallback((action: ReactNode | null) => {
    setHeaderAction(action);
  }, []);


  return (
    <DynamicHeaderContext.Provider value={{ headerContent, setHeaderContent: setHeaderContentCallback, headerAction, setHeaderAction: setHeaderActionCallback }}>
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
