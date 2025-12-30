
'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/useAuth';
import { MeetingRTCProvider } from '@/contexts/MeetingRTCContext';
import { BlockProvider } from '@/contexts/BlockContext';


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
          <BlockProvider>
              {children}
          </BlockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
