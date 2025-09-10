
'use client';
import { Button } from '@/components/ui/button';
import { Video, PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { StartMeetingDialogContent } from '@/components/meeting/StartMeetingDialogContent';


export function SlideUpPanel() {
  const [showPanel, setShowPanel] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setShowPanel(true), 300);
    return () => clearTimeout(timer);
  }, []);
  
  const joinMeetingHref = isAuthenticated ? "/dashboard/join-meeting" : "/auth/signin?action=join";

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 transform transition-all duration-700 ease-in-out ${
        showPanel ? 'translate-y-0' : 'translate-y-full'
      } bg-gradient-to-t from-background to-background/90 backdrop-blur-sm p-6 shadow-2xl rounded-t-2xl border-t border-border`}
    >
      <div className="container mx-auto max-w-3xl flex flex-col sm:flex-row items-center sm:items-start justify-center gap-x-6 gap-y-4">
        {/* Start New Meeting Button with Dialog */}
        <div className="w-full sm:flex-1 flex justify-center">
          {isAuthenticated ? (
            <Button
              size="lg"
              className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Start New Meeting"
            >
              <PlusCircle className="mr-2 h-6 w-6" />
              Start New Meeting
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Start New Meeting"
              disabled={authLoading}
            >
              <PlusCircle className="mr-2 h-6 w-6" />
              Start New Meeting
            </Button>
          )}
        </div>

        {/* Join Meeting Section */}
        <div className="w-full sm:flex-1 flex justify-center">
            <Button
              asChild
              size="lg"
              className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Join Existing Meeting"
              disabled={authLoading}
            >
              <Link href={joinMeetingHref}>
                <Video className="mr-2 h-6 w-6" />
                Join Meeting
              </Link>
            </Button>
        </div>
      </div>
    </div>
  );
}
