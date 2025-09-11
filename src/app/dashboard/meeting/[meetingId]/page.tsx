
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
        size="lg"
        onClick={onClick}
        className={cn(
          "h-16 w-16 rounded-full flex flex-col items-center justify-center gap-1 text-xs",
          isActive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
          isDestructive && "bg-destructive/80 text-destructive-foreground hover:bg-destructive"
        )}
      >
        {children}
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top" className="rounded-lg">
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
  
  const handleUserJoined = (socketId: string) => {
    toast({ title: 'Participant Joined', description: `A new user has joined the meeting.` });
  };
  
  if (authLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background">Loading...</div>;
  }
  
  if (!user) {
    router.push(`/auth/signin?redirect=/dashboard/meeting/${meetingId}`);
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
          <Logo size="small" />
          <div className="text-center">
            <h1 className="font-semibold truncate">{topic}</h1>
            <p className="text-xs text-muted-foreground">{meetingId}</p>
          </div>
          <div className="w-24"></div>
        </header>

        {/* Main Content (Video Tiles) */}
        <main className="flex-1 bg-black">
          <MeetingClient
            ref={rtcRef}
            meetingId={meetingId}
            userId={user.uid}
            onMicToggle={setMicOn}
            onCamToggle={setCamOn}
            onUserJoined={handleUserJoined}
          />
        </main>

        {/* Controls */}
        <footer className="absolute bottom-0 left-0 right-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 p-3 bg-card/80 backdrop-blur-md rounded-full shadow-2xl border border-border/50">
            <ControlButton label={micOn ? "Mute" : "Unmute"} onClick={handleToggleMic} isActive={micOn}>
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </ControlButton>
            <ControlButton label={camOn ? "Stop Camera" : "Start Camera"} onClick={handleToggleCam} isActive={camOn}>
              {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </ControlButton>

            <div className="h-8 w-px bg-border mx-2" />

            <ControlButton label="Share Screen">
              <MonitorUp className="h-6 w-6" />
            </ControlButton>
            <ControlButton label="Raise Hand">
              <Hand className="h-6 w-6" />
            </ControlButton>
             <Link href={`/dashboard/meeting/${meetingId}/whiteboard?topic=${encodeURIComponent(topic)}`}>
              <ControlButton label="Whiteboard">
                <Brush className="h-6 w-6" />
              </ControlButton>
            </Link>
            <ControlButton label="Participants" onClick={() => setIsParticipantsOpen(true)}>
              <Users className="h-6 w-6" />
            </ControlButton>
             <Link href={`/dashboard/meeting/${meetingId}/chat?topic=${encodeURIComponent(topic)}`}>
                <ControlButton label="Chat">
                    <MessageSquare className="h-6 w-6" />
                </ControlButton>
             </Link>

            <div className="h-8 w-px bg-border mx-2" />
            
            <ControlButton label="Leave Meeting" isDestructive onClick={handleLeave}>
              <PhoneOff className="h-6 w-6" />
            </ControlButton>
          </div>
        </footer>

        {/* Participants Sheet */}
        <Sheet open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Participants</SheetTitle>
              <SheetDescription>
                List of everyone currently in the meeting.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              {/* Participants list will go here */}
              <p className="text-muted-foreground">Participants list is under development.</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
