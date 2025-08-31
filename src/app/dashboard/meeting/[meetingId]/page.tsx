
'use client';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  MessageSquare,
  Brush,
  MonitorUp,
  Hand,
  Phone,
  Settings,
  MoreVertical,
  UserCog,
  ShieldCheck,
  Pin,
  AlertCircle,
  Maximize,
  UserX,
  Loader2,
  Bell,
} from 'lucide-react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import MeetingClient from './MeetingClient';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, DocumentData, updateDoc, deleteDoc } from 'firebase/firestore';


// --- Join Request Logic ---
interface JoinRequest {
  id: string;
  name: string;
  photoURL?: string;
  requestingUserId: string;
}

const JoinRequestItem = React.memo(({ request, onAccept, onDeny }: { request: JoinRequest; onAccept: (req: JoinRequest) => void; onDeny: (req: JoinRequest) => void; }) => (
  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={request.photoURL} alt={request.name} data-ai-hint="avatar user"/>
        <AvatarFallback>{request.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium text-foreground">{request.name}</p>
        <p className="text-xs text-muted-foreground">Wants to join</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Button size="sm" variant="destructive" onClick={() => onDeny(request)}>Deny</Button>
      <Button size="sm" onClick={() => onAccept(request)}>Admit</Button>
    </div>
  </div>
));
JoinRequestItem.displayName = 'JoinRequestItem';


// --- Participant List Logic ---
interface Participant {
  id: string;
  name: string;
  photoURL?: string;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
}

const ParticipantItem = React.memo(({
  participant, 
  isCurrentUserHost, 
  isThisParticipantTheHost,
  onRemove,
}: { 
  participant: Participant, 
  isCurrentUserHost: boolean,
  isThisParticipantTheHost: boolean,
  onRemove: (participant: Participant) => void;
}) => {
  const { toast } = useToast();
  const isMe = auth.currentUser?.uid === participant.id;

  const handleActionClick = (action: string, participantName: string) => {
    toast({
      title: `${action} ${participantName}`,
      description: `The "${action.toLowerCase()}" feature is under development.`,
      duration: 3000,
    });
  };

  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={participant.photoURL || `https://placehold.co/40x40.png?text=${participant.name.charAt(0)}`} alt={participant.name} data-ai-hint="avatar user"/>
          <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">
            {participant.name} {isMe && "(You)"}
            {isThisParticipantTheHost && <ShieldCheck className="inline-block ml-1.5 h-4 w-4 text-primary" title="Host" />}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
          {participant.isMicMuted ? <MicOff className="h-4 w-4 text-muted-foreground" /> : <Mic className="h-4 w-4 text-foreground" />}
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
          {participant.isCameraOff ? <VideoOff className="h-4 w-4 text-muted-foreground" /> : <Video className="h-4 w-4 text-foreground" />}
        </Button>
        {!isMe && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-lg">
              <DropdownMenuItem onSelect={() => handleActionClick('Chat Privately with', participant.name)} className="cursor-pointer">
                <MessageSquare className="mr-2 h-4 w-4" />
                <span>Chat Privately</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isCurrentUserHost && !isThisParticipantTheHost && ( 
                <DropdownMenuItem 
                  onSelect={() => onRemove(participant)} 
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  <span>Remove Participant</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});
ParticipantItem.displayName = 'ParticipantItem';
// --- End of Participant List Logic ---

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

export default function MeetingPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const { user, loading } = useAuth();
  const router = useRouter();
  const meetingClientRef = useRef<React.ElementRef<typeof MeetingClient>>(null);

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isParticipantJoining, setIsParticipantJoining] = useState(false);

  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  
  // --- State for Participants Sheet ---
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [hostId, setHostId] = useState<string | null>(null);
  const currentUserId = auth.currentUser?.uid;
  const { toast } = useToast();
  // ---
  
  useEffect(() => {
    setHeaderContent(
        <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold truncate">{topic}</h1>
        </div>
    );
    setHeaderAction(
      <div className="flex items-center gap-2">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push(`/dashboard/meeting/${meetingId}/whiteboard?topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
                    <Brush className="mr-2 h-4 w-4"/>
                    <span>Whiteboard</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsParticipantsPanelOpen(true)} className="cursor-pointer">
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Manage Participants</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push(`/dashboard/meeting/${meetingId}/chat?topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
                    <MessageSquare className="mr-2 h-4 w-4"/>
                    <span>Chat</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
    return () => {
        setHeaderContent(null);
        setHeaderAction(null);
    }
  }, [setHeaderContent, setHeaderAction, topic, meetingId, router]);


  // --- Effect to fetch data for the sheet ---
  useEffect(() => {
    if (!meetingId) return;

    setIsLoadingData(true);
    const meetingDocRef = doc(db, "meetings", meetingId);
    
    // Fetch one-time meeting details to get hostId
    const unsubMeeting = onSnapshot(meetingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setHostId(docSnap.data().hostId);
      }
    }, (error) => {
      console.error("[MeetingPage] Error fetching meeting document:", error);
    });

    // Listen for realtime participant changes
    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const unsubParticipants = onSnapshot(query(participantsColRef), (snapshot) => {
      const fetchedParticipants: Participant[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
      setParticipants(fetchedParticipants);
      if (isLoadingData) setIsLoadingData(false);
    }, (error) => {
      console.error("[MeetingPage] Error fetching participants:", error);
      if (isLoadingData) setIsLoadingData(false);
    });

    // Listen for join requests if current user is the host
    const isCurrentUserTheHost = auth.currentUser?.uid === hostId;
    let unsubRequests = () => {};
    if (isCurrentUserTheHost) {
      unsubRequests = onSnapshot(query(collection(db, "meetings", meetingId, "joinRequests")), (snapshot) => {
          const fetchedRequests: JoinRequest[] = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as JoinRequest))
            .filter(req => req.status === 'pending'); // Only show pending requests
          setJoinRequests(fetchedRequests);
        }, (error) => console.error("[MeetingPage] Error fetching join requests:", error))
    }

    return () => { 
      unsubMeeting();
      unsubParticipants();
      unsubRequests();
    };
  }, [meetingId, hostId]);
  // ---
  
  const handleAcceptRequest = async (request: JoinRequest) => {
    try {
        await updateDoc(doc(db, "meetings", meetingId, "joinRequests", request.id), {
          status: "accepted",
        });
        toast({ title: "Participant Admitted", description: `${request.name} will now join the meeting.` });
    } catch(err) {
        console.error("Error admitting participant:", err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not admit participant.'});
    }
  };
  
  const handleDenyRequest = async (request: JoinRequest) => {
    try {
        await deleteDoc(doc(db, `meetings/${meetingId}/joinRequests`, request.id));
        toast({ title: "Request Denied" });
    } catch (err) {
        console.error("Error denying request:", err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not deny the request.'});
    }
  };
  
  const handleRemoveParticipant = async (participant: Participant) => {
      if (participant.id === hostId) {
          toast({ variant: 'destructive', title: "Cannot Remove Host" });
          return;
      }
      try {
        await deleteDoc(doc(db, `meetings/${meetingId}/participants`, participant.id));
        toast({ title: "Participant Removed", description: `${participant.name} has been removed from the meeting.`});
      } catch (err) {
        console.error("Error removing participant:", err);
        toast({ variant: 'destructive', title: 'Error', description: `Could not remove ${participant.name}.`});
      }
  };


  const handleMicToggle = useCallback((isOn: boolean) => setMicOn(isOn), []);
  const handleCamToggle = useCallback((isOn: boolean) => setCamOn(isOn), []);
  
  const userId = user?.uid;

  const handleUserJoined = useCallback(() => {
    setIsParticipantJoining(true);
    setTimeout(() => {
        setIsParticipantJoining(false);
    }, 2000); // Animation duration
  }, []);


  if (loading) {
    return <div className="w-full h-full flex items-center justify-center bg-[#1e2a38] text-white">Loading...</div>;
  }
  if (!userId) {
    router.replace(`/auth/signin?redirect=/dashboard/meeting/${meetingId}`);
    return null;
  }
  
  const backToHomepage = () => {
    try {
      const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
      if (startedMeetingsRaw) {
        let startedMeetings = JSON.parse(startedMeetingsRaw);
        if (Array.isArray(startedMeetings)) {
          // Remove the current meeting from the list
          const updatedMeetings = startedMeetings.filter(m => m.id !== meetingId);
          localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(updatedMeetings));
          window.dispatchEvent(new CustomEvent('teachmeet_meeting_ended'));
        }
      }
    } catch (error) {
      console.error("Failed to update ongoing meetings in localStorage:", error);
    }
    router.push('/');
  };
  
  const isCurrentUserTheHost = currentUserId === hostId;

  return (
    <div className="w-full h-full flex flex-col bg-[#1e2a38] text-white overflow-hidden">
      <div className="flex-grow relative">
        <MeetingClient 
            ref={meetingClientRef}
            meetingId={meetingId} 
            userId={userId} 
            onMicToggle={handleMicToggle} 
            onCamToggle={handleCamToggle}
            onUserJoined={handleUserJoined}
        />
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 flex items-center justify-center gap-2 md:gap-4 max-w-lg mx-auto">
          <Button
            variant={micOn ? 'default' : 'destructive'}
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={() => meetingClientRef.current?.toggleMic()}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>
          <Button
            variant={camOn ? 'default' : 'destructive'}
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={() => meetingClientRef.current?.toggleCam()}
            aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          <div className="w-px h-8 bg-white/20 mx-1 md:mx-3" />

          {/* Participants Sheet Trigger */}
          <Sheet open={isParticipantsPanelOpen} onOpenChange={setIsParticipantsPanelOpen}>
            <SheetTrigger asChild>
               <Button
                variant={'destructive'}
                size="icon"
                className={cn(
                  "rounded-full w-12 h-12 md:w-14 md:h-14 relative",
                  isParticipantJoining && 'animate-blink-success'
                )}
                aria-label="Participants"
              >
                <Users className="h-6 w-6" />
                 {joinRequests.length > 0 && isCurrentUserTheHost && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-destructive items-center justify-center text-xs text-white">{joinRequests.length}</span>
                    </span>
                 )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="text-foreground bg-background rounded-t-xl h-[70vh] flex flex-col">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Participants ({participants.length})</SheetTitle>
                <SheetDescription>Manage participants and view join requests.</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-grow">
                <div className="p-4 space-y-4">
                   {isLoadingData ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                    </div>
                  ) : (
                    <>
                      {isCurrentUserTheHost && joinRequests.length > 0 && (
                        <div className="space-y-2">
                           <h3 className="text-sm font-medium text-muted-foreground px-1 flex items-center gap-2"><Bell className="h-4 w-4 text-primary"/> Join Requests</h3>
                           {joinRequests.map(req => <JoinRequestItem key={req.id} request={req} onAccept={handleAcceptRequest} onDeny={handleDenyRequest} />)}
                           <div className="pt-2 border-b"></div>
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        {participants.length === 0 ? (
                           <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                            <Users className="w-16 h-16 mb-4" />
                            <p>You're the first one here!</p>
                           </div>
                         ) : participants.map((participant) => (
                           <ParticipantItem 
                             key={participant.id} 
                             participant={participant} 
                             isCurrentUserHost={isCurrentUserTheHost}
                             isThisParticipantTheHost={participant.id === hostId}
                             onRemove={handleRemoveParticipant}
                           />
                         ))}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <SheetFooter className="p-4 border-t">
                  <SheetClose asChild>
                    <Button variant="outline" className="w-full">Close</Button>
                  </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Button 
            variant={isHandRaised ? 'default' : 'destructive'}
            size="icon" 
            className="rounded-full w-12 h-12 md:w-14 md:h-14" 
            aria-label="Raise hand"
            onClick={() => setIsHandRaised(!isHandRaised)}
          >
            <Hand className="h-6 w-6" />
          </Button>
           
          <div className="w-px h-8 bg-white/20 mx-1 md:mx-3" />

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={backToHomepage}
            aria-label="Leave meeting"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
