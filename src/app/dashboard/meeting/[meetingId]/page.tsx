
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
  XCircle,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Logo } from "@/components/common/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ControlButtonProps = {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  children: React.ReactNode;
};

const ControlButton = ({ label, onClick, isActive, isDestructive, children }: ControlButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(
          "h-14 w-14 rounded-full flex flex-col items-center justify-center gap-1 text-xs text-white",
          isActive ? "bg-primary/80" : "bg-white/10 hover:bg-white/20",
          isDestructive && "bg-destructive/90 hover:bg-destructive"
        )}
      >
        {children}
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top" className="rounded-lg bg-card text-card-foreground">
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

export default function MeetingPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "Untitled Meeting";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const rtcRef = useRef<MeetingClientRef>(null);
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);

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
          />
        </main>

        {/* Self-view / local video preview */}
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
            
            <ControlButton label="Participants" onClick={() => setIsParticipantsOpen(true)}>
              <Users className="h-6 w-6" />
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

        {/* Participants Sheet */}
        <Sheet open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
          <SheetContent className="bg-[#101726] text-white border-l border-[#1f2a40]">
            <SheetHeader>
              <SheetTitle>Participants</SheetTitle>
              <SheetDescription className="text-gray-400">
                List of everyone currently in the meeting.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              {/* Participants list will go here */}
              <p className="text-gray-400">Participants list is under development.</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
