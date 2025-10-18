
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hash, LinkIcon } from "lucide-react";

export function JoinMeetingClient() {
  const [meetingInput, setMeetingInput] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleJoinMeeting = () => {
    const codeOrLink = meetingInput.trim();
    if (!codeOrLink) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter a meeting link or code.",
      });
      return;
    }

    let meetingId: string | null = null;
    let topic: string | null = null;

    try {
      // Attempt to parse as a URL first
      if (codeOrLink.startsWith('http')) {
        const url = new URL(codeOrLink);
        meetingId = url.searchParams.get('meetingId');
        topic = url.searchParams.get('topic');
      }
    } catch (error) {
      // Not a valid URL, treat it as a code
    }

    // If parsing as URL didn't yield an ID, treat the whole input as the ID
    if (!meetingId) {
      meetingId = codeOrLink;
    }

    if (meetingId) {
      let navigationPath = `/dashboard/meeting/prejoin?meetingId=${encodeURIComponent(meetingId)}&role=participant`;
      if (topic) {
        navigationPath += `&topic=${encodeURIComponent(topic)}`;
      }
      
      toast({
        title: "Preparing to Join...",
        description: `Taking you to the setup screen for meeting...`,
      });
      router.push(navigationPath);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Could not determine a valid meeting ID from your input.",
      });
    }
  };

  return (
    <div className="space-y-6">
       <div>
        <label htmlFor="meetingLink" className="block text-sm font-medium text-muted-foreground mb-1">
          Meeting Link or Code
        </label>
        <div className="relative group/meeting-link-input">
          <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input 
            id="meetingLink" 
            placeholder="Paste link or enter code..." 
            className="pl-10 rounded-lg text-base"
            value={meetingInput}
            onChange={(e) => setMeetingInput(e.target.value)}
          />
        </div>
      </div>
      
      <Button onClick={handleJoinMeeting} className="w-full btn-gel text-lg py-3 rounded-lg">
        Join Meeting
      </Button>
    </div>
  );
}
