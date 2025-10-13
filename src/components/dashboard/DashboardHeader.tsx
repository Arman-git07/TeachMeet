
'use client';

import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { cn } from '@/lib/utils';

export function DashboardHeader() {
  const { headerContent, headerAction } = useDynamicHeader();
  
  return (
    <header className={cn(
        "sticky top-0 z-40 w-full",
        "border-b bg-background/80 backdrop-blur-md"
    )}>
      <div className={cn(
          "container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16"
      )}>
        <div className="flex items-center gap-2 sm:gap-4">
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
