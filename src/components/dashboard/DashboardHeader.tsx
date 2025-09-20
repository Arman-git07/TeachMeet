
'use client';

import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelLeftOpen, MoreVertical, Brush, MessageSquare, Users, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';

export function DashboardHeader() {
  const { headerContent } = useDynamicHeader();
  const pathname = usePathname();

  const meetingId = useMemo(() => {
    const parts = pathname.split('/');
    const meetingIndex = parts.indexOf('meeting');
    if (meetingIndex !== -1 && parts.length > meetingIndex + 1) {
      return parts[meetingIndex + 1];
    }
    return null;
  }, [pathname]);

  const isMeetingRelatedPage = !!meetingId;

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
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          <SidebarTrigger className="hidden md:flex" />
        </div>
        
        <div className="flex-grow flex items-center px-4">
          {headerContent}
        </div>
        
        <div className="flex items-center gap-2">
          {isMeetingRelatedPage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-56">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/dashboard/meeting/${meetingId}/whiteboard`}>
                    <Brush className="mr-2 h-4 w-4" />
                    <span>Whiteboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                   <Link href={`/dashboard/meeting/${meetingId}/chat`}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Chat</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                   <Link href={`/dashboard/meeting/${meetingId}/participants`}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Participants</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/dashboard/settings?highlight=advancedMeetingSettings`}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Meeting Settings</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
