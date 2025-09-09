
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Video, Loader2, Clipboard, Share2, Check, Link as LinkIcon, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";
import { 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogClose
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { ShareOptionsPanel } from "../common/ShareOptionsPanel";

const generateRandomId = (length: number) => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `${result.slice(0,3)}-${result.slice(3,6)}-${result.slice(6,9)}`;
};

export function StartMeetingDialogContent() {
  const [meetingTitle, setMeetingTitle] = useState("My TeachMeet Meeting");
  const [meetingId, setMeetingId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  
  useEffect(() => {
    setMeetingId(generateRandomId(9));
  }, []);

  const handleCopyToClipboard = useCallback((text: string, type: 'link' | 'code') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      toast({ title: `Meeting ${type} copied!` });
      setTimeout(() => setCopied(null), 2000);
    });
  }, [toast]);
  
  const meetingLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/dashboard/join-meeting?meetingId=${meetingId}`
    : '';

  const handleCreateAndGoToPrejoin = () => {
    if (!meetingTitle.trim()) {
      toast({ variant: "destructive", title: "Topic Required", description: "Please enter a topic for the meeting." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to start a meeting." });
      return;
    }

    setIsCreating(true);
    // In a real app, you might create the meeting document in Firestore here.
    // For now, we'll just navigate.
    
    const prejoinPath = `/dashboard/meeting/prejoin?meetingId=${meetingId}&topic=${encodeURIComponent(meetingTitle.trim())}`;
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
            Use the details below to invite others, then proceed to the pre-join screen to set up your devices.
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
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateAndGoToPrejoin();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Invite Details</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-grow">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={meetingLink} readOnly className="pl-9 rounded-lg text-sm bg-muted/50" />
              </div>
              <Button variant="outline" size="icon" className="rounded-lg flex-shrink-0" onClick={() => handleCopyToClipboard(meetingLink, 'link')}>
                {copied === 'link' ? <Check className="h-4 w-4 text-primary" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-grow">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={meetingId} readOnly className="pl-9 rounded-lg text-sm bg-muted/50" />
              </div>
              <Button variant="outline" size="icon" className="rounded-lg flex-shrink-0" onClick={() => handleCopyToClipboard(meetingId, 'code')}>
                {copied === 'code' ? <Check className="h-4 w-4 text-primary" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            </div>
             <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" className="w-full rounded-lg" onClick={() => setIsSharePanelOpen(true)}>
                    <Share2 className="mr-2 h-4 w-4"/> Share Full Invite
                </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-lg" disabled={isCreating}>
              Cancel
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            onClick={handleCreateAndGoToPrejoin} 
            className="btn-gel rounded-lg" 
            disabled={!meetingTitle.trim() || isCreating || !user}
          >
            {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isCreating ? "Proceeding..." : "Setup Devices & Join"}
          </Button>
        </DialogFooter>
         <ShareOptionsPanel
            isOpen={isSharePanelOpen}
            onClose={() => setIsSharePanelOpen(false)}
            meetingLink={meetingLink}
            meetingCode={meetingId}
            meetingTitle={meetingTitle}
        />
    </>
  );
}
