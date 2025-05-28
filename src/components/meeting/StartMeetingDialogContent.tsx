
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { useToast } from "@/hooks/use-toast";
import { Copy, Hash, Link as LinkIcon, Share2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import Link from "next/link"; // Keep this if used elsewhere, or remove if only for the old button
import { useAuth } from '@/hooks/useAuth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Ensure db is correctly exported from your firebase setup

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

interface OngoingMeeting {
  id: string;
  title: string;
  participants?: number;
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
  const { user } = useAuth(); // Get current authenticated user
  const [isJoining, setIsJoining] = useState(false); // Loading state for the button

  useEffect(() => {
    const randomString = (length: number) => Math.random().toString(36).substring(2, 2 + length);
    
    const newMeetingId = randomString(8);
    setMeetingId(newMeetingId);

    if (typeof window !== "undefined") {
        setMeetingLink(`${window.location.origin}/dashboard/meeting/${newMeetingId}/wait`);
    } else {
        setMeetingLink(`/dashboard/meeting/${newMeetingId}/wait`); // Fallback for SSR or testing
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
    if (!meetingId || !meetingTitle) {
      toast({ variant: "destructive", title: "Missing Details", description: "Please ensure a meeting topic is set." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to start a meeting." });
      // Optionally, redirect to sign-in or disable the button if user is null
      return;
    }

    setIsJoining(true);

    try {
      // Step 1: Create the main meeting document in Firestore
      const meetingDocRef = doc(db, 'meetings', meetingId);
      const meetingData = {
        creatorId: user.uid,
        topic: meetingTitle,
        createdAt: serverTimestamp(),
      };
      await setDoc(meetingDocRef, meetingData);
      toast({ title: "Meeting Created", description: "Meeting room registered in the database."});

      // Step 2: Save to localStorage (as previously implemented)
      const newMeetingEntry: OngoingMeeting = { 
        id: meetingId, 
        title: meetingTitle, 
        startedAt: Date.now() 
      };
      const existingStartedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
      let existingStartedMeetings: OngoingMeeting[] = [];
      if (existingStartedMeetingsRaw) {
        try {
          existingStartedMeetings = JSON.parse(existingStartedMeetingsRaw);
          if (!Array.isArray(existingStartedMeetings)) existingStartedMeetings = [];
        } catch (e) {
          console.error("Error parsing started meetings from localStorage:", e);
          localStorage.removeItem(STARTED_MEETINGS_KEY); // Clear corrupted data
        }
      }
      if (!existingStartedMeetings.find(m => m.id === newMeetingEntry.id)) {
        const updatedStartedMeetings = [...existingStartedMeetings, newMeetingEntry];
        localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(updatedStartedMeetings));
      }

      // Step 3: Navigate to the meeting waiting page
      const joinNowLinkPath = `/dashboard/meeting/${meetingId}/wait?topic=${encodeURIComponent(meetingTitle)}`;
      router.push(joinNowLinkPath);

      // The DialogClose wrapping the button will handle closing the dialog.
      // If programmatic close was needed and this component controlled Dialog open state:
      // props.onCloseDialog(); // Assuming a prop like onCloseDialog was passed down

    } catch (error) {
      console.error("Error starting meeting:", error);
      toast({
        variant: "destructive",
        title: "Failed to Start Meeting",
        description: "Could not create the meeting in the database. Please ensure you are connected and try again.",
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
          {/* The onClick now calls the new comprehensive handler */}
          <Button 
            type="button" 
            onClick={handleStartAndJoinMeeting} 
            className="btn-gel rounded-lg" 
            disabled={!meetingId || !meetingTitle || isJoining || !user}
          >
            {isJoining ? "Starting..." : (meetingId ? "Join Meeting Now" : "Generating ID...")}
          </Button>
      </DialogFooter>
      <ShareOptionsPanel
        isOpen={isSharePanelOpen}
        onClose={() => setIsSharePanelOpen(false)}
        meetingLink={meetingLink}
        meetingCode={meetingCode}
        meetingTitle={meetingTitle} 
      />
    </>
  );
}
