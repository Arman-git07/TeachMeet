
'use client';

import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelLeftOpen } from 'lucide-react';

export function DashboardHeader() {
  const { headerContent, headerAction } = useDynamicHeader();

  // If there's no dynamic content, render a minimal header.
  if (!headerContent) {
    return (
      <header className="sticky top-0 z-40 w-full">
        <div className="container mx-auto flex h-12 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            {/* Sidebar trigger for mobile */}
            <SidebarTrigger className="md:hidden">
              <PanelLeftOpen className="h-6 w-6" />
            </SidebarTrigger>
            {/* Sidebar trigger for desktop */}
            <SidebarTrigger className="hidden md:flex" />
          </div>
        </div>
      </header>
    );
  }

  // Render the full header when dynamic content is provided
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          <SidebarTrigger className="hidden md:flex" />
        </div>
        <div className="flex-grow flex items-center px-4">
          {headerContent}
        </div>
        <div className="w-auto flex-shrink-0">
          {headerAction}
        </div>
      </div>
    </header>
  );
}
