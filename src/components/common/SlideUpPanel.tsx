
'use client';
import { Button } from '@/components/ui/button';
import { Video, PlusCircle, Code } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic'; // Added dynamic
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger, // Ensured DialogTrigger is imported
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
// import { StartMeetingDialogContent } from "@/components/meeting/StartMeetingDialogContent"; // Removed direct import

// Dynamically import StartMeetingDialogContent
const StartMeetingDialogContent = dynamic(() => 
  import('@/components/meeting/StartMeetingDialogContent').then(mod => mod.StartMeetingDialogContent), 
  { 
    ssr: false,
    loading: () => <p className="p-4 text-center">Loading dialog...</p> // Optional loading state
  }
);

export function SlideUpPanel() {
  const [showPanel, setShowPanel] = useState(false);
  const [meetingCodeDialogInput, setMeetingCodeDialogInput] = useState(''); 
  const { toast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth(); 

  useEffect(() => {
    const timer = setTimeout(() => setShowPanel(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleJoinFromDialog = () => {
    if (meetingCodeDialogInput.trim()) {
      toast({
        title: "Joining Meeting (Dialog)",
        description: `Attempting to join with code: ${meetingCodeDialogInput}`,
      });
      // In a real app, navigate: router.push(`/dashboard/join-meeting?code=${meetingCodeDialogInput}`);
      setMeetingCodeDialogInput('');
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a meeting code.",
      });
    }
  };

  const startMeetingHref = isAuthenticated ? "#" : "/auth/signin?action=start"; // Dialog trigger, so href can be # if auth
  const joinMeetingHref = isAuthenticated ? "/dashboard/join-meeting" : "/auth/signin?action=join";

  if (authLoading) {
    // Optional loading state
  }

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
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
                  aria-label="Start New Meeting"
                  disabled={authLoading}
                >
                  <PlusCircle className="mr-2 h-6 w-6" />
                  Start New Meeting
                </Button>
              </DialogTrigger>
              <DialogContent 
                className="sm:max-w-lg rounded-xl"
                aria-label="Start a New Meeting" 
              >
                <StartMeetingDialogContent />
              </DialogContent>
            </Dialog>
          ) : (
            <Link href={startMeetingHref} passHref legacyBehavior>
              <Button
                size="lg"
                className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
                aria-label="Start New Meeting"
                disabled={authLoading}
              >
                <PlusCircle className="mr-2 h-6 w-6" />
                Start New Meeting
              </Button>
            </Link>
          )}
        </div>

        {/* Join Meeting Section */}
        <div className="w-full sm:flex-1 flex flex-col items-center">
          <div className="relative w-full max-w-xs">
            <Link href={joinMeetingHref} passHref legacyBehavior className="block">
              <Button
                size="lg"
                className="w-full btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
                aria-label="Join Existing Meeting"
                disabled={authLoading}
              >
                <Video className="mr-2 h-6 w-6" />
                Join Meeting
              </Button>
            </Link>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className="absolute top-0 right-0 h-full bg-cta-orange text-cta-orange-foreground hover:bg-cta-orange/90 shrink-0 rounded-lg shadow-lg z-10 px-3 py-1.5 text-sm flex items-center"
                  aria-label="Enter Meeting Code"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent 
                className="sm:max-w-[425px] rounded-xl"
                aria-label="Enter Meeting Code" 
              >
                <DialogHeader>
                  <DialogTitle>Enter Meeting Code</DialogTitle>
                  <DialogDescription>
                    Type in the meeting code provided by the host to join the session.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dialogMeetingCodeInput" className="text-right">
                      Code
                    </Label>
                    <Input
                      id="dialogMeetingCodeInput"
                      value={meetingCodeDialogInput}
                      onChange={(e) => setMeetingCodeDialogInput(e.target.value)}
                      placeholder="e.g., abc-xyz-123"
                      className="col-span-3 rounded-lg"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-lg">
                      Cancel
                    </Button>
                  </DialogClose>
                  {/* Ensure the link works correctly with DialogClose for navigation */}
                  <DialogClose asChild>
                    <Button type="button" onClick={handleJoinFromDialog} className="btn-gel rounded-lg">
                      Join
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}

