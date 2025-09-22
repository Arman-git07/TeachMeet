
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Hand, Users, PhoneOff, ScreenShare, ScreenShareOff, MoreVertical, Brush, MessageSquare, PanelLeftOpen, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import MeetingClient from "./MeetingClient";
import { doc, onSnapshot, updateDoc, writeBatch, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDynamicHeader } from "@/contexts/DynamicHeaderContext";


export default function MeetingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setHeaderContent } = useDynamicHeader();
  
  const [meetingId, setMeetingId] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.indexOf('meeting') + 1];
      setMeetingId(id);
    }
  }, []);

  const topic = params.get('topic') || "TeachMeet Meeting";
  
  const { user } = useAuth();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true) }, []);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const initialCamState = isClient ? params.get('cam') !== 'false' : true;
  const initialMicState = isClient ? params.get('mic') !== 'false' : true;

  const [isCameraOn, setIsCameraOn] = useState(initialCamState);
  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [participants, setParticipants] = useState<any[]>([]);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);

  const selfParticipant = participants.find(p => p.id === user?.uid);
  const previousRaisedHands = useRef(new Set());

  useEffect(() => {
    setHeaderContent(<span className="text-sm font-medium truncate">{topic}</span>);
    return () => setHeaderContent(null);
  }, [topic, setHeaderContent]);


  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        
        stream.getVideoTracks().forEach(track => track.enabled = initialCamState);
        stream.getAudioTracks().forEach(track => track.enabled = initialMicState);

        setLocalStream(stream);
        localStreamRef.current = stream;

      } catch (err) {
        console.error("Error accessing media devices:", err);
        toast({
          variant: "destructive",
          title: "Media Access Denied",
          description: "Could not access camera or microphone. Please check browser permissions.",
        });
        setIsCameraOn(false);
        setIsMicOn(false);
      }
    }
    setupMedia();

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [initialCamState, initialMicState, toast]);

  const handleUserJoined = useCallback((socketId: string) => {
    // This function can be used to notify about new users if needed
  }, []);
  
  const handleParticipantsChange = useCallback((newParticipants: any[]) => {
    setParticipants(newParticipants);
  }, []);

  // Notification for hand raises
  useEffect(() => {
    const isHost = participants.find(p => p.id === user?.uid)?.isHost;
    if (isHost) {
      const currentRaisedHands = new Set();
      participants.forEach(p => {
        if (p.isHandRaised && !p.isHost) {
          currentRaisedHands.add(p.id);
        }
      });

      // Find new hand raises
      currentRaisedHands.forEach(id => {
        if (!previousRaisedHands.current.has(id)) {
          const participant = participants.find(p => p.id === id);
          if (participant) {
            toast({
              title: "Hand Raised",
              description: `${participant.name} raised their hand.`,
            });
          }
        }
      });
      previousRaisedHands.current = currentRaisedHands;
    }
  }, [participants, user?.uid, toast]);
  
  const updateMyStatus = async (status: Partial<{ isMicOn: boolean; isCameraOn: boolean; isHandRaised: boolean; isScreenSharing: boolean }>) => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId as string, "participants", user.uid);
      try {
        await updateDoc(participantRef, status);
      } catch (error) {
        console.error("Error updating participant status:", error);
      }
    }
  };

  const handleToggleCamera = useCallback(() => {
    if (isScreenSharing) {
        toast({ title: "Camera Disabled", description: "You cannot turn on your camera while screen sharing."});
        return;
    }
    
    if (localStreamRef.current) {
        const nextState = !isCameraOn;
        localStreamRef.current.getVideoTracks().forEach(track => track.enabled = nextState);
        setIsCameraOn(nextState);
        updateMyStatus({ isCameraOn: nextState });
    }
  }, [isScreenSharing, isCameraOn, toast]);

  const handleToggleMic = useCallback(() => {
    const stream = isScreenSharing ? screenStreamRef.current : localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      const nextState = !isMicOn;
      audioTrack.enabled = nextState;
      setIsMicOn(nextState);
      updateMyStatus({ isMicOn: nextState });
    }
  }, [isMicOn, isScreenSharing]);

  const handleToggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    updateMyStatus({ isHandRaised: nextState });
  };
  
  const handleScreenShare = async () => {
    setShowScreenShareConfirm(false);
    if (isScreenSharing) {
        // Stop sharing
        const cameraVideoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (cameraVideoTrack) {
            cameraVideoTrack.enabled = isCameraOn; // Restore original camera state
            const newStream = new MediaStream([cameraVideoTrack, ...localStreamRef.current!.getAudioTracks()]);
            setLocalStream(newStream);
        }

        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        await updateMyStatus({ isScreenSharing: false });
        return;
    }

    // Start sharing
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        screenStream.getVideoTracks()[0].onended = () => {
            handleScreenShare(); // Call again to stop sharing
        };
        
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = false);

        const newStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...localStreamRef.current!.getAudioTracks()
        ]);
        
        setLocalStream(newStream);
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        await updateMyStatus({ isScreenSharing: true });

    } catch (err) {
        console.error("Screen share error:", err);
        toast({ variant: 'destructive', title: 'Screen Share Failed', description: 'Could not start screen sharing.' });
    }
  };

  const handleLeave = async () => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId as string, "participants", user.uid);
      try {
        await deleteDoc(participantRef);
        // If host leaves, consider ending the meeting for all (more complex logic)
      } catch (error) {
        console.error("Error leaving meeting:", error);
      }
    }
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    router.push("/");
  };
  
  const isHost = selfParticipant?.isHost;

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
        {/* Main Content Area */}
        <div className="relative flex-grow">
            {isClient && meetingId && user?.uid && (
              <MeetingClient
                  meetingId={meetingId as string}
                  userId={user.uid}
                  onUserJoined={handleUserJoined}
                  onParticipantsChange={handleParticipantsChange}
                  localStream={localStream}
                  micOn={isMicOn}
                  camOn={isCameraOn}
              />
            )}
        </div>

        {/* Bottom Controls */}
        <div className="flex-none p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center justify-center relative">
                <div className="flex items-center gap-3">
                    <Button
                      onClick={handleToggleMic}
                      className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors", 
                        isMicOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
                      )}
                      aria-label={isMicOn ? "Mute" : "Unmute"}
                    >
                      {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                    </Button>

                    <Button
                      onClick={handleToggleCamera}
                      className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                        isCameraOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
                      )}
                      aria-label={isCameraOn ? "Stop Camera" : "Start Camera"}
                    >
                      {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                    </Button>
                    
                    <AlertDialog open={showScreenShareConfirm} onOpenChange={setShowScreenShareConfirm}>
                       <AlertDialogTrigger asChild>
                           <Button
                              variant="ghost"
                              className={cn(
                                "h-14 w-14 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/20 text-white",
                                isScreenSharing && "bg-primary text-primary-foreground hover:bg-primary/90"
                              )}
                              aria-label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                            >
                               {isScreenSharing ? <ScreenShareOff className="h-6 w-6" /> : <ScreenShare className="h-6 w-6" />}
                            </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Share Your Screen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will allow everyone in the meeting to see your screen. You can choose to share your entire screen, a window, or a tab.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleScreenShare}>Share Screen</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button
                      onClick={handleToggleHandRaise}
                      className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                        isHandRaised ? "bg-green-500 hover:bg-green-600" : "bg-destructive hover:bg-destructive/90"
                      )}
                      aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
                    >
                      <Hand className="h-6 w-6" />
                    </Button>
                </div>
                 <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <Button
                      onClick={handleLeave}
                      className="h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors px-6"
                      aria-label="Leave Meeting"
                    >
                      <PhoneOff className="h-6 w-6" />
                      <span className="ml-2 font-semibold hidden sm:inline">Leave</span>
                    </Button>
                </div>
            </div>
        </div>
    </div>
  );
}
