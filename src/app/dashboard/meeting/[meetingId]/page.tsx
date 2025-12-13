
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

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

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


  useEffect(() => {
    if (authLoading || !meetingId) return;

    if (!user) {
      const intendedUrl = `/dashboard/meeting/${meetingId}?${searchParams.toString()}`;
      router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
      return;
    }
    
    // Set up a real-time listener for the meeting document
    const meetingRef = doc(db, "meetings", meetingId);
    const unsubscribe = onSnapshot(meetingRef, (snap) => {
        if (!snap.exists()) {
            toast({ variant: "destructive", title: "Meeting Not Found", description: "This meeting may have been deleted or never existed." });
            router.replace("/");
            return;
        }

        const data = snap.data();
        // Check if the current user is the host
        const isUserHost = data.hostId === user.uid;
        if (isUserHost) {
          setIsHost(true);
        }
        
        // Check if meeting has ended for everyone
        if (data.status === 'ended') {
            toast({ title: "Meeting Ended", description: "The host has ended this meeting." });
            // Clean up localStorage for all users on this event
            const storedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
            if (storedMeetingsRaw) {
                let meetings = JSON.parse(storedMeetingsRaw);
                if (Array.isArray(meetings)) {
                    const updatedMeetings = meetings.filter(m => m.id !== meetingId);
                    localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(updatedMeetings));
                    window.dispatchEvent(new CustomEvent('teachmeet_meeting_ended'));
                }
            }
            router.replace("/");
            return; // Stop further processing
        }

        setLoading(false);

    }, (error) => {
        console.error("Error listening to meeting document:", error);
        toast({ variant: "destructive", title: "Connection Error", description: "Could not sync with the meeting." });
        router.replace("/");
    });

    return () => unsubscribe(); // Cleanup listener on component unmount

  }, [meetingId, user, authLoading, router, searchParams, toast]);


  const constructUrl = (page: string) => {
    let url = `/dashboard/meeting/${meetingId}/${page}`;
    const topicParam = topic || '';
    if (topicParam) {
        url += `?topic=${encodeURIComponent(topicParam)}`;
    }
    return url;
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
  ), [meetingId, topic]);
  
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

  const handleLeave = async (endForAll = false) => {
    if (!meetingId) return;
  
    if (isHost && endForAll) {
      try {
        const meetingRef = doc(db, "meetings", meetingId);
        await updateDoc(meetingRef, { status: 'ended' });
        // The onSnapshot listener will handle localStorage cleanup and redirection for all users.
      } catch (error) {
        console.error("Error ending meeting for all:", error);
      }
    } else if (user) {
      // Logic for a single user (host or participant) leaving
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try {
        await deleteDoc(participantRef);
        if (isHost) {
          // If host leaves without ending, remove from their local storage
           const storedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
            if (storedMeetingsRaw) {
                let meetings = JSON.parse(storedMeetingsRaw);
                if (Array.isArray(meetings)) {
                    const updatedMeetings = meetings.filter(m => m.id !== meetingId);
                    localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(updatedMeetings));
                    window.dispatchEvent(new CustomEvent('teachmeet_meeting_ended'));
                }
            }
        }
      } catch (error) {
        console.error("Error removing participant on leave:", error);
      }
    }
  
    // Always redirect the current user away from the meeting page
    router.push("/");
  };
  
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
