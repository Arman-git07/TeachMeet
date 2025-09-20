
'use client';

import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelLeftOpen } from 'lucide-react';
import { UserProfileDropdown } from '@/components/common/UserProfileDropdown';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/utils';

export function DashboardHeader() {
  const { headerContent } = useDynamicHeader();

  // The base header now always includes the user profile and theme toggle.
  return (
    <header className={cn(
        "sticky top-0 z-40 w-full",
        headerContent && "border-b bg-background/80 backdrop-blur-md"
    )}>
      <div className={cn(
          "container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8",
          headerContent ? "h-16" : "h-12"
      )}>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sidebar trigger for mobile */}
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          {/* Sidebar trigger for desktop */}
          <SidebarTrigger className="hidden md:flex" />
        </div>
        
        {/* Dynamic content area in the middle */}
        <div className="flex-grow flex items-center px-4">
          {headerContent}
        </div>
        
        {/* Always visible right-side controls */}
        <div className="flex items-center gap-2">
          <UserProfileDropdown />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
