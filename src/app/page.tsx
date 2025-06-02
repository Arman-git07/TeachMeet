
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle } from 'lucide-react';
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

  const loadMeetings = () => {
    console.log('[HomePage] loadMeetings: Attempting to load meetings from localStorage.');
    const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
    console.log('[HomePage] loadMeetings: Raw started meetings from localStorage:', startedMeetingsRaw);
    let activeMeetings: OngoingMeeting[] = [];
    try {
      activeMeetings = startedMeetingsRaw ? JSON.parse(startedMeetingsRaw) : [];
      if (!Array.isArray(activeMeetings)) activeMeetings = [];
    } catch (e) {
      console.error("[HomePage] loadMeetings: Error parsing started meetings from localStorage", e);
      localStorage.removeItem(STARTED_MEETINGS_KEY);
      activeMeetings = [];
    }
    console.log('[HomePage] loadMeetings: Parsed activeMeetings:', activeMeetings);

    const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    console.log('[HomePage] loadMeetings: Raw dismissed IDs from localStorage:', dismissedIdsString);
    let dismissedIds: string[] = [];
    try {
      dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
      if (!Array.isArray(dismissedIds)) dismissedIds = [];
    } catch (e) {
      console.error("[HomePage] loadMeetings: Error parsing dismissed meetings from localStorage", e);
      localStorage.removeItem(DISMISSED_MEETINGS_KEY);
      dismissedIds = [];
    }
    console.log('[HomePage] loadMeetings: Parsed dismissedIds:', dismissedIds);

    const now = Date.now();
    let newDismissalsMade = false;

    activeMeetings.forEach(meeting => {
      if (meeting.startedAt && (now - meeting.startedAt > TWO_HOURS_IN_MS)) {
        if (!dismissedIds.includes(meeting.id)) {
          dismissedIds.push(meeting.id);
          newDismissalsMade = true;
          console.log(`[HomePage] loadMeetings: Auto-dismissing meeting "${meeting.title}" (ID: ${meeting.id}) as it started over 2 hours ago.`);
        }
      }
    });

    if (newDismissalsMade) {
      localStorage.setItem(DISMISSED_MEETINGS_KEY, JSON.stringify(dismissedIds));
      console.log('[HomePage] loadMeetings: Updated dismissedIds in localStorage due to auto-dismissal:', dismissedIds);
    }

    const meetingsToDisplay = activeMeetings.filter(
      meeting => !dismissedIds.includes(meeting.id)
    );

    meetingsToDisplay.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    console.log('[HomePage] loadMeetings: Final meetingsToDisplay:', meetingsToDisplay);
    setOngoingMeetings(meetingsToDisplay);
  };

  useEffect(() => {
    loadMeetings();

    const handleMeetingStarted = () => {
      console.log('[HomePage] Received teachmeet_meeting_started event. Reloading meetings.');
      loadMeetings();
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
    const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    let dismissedIds: string[] = [];
    try {
      dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
      if (!Array.isArray(dismissedIds)) dismissedIds = [];
    } catch (e) {
      console.error("[HomePage] handleDismissMeeting: Error parsing dismissed meetings from localStorage", e);
      localStorage.removeItem(DISMISSED_MEETINGS_KEY);
      dismissedIds = [];
    }

    if (!dismissedIds.includes(meetingIdToDismiss)) {
      dismissedIds.push(meetingIdToDismiss);
      localStorage.setItem(DISMISSED_MEETINGS_KEY, JSON.stringify(dismissedIds));
    }

    setOngoingMeetings(prevMeetings => prevMeetings.filter(meeting => meeting.id !== meetingIdToDismiss));
    toast({
      title: "Meeting Dismissed",
      description: "The meeting has been removed from your ongoing list.",
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={false} />
      {/* 
        Main content area adjustments:
        - Removed justify-center to allow content to flow from top if it's taller than viewport.
        - Removed overflow-hidden to allow scrolling if content overflows.
        - Adjusted padding for better spacing, especially py-8 for vertical space.
      */}
      <main className="flex-grow flex flex-col items-center px-4 py-8 relative">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px), radial-gradient(hsl(var(--accent)) 1px, transparent 1px)",
            backgroundSize: "30px 30px, 30px 30px",
            backgroundPosition: "0 0, 15px 15px",
            maskImage: "radial-gradient(circle at center, white, transparent 70%)"
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center w-full">
          <Logo
            text={logoText}
            size="small" // Changed from medium to small for better fit on smaller screens
            className={cn(
              'mb-8 text-center cursor-pointer',
              animateChars && logoText === 'TeachMeet' && 'logo-animate-complex'
            )}
            onClick={handleComplexLogoAnimation}
            animateChars={animateChars && logoText === 'TeachMeet'}
          />
          <div className="mt-4 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md text-center"> {/* Reduced mt from 8 to 4 */}
            <h2 className="text-2xl font-semibold text-primary mb-4">Ongoing Meetings</h2>
            {ongoingMeetings.length > 0 ? (
              <ul className="space-y-3 text-left">
                {ongoingMeetings.map((meeting) => (
                  <li key={meeting.id} className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/meeting/${meeting.id}/wait?topic=${encodeURIComponent(meeting.title)}`}
                      passHref
                      legacyBehavior
                    >
                      <a
                        className={cn(
                          "w-full justify-start text-base py-3 px-4 rounded-lg hover:border-primary flex items-center",
                          "border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none flex-grow"
                        )}
                      >
                        <Video className="mr-3 h-5 w-5 text-primary/80" />
                        <span className="truncate flex-grow text-foreground">{meeting.title}</span>
                        {meeting.participants && (
                          <span className="text-xs text-muted-foreground ml-auto pl-2 flex items-center">
                            <UsersIcon className="h-3 w-3 mr-1" />
                            {meeting.participants}
                          </span>
                        )}
                      </a>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive rounded-full p-2 flex-shrink-0"
                      onClick={() => handleDismissMeeting(meeting.id)}
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
    