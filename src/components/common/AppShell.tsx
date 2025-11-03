'use client';

import React from 'react';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-1 bg-background">
        <AppSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
