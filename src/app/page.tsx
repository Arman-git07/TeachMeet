
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle, Bell } from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';

interface OngoingMeeting {
  id: string;
  title: string;
  participants?: number;
  startedAt?: number;
}

const DISMISSED_MEETINGS_KEY = 'teachmeet-dismissed-meetings';
const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

export default function HomePage() {
  const [ongoingMeetings, setOngoingMeetings] = useState<OngoingMeeting[]>([]);
  const [logoText, setLogoText] = useState('TeachMeet');
  const [animateChars, setAnimateChars] = useState(false);
  const [animationLock, setAnimationLock] = useState(false);

  const { toast } = useToast();

  const loadOngoingMeetings = () => {
    // --- Load Ongoing Meetings ---
    const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
    let activeMeetings: OngoingMeeting[] = [];
    try {
      activeMeetings = startedMeetingsRaw ? JSON.parse(startedMeetingsRaw) : [];
      if (!Array.isArray(activeMeetings)) activeMeetings = [];
    } catch (e) {
      console.error("[HomePage] Error parsing started meetings:", e);
      activeMeetings = [];
    }

    const dismissedMeetingIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    let dismissedMeetingIds: string[] = [];
    try {
      dismissedMeetingIds = dismissedMeetingIdsString ? JSON.parse(dismissedMeetingIdsString) : [];
      if (!Array.isArray(dismissedMeetingIds)) dismissedMeetingIds = [];
    } catch (e) {
      console.error("[HomePage] Error parsing dismissed meetings:", e);
      dismissedMeetingIds = [];
    }

    const now = Date.now();
    activeMeetings.forEach(meeting => {
      if (meeting.startedAt && (now - meeting.startedAt > TWO_HOURS_IN_MS)) {
        if (!dismissedMeetingIds.includes(meeting.id)) {
          dismissedMeetingIds.push(meeting.id);
        }
      }
    });

    const meetingsToDisplay = activeMeetings
      .filter(meeting => !dismissedMeetingIds.includes(meeting.id))
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    
    setOngoingMeetings(meetingsToDisplay);
  };

  useEffect(() => {
    loadOngoingMeetings();

    const handleMeetingStarted = () => {
      loadOngoingMeetings();
    };

    window.addEventListener('teachmeet_meeting_started', handleMeetingStarted);

    return () => {
      window.removeEventListener('teachmeet_meeting_started', handleMeetingStarted);
    };
  }, []);

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

  const handleDismissMeeting = (meetingIdToDismiss: string) => {
    const key = DISMISSED_MEETINGS_KEY;
    const dismissedIdsString = localStorage.getItem(key);
    let dismissedIds: string[] = [];
    try {
        dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
        if (!Array.isArray(dismissedIds)) dismissedIds = [];
    } catch (e) {
      console.error(`[HomePage] Error parsing dismissed items from ${key}:`, e);
      dismissedIds = [];
    }

    if (!dismissedIds.includes(meetingIdToDismiss)) {
      dismissedIds.push(meetingIdToDismiss);
      localStorage.setItem(key, JSON.stringify(dismissedIds));
    }

    setOngoingMeetings(prev => prev.filter(item => item.id !== meetingIdToDismiss));
    toast({
      title: "Meeting Dismissed",
      description: "The meeting has been removed from your list.",
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={false} />
      {/* Main content area */}
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
              <Bell className="mr-3 h-6 w-6" />
              Ongoing Meetings
            </h2>
            {ongoingMeetings.length > 0 ? (
              <ul className="space-y-3 text-left">
                {ongoingMeetings.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/meeting/${item.id}/wait?topic=${encodeURIComponent(item.title)}`}
                      className="w-full justify-start text-base py-3 px-4 rounded-lg hover:border-primary flex items-center border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none flex-grow"
                    >
                      <Video className="mr-3 h-5 w-5 text-primary/80" />
                      <span className="truncate flex-grow text-foreground">{item.title}</span>
                      {item.participants && (
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
                      onClick={() => handleDismissMeeting(item.id)}
                      aria-label="Dismiss meeting"
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center">No ongoing meetings. Start one now!</p>
            )}
          </div>
        </div>
      </main>
      <SlideUpPanel />
    </div>
  );
}
    