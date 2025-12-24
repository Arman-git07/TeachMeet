
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import MeetingClient from "./MeetingClient";
import { doc, getDoc, deleteDoc, onSnapshot, collection, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Brush, MessageSquare, Users, Settings, UserCheck, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';

// --- Type Definitions for this page ---
interface Participant {
  id: string;
  name: string;
  photoURL?: string;
  isHost?: boolean;
}

// --------------------------- Meeting Page ---------------------------
export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  const { user, loading: authLoading } = useAuth();
  
  const meetingId = params.meetingId as string;
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const initialPinnedId = searchParams.get('pin') || null;
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHeaderAsId, setShowHeaderAsId] = useState(false);
  const [currentCamOn, setCurrentCamOn] = useState(true);
  const [currentMicOn, setCurrentMicOn] = useState(true);

  // Update cam/mic state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentCamOn(localStorage.getItem('teachmeet-cam-state') !== 'false');
      setCurrentMicOn(localStorage.getItem('teachmeet-mic-state') !== 'false');
    }
  }, []);


  const handleLeave = useCallback(async (endForAll = false) => {
    if (!meetingId || !user) return;

    // Always clean up local storage for the current user
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
      console.error("Failed to clean up localStorage on leave", e);
    }
  
    if (isHost && endForAll) {
      try {
        // This update will trigger the onSnapshot listener for all clients,
        // leading to cleanup and redirection.
        const meetingRef = doc(db, "meetings", meetingId);
        await updateDoc(meetingRef, { status: 'ended' });
      } catch (error) {
        console.error("Error ending meeting for all:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not end meeting for all participants." });
      }
    } else {
      // Logic for a single user (host or participant) leaving without ending for all.
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try {
        await deleteDoc(participantRef);
      } catch (error) {
        console.error("Error removing participant on leave:", error);
      }
    }
  
    // Always redirect the current user away from the meeting page immediately after cleanup.
    router.push("/");
  }, [meetingId, user, isHost, router, toast]);

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
            handleLeave(false); // Trigger local cleanup without trying to delete again
            return;
        }

        setLoading(false);

    }, (error) => {
        console.error("Error listening to meeting document:", error);
        toast({ variant: "destructive", title: "Connection Error", description: "Could not sync with the meeting." });
        router.replace("/");
    });
    
    // Add beforeunload listener
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      handleLeave(false);
      // Most browsers don't show this message anymore, but it's good practice
      e.preventDefault(); 
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);


    return () => {
      unsubscribe(); // Cleanup Firestore listener on component unmount
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };

  }, [meetingId, user, authLoading, router, searchParams, toast, handleLeave]);


  const constructUrl = (page: string) => {
    const params = new URLSearchParams({
        topic: topic || '',
        cam: String(currentCamOn),
        mic: String(currentMicOn),
    });
    return `/dashboard/meeting/${meetingId}/${page}?${params.toString()}`;
  };

  const memoizedMeetingActions = useCallback(() => (
    <DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
        <MoreVertical className="h-5 w-5" />
        </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="rounded-xl w-56">
        <DropdownMenuItem asChild className="cursor-pointer">
        <Link href={constructUrl('whiteboard')}>
            <Brush className="mr-2 h-4 w-4" />
            <span>Whiteboard</span>
        </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
        <Link href={constructUrl('chat')}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chat</span>
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
  ), [meetingId, topic, currentCamOn, currentMicOn]);
  
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
        <MeetingClient
          meetingId={meetingId}
          userId={user.uid}
          initialCamOn={searchParams.get('cam') !== 'false'}
          initialMicOn={searchParams.get('mic') !== 'false'}
          onLeave={handleLeave}
          topic={topic}
          initialPinnedId={initialPinnedId}
        />
      )}
    </div>
  );
}
