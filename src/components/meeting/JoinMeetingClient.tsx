
'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hash, LinkIcon, ClipboardPaste, X } from "lucide-react";

const LONG_PRESS_DURATION = 750; // milliseconds

export function JoinMeetingClient() {
  const [meetingLinkInput, setMeetingLinkInput] = useState('');
  const [meetingCodeInput, setMeetingCodeInput] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const [showPasteButton, setShowPasteButton] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPressTimer = () => {
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setShowPasteButton(true);
    }, LONG_PRESS_DURATION);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  const handleAttemptPaste = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        toast({
          variant: "destructive",
          title: "Paste Not Supported",
          description: "Your browser does not support pasting from the clipboard directly or permission was denied.",
        });
        setShowPasteButton(false);
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        setMeetingLinkInput(text);
        toast({
          title: "Pasted from Clipboard",
          description: "Link pasted successfully.",
        });
      } else {
        toast({
          title: "Clipboard Empty",
          description: "Nothing to paste from the clipboard.",
        });
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      toast({
        variant: "destructive",
        title: "Paste Failed",
        description: "Could not paste from clipboard. Ensure you've granted permission if prompted.",
      });
    } finally {
      setShowPasteButton(false);
    }
  };
  
  const handleJoinMeeting = () => {
    let meetingId: string | null = null;
    let topic: string | null = null;
    let derivedFromLink = false;

    if (meetingLinkInput.trim()) {
      derivedFromLink = true;
      try {
        const url = new URL(meetingLinkInput.trim());
        const pathParts = url.pathname.split('/');
        const meetingSegmentIndex = pathParts.indexOf('meeting');

        if (meetingSegmentIndex !== -1 && meetingSegmentIndex + 1 < pathParts.length) {
          const potentialId = pathParts[meetingSegmentIndex + 1];
          if (potentialId && potentialId !== 'wait' && potentialId !== 'chat' && potentialId !== 'participants' && potentialId !== 'whiteboard') {
            meetingId = potentialId;
          }
        }
        
        if (url.searchParams.has('topic')) {
          topic = url.searchParams.get('topic');
        }

        if (!meetingId) {
          toast({
            variant: "destructive",
            title: "Invalid Link Format",
            description: "Could not extract a valid meeting ID from the link. Please ensure the link is correct.",
          });
          return;
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Invalid URL",
          description: "The meeting link provided is not a valid URL.",
        });
        return;
      }
    } else if (meetingCodeInput.trim()) {
      meetingId = meetingCodeInput.trim();
      if (!meetingId) {
        toast({
          variant: "destructive",
          title: "Invalid Code",
          description: "Meeting code cannot be empty.",
        });
        return;
      }
    } else {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter a meeting link or code.",
      });
      return;
    }

    if (meetingId && meetingId.trim()) {
      const finalMeetingId = meetingId.trim();
      let navigationPath = `/dashboard/meeting/${finalMeetingId}/wait`;
      if (topic) {
        navigationPath += `?topic=${encodeURIComponent(topic)}`;
      }
      
      toast({
        title: "Joining Meeting...",
        description: `Attempting to join meeting ID: ${finalMeetingId}${topic ? ' with topic: ' + topic : ''}`,
      });
      router.push(navigationPath);
    } else {
      toast({
        variant: "destructive",
        title: derivedFromLink ? "Invalid Link" : "Invalid Code",
        description: "Could not determine a valid meeting ID from your input.",
      });
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      if (!document.activeElement || !document.activeElement.closest('[data-paste-button-area]')) {
        setShowPasteButton(false);
      }
    }, 150);
    clearLongPressTimer();
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="meetingCode" className="block text-sm font-medium text-muted-foreground mb-1">
          Meeting Code
        </label>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input 
            id="meetingCode" 
            placeholder="e.g., abc-def-ghi" 
            className="pl-10 rounded-lg text-base"
            value={meetingCodeInput}
            onChange={(e) => setMeetingCodeInput(e.target.value)}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="meetingLink" className="block text-sm font-medium text-muted-foreground mb-1">
          Meeting Link
        </label>
        <div className="relative group/meeting-link-input">
          <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input 
            id="meetingLink" 
            placeholder="https://teachmeet.example.com/join/..." 
            className="pl-10 rounded-lg text-base pr-16"
            value={meetingLinkInput}
            onChange={(e) => setMeetingLinkInput(e.target.value)}
            onMouseDown={startLongPressTimer}
            onMouseUp={clearLongPressTimer}
            onMouseLeave={clearLongPressTimer}
            onTouchStart={startLongPressTimer}
            onTouchEnd={clearLongPressTimer}
            onBlur={handleInputBlur}
          />
          {showPasteButton && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10" data-paste-button-area>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md px-2 py-1 text-xs h-7 bg-background hover:bg-muted"
                onClick={handleAttemptPaste}
                onBlur={handleInputBlur}
                title="Paste from clipboard"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full h-6 w-6 hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPasteButton(false);
                  clearLongPressTimer();
                }}
                onBlur={handleInputBlur}
                title="Close paste option"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <Button onClick={handleJoinMeeting} className="w-full btn-gel text-lg py-3 rounded-lg">
        Join Meeting
      </Button>
    </div>
  );
}
