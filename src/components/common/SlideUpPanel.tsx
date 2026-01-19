
'use client';
import { Button } from '@/components/ui/button';
import { Video, PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';


export function SlideUpPanel() {
  const [showPanel, setShowPanel] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setShowPanel(true), 300);
    return () => clearTimeout(timer);
  }, []);
  
  const joinMeetingHref = isAuthenticated ? "/dashboard/join-meeting" : "/auth/signin?action=join";

  const handleStartMeeting = () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/auth/signin?action=start');
      return;
    }
    const meetingId = `meeting-${uuidv4().slice(0, 11).replace(/-/g, '')}`;
    router.push(`/dashboard/meeting/prejoin?meetingId=${meetingId}&role=host`);
  };
  
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 transform transition-all duration-700 ease-in-out ${
        showPanel ? 'translate-y-0' : 'translate-y-full'
      } bg-gradient-to-t from-background to-background/90 backdrop-blur-sm p-4 sm:p-6 shadow-2xl rounded-t-2xl border-t border-border`}
    >
      <div className="container mx-auto max-w-3xl flex flex-col sm:flex-row items-center sm:items-start justify-center gap-x-4 gap-y-4">
        {/* Start New Meeting Section */}
        <div className="w-full sm:flex-1 flex justify-center">
            <Button
              size="lg"
              className="w-full max-w-xs btn-gel text-base py-4 px-6 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Start New Meeting"
              onClick={handleStartMeeting}
              disabled={authLoading}
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Start New Meeting
            </Button>
        </div>

        {/* Separator */}
        <div className="w-full sm:w-auto flex items-center justify-center">
          <div className="sm:h-16 border-b sm:border-l w-1/2 sm:w-0 border-border/50"></div>
          <span className="px-4 text-muted-foreground font-semibold sm:hidden">OR</span>
          <div className="sm:h-16 border-b sm:border-l w-1/2 sm:w-0 border-border/50"></div>
        </div>
        
        {/* Join Meeting Section */}
        <div className="w-full sm:flex-1 flex justify-center">
            <Button
              asChild
              size="lg"
              className="w-full max-w-xs btn-gel text-base py-4 px-6 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Join Existing Meeting"
              disabled={authLoading}
            >
              <Link href={joinMeetingHref}>
                <Video className="mr-2 h-5 w-5" />
                Join Meeting
              </Link>
            </Button>
        </div>
      </div>
    </div>
  );
}
