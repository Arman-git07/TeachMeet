
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Loader2, Video, Link as LinkIcon, Hash, Copy, Share2 } from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { v4 as uuidv4 } from 'uuid';

export function StartMeetingDialogContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [topic, setTopic] = useState("My TeachMeet Meeting");
  const [loading, setLoading] = useState(false);
  
  // These are now derived from a single stable meetingId
  const [meetingId, setMeetingId] = useState('');
  const [meetingCode, setMeetingCode] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);

  useEffect(() => {
    // Generate a stable ID once when the dialog mounts
    const id = `meeting-${uuidv4().slice(0, 11).replace(/-/g, '')}`;
    const code = id.replace('meeting-','');
    
    setMeetingId(id);
    setMeetingCode(code);
    
    if (typeof window !== 'undefined') {
      setMeetingLink(
        `${window.location.origin}/dashboard/join-meeting?meetingId=${id}`
      );
    }
  }, []);


  const handleCopyToClipboard = (textToCopy: string, type: 'Link' | 'Code') => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({ title: `${type} Copied!`, description: `${type} has been copied to your clipboard.`});
    }).catch(err => {
      toast({ variant: 'destructive', title: 'Copy Failed', description: `Could not copy the ${type}.`});
    });
  };

  const handleSetupAndJoin = async () => {
    // This dialog now only redirects to the prejoin page.
    // The prejoin page will handle creating the meeting document.
    const prejoinPath = `/dashboard/meeting/prejoin?meetingId=${meetingId}&topic=${encodeURIComponent(topic.trim())}&role=host`;
    router.push(prejoinPath);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Video className="mr-2 h-6 w-6 text-primary" />
          Start a New Meeting
        </DialogTitle>
        <DialogDescription>
          Use the details below to invite others, then proceed to the pre-join screen to set up your devices.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="meetingTopicDialog">Meeting Topic / Purpose</Label>
          <Input
            id="meetingTopicDialog"
            placeholder="Enter meeting topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-md border p-2 mt-1"
            disabled={loading}
          />
        </div>
        <div>
            <Label>Invite Details</Label>
            <div className="space-y-2 mt-1">
                <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input readOnly value={meetingLink} className="pl-9 pr-10 rounded-lg text-xs" />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopyToClipboard(meetingLink, 'Link')}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
                 <div className="relative">
                    <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input readOnly value={meetingCode} className="pl-9 pr-10 rounded-lg text-sm font-mono" />
                     <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopyToClipboard(meetingCode, 'Code')}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
        <Button variant="outline" className="w-full rounded-lg" onClick={() => setIsSharePanelOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" /> Share Full Invite
        </Button>
      </div>
      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="w-full sm:w-auto rounded-lg" disabled={loading}>
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={handleSetupAndJoin} disabled={loading || !topic.trim()} className="w-full sm:w-auto btn-gel rounded-lg">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</> : "Setup Devices & Join"}
        </Button>
      </DialogFooter>

      <ShareOptionsPanel
        isOpen={isSharePanelOpen}
        onClose={() => setIsSharePanelOpen(false)}
        meetingLink={meetingLink}
        meetingCode={meetingCode}
        meetingTitle={topic}
      />
    </>
  );
}
