
'use client';
import { Button } from '@/components/ui/button';
import { Video, PlusCircle, Code } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

export function SlideUpPanel() {
  const [showPanel, setShowPanel] = useState(false);
  const [meetingCode, setMeetingCode] = useState('');
  const { toast } = useToast();
  const { isAuthenticated, loading: authLoading } = useAuth(); // Get auth state

  useEffect(() => {
    const timer = setTimeout(() => setShowPanel(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleJoinFromDialog = () => {
    if (meetingCode.trim()) {
      toast({
        title: "Joining Meeting (Dialog)",
        description: `Attempting to join with code: ${meetingCode}`,
      });
      // In a real app, navigate: router.push(`/dashboard/meeting/${meetingCode}/wait`);
      setMeetingCode('');
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a meeting code.",
      });
    }
  };

  const startMeetingHref = isAuthenticated ? "/dashboard/start-meeting" : "/auth/signin?action=start";
  const joinMeetingHref = isAuthenticated ? "/dashboard/join-meeting" : "/auth/signin?action=join";

  if (authLoading) {
    // Optionally, render a loading state for the panel or buttons
    // For simplicity, we'll just let the links update once auth state is known
    // Users might see a flicker if they click very fast, but panel animates in anyway.
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 transform transition-all duration-700 ease-in-out ${
        showPanel ? 'translate-y-0' : 'translate-y-full'
      } bg-gradient-to-t from-background to-background/90 backdrop-blur-sm p-6 shadow-2xl rounded-t-2xl border-t border-border`}
    >
      <div className="container mx-auto max-w-3xl flex flex-col sm:flex-row items-center sm:items-start justify-center gap-x-6 gap-y-4">
        {/* Start New Meeting Button */}
        <div className="w-full sm:flex-1 flex justify-center">
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
                  className="absolute top-0 right-0 h-full bg-cta-orange text-cta-orange-foreground hover:bg-cta-orange/90 shrink-0 rounded-md shadow-lg z-10 px-3 py-1.5 text-sm flex items-center"
                  aria-label="Enter Meeting Code"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-lg">
                <DialogHeader>
                  <DialogTitle>Enter Meeting Code</DialogTitle>
                  <DialogDescription>
                    Type in the meeting code provided by the host to join the session.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dialogMeetingCode" className="text-right">
                      Code
                    </Label>
                    <Input
                      id="dialogMeetingCode"
                      value={meetingCode}
                      onChange={(e) => setMeetingCode(e.target.value)}
                      placeholder="e.g., abc-xyz-123"
                      className="col-span-3 rounded-md"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-md">
                      Cancel
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button type="button" onClick={handleJoinFromDialog} className="btn-gel rounded-md">
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
    
