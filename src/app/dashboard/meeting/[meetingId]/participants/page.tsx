
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Mic,
  MicOff,
  MoreVertical,
  ShieldCheck,
  User,
  Video,
  VideoOff,
  Users as UsersIcon,
  MessageSquare,
  Pin,
  AlertCircle,
  Maximize,
  UserX,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { use, useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, DocumentData } from 'firebase/firestore';

interface Participant {
  id: string; // This will be the userId
  name: string;
  photoURL?: string;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  // isHost property will be determined by comparing id with meetingCreatorId
}

const ParticipantItem = ({ 
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
};

export default function MeetingParticipantsPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const resolvedParams = use(paramsPromise);
  const { meetingId } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || `Meeting Participants`;
  const { toast } = useToast();

  const [realtimeParticipants, setRealtimeParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [meetingCreatorId, setMeetingCreatorId] = useState<string | null>(null);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!meetingId || !db) return;
    setIsLoading(true);

    const meetingDocRef = doc(db, "meetings", meetingId);
    getDoc(meetingDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setMeetingCreatorId(docSnap.data().creatorId);
      } else {
        toast({ variant: "destructive", title: "Meeting Not Found", description: "Could not load meeting details." });
        console.error("Meeting document not found for ID:", meetingId);
      }
    }).catch(error => {
      toast({ variant: "destructive", title: "Error Fetching Meeting", description: "Could not load meeting details." });
      console.error("Error fetching meeting document:", error);
    });

    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const q = query(participantsColRef);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as DocumentData;
        fetchedParticipants.push({
          id: docSnap.id, // userId
          name: data.displayName || data.name || "Guest", // Prefer displayName from Auth, then name
          photoURL: data.photoURL,
          isMicMuted: data.isMicMuted,
          isCameraOff: data.isCameraOff,
        });
      });
      setRealtimeParticipants(fetchedParticipants);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching participants from Firestore:", error);
      toast({ 
        variant: "destructive", 
        title: "Participant List Error", 
        description: "Could not load participant list. Error: " + error.message,
        duration: 7000,
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [meetingId, db, toast]);

  const backToMeetingLink = topic && topic !== "Meeting Participants" 
    ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`
    : `/dashboard/meeting/${meetingId}`;
  
  const isCurrentUserTheHost = currentUserId === meetingCreatorId;

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
            <CardTitle className="text-lg">Participants ({realtimeParticipants.length})</CardTitle>
            <CardDescription>Manage participants and their settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full p-2 md:p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                  <p className="text-lg">Loading participants...</p>
                </div>
              ) : realtimeParticipants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ShieldCheck className="w-16 h-16 mb-4 text-primary" />
                   {isCurrentUserTheHost ? (
                    <>
                      <p className="text-lg">You are the host.</p>
                      <p className="text-sm">Meeting ID: {meetingId}</p>
                      <p className="text-sm mt-2">Waiting for others to join...</p>
                    </>
                   ) : (
                    <>
                      <p className="text-lg">No participants yet.</p>
                      <p className="text-sm mt-2">You might be the first one here, or waiting for others to join.</p>
                    </>
                   )}
                </div>
              ) : (
                <div className="space-y-1">
                  {realtimeParticipants.map((participant) => (
                    <ParticipantItem 
                      key={participant.id} 
                      participant={participant} 
                      isCurrentUserHost={isCurrentUserTheHost}
                      isThisParticipantTheHost={participant.id === meetingCreatorId}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Participants List - Real-time updates from Firestore.
      </footer>
    </div>
  );
}
