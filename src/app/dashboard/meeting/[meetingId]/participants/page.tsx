
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
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
  CameraOff,
  Hand,
  UserCheck,
  UserCog
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, DocumentData, writeBatch, updateDoc } from 'firebase/firestore';
import { useBlock } from "@/contexts/BlockContext";
import { BlockUserDialog } from "@/components/meeting/BlockUserDialog";

interface Participant {
  id: string; // This will be the userId
  name: string;
  photoURL?: string;
  isMicOn?: boolean;
  isCameraOn?: boolean;
  isHandRaised?: boolean;
  role: 'host' | 'participant';
}

const ParticipantItem = React.memo(({
  participant, 
  isCurrentUserHost, 
  isThisParticipantTheHost,
  onRemoveClick,
  onToggleCamera,
  onLowerHand,
  onBlockClick,
  meetingId,
  topic,
  pinnedUserId
}: { 
  participant: Participant, 
  isCurrentUserHost: boolean,
  isThisParticipantTheHost: boolean,
  onRemoveClick: (participant: Participant) => void;
  onToggleCamera: (participant: Participant) => void;
  onLowerHand: (participant: Participant) => void;
  onBlockClick: (participant: Participant) => void;
  meetingId: string;
  topic: string | null;
  pinnedUserId: string | null;
}) => {
  const { toast } = useToast();
  const { unblockUser, getBlockSettings, isBlockedByMe, amIBlockedBy } = useBlock();
  const isMe = auth.currentUser?.uid === participant.id;
  const isPinned = participant.id === pinnedUserId;
  const blockInfo = getBlockSettings(participant.id);
  const isBlocked = !!blockInfo;
  
  const isPrivateChatDisabled = isBlocked || amIBlockedBy(participant.id, 'privateChat');


  const searchParams = useSearchParams();
  const cam = searchParams.get('cam');
  const mic = searchParams.get('mic');

  const privateChatLinkParams = new URLSearchParams();
  if (topic) privateChatLinkParams.set('topic', topic);
  if (cam) privateChatLinkParams.set('cam', cam);
  if (mic) privateChatLinkParams.set('mic', mic);
  privateChatLinkParams.set('privateWith', participant.id);
  privateChatLinkParams.set('privateWithName', participant.name);
  const privateChatLink = `/dashboard/meeting/${meetingId}/chat?${privateChatLinkParams.toString()}`;
  
  const pinUrlParams = new URLSearchParams(searchParams.toString());
  if (isPinned) {
      pinUrlParams.delete('pin');
  } else {
      pinUrlParams.set('pin', participant.id);
  }
  const pinLink = `/dashboard/meeting/${meetingId}?${pinUrlParams.toString()}`;

  const reportUrlParams = new URLSearchParams(searchParams.toString());
  reportUrlParams.set('reportedUser', participant.id);
  const reportLink = `/dashboard/meeting/${meetingId}/report?${reportUrlParams.toString()}`;
  
  const handleUnblock = () => {
    unblockUser(participant.id);
    toast({ title: "User Unblocked", description: `You can now see and interact with ${participant.name} again.` });
  };


  return (
    <>
      <div className={cn("flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors", isBlocked && "bg-destructive/10")}>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={participant.photoURL || `https://placehold.co/40x40.png?text=${participant.name.charAt(0)}`} alt={participant.name} data-ai-hint="avatar user"/>
            <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {participant.name} {isMe && "(You)"}
              {isThisParticipantTheHost && <ShieldCheck className="inline-block h-4 w-4 text-primary" title="Host" />}
              {participant.isHandRaised && <Hand className="inline-block h-4 w-4 text-primary" title="Hand Raised" />}
              {isBlocked && <UserX className="inline-block h-4 w-4 text-destructive" title="Blocked" />}
            </p>
            <p className="text-xs text-muted-foreground">
              {participant.isMicOn ? "Unmuted" : "Muted"} | {participant.isCameraOn ? "Camera On" : "Camera Off"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
            {participant.isMicOn ? <Mic className="h-4 w-4 text-foreground" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
            {participant.isCameraOn ? <Video className="h-4 w-4 text-foreground" /> : <VideoOff className="h-4 w-4 text-muted-foreground" />}
          </Button>
          {!isMe && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg">
                  <>
                    <DropdownMenuItem asChild className="cursor-pointer" disabled={isPrivateChatDisabled}>
                      <Link href={privateChatLink}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>Chat Privately</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href={pinLink}>
                          <Pin className="mr-2 h-4 w-4" />
                          <span>{isPinned ? "Unpin User" : "Pin User"}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>

                  {isBlocked ? (
                    <DropdownMenuItem onSelect={handleUnblock} className="text-primary focus:text-primary cursor-pointer">
                        <UserCheck className="mr-2 h-4 w-4" />
                        <span>Unblock User</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => onBlockClick(participant)} className="text-destructive focus:text-destructive cursor-pointer">
                        <UserX className="mr-2 h-4 w-4" />
                        <span>Block User...</span>
                    </DropdownMenuItem>
                  )}
                  
                {isCurrentUserHost && !isThisParticipantTheHost && (
                  <>
                    <DropdownMenuSeparator />
                    {participant.isHandRaised && (
                      <DropdownMenuItem onSelect={() => onLowerHand(participant)} className="cursor-pointer">
                          <Hand className="mr-2 h-4 w-4" />
                          <span>Lower Hand</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => onToggleCamera(participant)} className="cursor-pointer" disabled={!participant.isCameraOn}>
                      <CameraOff className="mr-2 h-4 w-4" />
                      <span>Turn Off Camera</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onRemoveClick(participant); }} className="text-destructive focus:text-destructive cursor-pointer">
                      <UserX className="mr-2 h-4 w-4" />
                      <span>Remove Participant</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-destructive focus:text-destructive cursor-pointer">
                  <Link href={reportLink}>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    <span>Report User</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </>
  );
});
ParticipantItem.displayName = 'ParticipantItem';


export default function MeetingParticipantsPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicFromParams = searchParams.get('topic');
  const pinnedUserId = searchParams.get('pin');
  const cam = searchParams.get('cam');
  const mic = searchParams.get('mic');
  const displayTopic = topicFromParams || `Meeting Participants`;
  const { toast } = useToast();

  const [realtimeParticipants, setRealtimeParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [meetingHostId, setMeetingHostId] = useState<string | null>(null);
  const [showMeetingId, setShowMeetingId] = useState(false);
  const currentUserId = auth.currentUser?.uid;
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null);
  
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [participantToBlock, setParticipantToBlock] = useState<Participant | null>(null);

  useEffect(() => {
    if (!meetingId || !db) return;
    setIsLoading(true);

    const meetingDocRef = doc(db, "meetings", meetingId);
    
    const fetchMeetingDetails = async () => {
        try {
            const docSnap = await getDoc(meetingDocRef);
            if (docSnap.exists()) {
                const host = docSnap.data().hostId;
                setMeetingHostId(host);
            } else {
                toast({ variant: "destructive", title: "Meeting Not Found", description: "Could not load meeting details." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error Fetching Meeting", description: "Could not load meeting details. Check security rules." });
            console.error("[ParticipantsPage] Error fetching meeting document:", error);
        }
    };
    
    fetchMeetingDetails();
    
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
          isMicOn: data.isMicOn,
          isCameraOn: data.isCameraOn,
          isHandRaised: data.isHandRaised,
          role: data.isHost ? 'host' : 'participant',
        });
      });
      setRealtimeParticipants(fetchedParticipants);
      setIsLoading(false);
    }, (error) => {
      console.error("[ParticipantsPage] Error fetching participants from Firestore:", error);
      toast({ 
        variant: "destructive", 
        title: "Participant List Error", 
        description: "Could not load participant list. Error: " + error.message,
        duration: 7000,
      });
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [meetingId, toast]);

  const handleRemoveConfirm = async () => {
    if (!participantToRemove) return;
    
    const batch = writeBatch(db);
    const participantRef = doc(db, "meetings", meetingId, "participants", participantToRemove.id);
    batch.delete(participantRef);

    try {
        await batch.commit();
        toast({ title: "Participant Removed", description: `${participantToRemove.name} has been removed from the meeting.` });
    } catch (error) {
        console.error("Error removing participant:", error);
        toast({ variant: "destructive", title: "Removal Failed", description: "Could not remove the participant." });
    } finally {
        setParticipantToRemove(null);
    }
  };

  const handleToggleCamera = async (participant: Participant) => {
    if (!isCurrentUserTheHost || participant.id === currentUserId) return;
    try {
      const participantRef = doc(db, 'meetings', meetingId, 'participants', participant.id);
      await updateDoc(participantRef, { isCameraOn: false });
      toast({ title: 'Camera Off', description: `Turned off ${participant.name}'s camera.` });
    } catch (error) {
      console.error('Failed to turn off camera:', error);
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not turn off the camera.' });
    }
  };

  const handleLowerHand = async (participant: Participant) => {
    if (!isCurrentUserTheHost) return;
    try {
        const participantRef = doc(db, 'meetings', meetingId, 'participants', participant.id);
        await updateDoc(participantRef, { isHandRaised: false, handRaisedAt: null });
        toast({ title: 'Hand Lowered', description: `Lowered ${participant.name}'s hand.` });
    } catch (error) {
        console.error("Failed to lower hand:", error);
        toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not lower the hand.' });
    }
  };

  const backToMeetingParams = new URLSearchParams();
  if (topicFromParams) backToMeetingParams.set('topic', topicFromParams);
  if (cam) backToMeetingParams.set('cam', cam);
  if (mic) backToMeetingParams.set('mic', mic);
  const backToMeetingLink = `/dashboard/meeting/${meetingId}?${backToMeetingParams.toString()}`;

  const isCurrentUserTheHost = currentUserId === meetingHostId;

  return (
    <>
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-7 w-7 text-primary" />
             <div className="cursor-pointer" onClick={() => setShowMeetingId(prev => !prev)}>
                <h1 className="text-xl font-semibold text-foreground truncate" title={displayTopic}>
                    {showMeetingId ? meetingId : displayTopic}
                </h1>
                <p className="text-xs text-muted-foreground">
                    {showMeetingId ? 'Click to show topic' : 'Click to show Meeting ID'}
                </p>
             </div>
          </div>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={backToMeetingLink}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Meeting
            </Link>
          </Button>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col overflow-hidden">
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
                  <UsersIcon className="w-16 h-16 mb-4 text-primary" />
                  <p className="text-lg">No one is here yet.</p>
                  <p className="text-sm mt-2">Waiting for others to join...</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {realtimeParticipants.map((participant) => (
                    <ParticipantItem 
                      key={participant.id} 
                      participant={participant} 
                      isCurrentUserHost={isCurrentUserTheHost}
                      isThisParticipantTheHost={participant.id === meetingHostId}
                      onRemoveClick={() => setParticipantToRemove(participant)}
                      onToggleCamera={handleToggleCamera}
                      onLowerHand={handleLowerHand}
                      onBlockClick={() => { setParticipantToBlock(participant); setIsBlockDialogOpen(true); }}
                      meetingId={meetingId}
                      topic={topicFromParams}
                      pinnedUserId={pinnedUserId}
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
    <AlertDialog open={!!participantToRemove} onOpenChange={(open) => !open && setParticipantToRemove(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove <span className="font-bold">{participantToRemove?.name}</span> from the meeting. They will need to request to join again.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setParticipantToRemove(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Remove</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    {participantToBlock && (
        <BlockUserDialog
            isOpen={isBlockDialogOpen}
            onOpenChange={setIsBlockDialogOpen}
            participant={participantToBlock}
        />
    )}
    </>
  );
}
