'use client';

import React from 'react';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/useAuth';
import { SidebarInset } from '@/components/ui/sidebar';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex flex-1 bg-background"> 
            <AppSidebar />
            <SidebarInset>
              {children}
            </SidebarInset>
          </div>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
