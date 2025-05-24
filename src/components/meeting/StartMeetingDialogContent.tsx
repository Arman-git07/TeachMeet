
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
import Link from "next/link";

export function StartMeetingDialogContent() {
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingCode, setMeetingCode] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("My TeachMeet Meeting");
  const { toast } = useToast();
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const randomString = (length: number) => Math.random().toString(36).substring(2, 2 + length);
    
    const newMeetingId = randomString(8);
    setMeetingId(newMeetingId);

    // Ensure meetingLink is a full URL for sharing purposes, adjust domain as needed
    setMeetingLink(`${window.location.origin}/dashboard/join-meeting?code=${newMeetingId}`); // Adjusted to use join-meeting page with code
    
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

  const joinMeetingHref = meetingId && meetingTitle 
    ? `/dashboard/meeting/${meetingId}/wait?topic=${encodeURIComponent(meetingTitle)}` 
    : "#";

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
                className="pl-10"
                />
            </div>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingLink, "Link")} aria-label="Copy link" disabled={!meetingLink}>
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
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingCode, "Code")} aria-label="Copy code" disabled={!meetingCode}>
              <Copy className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Button variant="outline" className="w-full rounded-lg py-3 text-base" onClick={handleShareInvite} disabled={!meetingLink || !meetingCode}>
          <Share2 className="mr-2 h-5 w-5" />
          Share Invite
        </Button>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="rounded-md">
            Cancel
          </Button>
        </DialogClose>
        <DialogClose asChild>
           <Link href={joinMeetingHref} passHref legacyBehavior>
             <Button asChild className="btn-gel rounded-md" disabled={!meetingId || !meetingTitle}>
                <a>{meetingId ? "Join Meeting Now" : "Generating ID..."}</a>
             </Button>
           </Link>
        </DialogClose>
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
