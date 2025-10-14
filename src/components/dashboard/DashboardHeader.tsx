
'use client';

import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { cn } from '@/lib/utils';
import { PanelLeftOpen } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';

export function DashboardHeader() {
  const { headerContent, headerAction } = useDynamicHeader();
  
  // Render nothing if there's no dynamic content to display.
  // This is useful for pages that want a completely clean layout.
  if (!headerContent && !headerAction) {
    return null;
  }
  
  return (
    <header className={cn(
        "sticky top-0 z-40 w-full flex-shrink-0",
        "border-b bg-background/80 backdrop-blur-md"
    )}>
      <div className={cn(
          "container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16"
      )}>
        <div className="flex items-center gap-2 sm:gap-4">
           <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
           {headerContent}
        </div>
        {headerAction && (
            <div className="flex items-center gap-2">
                {headerAction}
            </div>
        )}
      </div>
    </header>
  );
}
