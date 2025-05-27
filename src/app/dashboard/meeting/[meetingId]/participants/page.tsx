
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowLeft, Mic, MicOff, MoreVertical, ShieldCheck, User, Video, VideoOff, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { use } from "react";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isMe?: boolean;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  isHost?: boolean;
}

// Mock participants - in a real app, this would come from a backend or WebRTC state
const mockMeetingParticipants: Participant[] = [
  { id: 'user1', name: 'You', avatar: 'https://placehold.co/40x40/00FFFF/000000.png?text=Y', isMe: true, isMicMuted: false, isCameraOff: false, isHost: true },
  { id: 'user2', name: 'Alice Wonderland', avatar: 'https://placehold.co/40x40/FFC0CB/000000.png?text=A', isMicMuted: true, isCameraOff: false },
  { id: 'user3', name: 'Bob The Builder', avatar: 'https://placehold.co/40x40/ADD8E6/000000.png?text=B', isMicMuted: false, isCameraOff: true },
  { id: 'user4', name: 'Charlie Brown', avatar: 'https://placehold.co/40x40/FFFF00/000000.png?text=C', isMicMuted: true, isCameraOff: true },
];


const ParticipantItem = ({ participant }: { participant: Participant }) => {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={participant.avatar || `https://placehold.co/40x40.png?text=${participant.name.charAt(0)}`} alt={participant.name} data-ai-hint="avatar user"/>
          <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">
            {participant.name} {participant.isMe && "(You)"}
            {participant.isHost && <ShieldCheck className="inline-block ml-1.5 h-4 w-4 text-primary" title="Host" />}
          </p>
          <p className="text-xs text-muted-foreground">
            {participant.isMicMuted ? "Muted" : "Unmuted"} | {participant.isCameraOff ? "Camera Off" : "Camera On"}
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
        {!participant.isMe && (
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default function MeetingParticipantsPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const resolvedParams = use(paramsPromise);
  const { meetingId } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Participants";

  const backToMeetingLink = topic 
    ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`
    : `/dashboard/meeting/${meetingId}`;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
              {topic}
            </h1>
            <span className="text-sm text-muted-foreground"> (Meeting ID: {meetingId})</span>
          </div>
          <Link href={backToMeetingLink} passHref legacyBehavior>
            <Button variant="outline" className="rounded-lg">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Meeting
            </Button>
          </Link>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col overflow-hidden pt-[65px]"> {/* Adjust pt if header height changes */}
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Participants ({mockMeetingParticipants.length})</CardTitle>
            <CardDescription>Manage participants and their settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full p-2 md:p-4">
              {mockMeetingParticipants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <User className="w-16 h-16 mb-4" />
                  <p className="text-lg">No participants yet.</p>
                  <p>You're the first one here!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {mockMeetingParticipants.map((participant) => (
                    <ParticipantItem key={participant.id} participant={participant} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Participants List - Real-time updates require backend integration.
      </footer>
    </div>
  );
}
