
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle, History, FileText, Clapperboard, Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where, Timestamp } from 'firebase/firestore';

type ActivityItemType = 'meeting' | 'document' | 'recording';

interface BaseActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  timestamp: number;
}

interface MeetingActivityItem extends BaseActivityItem {
  type: 'meeting';
  participants?: number;
}

interface DocumentActivityItem extends BaseActivityItem {
  type: 'document';
  isPrivate: boolean;
}

interface RecordingActivityItem extends BaseActivityItem {
  type: 'recording';
  isPrivate: boolean;
  thumbnailUrl?: string;
}

type ActivityItem = MeetingActivityItem | DocumentActivityItem | RecordingActivityItem;


const DISMISSED_ITEMS_KEY = 'teachmeet-dismissed-items';
const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

const itemIcons: Record<ActivityItemType, React.ElementType> = {
  meeting: Video,
  document: FileText,
  recording: Clapperboard,
};

const itemLinks: Record<ActivityItemType, (id: string, item: any) => string> = {
  meeting: (id, item) => `/dashboard/meeting/${id}/wait?topic=${encodeURIComponent(item.title)}`,
  document: (id) => `/dashboard/documents`,
  recording: (id) => `/dashboard/recordings`,
};

export default function HomePage() {
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logoText, setLogoText] = useState('TeachMeet');
  const [animateChars, setAnimateChars] = useState(false);
  const [animationLock, setAnimationLock] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    let combinedUnsubscribers: (() => void)[] = [];

    const loadActivities = () => {
      setIsLoading(true);

      // 1. Get dismissed items
      const dismissedItemsRaw = localStorage.getItem(DISMISSED_ITEMS_KEY);
      let dismissedItemIds: string[] = [];
      try {
        dismissedItemIds = dismissedItemsRaw ? JSON.parse(dismissedItemsRaw) : [];
        if (!Array.isArray(dismissedItemIds)) dismissedItemIds = [];
      } catch (e) {
        console.error("Error parsing dismissed items:", e);
        dismissedItemIds = [];
      }

      // 2. Process meetings from localStorage
      const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
      let activeMeetings: MeetingActivityItem[] = [];
      try {
          const storedMeetings = startedMeetingsRaw ? JSON.parse(startedMeetingsRaw) : [];
          if (Array.isArray(storedMeetings)) {
              const now = Date.now();
              storedMeetings.forEach(meeting => {
                  if (meeting.startedAt && (now - meeting.startedAt > TWO_HOURS_IN_MS) && !dismissedItemIds.includes(`meeting-${meeting.id}`)) {
                      dismissedItemIds.push(`meeting-${meeting.id}`);
                  }
              });
              activeMeetings = storedMeetings.map(m => ({ ...m, type: 'meeting', id: `meeting-${m.id}`, timestamp: m.startedAt || now }));
          }
      } catch (e) { console.error("Error parsing started meetings:", e); }
      localStorage.setItem(DISMISSED_ITEMS_KEY, JSON.stringify(dismissedItemIds));


      let firestoreActivities: ActivityItem[] = [];

      // 3. Set up Firestore listeners for documents and recordings
      const collectionsToQuery: ActivityItemType[] = ['document', 'recording'];
      collectionsToQuery.forEach(type => {
        const pluralType = `${type}s` as 'documents' | 'recordings';
        const q = query(collection(db, pluralType), orderBy("createdAt", "desc"), limit(5));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newItems = snapshot.docs.map(doc => {
            const data = doc.data();
            const isVisible = user ? (data.isPrivate ? data.uploaderId === user.uid : true) : !data.isPrivate;
            if (!isVisible) return null;

            const createdAt = (data.createdAt as Timestamp)?.toDate().getTime() || Date.now();
            return {
              id: `${type}-${doc.id}`,
              type: type,
              title: data.name || 'Untitled',
              timestamp: createdAt,
              isPrivate: data.isPrivate,
              ...(type === 'recording' && { thumbnailUrl: data.thumbnailUrl }),
            } as ActivityItem;
          }).filter((item): item is ActivityItem => item !== null);

          firestoreActivities = [...firestoreActivities.filter(item => item.type !== type), ...newItems];
          
          const combined = [...activeMeetings, ...firestoreActivities]
            .filter(item => !dismissedItemIds.includes(item.id))
            .sort((a, b) => b.timestamp - a.timestamp);
            
          setAllActivity(combined);
          setIsLoading(false);
        }, (error) => {
          console.error(`Error fetching ${pluralType}:`, error);
          setIsLoading(false);
        });
        combinedUnsubscribers.push(unsubscribe);
      });

    };

    loadActivities();

    const handleMeetingStarted = () => loadActivities();
    window.addEventListener('teachmeet_meeting_started', handleMeetingStarted);

    return () => {
      window.removeEventListener('teachmeet_meeting_started', handleMeetingStarted);
      combinedUnsubscribers.forEach(unsub => unsub());
    };
  }, [user]);


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
            backgroundSize: "30px 30px, 30px 30px",
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
            {isLoading ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                  <p className="ml-2 text-muted-foreground">Loading activities...</p>
                </div>
              ) : allActivity.length > 0 ? (
              <ul className="space-y-3 text-left">
                {allActivity.map((item) => {
                  const Icon = itemIcons[item.type];
                  const rawId = item.id.split('-').slice(1).join('-');
                  const link = itemLinks[item.type](rawId, item);
                  return (
                    <li key={item.id} className="flex items-center gap-2">
                      <Link
                        href={link}
                        className="w-full justify-start text-base py-3 px-4 rounded-lg hover:border-primary flex items-center border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none flex-grow"
                      >
                        <Icon className="mr-3 h-5 w-5 text-primary/80" />
                        <span className="truncate flex-grow text-foreground">{getNotificationText(item)}</span>
                        {item.type === 'meeting' && item.participants && (
                          <span className="text-xs text-muted-foreground ml-auto pl-2 flex items-center">
                            <UsersIcon className="h-3 w-3 mr-1" />
                            {item.participants}
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
                <p className="text-sm">Start a new meeting or upload a file to get started!</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <SlideUpPanel />
    </div>
  );
}
