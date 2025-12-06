
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { useAuth } from "@/hooks/useAuth";
import MeetingClient from "./MeetingClient";
import { doc, getDoc, deleteDoc, onSnapshot, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Brush, MessageSquare, Users, Settings, UserCheck, Loader2 } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { io, Socket } from "socket.io";


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
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  const { user, loading: authLoading } = useAuth();
  
  const meetingId = params.meetingId as string;
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const initialPinnedId = searchParams.get('pin') || null;
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHeaderAsId, setShowHeaderAsId] = useState(false);

  // --- State for Collaboration Dialog ---
  const [isCollaborateDialogOpen, setIsCollaborateDialogOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drawingPermissions, setDrawingPermissions] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (authLoading || !meetingId) return;

    if (!user) {
      const intendedUrl = `/dashboard/meeting/${meetingId}?${searchParams.toString()}`;
      router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
      return;
    }
    
    const checkHost = async () => {
      setLoading(true);
      try {
        const meetingRef = doc(db, "meetings", meetingId);
        const snap = await getDoc(meetingRef);

        if (snap.exists()) {
          const data = snap.data();
          if (data.hostId === user.uid) {
            setIsHost(true);
          }
        } else {
          // If meeting doesn't exist, they can't be the host.
          setIsHost(false);
        }
      } catch (err) {
        console.error("Error verifying host:", err);
        setIsHost(false); // Default to false on error
      } finally {
        setLoading(false);
      }
    };

    checkHost();
  }, [meetingId, user, authLoading, router, searchParams]);

  // --- Logic for Collaboration Dialog ---
  useEffect(() => {
      const whiteboardRoomId = `whiteboard-${meetingId}`;
      const socket = io({ path: "/api/socketio" });
      socketRef.current = socket;

      socket.on('connect', () => socket.emit('join-room', whiteboardRoomId, user?.uid));
      
      socket.on('initial-state', ({ permissions }) => {
        setDrawingPermissions(permissions || {});
      });

      socket.on('permission-update', (newPermissions) => {
        setDrawingPermissions(newPermissions);
      });

      const unsubParticipants = onSnapshot(collection(db, "meetings", meetingId, "participants"), (snapshot) => {
          const fetchedParticipants: Participant[] = [];
          snapshot.forEach((doc) => {
              fetchedParticipants.push({ id: doc.id, ...doc.data() } as Participant);
          });
          setParticipants(fetchedParticipants);
      });

      return () => {
          socket.disconnect();
          unsubParticipants();
      };
  }, [meetingId, user?.uid]);

  const handlePermissionChange = (participantId: string, canDraw: boolean) => {
    socketRef.current?.emit('set-permission', { participantId, canDraw });
  };


  const constructUrl = (page: string) => {
    let url = `/dashboard/meeting/${meetingId}/${page}`;
    const topicParam = topic || '';
    if (topicParam) {
        url += `?topic=${encodeURIComponent(topicParam)}`;
    }
    return url;
  };

  const memoizedMeetingActions = useCallback(() => (
    <Dialog open={isCollaborateDialogOpen} onOpenChange={setIsCollaborateDialogOpen}>
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
            {isHost && (
                <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="cursor-pointer">
                        <UserCheck className="mr-2 h-4 w-4" />
                        <span>Collaborate on Whiteboard</span>
                    </DropdownMenuItem>
                </DialogTrigger>
            )}
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
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Manage Whiteboard Collaboration</DialogTitle>
                <DialogDescription>Allow other participants to draw on the shared whiteboard.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-64 my-4">
                <div className="space-y-3 pr-4">
                    {participants.filter(p => !p.isHost).map(p => (
                        <div key={p.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8"><AvatarImage src={p.photoURL} /><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar>
                                <Label htmlFor={`perm-${p.id}`}>{p.name}</Label>
                            </div>
                            <Switch id={`perm-${p.id}`} checked={drawingPermissions[p.id] || false} onCheckedChange={(checked) => handlePermissionChange(p.id, checked)} />
                        </div>
                    ))}
                </div>
            </ScrollArea>
            <DialogFooter>
                <DialogClose asChild><Button>Done</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  ), [meetingId, topic, isHost, isCollaborateDialogOpen, participants, drawingPermissions]);
  
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

  const handleLeave = async () => {
    if (user && meetingId) {
        const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
        try {
          // If the user is the host, we might want to end the meeting for everyone
          // For now, we just remove the participant
          await deleteDoc(participantRef);
        } catch (error) {
           console.error("Error removing participant on leave:", error);
        }
    }
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
