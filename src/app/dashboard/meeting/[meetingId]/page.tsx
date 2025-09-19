
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import MeetingClient from "./MeetingClient";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  Users,
  MessageSquare,
  MoreVertical,
  Settings,
  Brush,
  PhoneOff,
  ShieldCheck,
  Pin,
  UserX,
  AlertCircle,
  Maximize,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDynamicHeader } from "@/contexts/DynamicHeaderContext";
import Link from 'next/link';
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import CameraToggle from "@/components/CameraToggle";


type ControlButtonProps = {
  label: string;
  onClick?: () => void;
  isDestructive?: boolean;
  children: React.ReactNode;
  asChild?: boolean;
  href?: string;
  className?: string; // Allow className to be passed
};

type Participant = {
  id: string;
  name: string;
  avatar?: string;
  isCamOff: boolean;
  isMicOff: boolean;
  isHandRaised?: boolean;
};

const ParticipantItem = React.memo(({
  participant
}: { 
  participant: Participant, 
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMe = user?.uid === participant.id || participant.id === 'local';

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
          <AvatarImage src={participant.avatar} alt={participant.name} data-ai-hint="avatar user"/>
          <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            {participant.name} {isMe && "(You)"}
            {participant.isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
          {participant.isMicOff ? <MicOff className="h-4 w-4 text-muted-foreground" /> : <Mic className="h-4 w-4 text-foreground" />}
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
          {participant.isCamOff ? <VideoOff className="h-4 w-4 text-muted-foreground" /> : <Video className="h-4 w-4 text-foreground" />}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={() => handleActionClick('Remove', participant.name)} 
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <UserX className="mr-2 h-4 w-4" />
                <span>Remove Participant</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});
ParticipantItem.displayName = 'ParticipantItem';


const ControlButton = ({ label, onClick, isDestructive, children, asChild, href, className }: ControlButtonProps) => {
  const content = (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-14 w-14 rounded-full flex flex-col items-center justify-center gap-1 text-xs text-white",
        "bg-white/10 hover:bg-white/20",
        isDestructive && "bg-destructive/90 hover:bg-destructive",
        className // Apply additional classNames
      )}
      asChild={asChild}
    >
      <div>
        {children}
        <span className="sr-only">{label}</span>
      </div>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {asChild && href ? <Link href={href}>{content}</Link> : content}
      </TooltipTrigger>
      <TooltipContent side="top" className="rounded-lg bg-card text-card-foreground">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};


export default function MeetingPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "Untitled Meeting";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isParticipantJoining, setIsParticipantJoining] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showMeetingId, setShowMeetingId] = useState(false);


  useEffect(() => {
    async function checkHostStatus() {
        if (!user || !meetingId) return;
        try {
            const meetingDocRef = doc(db, 'meetings', meetingId);
            const meetingSnap = await getDoc(meetingDocRef);
            if (meetingSnap.exists() && meetingSnap.data().creatorId === user.uid) {
                setIsHost(true);
            } else {
                setIsHost(false);
            }
        } catch (error) {
            console.error("Failed to check host status:", error);
            setIsHost(false);
        }
    }
    checkHostStatus();
  }, [user, meetingId]);

  // Correctly initialize media stream once
  useEffect(() => {
    let stream: MediaStream;
    let cancelled = false;

    const initMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const initialMic = localStorage.getItem('teachmeet-mic-default') !== 'off';
        const initialCam = localStorage.getItem('teachmeet-camera-default') !== 'off';

        stream.getAudioTracks().forEach(track => track.enabled = initialMic);
        stream.getVideoTracks().forEach(track => track.enabled = initialCam);
        
        if (!cancelled) {
          setLocalStream(stream);
          setMicOn(initialMic);
          setCamOn(initialCam);
        }
        
      } catch (err) {
        console.error("Error accessing media devices:", err);
        if (!cancelled) {
          toast({ variant: 'destructive', title: 'Media Error', description: 'Could not access camera or microphone.'});
        }
      }
    };

    if (user) {
        initMedia();
    }
    
    return () => {
        cancelled = true;
        localStream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Subscribe to own participant state for hand-raise status
  useEffect(() => {
    if (!user || !meetingId) return;
    const participantRef = doc(db, 'meetings', meetingId, 'participants', user.uid);
    
    // Set initial participant data
    setDoc(participantRef, { 
      name: user.displayName || `User ${user.uid.substring(0, 4)}`,
      photoURL: user.photoURL,
      isHandRaised: false, // Start with hand down
      joinedAt: serverTimestamp()
    }, { merge: true });

    const unsubscribe = onSnapshot(participantRef, (doc) => {
        if (doc.exists()) {
            setIsHandRaised(!!doc.data().isHandRaised);
        }
    });

    return () => unsubscribe();
  }, [user, meetingId]);


  useEffect(() => {
    setHeaderContent(
      <div className="cursor-pointer" onClick={() => setShowMeetingId(prev => !prev)}>
        <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
          {showMeetingId ? meetingId : topic}
        </h1>
        <p className="text-xs text-muted-foreground">
            {showMeetingId ? 'Click to show topic' : 'Click to show Meeting ID'}
        </p>
      </div>
    );
    setHeaderAction(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/meeting/${meetingId}/whiteboard?topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
            <Brush className="mr-2 h-4 w-4" />
            <span>Whiteboard</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast({ title: 'Screen Share is under development.' })} className="cursor-pointer">
            <MonitorUp className="mr-2 h-4 w-4" />
            <span>Screen Share</span>
          </DropdownMenuItem>
          {isHost && (
            <DropdownMenuItem onSelect={() => router.push(`/dashboard/meeting/${meetingId}/participants?topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
              <Users className="mr-2 h-4 w-4" />
              <span>Manage Participants</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/meeting/${meetingId}/chat?topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chat</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/settings`)} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return () => {
      setHeaderContent(null);
      setHeaderAction(null);
    };
  }, [meetingId, topic, router, setHeaderContent, setHeaderAction, toast, isHost, showMeetingId]);
  
  const handleToggleMic = useCallback(() => {
    if (!localStream) return;
    const nextState = !micOn;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = nextState;
    });
    setMicOn(nextState);
    localStorage.setItem('teachmeet-mic-default', nextState ? 'on' : 'off');
  }, [localStream, micOn]);
  
  const handleToggleCam = useCallback(() => {
    if (!localStream) return;
    const nextState = !camOn;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextState;
    });
    setCamOn(nextState);
    localStorage.setItem('teachmeet-camera-default', nextState ? 'on' : 'off');
}, [localStream, camOn]);
  
  const handleToggleHandRaise = async () => {
    if (!user) return;
    const newHandRaiseState = !isHandRaised;
    const participantRef = doc(db, 'meetings', meetingId, 'participants', user.uid);
    try {
        await updateDoc(participantRef, { isHandRaised: newHandRaiseState });
        // The local state `isHandRaised` is now managed by the onSnapshot listener.
        if (newHandRaiseState) {
            toast({
                title: "Hand Raised",
                description: "Your hand is now raised. Other participants can see this.",
            });
        }
    } catch (error) {
        console.error("Failed to update hand-raise status:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not update your hand-raise status." });
    }
  };

  const handleLeave = useCallback(() => {
    toast({ title: "You left the meeting." });
    router.push("/");
  }, [router, toast]);
  
  const handleUserJoined = useCallback((socketId: string) => {
    toast({ title: 'Participant Joined', description: `A new user has joined the meeting.` });
    setIsParticipantJoining(true);
    setTimeout(() => setIsParticipantJoining(false), 2000); // Animation is 1s, runs twice
  }, [toast]);
  
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#222E46] text-white">
        <Loader2 className="h-8 w-8 animate-spin mr-3"/>
        Initializing...
      </div>
    );
  }
  
  if (!user) {
    router.push(`/auth/signin?redirect=/dashboard/meeting/${meetingId}`);
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-screen bg-[#222E46] text-white overflow-hidden">
        
        {/* Main Content (Video Tiles) */}
        <main className="flex-1 relative flex items-center justify-center">
           {localStream ? (
              <MeetingClient
                meetingId={meetingId}
                userId={user.uid}
                onUserJoined={handleUserJoined}
                onParticipantsChange={setParticipants}
                localStream={localStream}
                micOn={micOn}
                camOn={camOn}
              />
            ) : (
               <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                Initializing Camera...
              </div>
            )}
        </main>

        {/* Controls */}
        <footer className="absolute bottom-0 left-0 right-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 p-3 bg-black/30 backdrop-blur-md rounded-full shadow-2xl border border-white/10">
            <ControlButton label={micOn ? "Mute" : "Unmute"} onClick={handleToggleMic} className={cn(!micOn && "bg-destructive hover:bg-destructive/90")}>
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </ControlButton>

            <ControlButton label={camOn ? "Stop Camera" : "Start Camera"} onClick={handleToggleCam} className={cn(!camOn && "bg-destructive hover:bg-destructive/90")}>
                {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </ControlButton>


            <div className="h-8 w-px bg-white/20 mx-2" />
            
            <Sheet open={isParticipantsPanelOpen} onOpenChange={setIsParticipantsPanelOpen}>
              <SheetTrigger asChild>
                <ControlButton label="Participants" className={cn(isParticipantJoining && "animate-blink-success")}>
                    <div>
                      <Users className="h-6 w-6" />
                    </div>
                </ControlButton>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-3/4 rounded-t-2xl bg-background text-foreground">
                <SheetHeader>
                  <SheetTitle>Participants ({participants.length})</SheetTitle>
                  <SheetDescription>
                    List of everyone in the meeting.
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-80px)] mt-4">
                  <div className="space-y-1 p-4">
                    {participants.map((p) => (
                      <ParticipantItem key={p.id} participant={p} />
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

             <ControlButton label={isHandRaised ? "Lower Hand" : "Raise Hand"} onClick={handleToggleHandRaise} className={cn(isHandRaised && "bg-primary hover:bg-primary/90")}>
              <Hand className="h-6 w-6" />
            </ControlButton>

            <div className="h-8 w-px bg-white/20 mx-2" />
            
            <ControlButton label="Leave Meeting" isDestructive onClick={handleLeave}>
              <PhoneOff className="h-6 w-6" />
            </ControlButton>
          </div>
        </footer>
        
         <div className="absolute bottom-4 right-4 z-10">
            <Logo size="small" text="vs" className="!text-xl" />
        </div>
      </div>
    </TooltipProvider>
  );
}
