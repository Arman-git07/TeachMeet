
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/common/AppHeader';

interface OngoingMeeting {
  id: string;
  title: string;
  participants?: number;
}

// Initial mock data for ongoing meetings
const initialMockOngoingMeetings: OngoingMeeting[] = [
  { id: 'alpha-beta-gamma', title: 'Project Sync: Q3 Roadmap', participants: 5 },
  { id: 'delta-echo-foxtrot', title: 'Weekly Team Huddle', participants: 8 },
];

const DISMISSED_MEETINGS_KEY = 'teachmeet-dismissed-meetings';

export default function HomePage() {
  const [ongoingMeetings, setOngoingMeetings] = useState<OngoingMeeting[]>([]);
  const [logoTextContent, setLogoTextContent] = useState('TeachMeet');
  const [animationLock, setAnimationLock] = useState(false);
  const [animateChars, setAnimateChars] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    const dismissedIds: string[] = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];

    const activeMeetings = initialMockOngoingMeetings.filter(
      meeting => !dismissedIds.includes(meeting.id)
    );
    setOngoingMeetings(activeMeetings);
  }, []);


  const tmVisibleDuration = 350;
  const characterAnimationTotalDuration = 1000;

  const handleComplexLogoAnimation = () => {
    if (animationLock) return;

    setAnimationLock(true);
    setAnimateChars(false);
    setLogoTextContent('TM');

    setTimeout(() => {
      setLogoTextContent('TeachMeet');
      setAnimateChars(true);
      setTimeout(() => {
        setAnimateChars(false);
        setAnimationLock(false);
      }, characterAnimationTotalDuration);
    }, tmVisibleDuration);
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
              'text-center cursor-pointer mb-8',
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
                  <li key={meeting.id}>
                    <Link
                      href={`/dashboard/meeting/${meeting.id}/wait?topic=${encodeURIComponent(meeting.title)}`}
                      passHref
                      legacyBehavior
                    >
                      <a
                        className={cn(
                          "w-full justify-start text-base py-3 px-4 rounded-lg hover:bg-primary/10 hover:border-primary flex items-center",
                          "border border-border bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none" // Button-like appearance
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
