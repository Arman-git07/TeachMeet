
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { useToast } from "@/hooks/use-toast";
import { Copy, Hash, Link as LinkIcon, Share2, Video, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

interface OngoingMeeting {
  id: string;
  title: string;
  startedAt?: number;
}


export function StartMeetingDialogContent() {
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingCode, setMeetingCode] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("My TeachMeet Meeting");
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const randomString = (length: number) => Math.random().toString(36).substring(2, 2 + length);
    
    const newMeetingId = randomString(8);
    setMeetingId(newMeetingId);

    if (typeof window !== "undefined") {
        setMeetingLink(`${window.location.origin}/dashboard/meeting/${newMeetingId}/wait`);
    } else {
        setMeetingLink(`/dashboard/meeting/${newMeetingId}/wait`); 
    }
    
    const codePart1 = randomString(3);
    const codePart2 = randomString(3);
    const codePart3 = randomString(3);
    setMeetingCode(`${codePart1}-${codePart2}-${codePart3}`);
  }, []);

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
    if (!meetingLink || !meetingCode) {
      toast({ variant: "destructive", title: "Cannot Share", description: "Meeting details are not yet generated." });
      return;
    }
    setIsSharePanelOpen(true);
  };
  
  const handleStartAndJoinMeeting = async () => {
    if (!meetingId || !meetingTitle.trim()) {
      toast({ variant: "destructive", title: "Missing Details", description: "Please ensure a meeting topic is set." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to start a meeting." });
      return;
    }

    setIsJoining(true);
    const trimmedMeetingTitle = meetingTitle.trim();
    console.log(`[StartMeetingDialog] Attempting to create meeting: ID=${meetingId}, Topic=${trimmedMeetingTitle}, Creator=${user.uid}`);

    try {
      const meetingDocRef = doc(db, 'meetings', meetingId);
      const meetingData = {
        creatorId: user.uid,
        topic: trimmedMeetingTitle,
        createdAt: serverTimestamp(),
      };
      
      console.log("[StartMeetingDialog] Data to write for main meeting document:", meetingData);
      await setDoc(meetingDocRef, meetingData);
      console.log("[StartMeetingDialog] Successfully created main meeting document in Firestore.");


      const newMeetingEntry: OngoingMeeting = { 
        id: meetingId, 
        title: trimmedMeetingTitle, 
        startedAt: Date.now() 
      };
      const existingStartedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
      let existingStartedMeetings: OngoingMeeting[] = [];
      if (existingStartedMeetingsRaw) {
        try {
          existingStartedMeetings = JSON.parse(existingStartedMeetingsRaw);
          if (!Array.isArray(existingStartedMeetings)) existingStartedMeetings = [];
        } catch (e) {
          console.error("[StartMeetingDialog] Error parsing started meetings from localStorage:", e);
          localStorage.removeItem(STARTED_MEETINGS_KEY);
        }
      }
      if (!existingStartedMeetings.find(m => m.id === newMeetingEntry.id)) {
        const updatedStartedMeetings = [...existingStartedMeetings, newMeetingEntry];
        localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(updatedStartedMeetings));
        console.log("[StartMeetingDialog] Meeting added to localStorage 'started-meetings'.");
        window.dispatchEvent(new CustomEvent('teachmeet_meeting_started')); 
      }

      const joinNowLinkPath = `/dashboard/meeting/${meetingId}/wait?topic=${encodeURIComponent(trimmedMeetingTitle)}`;
      
      router.push(joinNowLinkPath);

    } catch (error: any) {
      console.error("[StartMeetingDialog] CRITICAL: Error creating meeting document in Firestore:", error);
      let description = `Could not create the meeting in the database: ${error.message}.`;
      if (error.message && error.message.toLowerCase().includes('permission')) {
        description = `Permission Denied: ${error.message}. Please check your Firebase Firestore security rules to allow writes to the 'meetings' collection for authenticated users. For development, you might need a rule like 'allow write: if request.auth != null;'.`;
      } else {
        description += " Check console & Firestore rules.";
      }
      toast({
        variant: "destructive",
        title: "Failed to Start Meeting",
        description: description,
        duration: 10000,
      });
    } finally {
        setIsJoining(false); 
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Video className="mr-2 h-6 w-6 text-primary" />
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
                value={meetingLink || "Generating..."}
                className="pl-10 rounded-lg"
                />
            </div>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingLink, "Link")} aria-label="Copy link" disabled={!meetingLink || isJoining} className="rounded-lg">
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
                value={meetingCode || "Generating..."}
                className="pl-10 rounded-lg"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingCode, "Code")} aria-label="Copy code" disabled={!meetingCode || isJoining} className="rounded-lg">
              <Copy className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Button variant="outline" className="w-full rounded-lg py-3 text-base" onClick={handleShareInvite} disabled={!meetingLink || !meetingCode || isJoining}>
          <Share2 className="mr-2 h-5 w-5" />
          Share Invite
        </Button>
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
          disabled={!meetingId || !meetingTitle.trim() || isJoining || !user}
        >
          {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isJoining ? "Starting..." : (meetingId ? "Start and Join Meeting" : "Generating ID...")}
        </Button>
      </DialogFooter>
      <ShareOptionsPanel
        isOpen={isSharePanelOpen}
        onClose={() => setIsSharePanelOpen(false)}
        meetingLink={meetingLink}
        meetingCode={meetingCode}
        meetingTitle={meetingTitle.trim()} 
      />
    </>
  );
}
