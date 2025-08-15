
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { useToast } from "@/hooks/use-toast";
import { Copy, Hash, Link as LinkIcon, Share2, Video, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogClose
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

const generateRandomId = (length: number) => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

const generateMeetingDetails = () => {
    const newMeetingId = generateRandomId(9);
    const codePart1 = newMeetingId.substring(0, 3);
    const codePart2 = newMeetingId.substring(3, 6);
    const codePart3 = newMeetingId.substring(6, 9);
    const newMeetingCode = `${codePart1}-${codePart2}-${codePart3}`;
    
    let newMeetingLink = '';
    if (typeof window !== "undefined") {
      newMeetingLink = `${window.location.origin}/dashboard/meeting/${newMeetingId}/wait`;
    } else {
      newMeetingLink = `/dashboard/meeting/${newMeetingId}/wait`;
    }

    return {
      id: newMeetingId,
      link: newMeetingLink,
      code: newMeetingCode,
    };
};


export function StartMeetingDialogContent() {
  const [meetingTitle, setMeetingTitle] = useState("My TeachMeet Meeting");
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const [meetingDetails, setMeetingDetails] = useState(generateMeetingDetails);

  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  
  const regenerateMeetingDetails = useCallback(() => {
    setMeetingDetails(generateMeetingDetails());
    toast({ title: "New Link Generated", description: "A new meeting link and code have been created." });
  }, [toast]);


  const copyToClipboard = (textToCopy: string, type: "Link" | "Code") => {
    if (!textToCopy) {
        toast({ variant: "destructive", title: "Nothing to Copy", description: `${type} has not been generated yet.` });
        return;
    }
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast({ title: `${type} Copied!`, description: `Meeting ${type.toLowerCase()} copied to clipboard.` });
      })
      .catch(err => {
        console.error(`Failed to copy ${type.toLowerCase()}: `, err);
        toast({ variant: "destructive", title: "Copy Failed", description: `Could not copy the meeting ${type.toLowerCase()}.` });
      });
  };

  const handleShareInvite = () => {
    if (!meetingDetails.link || !meetingDetails.code) {
      toast({ variant: "destructive", title: "Cannot Share", description: "Meeting details are not yet generated." });
      return;
    }
    setIsSharePanelOpen(true);
  };
  
  const handleStartAndJoinMeeting = async () => {
    if (!meetingDetails.id || !meetingTitle.trim()) {
      toast({ variant: "destructive", title: "Missing Details", description: "Please ensure a meeting topic is set." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to start a meeting." });
      return;
    }

    setIsJoining(true);
    const trimmedMeetingTitle = meetingTitle.trim();
    
    // Pass a special flag to the wait room to identify the host.
    const waitRoomPath = `/dashboard/meeting/${meetingDetails.id}/wait?topic=${encodeURIComponent(trimmedMeetingTitle)}&host=true`;
    router.push(waitRoomPath);

    setTimeout(() => {
      try {
        const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
        let startedMeetings = startedMeetingsRaw ? JSON.parse(startedMeetingsRaw) : [];
        if (!Array.isArray(startedMeetings)) startedMeetings = [];
        
        const newMeeting = {
          id: meetingDetails.id,
          title: trimmedMeetingTitle,
          startedAt: Date.now(),
        };

        startedMeetings = startedMeetings.filter((m: any) => m.id !== meetingDetails.id);
        startedMeetings.unshift(newMeeting); 
        
        localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(startedMeetings.slice(0, 10)));
        
        window.dispatchEvent(new CustomEvent('teachmeet_meeting_started'));
      } catch (error) {
        console.error("Failed to update local meeting records:", error);
      }
    }, 100);
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>
            <Video className="mr-2 h-6 w-6 text-primary inline-block" />
            Start a New Meeting
          </DialogTitle>
          <DialogDescription>
            Set a topic and share the invite to begin.
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
              disabled={isJoining}
            />
          </div>

          <div>
            <Label htmlFor="meetingLinkDialog" className="block text-sm font-medium text-muted-foreground mb-1">
              Meeting Link
            </Label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-grow">
                  <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                  id="meetingLinkDialog"
                  type="text"
                  readOnly
                  value={meetingDetails.link || "Generating..."}
                  className="pl-10 rounded-lg"
                  />
              </div>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingDetails.link, "Link")} aria-label="Copy link" disabled={!meetingDetails.link || isJoining} className="rounded-lg">
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="meetingCodeDialog" className="block text-sm font-medium text-muted-foreground mb-1">
              Meeting Code
            </Label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-grow">
                <Hash className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="meetingCodeDialog"
                  type="text"
                  readOnly
                  value={meetingDetails.code || "Generating..."}
                  className="pl-10 rounded-lg"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingDetails.code, "Code")} aria-label="Copy code" disabled={!meetingDetails.code || isJoining} className="rounded-lg">
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-grow rounded-lg py-3 text-base" onClick={handleShareInvite} disabled={!meetingDetails.link || !meetingDetails.code || isJoining}>
              <Share2 className="mr-2 h-5 w-5" />
              Share Invite
            </Button>
            <Button variant="ghost" size="icon" onClick={regenerateMeetingDetails} aria-label="Generate new link and code" disabled={isJoining} className="rounded-lg text-muted-foreground">
              <RefreshCw className="h-5 w-5"/>
            </Button>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-lg" disabled={isJoining}>
              Cancel
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            onClick={handleStartAndJoinMeeting} 
            className="btn-gel rounded-lg" 
            disabled={!meetingDetails.id || !meetingTitle.trim() || isJoining || !user}
          >
            {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isJoining ? "Redirecting..." : "Start and Join Meeting"}
          </Button>
        </DialogFooter>
        <ShareOptionsPanel
          isOpen={isSharePanelOpen}
          onClose={() => setIsSharePanelOpen(false)}
          meetingLink={meetingDetails.link}
          meetingCode={meetingDetails.code}
          meetingTitle={meetingTitle.trim()} 
        />
    </>
  );
}
