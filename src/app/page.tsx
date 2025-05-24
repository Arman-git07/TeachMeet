
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Mic, MicOff, VideoOff, X, LogIn, Users as UsersIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';

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
  const [logoText, setLogoText] = useState('TeachMeet');
  const [animateChars, setAnimateChars] = useState(false);
  const [animationLock, setAnimationLock] = useState(false);
  const [ongoingMeetings, setOngoingMeetings] = useState<OngoingMeeting[]>([]);

  const [isMeetingDialogVisible, setIsMeetingDialogVisible] = useState(false);
  const [selectedMeetingForDialog, setSelectedMeetingForDialog] = useState<OngoingMeeting | null>(null);
  const [isMicMutedInDialog, setIsMicMutedInDialog] = useState(false);
  const [isCameraOffInDialog, setIsCameraOffInDialog] = useState(true); // Default camera to off in dialog
  const router = useRouter();

  useEffect(() => {
    // Load dismissed meetings from localStorage and filter the initial list
    const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
    const dismissedIds: string[] = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
    
    const activeMeetings = initialMockOngoingMeetings.filter(
      meeting => !dismissedIds.includes(meeting.id)
    );
    setOngoingMeetings(activeMeetings);
  }, []);


  const handleComplexLogoAnimation = () => {
    if (animationLock) return;

    setAnimationLock(true);
    setAnimateChars(false); 
    setLogoText('TM');

    const tmVisibleDuration = 300; 
    const charAnimationTotalDuration = 900; 

    setTimeout(() => {
      setLogoText('TeachMeet');
      setAnimateChars(true); 
    }, tmVisibleDuration);

    setTimeout(() => {
      setAnimateChars(false); 
      setAnimationLock(false);
    }, tmVisibleDuration + charAnimationTotalDuration + 100); 
  };

  const openMeetingDialog = (meeting: OngoingMeeting) => {
    setSelectedMeetingForDialog(meeting);
    setIsMicMutedInDialog(false); 
    setIsCameraOffInDialog(true);
    setIsMeetingDialogVisible(true);
  };

  const handleJoinMeetingFromDialog = () => {
    if (selectedMeetingForDialog) {
      const topicQueryParam = selectedMeetingForDialog.title ? `?topic=${encodeURIComponent(selectedMeetingForDialog.title)}` : '';
      router.push(`/dashboard/meeting/${selectedMeetingForDialog.id}/wait${topicQueryParam}`);
      setIsMeetingDialogVisible(false); 
    }
  };

  const handleDismissMeeting = () => {
    if (selectedMeetingForDialog) {
      setOngoingMeetings(prevMeetings => prevMeetings.filter(m => m.id !== selectedMeetingForDialog!.id));
      
      const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
      const dismissedIds: string[] = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
      if (!dismissedIds.includes(selectedMeetingForDialog.id)) {
        dismissedIds.push(selectedMeetingForDialog.id);
        localStorage.setItem(DISMISSED_MEETINGS_KEY, JSON.stringify(dismissedIds));
      }

      setIsMeetingDialogVisible(false);
      setSelectedMeetingForDialog(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppSidebar />
      <SidebarInset>
        <AppHeader showLogo={false} />
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
              text={logoText}
              size="large"
              animateChars={animateChars}
              className={cn(
                "mb-8 animate-fadeIn cursor-pointer text-center",
                 animateChars && 'char-animation-active' 
              )}
              onClick={handleComplexLogoAnimation}
            />
            <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md text-center">
              <h2 className="text-2xl font-semibold text-primary mb-4">Latest Activity</h2>
              {ongoingMeetings.length > 0 ? (
                <ul className="space-y-3 text-left">
                  {ongoingMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <Dialog open={isMeetingDialogVisible && selectedMeetingForDialog?.id === meeting.id} onOpenChange={(isOpen) => {
                        if (!isOpen) {
                          setSelectedMeetingForDialog(null); 
                        }
                        setIsMeetingDialogVisible(isOpen);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-base py-3 px-4 rounded-lg hover:bg-primary/10 hover:border-primary"
                            onClick={() => openMeetingDialog(meeting)}
                          >
                            <Video className="mr-3 h-5 w-5 text-primary/80" />
                            <span className="truncate flex-grow text-foreground">{meeting.title}</span>
                            {meeting.participants && (
                              <span className="text-xs text-muted-foreground ml-auto pl-2 flex items-center">
                                <UsersIcon className="h-3 w-3 mr-1"/>
                                {meeting.participants}
                              </span>
                            )}
                          </Button>
                        </DialogTrigger>
                        {selectedMeetingForDialog && ( 
                          <DialogContent className="sm:max-w-md rounded-lg">
                            <DialogHeader>
                              <DialogTitle className="text-xl">Rejoin: {selectedMeetingForDialog?.title}</DialogTitle>
                              <DialogDescription>
                                Configure your audio/video before rejoining.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                              <div className="flex justify-around">
                                <Button
                                  variant={isCameraOffInDialog ? "destructive" : "secondary"}
                                  size="lg"
                                  className="rounded-full p-3 btn-gel flex flex-col h-auto items-center gap-1"
                                  onClick={() => setIsCameraOffInDialog(!isCameraOffInDialog)}
                                  aria-label={isCameraOffInDialog ? "Turn Camera On" : "Turn Camera Off"}
                                >
                                  {isCameraOffInDialog ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                                  <span className="text-xs mt-1">{isCameraOffInDialog ? "Cam Off" : "Cam On"}</span>
                                </Button>
                                <Button
                                  variant={isMicMutedInDialog ? "destructive" : "secondary"}
                                  size="lg"
                                  className="rounded-full p-3 btn-gel flex flex-col h-auto items-center gap-1"
                                  onClick={() => setIsMicMutedInDialog(!isMicMutedInDialog)}
                                  aria-label={isMicMutedInDialog ? "Unmute Mic" : "Mute Mic"}
                                >
                                  {isMicMutedInDialog ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                                  <span className="text-xs mt-1">{isMicMutedInDialog ? "Mic Off" : "Mic On"}</span>
                                </Button>
                              </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                              <Button type="button" variant="outline" className="rounded-md" onClick={handleDismissMeeting}>
                                  <X className="mr-2 h-4 w-4" /> Dismiss
                              </Button>
                              <Button type="button" onClick={handleJoinMeetingFromDialog} className="btn-gel rounded-md">
                                <LogIn className="mr-2 h-4 w-4" /> Join Meeting
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        )}
                      </Dialog>
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
      </SidebarInset>
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.8s ease-out 0.2s forwards; }

        .logo-animated-span {
          display: inline-block;
          opacity: 0; 
        }
        
        .char-animation-active .logo-animated-span.char-index-0 { 
          animation: slideInT 0.6s forwards;
          animation-delay: 0s;
        }
        @keyframes slideInT {
          from { transform: translateX(-30px) scaleX(0.8); opacity: 0; }
          to { transform: translateX(0) scaleX(1); opacity: 1; }
        }

        .char-animation-active .logo-animated-span.char-index-5 { 
          animation: slideInM 0.6s forwards;
          animation-delay: 0.2s; 
        }
        @keyframes slideInM {
          from { transform: translateX(30px) scaleX(0.8); opacity: 0; }
          to { transform: translateX(0) scaleX(1); opacity: 1; }
        }

        .char-animation-active .logo-animated-span.char-index-1,
        .char-animation-active .logo-animated-span.char-index-2,
        .char-animation-active .logo-animated-span.char-index-3,
        .char-animation-active .logo-animated-span.char-index-4 {
          animation: emergeEach 0.5s forwards;
        }
        .char-animation-active .logo-animated-span.char-index-1 { animation-delay: 0.1s; } 
        .char-animation-active .logo-animated-span.char-index-2 { animation-delay: 0.15s; } 
        .char-animation-active .logo-animated-span.char-index-3 { animation-delay: 0.2s; } 
        .char-animation-active .logo-animated-span.char-index-4 { animation-delay: 0.25s; } 

        @keyframes emergeEach {
          from { transform: translate(20px, 5px) scale(0.5); opacity: 0; } 
          to { transform: translate(0, 0) scale(1); opacity: 1; }
        }

        .char-animation-active .logo-animated-span.char-index-6,
        .char-animation-active .logo-animated-span.char-index-7,
        .char-animation-active .logo-animated-span.char-index-8 {
          animation: emergeEet 0.5s forwards;
        }
        .char-animation-active .logo-animated-span.char-index-6 { animation-delay: 0.3s; } 
        .char-animation-active .logo-animated-span.char-index-7 { animation-delay: 0.35s; } 
        .char-animation-active .logo-animated-span.char-index-8 { animation-delay: 0.4s; } 

        @keyframes emergeEet {
          from { transform: translate(-20px, 5px) scale(0.5); opacity: 0; } 
          to { transform: translate(0, 0) scale(1); opacity: 1; }
        }

      `}</style>
    </div>
  );
}

