// src/app/dashboard/meeting/[meetingId]/page.tsx
"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import MeetingClient from "./MeetingClient";
import { doc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Brush, Users, Settings, Loader2, Video, MessageSquare } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useMeetingRTC } from "@/contexts/MeetingRTCContext";
import { SaveRecordingDialog } from "@/components/meeting/SaveRecordingDialog";

const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';

export interface Recording {
  id: string;
  name: string;
  date: string;
  duration: string;
  size: string;
  thumbnailUrl?: string;
  downloadURL: string;
  storagePath: string;
  uploaderId: string;
  isPrivate: boolean;
  createdAt?: any;
}


function MeetingPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  const { user, loading: authLoading } = useAuth();
  const { rtc, isRecording, isUploading, recordingControls, isSaveRecordingDialogOpen, setIsSaveRecordingDialogOpen } = useMeetingRTC();
  
  const meetingId = params.meetingId as string;
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHeaderAsId, setShowHeaderAsId] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Centralized state for pinned user
  const [pinnedId, setPinnedId] = useState<string | null>(() => searchParams.get('pin'));

  useEffect(() => {
    // Sync pinnedId state with URL search params
    const currentPin = searchParams.get('pin');
    if (currentPin !== pinnedId) {
        setPinnedId(currentPin);
    }
  }, [searchParams, pinnedId]);


  const handleLeave = useCallback(async (endForAll = false) => {
    if (!meetingId || !user) return;

    rtc?.leave();

    if (isHost && endForAll) {
        try {
            const STARTED_MEETINGS_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;
            const storedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
            if (storedMeetingsRaw) {
                let meetings = JSON.parse(storedMeetingsRaw);
                if (Array.isArray(meetings)) {
                    const updatedMeetings = meetings.filter(m => m.id !== meetingId);
                    localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(updatedMeetings));
                    window.dispatchEvent(new CustomEvent('teachmeet_meeting_ended'));
                }
            }
        } catch (e) {
            console.error("Failed to clean up localStorage on end-for-all", e);
        }
    }
  
    if (isHost && endForAll) {
      try {
        const meetingRef = doc(db, "meetings", meetingId);
        await updateDoc(meetingRef, { status: 'ended' });
      } catch (error) {
        console.error("Error ending meeting for all:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not end meeting for all participants." });
      }
    } else {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try {
        await deleteDoc(participantRef);
      } catch (error) {
        console.error("Error removing participant on leave:", error);
      }
    }
  
    router.push("/");
  }, [meetingId, user, isHost, router, toast, rtc]);

  useEffect(() => {
    const camState = localStorage.getItem('teachmeet-cam-state') !== 'false';
    const micState = localStorage.getItem('teachmeet-mic-state') !== 'false';
    setCamOn(camState);
    setMicOn(micState);
  }, []);

  useEffect(() => {
    if (authLoading || !meetingId) return;

    if (!user) {
      const intendedUrl = `/dashboard/meeting/${meetingId}?${searchParams.toString()}`;
      router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
      return;
    }
    
    const meetingRef = doc(db, "meetings", meetingId);
    const unsubscribe = onSnapshot(meetingRef, (snap) => {
        if (!snap.exists()) {
            toast({ variant: "destructive", title: "Meeting Not Found", description: "This meeting may have been deleted or never existed." });
            router.replace("/");
            return;
        }

        const data = snap.data();
        const isUserHost = data.hostId === user.uid;
        if (isUserHost) setIsHost(true);
        
        if (data.status === 'ended') {
            toast({ title: "Meeting Ended", description: "The host has ended this meeting." });
            handleLeave(false); 
            return;
        }

        setLoading(false);

    }, (error) => {
        console.error("Error listening to meeting document:", error);
        toast({ variant: "destructive", title: "Connection Error", description: "Could not sync with the meeting." });
        router.replace("/");
    });
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      handleLeave(false);
      e.preventDefault(); 
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);


    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };

  }, [meetingId, user, authLoading, router, searchParams, toast, handleLeave]);


  const memoizedMeetingActions = useCallback(() => {
    const params = new URLSearchParams({ topic: topic || '' });
    params.set('cam', String(camOn));
    params.set('mic', String(micOn));
    if (pinnedId) {
        params.set('pin', pinnedId);
    }

    const constructUrl = (page: string) => `/dashboard/meeting/${meetingId}/${page}?${params.toString()}`;

    const handleRecordingToggle = () => {
      if (isRecording) {
        setIsSaveRecordingDialogOpen(true);
      } else {
        recordingControls.start();
      }
    };

    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="h-5 w-5" />
              </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl w-56">
              <DropdownMenuItem className="cursor-pointer">
                <MessageSquare className="mr-2 h-4 w-4" />
                <span>Meeting Chat</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRecordingToggle} disabled={isUploading} className="cursor-pointer">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Video className="mr-2 h-4 w-4" />}
                <span>{isUploading ? 'Uploading...' : isRecording ? 'Stop Recording' : 'Start Recording'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={constructUrl('whiteboard')}>
                  <Brush className="mr-2 h-4 w-4" />
                  <span>Whiteboard</span>
              </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={constructUrl('participants')}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Participants</span>
              </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic || '')}`}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Meeting Settings</span>
              </Link>
              </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }, [meetingId, topic, camOn, micOn, pinnedId, isRecording, isUploading, recordingControls, setIsSaveRecordingDialogOpen]);
  
  useEffect(() => {
      setHeaderContent(
          <div onClick={() => setShowHeaderAsId(prev => !prev)} className="cursor-pointer">
              <span className="text-sm font-medium truncate">
              {showHeaderAsId ? meetingId.replace('meeting-', '') : topic}
              </span>
          </div>
      );
      setHeaderAction(memoizedMeetingActions());

      return () => {
          setHeaderContent(null);
          setHeaderAction(null);
      };
  }, [topic, meetingId, setHeaderContent, setHeaderAction, showHeaderAsId, memoizedMeetingActions]);
  
  if (loading || authLoading) return <div className="w-full h-full flex items-center justify-center bg-[#223D4A]"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;

  return (
    <div className="flex-1 w-full bg-[#223D4A] text-foreground flex flex-col h-full">
      {meetingId && user?.uid && (
        <>
          <MeetingClient
            meetingId={meetingId}
            userId={user.uid}
            onLeave={handleLeave}
            topic={topic}
            initialPinnedId={pinnedId}
          />
          <SaveRecordingDialog 
            isOpen={isSaveRecordingDialogOpen}
            onOpenChange={setIsSaveRecordingDialogOpen}
            onSave={(destination) => {
              recordingControls.stop(destination);
              setIsSaveRecordingDialogOpen(false);
            }}
            isSaving={isUploading}
          />
        </>
      )}
    </div>
  );
}

// --------------------------- Meeting Page ---------------------------
export default function MeetingPage() {
  return (
    <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-[#223D4A]"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>}>
      <MeetingPageContent />
    </Suspense>
  )
}
