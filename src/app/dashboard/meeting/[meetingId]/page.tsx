
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
  LogIn,
  Check,
  X,
} from 'lucide-react';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { collection, query, onSnapshot, doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, where } from 'firebase/firestore';


// --- Join Request Logic ---
interface JoinRequest {
  id: string;
  name: string;
  photoURL?: string;
  userId: string;
  status: 'pending' | 'accepted' | 'rejected';
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
      <Button size="sm" variant="destructive" onClick={() => onDeny(request)}><X className="h-4 w-4 mr-1" />Deny</Button>
      <Button size="sm" onClick={() => onAccept(request)}><Check className="h-4 w-4 mr-1"/>Admit</Button>
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


export default function MeetingPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get('topic') || "TeachMeet Meeting");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const meetingClientRef = useRef<React.ElementRef<typeof MeetingClient>>(null);

  // States for UI controls
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isParticipantJoining, setIsParticipantJoining] = useState(false);
  
  // States for join flow logic
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [hostId, setHostId] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<'loading' | 'requesting' | 'admitted' | 'denied' | 'idle'>('loading');

  // States for data
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 20, y: 20 });
  
  // Effect 1: Fetch meeting data and determine user status
  useEffect(() => {
    if (authLoading || !meetingId || !user) return;

    const setupMeeting = async () => {
        setIsLoadingMeeting(true);
        try {
            const meetingDocRef = doc(db, "meetings", meetingId);
            const meetingSnap = await getDoc(meetingDocRef);

            if (!meetingSnap.exists()) {
                toast({ variant: 'destructive', title: "Meeting Not Found", description: "This meeting does not exist or has been deleted." });
                router.push('/dashboard/classrooms');
                return;
            }
            const meetingData = meetingSnap.data();
            const meetingHostId = meetingData.hostId;
            setHostId(meetingHostId);
            setTopic(meetingData.topic || "TeachMeet Meeting");

            if (user.uid === meetingHostId) {
                setJoinStatus('admitted');
            } else {
                // Check if user is already a participant
                const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
                const participantSnap = await getDoc(participantRef);
                if (participantSnap.exists()) {
                    setJoinStatus('admitted');
                } else {
                    setJoinStatus('requesting');
                }
            }

        } catch (err) {
            console.error("Error setting up meeting:", err);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load meeting details.' });
            router.push('/dashboard/classrooms');
        } finally {
            setIsLoadingMeeting(false);
        }
    };
    
    setupMeeting();
  }, [user, authLoading, meetingId, router, toast]);

  // Effect 2: If admitted, add to participants. If requesting, create join request.
  useEffect(() => {
    if (joinStatus !== 'admitted' && joinStatus !== 'requesting' || !user || !meetingId) return;

    const performAction = async () => {
      if (joinStatus === 'admitted') {
        const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
        await setDoc(participantRef, {
            name: user.displayName || "Guest",
            photoURL: user.photoURL || null,
            joinedAt: serverTimestamp(),
        }, { merge: true });
      } else if (joinStatus === 'requesting') {
        const requestRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
        await setDoc(requestRef, {
          name: user.displayName || "Guest",
          photoURL: user.photoURL || null,
          status: 'pending',
          requestedAt: serverTimestamp()
        });
      }
    };

    performAction();

  }, [joinStatus, user, meetingId]);

  // Effect 3: Listeners for participants and join requests
  useEffect(() => {
    if (!meetingId) return;
    
    // Listener for all participants
    const participantsQuery = query(collection(db, "meetings", meetingId, "participants"));
    const unsubParticipants = onSnapshot(participantsQuery, (snapshot) => {
      setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant)));
    });

    // Listener for join requests (only if host)
    let unsubRequests = () => {};
    if (user?.uid === hostId) {
        const requestsQuery = query(collection(db, "meetings", meetingId, "joinRequests"), where('status', '==', 'pending'));
        unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
            const newRequests: JoinRequest[] = [];
            snapshot.forEach(doc => {
              newRequests.push({ id: doc.id, userId: doc.id, ...doc.data() } as JoinRequest);
            });
            if (newRequests.length > joinRequests.length && newRequests.length > 0) {
                toast({ title: "New Join Request", description: `${newRequests[newRequests.length - 1].name} wants to join.` });
            }
            setJoinRequests(newRequests);
        });
    }

    // Listener for the status of the current user's join request
    let unsubOwnRequest = () => {};
    if (user && user.uid !== hostId) {
        const ownRequestRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
        unsubOwnRequest = onSnapshot(ownRequestRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.status === 'accepted') {
                    setJoinStatus('admitted');
                    deleteDoc(ownRequestRef); // Clean up the request
                } else if (data.status === 'rejected') {
                    setJoinStatus('denied');
                }
            } else {
                // If doc is deleted, it might mean admission was denied without an explicit status update
                if(joinStatus === 'requesting') {
                    // Check if now a participant
                    getDoc(doc(db, "meetings", meetingId, "participants", user.uid)).then(pSnap => {
                        if(!pSnap.exists()) setJoinStatus('denied');
                    });
                }
            }
        });
    }

    return () => {
      unsubParticipants();
      unsubRequests();
      unsubOwnRequest();
    };
  }, [user, hostId, meetingId, toast, joinRequests.length, joinStatus]);


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
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button></DropdownMenuTrigger>
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

  const handleAcceptRequest = async (request: JoinRequest) => {
    try {
        await updateDoc(doc(db, "meetings", meetingId, "joinRequests", request.userId), {
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
        // Just deleting is simpler than setting a 'rejected' status that needs cleanup.
        await deleteDoc(doc(db, "meetings", meetingId, "joinRequests", request.userId));
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
        await deleteDoc(doc(db, "meetings", meetingId, "participants", participant.id));
        toast({ title: "Participant Removed", description: `${participant.name} has been removed from the meeting.`});
      } catch (err) {
        console.error("Error removing participant:", err);
        toast({ variant: 'destructive', title: 'Error', description: `Could not remove ${participant.name}.`});
      }
  };

  const handleMicToggle = useCallback((isOn: boolean) => setMicOn(isOn), []);
  const handleCamToggle = useCallback((isOn: boolean) => setCamOn(isOn), []);
  
  const handleUserJoined = useCallback(() => {
    setIsParticipantJoining(true);
    setTimeout(() => {
        setIsParticipantJoining(false);
    }, 2000); // Animation duration
  }, []);
  
  const handleDrag = (e: React.MouseEvent) => {
    if (isDragging) {
      setDragPosition({
        x: dragPosition.x + e.movementX,
        y: dragPosition.y + e.movementY,
      });
    }
  };
  
  const backToHomepage = () => {
    router.push('/');
  };
  
  const isCurrentUserTheHost = user?.uid === hostId;

  // Loading state
  if (isLoadingMeeting || authLoading) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-background text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4 text-lg">Loading Meeting...</p>
        </div>
    );
  }

  // Waiting Room UI for guests
  if (joinStatus === 'requesting') {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-background text-foreground text-center p-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h1 className="text-2xl font-bold">Asking to join...</h1>
            <p className="text-muted-foreground mt-2">You'll be let in once the host accepts your request.</p>
        </div>
    );
  }
  
  // Denied Access UI for guests
  if (joinStatus === 'denied') {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-background text-foreground text-center p-4">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground mt-2">Your request to join this meeting was denied by the host.</p>
             <Button onClick={() => router.push('/dashboard')} className="mt-6">Back to Dashboard</Button>
        </div>
    );
  }

  // Meeting UI for admitted users
  return (
    <div className="w-full h-full flex flex-col bg-black text-white overflow-hidden">
       <div className="flex-1 relative flex items-center justify-center p-2 overflow-hidden" onMouseMove={handleDrag} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
        {participants.length <= 1 && user ? (
          // Single participant (self) full screen
          <div className="w-full h-full rounded-lg overflow-hidden">
            <MeetingClient 
              ref={meetingClientRef}
              meetingId={meetingId} 
              userId={user.uid}
              onMicToggle={handleMicToggle} 
              onCamToggle={handleCamToggle}
              onUserJoined={handleUserJoined}
            />
          </div>
        ) : (
          <div className="w-full h-full relative">
            <div className="absolute inset-0 bg-muted/20 flex items-center justify-center rounded-lg">
              <Avatar className="w-48 h-48 border-4 border-background shadow-lg">
                <AvatarFallback className="text-6xl">{participants.length > 0 ? participants[0].name.charAt(0).toUpperCase() : '?'}</AvatarFallback>
              </Avatar>
            </div>
            
            {/* Floating self-view */}
            <div
              className="absolute w-40 h-28 cursor-move rounded-lg overflow-hidden shadow-lg border border-gray-700 bg-black"
              style={{ left: dragPosition.x, top: dragPosition.y, transition: isDragging ? 'none' : 'left 0.2s, top 0.2s' }}
              onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
            >
              <MeetingClient 
                ref={meetingClientRef}
                meetingId={meetingId} 
                userId={user.uid}
                onMicToggle={handleMicToggle} 
                onCamToggle={handleCamToggle}
                onUserJoined={handleUserJoined}
              />
            </div>
          </div>
        )}
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
