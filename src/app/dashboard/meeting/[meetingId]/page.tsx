
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Hand, Users, PhoneOff, ScreenShare, ScreenShareOff, MoreVertical, Brush, MessageSquare, PanelLeftOpen, Settings, AlertTriangle, Loader2 } from "lucide-react";
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

  const initialCamState = isClient ? params.get('cam') === 'true' : false;
  const initialMicState = isClient ? params.get('mic') !== 'false' : true;

  const [isCameraOn, setIsCameraOn] = useState(initialCamState);
  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const [participants, setParticipants] = useState<any[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(true);

  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Initialize stream on page load
  useEffect(() => {
    (async () => {
      setLoadingMedia(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: initialCamState,
          audio: true
        });
        
        // Disable video tracks if camera is meant to be off initially
        if (!initialCamState) {
            stream.getVideoTracks().forEach(track => { track.enabled = false; });
        }
        // Always apply initial mic state
        stream.getAudioTracks().forEach(track => { track.enabled = initialMicState; });

        setLocalStream(stream);
        setIsCameraOn(initialCamState);
        setIsMicOn(initialMicState);

      } catch (err) {
        console.error("Init media error:", err);
        try {
            // Fallback to audio-only if video fails
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getAudioTracks().forEach(track => track.enabled = initialMicState);
            setLocalStream(audioStream);
            setIsCameraOn(false);
            toast({ variant: 'destructive', title: 'Video Error', description: 'Could not access camera. Starting with audio only.' });
        } catch (audioErr) {
            console.error("Audio-only fallback error:", audioErr);
            toast({ variant: 'destructive', title: 'Media Error', description: 'Could not access microphone or camera.' });
        }
      } finally {
        setLoadingMedia(false);
      }
    })();

    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);
  

  const selfParticipant = participants.find(p => p.id === user?.uid);
  const previousRaisedHands = useRef(new Set());

  useEffect(() => {
    setHeaderContent(<span className="text-sm font-medium truncate">{topic}</span>);
    return () => setHeaderContent(null);
  }, [topic, setHeaderContent]);

  const handleUserJoined = useCallback((socketId: string) => {
  }, []);
  
  const handleParticipantsChange = useCallback((newParticipants: any[]) => {
    setParticipants(newParticipants);
  }, []);

  useEffect(() => {
    const isHost = participants.find(p => p.id === user?.uid)?.isHost;
    if (isHost) {
      const currentRaisedHands = new Set();
      participants.forEach(p => {
        if (p.isHandRaised && !p.isHost) {
          currentRaisedHands.add(p.id);
        }
      });

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

  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) { // If no video track, try to get one
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = videoStream.getVideoTracks()[0];
        localStream.addTrack(newVideoTrack);
        setIsCameraOn(true);
        updateMyStatus({ isCameraOn: true });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera.' });
      }
      return;
    }
    
    const nextState = !isCameraOn;
    videoTracks.forEach(track => {
        track.enabled = nextState;
    });
    setIsCameraOn(nextState);
    updateMyStatus({ isCameraOn: nextState });
  };

  const handleToggleMic = useCallback(() => {
    if (!localStream) return;
    const nextState = !isMicOn;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = nextState;
    });
    setIsMicOn(nextState);
    updateMyStatus({ isMicOn: nextState });
}, [isMicOn, localStream]);


  const handleToggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    updateMyStatus({ isHandRaised: nextState });
  };
  
  const handleScreenShare = async () => {
    setShowScreenShareConfirm(false);
    if (!localStream) return;

    if (isScreenSharing) {
        // Stop screen share
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        
        // Restore camera track if it exists
        const cameraTrack = localStream.getVideoTracks().find(t => t.kind === 'video' && !t.label.includes('screen'));
        const peerConnections: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ || [];
        peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(cameraTrack || null);
            }
        });
        
        setIsScreenSharing(false);
        await updateMyStatus({ isScreenSharing: false });
        return;
    }

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => handleScreenShare();
        
        const peerConnections: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ || [];
        peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(screenTrack);
            } else {
                pc.addTrack(screenTrack, screenStream);
            }
        });
        
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
      } catch (error) {
        console.error("Error leaving meeting:", error);
      }
    }
    localStream?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    router.push("/");
  };
  
  const isHost = selfParticipant?.isHost;

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
        <div className="relative flex-grow min-h-0">
             {loadingMedia ? (
                <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
             ) : (
                <MeetingClient
                    meetingId={meetingId as string}
                    userId={user?.uid || ''}
                    onUserJoined={handleUserJoined}
                    onParticipantsChange={handleParticipantsChange}
                    localStream={localStream}
                    micOn={isMicOn}
                    camOn={isCameraOn}
                />
             )}
        </div>

        <div className="flex-none p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center justify-center relative">
                <div className="flex items-center justify-center gap-3">
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
                      onClick={toggleCamera}
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
                              onClick={() => { isScreenSharing ? handleScreenShare() : setShowScreenShareConfirm(true) }}
                              variant="ghost"
                              className={cn(
                                "h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                                isScreenSharing ? "bg-green-600 text-white hover:bg-green-700" : "bg-secondary/50 hover:bg-secondary/70 text-white"
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
                              This will allow everyone in the meeting to see your screen. You can choose to share your entire screen, a window, or a tab. Your camera will be turned off during screen sharing.
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
                        isHandRaised ? "bg-yellow-500 hover:bg-yellow-600" : "bg-secondary/50 hover:bg-secondary/70 text-white"
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
