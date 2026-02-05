'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle, History, FileText, Clapperboard, Loader2, AtSign, Megaphone, UserPlus } from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export type ActivityItemType = 'meeting' | 'document' | 'recording' | 'chatMention' | 'announcement' | 'joinRequest';

interface BaseActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  timestamp: number;
}

export interface MeetingActivityItem extends BaseActivityItem {
  type: 'meeting';
  participants?: number;
}

export interface DocumentActivityItem extends BaseActivityItem {
  type: 'document';
  isPrivate: boolean;
}

export interface RecordingActivityItem extends BaseActivityItem {
  type: 'recording';
  isPrivate: boolean;
  thumbnailUrl?: string;
}

export interface ChatMentionActivityItem extends BaseActivityItem {
    type: 'chatMention';
    mentionedBy: string;
}

export interface AnnouncementActivityItem extends BaseActivityItem {
    type: 'announcement';
    classroomId: string;
}

export interface JoinRequestActivityItem extends BaseActivityItem {
    type: 'joinRequest';
    classroomId: string;
    requesterName: string;
}

export type ActivityItem = MeetingActivityItem | DocumentActivityItem | RecordingActivityItem | ChatMentionActivityItem | AnnouncementActivityItem | JoinRequestActivityItem;


const DISMISSED_ITEMS_KEY_PREFIX = 'teachmeet-dismissed-items-';
const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';
const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

const itemIcons: Record<ActivityItemType, React.ElementType> = {
  meeting: Video,
  document: FileText,
  recording: Clapperboard,
  chatMention: AtSign,
  announcement: Megaphone,
  joinRequest: UserPlus,
};

const itemLinks: Record<ActivityItemType, (id: string, item: any) => string> = {
  meeting: (id, item) => `/dashboard/meeting/prejoin?meetingId=${id}&topic=${encodeURIComponent(item.title)}&role=host`,
  document: (id) => `/dashboard/documents`,
  recording: (id) => `/dashboard/recordings`,
  chatMention: (id, item) => `/dashboard/classrooms`,
  announcement: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
  joinRequest: (id, item) => `/dashboard/classrooms/${item.classroomId}/requests`,
};

