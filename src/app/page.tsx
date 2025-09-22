
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle, History, FileText, Clapperboard, Loader2, AtSign, Megaphone } from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';


export type ActivityItemType = 'meeting' | 'document' | 'recording' | 'chatMention' | 'announcement';

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

export type ActivityItem = MeetingActivityItem | DocumentActivityItem | RecordingActivityItem | ChatMentionActivityItem | AnnouncementActivityItem;


const DISMISSED_ITEMS_KEY = 'teachmeet-dismissed-items';
const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';
const LATEST_ACTIVITY_KEY = 'teachmeet-latest-activity';
const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;

const itemIcons: Record<ActivityItemType, React.ElementType> = {
  meeting: Video,
  document: FileText,
  recording: Clapperboard,
  chatMention: AtSign,
  announcement: Megaphone,
};

const itemLinks: Record<ActivityItemType, (id: string, item: any) => string> = {
  meeting: (id, item) => `/dashboard/meeting/${id}?topic=${encodeURIComponent(item.title)}`,
  document: (id) => `/dashboard/documents`,
  recording: (id) => `/dashboard/recordings`,
  chatMention: (id, item) => `/dashboard/classrooms`, // Link to classrooms page for now
  announcement: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
};

export default function HomePage() {
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logoText, setLogoText] = useState('TeachMeet');
  const [animateChars, setAnimateChars] = useState(false);
  const [animationLock, setAnimationLock] = useState(false);

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const loadActivities = useCallback(() => {
    setIsLoading(true);

    const dismissedItemsRaw = localStorage.getItem(DISMISSED_ITEMS_KEY);
    const dismissedItemIds: string[] = dismissedItemsRaw ? JSON.parse(dismissedItemsRaw) : [];
    
    const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
    let ongoingMeetings: MeetingActivityItem[] = [];

    if (user && startedMeetingsRaw) {
      try {
        let storedMeetings = JSON.parse(startedMeetingsRaw);
        if (Array.isArray(storedMeetings)) {
          const now = Date.now();
          const validMeetings = storedMeetings.filter(meeting => meeting && meeting.id && meeting.startedAt && (now - meeting.startedAt < THIRTY_MINUTES_IN_MS));
          
          if(validMeetings.length < storedMeetings.length) {
            localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(validMeetings));
          }

          ongoingMeetings = validMeetings.map((m: any) => ({
            type: 'meeting',
            id: m.id, // Use the raw meetingId
            title: m.title || "Ongoing Meeting",
            timestamp: m.startedAt,
          }));
        }
      } catch (e) {
        console.error("Failed to parse started meetings from localStorage", e);
        localStorage.removeItem(STARTED_MEETINGS_KEY); // Clear corrupted data
      }
    }
    
    const latestActivityRaw = localStorage.getItem(LATEST_ACTIVITY_KEY);
    const otherActivities = latestActivityRaw ? JSON.parse(latestActivityRaw) : [];

    const combined = [...ongoingMeetings, ...otherActivities]
      .filter(item => !dismissedItemIds.includes(item.id))
      .sort((a, b) => b.timestamp - a.timestamp);

    setAllActivity(combined);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    // We only want to load activities once authentication is resolved.
    if (authLoading) return;

    loadActivities();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STARTED_MEETINGS_KEY || event.key === DISMISSED_ITEMS_KEY || event.key === LATEST_ACTIVITY_KEY) {
        loadActivities();
      }
    };
    
    // Listen for changes from other tabs
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom events dispatched from within the app
    window.addEventListener('teachmeet_meeting_started', loadActivities);
    window.addEventListener('teachmeet_meeting_ended', loadActivities);
    window.addEventListener('teachmeet_activity_updated', loadActivities);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('teachmeet_meeting_started', loadActivities);
      window.removeEventListener('teachmeet_meeting_ended', loadActivities);
      window.removeEventListener('teachmeet_activity_updated', loadActivities);
    };
  }, [authLoading, loadActivities]);


  const tmVisibleDuration = 350;
  const characterAnimationTotalDuration = 1000;

  const handleComplexLogoAnimation = () => {
    if (animationLock) return;

    setAnimationLock(true);
    setAnimateChars(false);
    setLogoText('TM');

    setTimeout(() => {
      setLogoText('TeachMeet');
      setAnimateChars(true);
      setTimeout(() => {
        setAnimateChars(false);
        setAnimationLock(false);
      }, characterAnimationTotalDuration);
    }, tmVisibleDuration);
  };

  const handleDismissItem = (itemIdToDismiss: string) => {
    const key = DISMISSED_ITEMS_KEY;
    const dismissedIdsString = localStorage.getItem(key);
    let dismissedIds: string[] = [];
    try {
        dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
        if (!Array.isArray(dismissedIds)) dismissedIds = [];
    } catch (e) {
      console.error(`Error parsing dismissed items from ${key}:`, e);
      dismissedIds = [];
    }

    if (!dismissedIds.includes(itemIdToDismiss)) {
      dismissedIds.push(itemIdToDismiss);
      localStorage.setItem(key, JSON.stringify(dismissedIds));
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
      default: return item.title;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={false} />
      <main className="flex-grow flex flex-col items-center justify-center overflow-hidden px-4 relative">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px), radial-gradient(hsl(var(--accent)) 1px, transparent 1px)",
            backgroundSize: "30px 30px, 30px 15px",
            backgroundPosition: "0 0, 15px 15px",
            maskImage: "radial-gradient(circle at center, white, transparent 70%)"
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <Logo
            text={logoText}
            size="medium"
            className={cn(
              'mb-8 text-center cursor-pointer',
              animateChars && logoText === 'TeachMeet' && 'logo-animate-complex'
            )}
            onClick={handleComplexLogoAnimation}
            animateChars={animateChars && logoText === 'TeachMeet'}
          />
          <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md text-center">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center justify-center">
              <History className="mr-3 h-6 w-6" />
              Latest Activity
            </h2>
            {isLoading || authLoading ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                  <p className="ml-2 text-muted-foreground">Checking for activities...</p>
                </div>
              ) : allActivity.length > 0 ? (
              <ul className="space-y-3 text-left">
                {allActivity.map((item) => {
                  const Icon = itemIcons[item.type];
                  const rawId = item.id;
                  const link = itemLinks[item.type](rawId, item);
                  return (
                    <li key={item.id} className="flex items-center gap-2">
                      <Link
                        href={link}
                        className="w-full justify-start text-base py-3 px-4 rounded-lg hover:border-primary flex items-center border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none flex-grow"
                      >
                        <Icon className="mr-3 h-5 w-5 text-primary/80" />
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
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="mb-2">No recent activity.</p>
                <p className="text-sm">Start a new meeting to get started!</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <SlideUpPanel />
    </div>
  );
}
