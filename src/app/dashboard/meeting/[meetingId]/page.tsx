
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { useAuth } from "@/hooks/useAuth";
import MeetingClient from "./MeetingClient";
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Brush, MessageSquare, Users, Settings } from 'lucide-react';
import HostJoinRequestNotification from "@/components/meeting/HostJoinRequestNotification";


// --------------------------- Meeting Page ---------------------------
export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  const { user, loading: authLoading } = useAuth();
  
  const meetingId = params.meetingId as string;
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (authLoading || !user || !meetingId) {
      if (!authLoading && !user) {
        // Redirect to signin if not authenticated
        const intendedUrl = `/dashboard/meeting/${meetingId}?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
      }
      return;
    }
    
    const checkHost = async () => {
      try {
        const meetingRef = doc(db, "meetings", meetingId);
        const snap = await getDoc(meetingRef);

        if (snap.exists()) {
          const data = snap.data();
          // ✅ Stricter check for host ownership
          if (data.hostId === user.uid) {
            setIsHost(true);
          }
        } else {
             // If meeting doc doesn't exist, this user can't be the host.
            setIsHost(false);
        }
      } catch (err) {
        console.error("Error verifying host:", err);
      } finally {
        setLoading(false);
      }
    };

    checkHost();
  }, [meetingId, user, authLoading, router, searchParams]);

  const constructUrl = (page: string) => {
    let url = `/dashboard/meeting/${meetingId}/${page}`;
    if (topic) {
        url += `?topic=${encodeURIComponent(topic || '')}`;
    }
    return url;
  };
  
  useEffect(() => {
    setHeaderContent(<span className="text-sm font-medium truncate">{topic}</span>);
    
    const MeetingActions = () => (
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
    );

    setHeaderAction(<MeetingActions />);

    return () => {
      setHeaderContent(null);
      setHeaderAction(null);
    };
  }, [topic, meetingId, setHeaderContent, setHeaderAction]);

  const handleLeave = async () => {
    if (user && meetingId) {
        const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
        try {
          await deleteDoc(participantRef);
        } catch (error) {
           console.error("Error removing participant on leave:", error);
        }
    }
    router.push("/");
  };
  
  if (loading || authLoading) return null; 

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
      {/* ✅ Correctly render the listener ONLY for the verified host */}
      {isHost && <HostJoinRequestNotification meetingId={meetingId} />}
      
      {meetingId && user?.uid && (
        <MeetingClient
          meetingId={meetingId}
          userId={user.uid}
          initialCamOn={searchParams.get('cam') !== 'false'}
          initialMicOn={searchParams.get('mic') !== 'false'}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
