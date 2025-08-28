
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
} from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import MeetingClient from './MeetingClient';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, DocumentData } from 'firebase/firestore';


// --- Participant List Logic (Moved from participants/page.tsx) ---
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
  isThisParticipantTheHost 
}: { 
  participant: Participant, 
  isCurrentUserHost: boolean,
  isThisParticipantTheHost: boolean
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
              <DropdownMenuItem onSelect={() => handleActionClick('Pin', participant.name)} className="cursor-pointer">
                <Pin className="mr-2 h-4 w-4" />
                <span>Pin User</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleActionClick('Full Screen for', participant.name)} className="cursor-pointer">
                <Maximize className="mr-2 h-4 w-4" />
                <span>Full Screen</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isCurrentUserHost && !isThisParticipantTheHost && ( 
                <DropdownMenuItem 
                  onSelect={() => handleActionClick('Remove', participant.name)} 
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  <span>Remove Participant</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => handleActionClick('Report', participant.name)} className="text-destructive focus:text-destructive cursor-pointer">
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>Report User</span>
              </DropdownMenuItem>
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
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const { user, loading } = useAuth();
  const router = useRouter();

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isParticipantJoining, setIsParticipantJoining] = useState(false);

  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  
  // --- State for Participants Sheet ---
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [meetingCreatorId, setMeetingCreatorId] = useState<string | null>(null);
  const currentUserId = auth.currentUser?.uid;
  const { toast } = useToast();
  // ---

  useEffect(() => {
    // This effect now does nothing, defaulting states to 'off' (false).
  }, []);
  
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
                <DropdownMenuItem onSelect={() => { /* Implement screen share logic */ }} className="cursor-pointer">
                    <MonitorUp className="mr-2 h-4 w-4"/>
                    <span>Share Screen</span>
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
                <DropdownMenuItem onSelect={() => router.push(`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4"/>
                    <span>Meeting Settings</span>
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


  // --- Effect to fetch participants for the sheet ---
  useEffect(() => {
    if (!meetingId) return;

    setIsLoadingParticipants(true);
    const meetingDocRef = doc(db, "meetings", meetingId);
    
    // Fetch one-time meeting details
    getDoc(meetingDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setMeetingCreatorId(docSnap.data().creatorId);
      }
    }).catch(error => {
      console.error("[MeetingPage] Error fetching meeting document:", error);
    });

    // Listen for realtime participant changes
    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const q = query(participantsColRef);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as DocumentData;
        fetchedParticipants.push({
          id: docSnap.id, 
          name: data.name || "Guest", 
          photoURL: data.photoURL,
          isMicMuted: data.isMicMuted,
          isCameraOff: data.isCameraOff,
        });
      });
      setParticipants(fetchedParticipants);
      setIsLoadingParticipants(false);
    }, (error) => {
      console.error("[MeetingPage] Error fetching participants:", error);
      setIsLoadingParticipants(false);
    });

    return () => unsubscribe();
  }, [meetingId, toast]);
  // ---


  const handleMicToggle = useCallback((isOn: boolean) => setMicOn(isOn), []);
  const handleCamToggle = useCallback((isOn: boolean) => setCamOn(isOn), []);
  
  const triggerControl = (controlId: string) => {
    const button = document.getElementById(controlId) as HTMLButtonElement | null;
    if (button) button.click();
    else console.warn(`Control button with id "${controlId}" not found.`);
  };

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
  
  const backToHomepage = () => router.push('/');
  const isCurrentUserTheHost = currentUserId === meetingCreatorId;

  return (
    <div className="w-full h-full flex flex-col bg-[#1e2a38] text-white overflow-hidden">
      <div className="flex-grow relative">
        <MeetingClient 
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
            onClick={() => triggerControl('meeting-client-mic-toggle')}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>
          <Button
            variant={camOn ? 'default' : 'destructive'}
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={() => triggerControl('meeting-client-cam-toggle')}
            aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          <div className="w-px h-8 bg-white/20 mx-1 md:mx-3" />

          {/* Participants Sheet Trigger */}
          <Sheet open={isParticipantsPanelOpen} onOpenChange={setIsParticipantsPanelOpen}>
            <SheetTrigger asChild>
               <Button
                variant={isParticipantsPanelOpen ? 'default' : 'destructive'}
                size="icon"
                className={cn(
                  "rounded-full w-12 h-12 md:w-14 md:h-14",
                  isParticipantJoining && 'animate-blink-success'
                )}
                aria-label="Participants"
              >
                <Users className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="text-foreground bg-background rounded-t-xl h-[70vh] flex flex-col">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Participants ({participants.length})</SheetTitle>
                <SheetDescription>Manage participants and their settings.</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-grow">
                <div className="p-4 space-y-1">
                   {isLoadingParticipants ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                    </div>
                  ) : participants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Users className="w-16 h-16 mb-4" />
                    </div>
                  ) : (
                    participants.map((participant) => (
                      <ParticipantItem 
                        key={participant.id} 
                        participant={participant} 
                        isCurrentUserHost={isCurrentUserTheHost}
                        isThisParticipantTheHost={participant.id === meetingCreatorId}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
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
