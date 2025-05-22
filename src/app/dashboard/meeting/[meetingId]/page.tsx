
'use client';
import { useState, useEffect, use } from 'react'; // Added 'use'
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Upload, MessageSquare, Settings, Users, MoreVertical, Hand, Maximize, Columns, Edit3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";

const ParticipantView = ({ name, isMe = false, isMicMuted = false, isCameraOff = false }: { name: string, isMe?: boolean, isMicMuted?: boolean, isCameraOff?: boolean }) => {
  return (
    <Card className="aspect-video rounded-lg overflow-hidden relative shadow-lg border-2 border-transparent group hover:border-primary transition-all">
      {isCameraOff ? (
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center">
          <Avatar className="w-16 h-16 mb-2">
            <AvatarImage src={`https://placehold.co/64x64.png?text=${name.charAt(0)}`} alt={name} data-ai-hint="avatar user" />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <VideoOff className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
      ) : (
        <Image src={`https://placehold.co/400x225.png`} alt={`${name}'s video`} layout="fill" objectFit="cover" data-ai-hint="participant video" />
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
        {name} {isMe && "(You)"}
      </div>
      <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full backdrop-blur-sm">
        {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </div>
    </Card>
  );
};

export default function MeetingPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(paramsPromise); // Use React.use to resolve the promise

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  
  // Placeholder participants
  const participants = [
    { id: "1", name: "Alice", isMicMuted: false, isCameraOff: false },
    { id: "2", name: "Bob", isMicMuted: true, isCameraOff: false },
    { id: "3", name: "You", isMe: true, isMicMuted, isCameraOff },
    { id: "4", name: "Charlie", isMicMuted: false, isCameraOff: true },
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
          <span className="text-sm text-muted-foreground">4 Participants</span>
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

      {/* Main meeting content - Participant grid */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {participants.map(p => (
            <ParticipantView key={p.id} name={p.name} isMe={p.isMe} isMicMuted={p.isMicMuted} isCameraOff={p.isCameraOff} />
          ))}
        </div>
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
