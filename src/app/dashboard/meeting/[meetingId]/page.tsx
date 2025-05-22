
'use client';
import { useState, useEffect, use } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Upload, MessageSquare, Settings, Users, MoreVertical, Hand, Maximize, Columns, Edit3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";

const ParticipantView = ({ name, isMe = false, isMicMuted = false, isCameraOff = false }: { name: string, isMe?: boolean, isMicMuted?: boolean, isCameraOff?: boolean }) => {
  return (
    <Card className="aspect-video rounded-xl overflow-hidden relative shadow-lg border-2 border-border/30 hover:border-primary hover:shadow-primary/20 transition-all duration-300 ease-in-out group w-full h-full">
      {isCameraOff ? (
        <div className="w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
          <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
            <AvatarImage src={`https://placehold.co/128x128.png?text=${name.charAt(0).toUpperCase()}`} alt={name} data-ai-hint="avatar user" />
            <AvatarFallback className="text-3xl md:text-4xl">{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <VideoOff className="w-7 h-7 text-muted-foreground mb-1" />
          <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
        </div>
      ) : (
        <Image src={`https://placehold.co/800x450.png`} alt={`${name}'s video`} layout="fill" objectFit="cover" data-ai-hint="participant video" />
      )}
      <div className="absolute bottom-2 left-2 bg-gradient-to-r from-black/70 to-transparent px-3 py-1.5 rounded-md backdrop-blur-sm">
        <p className="text-sm font-medium text-white shadow-sm">{name} {isMe && <span className="text-xs opacity-80">(You)</span>}</p>
      </div>
      <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm shadow-md">
        {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </div>
    </Card>
  );
};

export default function MeetingPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(paramsPromise);

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Mock participants - "You" and a couple of others to test grid and single view
  // To test single view, comment out User A and User B
  const participants = [
    { id: "currentUser", name: "You", isMe: true, isMicMuted, isCameraOff },
    // { id: "guestUserA", name: "User A", isMicMuted: false, isCameraOff: true },
    // { id: "guestUserB", name: "User B", isMicMuted: true, isCameraOff: false },
  ];

  const toggleMic = () => setIsMicMuted(prev => !prev);
  const toggleCamera = () => setIsCameraOff(prev => !prev);
  const toggleHandRaise = () => setIsHandRaised(prev => !prev);
  const leaveMeeting = () => {
    alert("Leaving meeting (mock action)");
    // router.push('/dashboard');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top Bar for Meeting Info & Actions */}
      <header className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Meeting: {meetingId}</h2>
          <span className="text-sm text-muted-foreground">{participants.length} Participant{participants.length === 1 ? '' : 's'}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg">
            <DropdownMenuItem><Upload className="mr-2 h-4 w-4" /> Share Screen</DropdownMenuItem>
            <DropdownMenuItem><Edit3 className="mr-2 h-4 w-4" /> Open Whiteboard</DropdownMenuItem>
            <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4" /> Chat</DropdownMenuItem>
            <DropdownMenuItem><Users className="mr-2 h-4 w-4" /> Participants</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Maximize className="mr-2 h-4 w-4" /> Full Screen</DropdownMenuItem>
            <DropdownMenuItem><Columns className="mr-2 h-4 w-4" /> Change Layout</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main meeting content - Participant grid or single view */}
      <main className="flex-1 p-4 overflow-y-auto flex flex-col">
        {participants.length === 1 && participants[0].isMe ? (
          // Single participant view (You)
          <div className="flex-grow flex items-center justify-center">
            <div className="w-full h-full max-w-5xl max-h-[calc(100vh-15rem)] relative"> {/* Adjust max-h to account for header/footer */}
              <ParticipantView
                name={participants[0].name}
                isMe={participants[0].isMe}
                isMicMuted={participants[0].isMicMuted}
                isCameraOff={participants[0].isCameraOff}
              />
            </div>
          </div>
        ) : (
          // Grid view for multiple participants
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {participants.map(p => (
              <ParticipantView key={p.id} name={p.name} isMe={p.isMe} isMicMuted={p.isMicMuted} isCameraOff={p.isCameraOff} />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Controls Bar */}
      <footer className="p-4 border-t border-border bg-background/80 backdrop-blur-md sticky bottom-0">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <Button variant={isMicMuted ? "destructive" : "secondary"} size="lg" className="rounded-full p-4 btn-gel" onClick={toggleMic} aria-label={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}>
            {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button variant={isCameraOff ? "destructive" : "secondary"} size="lg" className="rounded-full p-4 btn-gel" onClick={toggleCamera} aria-label={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}>
            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
          <Button variant={isHandRaised ? "primary" : "secondary"} size="lg" className="rounded-full p-4 btn-gel" onClick={toggleHandRaise} aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}>
            <Hand className="h-6 w-6" />
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full p-4 btn-gel" onClick={leaveMeeting} aria-label="Leave Meeting">
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
