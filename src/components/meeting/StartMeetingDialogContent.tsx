
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Video, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogClose
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';

export function StartMeetingDialogContent() {
  const [meetingTitle, setMeetingTitle] = useState("My TeachMeet Meeting");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const handleGoToPrejoin = () => {
    if (!meetingTitle.trim()) {
      toast({ variant: "destructive", title: "Topic Required", description: "Please enter a topic for the meeting." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to start a meeting." });
      return;
    }

    setIsRedirecting(true);
    const prejoinPath = `/dashboard/meeting/prejoin?topic=${encodeURIComponent(meetingTitle.trim())}`;
    router.push(prejoinPath);
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>
            <Video className="mr-2 h-6 w-6 text-primary inline-block" />
            Start a New Meeting
          </DialogTitle>
          <DialogDescription>
            Set a topic for your meeting. You'll configure your camera and mic on the next screen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div>
            <Label htmlFor="meetingTopicDialog" className="block text-sm font-medium text-muted-foreground mb-1">
              Meeting Topic / Purpose
            </Label>
            <Input
              id="meetingTopicDialog"
              placeholder="e.g., Weekly Sync, Project Brainstorm..."
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              className="rounded-lg text-base"
              disabled={isRedirecting}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGoToPrejoin();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-lg" disabled={isRedirecting}>
              Cancel
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            onClick={handleGoToPrejoin} 
            className="btn-gel rounded-lg" 
            disabled={!meetingTitle.trim() || isRedirecting || !user}
          >
            {isRedirecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isRedirecting ? "Proceeding..." : "Continue"}
          </Button>
        </DialogFooter>
    </>
  );
}
