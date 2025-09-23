
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

  const initialMicState = isClient ? params.get('mic') !== 'false' : true;

  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [participants, setParticipants] = useState<any[]>([]);
  
  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);

  // --- Camera State + Helpers ---

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Attach stream to local <video>
  const attachStreamToVideo = (stream: MediaStream | null) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  // Replace video track for all peers
  const replaceVideoTrackForPeers = (newTrack: MediaStreamTrack | null) => {
    const pcs: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ ?? [];
    pcs.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        sender.replaceTrack(newTrack).catch((e) =>
          console.warn("replaceTrack failed:", e)
        );
      } else if (newTrack && localStream) {
        pc.addTrack(newTrack, localStream);
      }
    });
  };

  // Start Camera
  const startCamera = async () => {
    setLoadingMedia(true);
    try {
      // Kill old video tracks if any
      localStream?.getVideoTracks().forEach((t) => {
        try { t.stop(); } catch {}
        localStream.removeTrack(t);
      });

      // Request new video
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("No video track");

      // Ensure we have a base stream with mic
      let baseStream = localStream;
      if (!baseStream) {
        baseStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(baseStream);
      }

      // Add new track
      baseStream.addTrack(videoTrack);
      attachStreamToVideo(baseStream);

      // Update peers
      replaceVideoTrackForPeers(videoTrack);

      setIsCameraOn(true);
    } catch (err) {
      console.error("startCamera error:", err);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Could not start your camera.",
      });
    } finally {
      setLoadingMedia(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    try {
      localStream?.getVideoTracks().forEach((t) => {
        try { t.stop(); } catch {}
        localStream.removeTrack(t);
      });
      attachStreamToVideo(null);
      replaceVideoTrackForPeers(null);
    } catch (e) {
      console.warn("stopCamera error:", e);
    } finally {
      setIsCameraOn(false);
    }
  };

  // --- Initialize on Page Load (respect ?cam=true/false) ---
  useEffect(() => {
    (async () => {
      // Use isClient check to ensure window is available
      if (typeof window === 'undefined') return;

      const url = new URL(window.location.href);
      const camParam = url.searchParams.get("cam");
      const initialCam = camParam === "true";

      try {
        if (initialCam) {
          await startCamera();
        } else {
          // mic-only init
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(micStream);
        }
      } catch (err) {
        console.error("Init media error:", err);
      } finally {
        setLoadingMedia(false);
      }
    })();

    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  const screenStreamRef = useRef<MediaStream | null>(null);
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

  const handleToggleMic = useCallback(() => {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        const nextState = !isMicOn;
        audioTracks.forEach(track => {
            track.enabled = nextState;
        });
        setIsMicOn(nextState);
        updateMyStatus({ isMicOn: nextState });
    }
}, [isMicOn, localStream]);


  const handleToggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    updateMyStatus({ isHandRaised: nextState });
  };
  
  const handleScreenShare = async () => {
    setShowScreenShareConfirm(false);
    if (isScreenSharing) {
        // Stop screen share
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        
        // Restore camera track if it was on
        const cameraVideoTrack = localStream?.getVideoTracks()[0]; // Re-check localStream
        if (cameraVideoTrack) {
          replaceVideoTrackForPeers(cameraVideoTrack);
        } else {
          replaceVideoTrackForPeers(null);
        }
        
        setIsScreenSharing(false);
        await updateMyStatus({ isScreenSharing: false });
        return;
    }

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        screenStream.getVideoTracks()[0].onended = () => {
            handleScreenShare(); // Toggle off when browser UI's "Stop sharing" is clicked
        };
        
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        if (localStream) {
          replaceVideoTrackForPeers(screenVideoTrack);
        }
        
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
        <div className="relative flex-grow">
             {isClient && meetingId && user?.uid ? (
              <MeetingClient
                  meetingId={meetingId as string}
                  userId={user.uid}
                  onUserJoined={handleUserJoined}
                  onParticipantsChange={handleParticipantsChange}
                  localStream={localStream}
                  micOn={isMicOn}
                  camOn={isCameraOn}
              />
            ) : (
                <div className="flex-1 flex items-center justify-center w-full bg-black">
                   {loadingMedia ? (
                      <div className="flex flex-col items-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <span>Initializing Media...</span>
                      </div>
                   ) : isCameraOn ? (
                     <video
                       ref={videoRef}
                       autoPlay
                       playsInline
                       muted
                       className="w-full h-full object-cover"
                     />
                   ) : (
                     <img
                       src={user?.photoURL || `https://placehold.co/128x128.png?text=${user?.displayName?.charAt(0) ?? 'U'}`}
                       alt="Profile"
                       className="w-32 h-32 rounded-full object-cover"
                       data-ai-hint="user avatar"
                     />
                   )}
                </div>
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
                      onClick={() => (isCameraOn ? stopCamera() : startCamera())}
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

    