export default function HomePage() {
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const getStorageKeys = useCallback(() => {
    if (!user) return { dismissed: null, started: null, latest: null };
    return {
        dismissed: `${DISMISSED_ITEMS_KEY_PREFIX}${user.uid}`,
        started: `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`,
        latest: `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`,
    };
  }, [user]);
  
  const loadActivities = useCallback(() => {
    if (!user) {
        setIsLoading(false);
        setAllActivity([]);
        return;
    }
    setIsLoading(true);
    
    const { dismissed: DISMISSED_ITEMS_KEY, started: STARTED_MEETINGS_KEY, latest: LATEST_ACTIVITY_KEY } = getStorageKeys();

    if (!DISMISSED_ITEMS_KEY || !STARTED_MEETINGS_KEY || !LATEST_ACTIVITY_KEY) {
        setIsLoading(false);
        return;
    }

    const dismissedItemsRaw = localStorage.getItem(DISMISSED_ITEMS_KEY);
    let dismissedItemIds: string[] = [];
    if (dismissedItemsRaw) {
      try {
        const parsed = JSON.parse(dismissedItemsRaw);
        if (Array.isArray(parsed)) {
          dismissedItemIds = parsed;
        }
      } catch (e) {
        localStorage.removeItem(DISMISSED_ITEMS_KEY);
      }
    }
    
    const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
    let ongoingMeetings: MeetingActivityItem[] = [];

    if (startedMeetingsRaw) {
      try {
        let storedMeetings = JSON.parse(startedMeetingsRaw);
        if (Array.isArray(storedMeetings)) {
          const now = Date.now();
          const validMeetings = storedMeetings.filter(meeting => meeting && meeting.id && meeting.startedAt && (now - meeting.startedAt < TWO_HOURS_IN_MS));
          ongoingMeetings = validMeetings.map((m: any) => ({
            type: 'meeting',
            id: m.id,
            title: m.title || "Ongoing Meeting",
            timestamp: m.startedAt,
          }));
        }
      } catch (e) {
        localStorage.removeItem(STARTED_MEETINGS_KEY);
      }
    }
    
    const latestActivityRaw = localStorage.getItem(LATEST_ACTIVITY_KEY);
    let otherActivities: ActivityItem[] = [];
    if (latestActivityRaw) {
        try {
            const parsed = JSON.parse(latestActivityRaw);
            if (Array.isArray(parsed)) {
                otherActivities = parsed.filter(item => item && item.type && item.type !== 'privateMessage' && item.type !== 'publicChat');
            }
        } catch (e) {
             localStorage.removeItem(LATEST_ACTIVITY_KEY);
        }
    }
    
    const combined = [...ongoingMeetings, ...otherActivities]
      .filter(item => item && item.id && !dismissedItemIds.includes(item.id))
      .sort((a, b) => b.timestamp - a.timestamp);

    setAllActivity(combined);
    setIsLoading(false);
  }, [user, getStorageKeys]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
        setIsLoading(false);
        setAllActivity([]);
        return;
    };

    loadActivities();

    const handleStorageChange = (event: StorageEvent) => {
        const keys = getStorageKeys();
        if (event.key === keys.started || event.key === keys.dismissed || event.key === keys.latest) {
            loadActivities();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('teachmeet_meeting_started', loadActivities);
    window.addEventListener('teachmeet_meeting_ended', loadActivities);
    window.addEventListener('teachmeet_activity_updated', loadActivities);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('teachmeet_meeting_started', loadActivities);
      window.removeEventListener('teachmeet_meeting_ended', loadActivities);
      window.removeEventListener('teachmeet_activity_updated', loadActivities);
    };
  }, [authLoading, isAuthenticated, loadActivities, getStorageKeys]);

  const handleDismissItem = (itemIdToDismiss: string) => {
    const { dismissed: DISMISSED_ITEMS_KEY } = getStorageKeys();
    if (!DISMISSED_ITEMS_KEY) return;
    
    const dismissedIdsString = localStorage.getItem(DISMISSED_ITEMS_KEY);
    let dismissedIds: string[] = [];
    try {
        dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
        if (!Array.isArray(dismissedIds)) dismissedIds = [];
    } catch (e) {
      dismissedIds = [];
    }

    if (!dismissedIds.includes(itemIdToDismiss)) {
      dismissedIds.push(itemIdToDismiss);
      localStorage.setItem(DISMISSED_ITEMS_KEY, JSON.stringify(dismissedIds));
    }

    setAllActivity(prev => prev.filter(item => item.id !== itemIdToDismiss));
    toast({
      title: "Notification Dismissed",
      description: "The item has been removed from your list.",
    });
  };

  const getNotificationText = (item: ActivityItem): string => {
    switch (item.type) {
      case 'meeting': return `Ongoing Meeting: ${item.title}`;
      case 'document': return `New Document: ${item.title}`;
      case 'recording': return `New Recording: ${item.title}`;
      case 'chatMention': return `${(item as ChatMentionActivityItem).mentionedBy} mentioned you: "${item.title}"`;
      case 'announcement': return `New in Classroom: ${item.title}`;
      case 'joinRequest': return `${(item as JoinRequestActivityItem).requesterName} wants to join: "${item.title}"`;
      default: return item.title;
    }
  };

  const renderActivityContent = () => {
    if (authLoading || isLoading) {
      return (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary"/>
          <p className="ml-2 text-muted-foreground">Checking for activities...</p>
        </div>
      );
    }
    
    if (!isAuthenticated) {
        return (
            <div className="text-center py-4 text-muted-foreground">
                <p className="mb-2">
                    <Link href="/auth/signin" className="text-accent font-medium hover:underline">Sign in</Link> to see your recent activity.
                </p>
                <p className="text-sm">Start a new meeting to get started!</p>
            </div>
        );
    }

    if (allActivity.length > 0) {
      return (
        <ul className="space-y-3 text-left">
          {allActivity.map((item) => {
            if (!item || !item.type || !itemLinks[item.type]) return null;
            const Icon = itemIcons[item.type];
            const link = itemLinks[item.type](item.id, item);
            const isMeeting = item.type === 'meeting';

            const handleClick = (e: React.MouseEvent) => {
              if (isMeeting) {
                e.preventDefault();
                router.push(link);
              }
            };

            return (
              <li key={item.id} className="flex items-center gap-2 animate-fade-in">
                <Link
                  href={link}
                  onClick={handleClick}
                  className="w-full justify-start text-base py-3 px-4 rounded-lg hover:border-primary flex items-center border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none flex-grow overflow-hidden"
                >
                  <Icon className="mr-3 h-5 w-5 text-primary/80 flex-shrink-0" />
                  <span className="truncate flex-grow text-foreground">{getNotificationText(item)}</span>
                  {item.type === 'meeting' && (item as MeetingActivityItem).participants && (
                    <span className="text-xs text-muted-foreground ml-auto pl-2 flex items-center">
                      <UsersIcon className="h-3 w-3 mr-1" />
                      {(item as MeetingActivityItem).participants}
                    </span>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive rounded-full p-2 flex-shrink-0"
                  onClick={() => handleDismissItem(item.id)}
                  aria-label="Dismiss item"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </li>
            )
          })}
        </ul>
      );
    }

    return (
      <div className="text-center py-4 text-muted-foreground">
        <p className="mb-2">No recent activity.</p>
        <p className="text-sm">Start a new meeting to get started!</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <AppHeader showLogo={false} />
      <main className="flex-grow flex flex-col items-center justify-center pt-16 sm:pt-4 relative pb-[18rem]">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px), radial-gradient(hsl(var(--accent)) 1px, transparent 1px)",
            backgroundSize: "30px 30px, 30px 15px",
            backgroundPosition: "0 0, 15px 15px",
            maskImage: "radial-gradient(circle at center, white, transparent 70%)"
          }}
        />
        <div className="relative z-10 flex w-full flex-col items-center text-center px-4 overflow-hidden">
          <Logo
            text="TeachMeet"
            size="medium"
            className="mb-8 text-center"
          />
          <div className="mt-8 p-4 sm:p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md text-center border">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center justify-center">
              <History className="mr-3 h-6 w-6" />
              Latest Activity
            </h2>
            {renderActivityContent()}
          </div>
        </div>
      </main>
      <SlideUpPanel />
    </div>
  );
}
