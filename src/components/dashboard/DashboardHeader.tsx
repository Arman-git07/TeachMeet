
'use client';

import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelLeftOpen, MoreVertical, Brush, MessageSquare, Users, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';

export function DashboardHeader() {
  const { headerContent } = useDynamicHeader();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');

  const meetingId = useMemo(() => {
    const parts = pathname.split('/');
    const meetingIndex = parts.indexOf('meeting');
    if (meetingIndex !== -1 && parts.length > meetingIndex + 1) {
      const potentialId = parts[meetingIndex + 1];
      // Ensure it's a valid meeting ID and not a sub-page like 'chat'
      if (potentialId && !['chat', 'participants', 'whiteboard', 'prejoin', 'wait'].includes(potentialId)) {
        return potentialId;
      }
    }
    // Fallback for sub-pages
    const meetingIdFromParams = searchParams.get('meetingId');
    if(meetingIdFromParams) return meetingIdFromParams;
    
    // Check if we are on a subpage and extract from path
    if (meetingIndex !== -1 && parts.length > meetingIndex + 1) {
        return parts[meetingIndex+1];
    }
    
    return null;
  }, [pathname, searchParams]);

  const isMeetingRelatedPage = !!meetingId;
  
  const constructUrl = (page: string) => {
    let url = `/dashboard/meeting/${meetingId}/${page}`;
    if (topic) {
        url += `?topic=${encodeURIComponent(topic)}`;
    }
    return url;
  };

  return (
    <header className={cn(
        "sticky top-0 z-40 w-full",
        "border-b bg-background/80 backdrop-blur-md"
    )}>
      <div className={cn(
          "container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16"
      )}>
        <div className="flex items-center gap-2 sm:gap-4">
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          <SidebarTrigger className="hidden md:flex" />
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
                  <Link href={constructUrl('whiteboard')}>
                    <Brush className="mr-2 h-4 w-4" />
                    <span>Whiteboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                   <Link href={constructUrl('chat')}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Chat</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                   <Link href={constructUrl('participants')}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Participants</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic || '')}`}>
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
