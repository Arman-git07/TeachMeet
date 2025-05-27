
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle } from 'lucide-react'; // Added XCircle for dismiss
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';

interface OngoingMeeting {
  id: string;
  title: string;
  participants?: number; // Participants will be undefined for locally started meetings
  startedAt?: number; // Optional: to potentially sort by later
}

const DISMISSED_MEETINGS_KEY = 'teachmeet-dismissed-meetings';
const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

export default function HomePage() {
  const [ongoingMeetings, setOngoingMeetings] = useState<OngoingMeeting[]>([]);
  const [logoTextContent, setLogoTextContent] = useState('TeachMeet');
  const [animationLock, setAnimationLock] = useState(false);
  const [animateChars, setAnimateChars] = useState(false);
  const { toast } = useToast();

  const router = useRouter();

  useEffect(() => {
    // Load started meetings
    const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
    let activeMeetings: OngoingMeeting[] = [];
    try {
      activeMeetings = startedMeetingsRaw ? JSON.parse(startedMeetingsRaw) : [];
    } catch (e) {
      console.error("Error parsing started meetings from localStorage", e);
      localStorage.removeItem(STARTED_MEETINGS_KEY); // Clear corrupted data
    }
    
    // Load dismissed meetings
    const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    let dismissedIds: string[] = [];
    try {
      dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
    } catch (e) {
      console.error("Error parsing dismissed meetings from localStorage", e);
      localStorage.removeItem(DISMISSED_MEETINGS_KEY); // Clear corrupted data
    }

    // Filter out dismissed meetings from the started meetings
    activeMeetings = activeMeetings.filter(
      meeting => !dismissedIds.includes(meeting.id)
    );
    
    // Optionally sort by startedAt if we want newest first, for example
    activeMeetings.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    setOngoingMeetings(activeMeetings);
  }, []);


  const tmVisibleDuration = 350;
  const characterAnimationTotalDuration = 1000; // Matches CSS animation duration

  const handleComplexLogoAnimation = () => {
    if (animationLock) return;

    setAnimationLock(true);
    setAnimateChars(false); // Reset for TM state
    setLogoTextContent('TM');

    setTimeout(() => {
      setLogoTextContent('TeachMeet');
      setAnimateChars(true); // Trigger full text animation
      setTimeout(() => {
        setAnimateChars(false); // Reset animation class after it finishes
        setAnimationLock(false);
      }, characterAnimationTotalDuration);
    }, tmVisibleDuration);
  };

  const handleDismissMeeting = (meetingIdToDismiss: string) => {
    const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    let dismissedIds: string[] = [];
     try {
      dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
    } catch (e) {
      console.error("Error parsing dismissed meetings from localStorage", e);
      // Potentially clear or reset the dismissed list if parsing fails
      localStorage.removeItem(DISMISSED_MEETINGS_KEY);
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
      <AppHeader showLogo={true} />
      <main className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
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
            text={logoTextContent}
            size="large"
            className={cn(
              'mb-8 text-center cursor-pointer',
              animateChars && logoTextContent === 'TeachMeet' && 'logo-animate-complex'
            )}
            onClick={handleComplexLogoAnimation}
            animateChars={animateChars && logoTextContent === 'TeachMeet'}
          />
          <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md text-center">
            <h2 className="text-2xl font-semibold text-primary mb-4">Latest Activity</h2>
            {ongoingMeetings.length > 0 ? (
              <ul className="space-y-3 text-left">
                {ongoingMeetings.map((meeting) => (
                  <li key={meeting.id} className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/meeting/${meeting.id}/wait?topic=${encodeURIComponent(meeting.title)}`}
                      passHref
                      legacyBehavior
                      className="flex-grow"
                    >
                      <a
                        className={cn(
                          "w-full justify-start text-base py-3 px-4 rounded-lg hover:bg-primary/10 hover:border-primary flex items-center",
                          "border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none" 
                        )}
                      >
                        <Video className="mr-3 h-5 w-5 text-primary/80" />
                        <span className="truncate flex-grow text-foreground">{meeting.title}</span>
                        {/* Participant count can be omitted for locally started meetings or shown if available */}
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
