
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import MeetingClient, { MeetingClientRef } from "./MeetingClient";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDynamicHeader } from "@/contexts/DynamicHeaderContext";
import Link from 'next/link';


type ControlButtonProps = {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
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
};


const ControlButton = ({ label, onClick, isActive, isDestructive, children, asChild, href, className }: ControlButtonProps) => {
  const content = (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-14 w-14 rounded-full flex flex-col items-center justify-center gap-1 text-xs text-white",
        isActive ? "bg-primary/80" : "bg-white/10 hover:bg-white/20",
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
  
  const rtcRef = useRef<MeetingClientRef>(null);
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isParticipantJoining, setIsParticipantJoining] = useState(false);


  useEffect(() => {
    setHeaderContent(
      <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
        {topic}
      </h1>
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
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/meeting/${meetingId}/participants?topic=${encodeURIComponent(topic)}`)} className="cursor-pointer">
            <Users className="mr-2 h-4 w-4" />
            <span>Participants</span>
          </DropdownMenuItem>
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
  }, [meetingId, topic, router, setHeaderContent, setHeaderAction, toast]);
  

  // Store desired state in localStorage to persist across reloads
  useEffect(() => {
    localStorage.setItem('teachmeet-desired-camera-state', camOn ? 'on' : 'off');
  }, [camOn]);

  useEffect(() => {
    localStorage.setItem('teachmeet-desired-mic-state', micOn ? 'on' : 'off');
  }, [micOn]);

  const handleToggleMic = () => rtcRef.current?.toggleMic();
  const handleToggleCam = () => rtcRef.current?.toggleCam();
  
  const handleLeave = () => {
    toast({ title: "You left the meeting." });
    router.push("/");
  };
  
  const handleUserJoined = useCallback((socketId: string) => {
    toast({ title: 'Participant Joined', description: `A new user has joined the meeting.` });
    setIsParticipantJoining(true);
    setTimeout(() => setIsParticipantJoining(false), 2000); // Animation is 1s, runs twice
  }, [toast]);
  
  if (authLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#222E46]">Loading...</div>;
  }
  
  if (!user) {
    router.push(`/auth/signin?redirect=/dashboard/meeting/${meetingId}`);
    return null;
  }

  const userName = user.displayName || "User";
  const userAvatarSrc = user.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;

  const participantsLink = `/dashboard/meeting/${meetingId}/participants?topic=${encodeURIComponent(topic)}`;

  const showPip = participants.length > 1;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-screen bg-[#222E46] text-white overflow-hidden">
        
        {/* Main Content (Video Tiles) */}
        <main className="flex-1 relative">
           <MeetingClient
            ref={rtcRef}
            meetingId={meetingId}
            userId={user.uid}
            onMicToggle={setMicOn}
            onCamToggle={setCamOn}
            onUserJoined={handleUserJoined}
            onParticipantsChange={setParticipants}
          />
        </main>

        {/* Self-view / local video preview */}
        {showPip && (
          <div className="absolute bottom-28 right-4 z-20 w-48 h-32">
               <div className="w-full h-full bg-black rounded-lg overflow-hidden shadow-lg relative">
                  <div id="local-video-container" className="w-full h-full">
                    {/* MeetingClient will attach video here */}
                  </div>
                   {!camOn && (
                      <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground">
                      <Avatar className="w-16 h-16 border-2 border-background shadow-lg">
                          <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar" />
                          <AvatarFallback className="text-2xl">{userName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      </div>
                  )}
                  <div className="absolute bottom-1 right-1 flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {micOn ? <Mic className="h-3 w-3 text-green-400" /> : <MicOff className="h-3 w-3 text-red-400" />}
                      <span className="text-xs">{userName} (You)</span>
                  </div>
              </div>
          </div>
        )}

        {/* Controls */}
        <footer className="absolute bottom-0 left-0 right-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 p-3 bg-black/30 backdrop-blur-md rounded-full shadow-2xl border border-white/10">
            <ControlButton label={micOn ? "Mute" : "Unmute"} onClick={handleToggleMic} isActive={micOn}>
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </ControlButton>
            <ControlButton label={camOn ? "Stop Camera" : "Start Camera"} onClick={handleToggleCam} isActive={camOn}>
              {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </ControlButton>

            <div className="h-8 w-px bg-white/20 mx-2" />
            
            <ControlButton label="Participants" asChild href={participantsLink} className={cn(isParticipantJoining && "animate-blink-success")}>
                <div>
                  <Users className="h-6 w-6" />
                </div>
            </ControlButton>
             <ControlButton label="Raise Hand">
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
