
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LinkIcon, Loader2 } from "lucide-react";
import { doc, getDoc, collection, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

async function isMeetingEmpty(meetingId: string): Promise<boolean> {
    const participantsRef = collection(db, 'meetings', meetingId, 'participants');
    const q = query(participantsRef, limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
}

export function JoinMeetingClient() {
  const [meetingInput, setMeetingInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleJoinMeeting = async () => {
    const codeOrLink = meetingInput.trim();
    if (!codeOrLink) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter a meeting link or code.",
      });
      return;
    }

    setIsLoading(true);

    let meetingId: string | null = null;
    let topic: string | null = null;

    try {
      if (codeOrLink.startsWith('http')) {
        const url = new URL(codeOrLink);
        const pathSegments = url.pathname.split('/');
        meetingId = url.searchParams.get('meetingId') || pathSegments.find(seg => seg.startsWith('meeting-')) || null;
        topic = url.searchParams.get('topic');
      } else {
        if (codeOrLink.startsWith('meeting-')) {
            meetingId = codeOrLink;
        } else {
            meetingId = `meeting-${codeOrLink}`;
        }
      }
    } catch (error) {
      // Not a valid URL, treat as a code
      if (codeOrLink.startsWith('meeting-')) {
          meetingId = codeOrLink;
      } else {
          meetingId = `meeting-${codeOrLink}`;
      }
    }

    if (!meetingId) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Could not determine a valid meeting ID from your input.",
      });
      setIsLoading(false);
      return;
    }
    
    // --- Validation Logic ---
    try {
        const meetingRef = doc(db, 'meetings', meetingId);
        const docSnap = await getDoc(meetingRef);

        if (!docSnap.exists()) {
            toast({ variant: "destructive", title: "Meeting Not Found", description: "This meeting does not exist or may have been deleted." });
            setIsLoading(false);
            return;
        }

        const meetingData = docSnap.data();

        if (meetingData.status === 'ended') {
            toast({ variant: "destructive", title: "Meeting Has Ended", description: "This meeting is no longer active." });
            setIsLoading(false);
            return;
        }

        const meetingAge = Date.now() - meetingData.createdAt.toDate().getTime();
        if (meetingAge > TWO_HOURS_IN_MS) {
            const isEmpty = await isMeetingEmpty(meetingId);
            if (isEmpty) {
                toast({ variant: "destructive", title: "Meeting Expired", description: "This meeting is old and no longer available to join." });
                setIsLoading(false);
                return;
            }
        }
        
        if (user && meetingData.hostId === user.uid) {
            toast({ title: "You are the host!", description: "To start your meeting, go to the pre-join link from your dashboard.", duration: 5000 });
            router.push(`/dashboard/meeting/prejoin?meetingId=${meetingId}&role=host&topic=${encodeURIComponent(meetingData.topic || '')}`);
            return;
        }
        
        let navigationPath = `/dashboard/meeting/prejoin?meetingId=${encodeURIComponent(meetingId)}&role=participant`;
        const finalTopic = topic || meetingData.topic;
        if (finalTopic) {
            navigationPath += `&topic=${encodeURIComponent(finalTopic)}`;
        }
        
        toast({
            title: "Preparing to Join...",
            description: `Taking you to the setup screen for the meeting.`,
        });
        router.push(navigationPath);

    } catch (error) {
        toast({ variant: "destructive", title: "Validation Failed", description: "An error occurred while trying to join the meeting."});
        setIsLoading(false);
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
            onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
            disabled={isLoading}
          />
        </div>
      </div>
      
      <Button onClick={handleJoinMeeting} className="w-full btn-gel text-lg py-3 rounded-lg" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Join Meeting
      </Button>
    </div>
  );
}
