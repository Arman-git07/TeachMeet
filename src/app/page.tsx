
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
              text="TeachMeet" // Default text, no animation props
              size="large"
              className="mb-8 animate-fadeIn text-center" // Removed cursor-pointer and animation-active class
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

        /* Removed complex character-specific logo animations */

      `}</style>
    </div>
  );
}
