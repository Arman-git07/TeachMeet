
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
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';


// --------------------------- Meeting Page ---------------------------
export default function MeetingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setHeaderContent } = useDynamicHeader();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [meetingId, setMeetingId] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.indexOf('meeting') + 1];
      setMeetingId(id);
    }
  }, []);

  const topic = params.get('topic') || "TeachMeet Meeting";
  const initialCamState = params.get('cam') === 'true';
  const initialMicState = params.get('mic') !== 'false';

  const [isCameraOn, setIsCameraOn] = useState(initialCamState);
  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(true);

  const [participants, setParticipants] = useState<any[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // --- CORRECT CAMERA INITIALIZATION ---
  // Initialize camera + microphone ONCE when the component mounts.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let mounted = true;

    const initMedia = async () => {
      setLoadingMedia(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        
        if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        // Set initial track states based on parameters from pre-join page
        stream.getVideoTracks().forEach(track => { track.enabled = initialCamState; });
        stream.getAudioTracks().forEach(track => { track.enabled = initialMicState; });

        setLocalStream(stream);
        setIsCameraOn(initialCamState);
        setIsMicOn(initialMicState);

      } catch (err) {
        console.error("Media init error:", err);
        toast({ variant: "destructive", title: "Media Error", description: "Could not access camera or microphone." });
      } finally {
        if(mounted) setLoadingMedia(false);
      }
    };
    
    initMedia();

    // Cleanup function: stop all tracks when the component unmounts
    return () => {
      mounted = false;
      stream?.getTracks().forEach(t => t.stop());
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once.


  const updateMyStatus = async (status: Partial<{ isMicOn: boolean; isCameraOn: boolean; isHandRaised: boolean; isScreenSharing: boolean }>) => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try { await updateDoc(participantRef, status); } catch (err) { console.error("Error updating participant status:", err); }
    }
  };
  
  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const nextState = !isMicOn;
    localStream.getAudioTracks().forEach(track => (track.enabled = nextState));
    
    localStorage.setItem("micState", nextState ? "true" : "false");
    
    setIsMicOn(nextState);
    updateMyStatus({ isMicOn: nextState });
  }, [localStream, isMicOn]);

  // --- CORRECT CAMERA TOGGLE ---
  // This function ONLY enables or disables the track on the PERSISTENT stream.
  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    const nextState = !isCameraOn;
    videoTracks.forEach(track => (track.enabled = nextState));
    setIsCameraOn(nextState); // This line is crucial to trigger a re-render
    updateMyStatus({ isCameraOn: nextState });
  };


  useEffect(() => {
    setHeaderContent(<span className="text-sm font-medium truncate">{topic}</span>);
    return () => setHeaderContent(null);
  }, [topic, setHeaderContent]);
  
  const handleParticipantsChange = useCallback((newParticipants: any[]) => {
    setParticipants(newParticipants);
  }, []);

  const handleToggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    updateMyStatus({ isHandRaised: next });
  };
  
  const handleScreenShare = async () => {
    setShowScreenShareConfirm(false);
    if (!localStream) return;
    const peerConnections: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ || [];

    if (isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        
        const cameraTrack = localStream.getVideoTracks().find(t => t.kind === 'video' && !t.label.includes('screen'));
        if (cameraTrack) {
             peerConnections.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(cameraTrack);
            });
        }
        
        setIsScreenSharing(false);
        await updateMyStatus({ isScreenSharing: false });
        return;
    }

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => handleScreenShare();
        
        peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
            else pc.addTrack(screenTrack, screenStream);
        });
        
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        await updateMyStatus({ isScreenSharing: true });

    } catch (err) {
        console.error("Screen share error:", err);
        toast({ variant: 'destructive', title: 'Screen Share Failed' });
    }
  };

  const handleLeave = async () => {
    if (user && meetingId) await deleteDoc(doc(db, "meetings", meetingId, "participants", user.uid)).catch(console.error);
    localStream?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    router.push("/");
  };
  
  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
      <div className="relative flex-grow min-h-0">
        {loadingMedia ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MeetingClient
            meetingId={meetingId}
            userId={user?.uid || ''}
            onUserJoined={() => {}}
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
              onClick={toggleMic}
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
                    <AlertDialogDescription>This will allow everyone in the meeting to see your screen.</AlertDialogDescription>
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
