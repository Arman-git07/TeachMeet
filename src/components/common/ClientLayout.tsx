'use client';

import React from 'react';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { PanelLeftOpen } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-1 bg-background">
        <AppSidebar />
        <SidebarInset>
          {/* This trigger is for mobile view, placed within the main content area */}
          <div className="md:hidden p-4 border-b">
              <SidebarTrigger>
                <PanelLeftOpen className="h-6 w-6" />
              </SidebarTrigger>
          </div>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
