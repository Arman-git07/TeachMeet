
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


// --------------------------- Microphone Hook ---------------------------
function useMeetingMic(localStream: MediaStream | null, isMicOn: boolean, setIsMicOn: (value: boolean) => void) {
  const [volumeLevel, setVolumeLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const nextState = !isMicOn;
    localStream.getAudioTracks().forEach(track => (track.enabled = nextState));
    
    // Persist state for pre-join page sync
    localStorage.setItem("micState", nextState ? "true" : "false");
    
    // Update peers
    const peerConnections: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ || [];
    peerConnections.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === "audio");
      if (sender) sender.replaceTrack(nextState ? localStream.getAudioTracks()[0] : null);
    });

    setIsMicOn(nextState);
  }, [localStream, isMicOn, setIsMicOn]);

  // Volume indicator setup
  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0) {
      if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setVolumeLevel(0);
      return;
    };

    if (audioContextRef.current) return; // Already initialized

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setVolumeLevel(avg / 255); // normalize 0-1
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err) {
      console.error("Failed to initialize audio context for volume meter", err);
    }
    
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      sourceRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, [localStream]);

  return { toggleMic, volumeLevel };
}


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

  // Initialize camera + microphone
  useEffect(() => {
    let stream: MediaStream;
    let mounted = true;

    (async () => {
      setLoadingMedia(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true, // Always request video to get the track
          audio: true
        });

        if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        
        // Apply initial states by enabling/disabling tracks
        stream.getVideoTracks().forEach(track => track.enabled = initialCamState);
        stream.getAudioTracks().forEach(track => track.enabled = initialMicState);
        
        setLocalStream(stream);
        setIsCameraOn(initialCamState);
        setIsMicOn(initialMicState);

      } catch (err) {
        console.error("Failed to get media:", err);
        // Fallback to audio only if video fails
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!mounted) return;
          audioStream.getAudioTracks().forEach(track => track.enabled = initialMicState);
          setLocalStream(audioStream);
          setIsCameraOn(false); // Ensure camera is marked as off
          toast({ variant: 'destructive', title: 'Video Error', description: 'Could not access camera. Starting with audio only.' });
        } catch (audioErr) {
          console.error("Audio-only fallback failed:", audioErr);
          if (mounted) {
           toast({ variant: 'destructive', title: 'Media Error', description: 'Could not access camera or microphone.' });
          }
        }
      } finally {
        if(mounted) setLoadingMedia(false);
      }
    })();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMyStatus = async (status: Partial<{ isMicOn: boolean; isCameraOn: boolean; isHandRaised: boolean; isScreenSharing: boolean }>) => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try { await updateDoc(participantRef, status); } catch (err) { console.error("Error updating participant status:", err); }
    }
  };
  
  // Sync mic state with Firestore
  useEffect(() => {
    updateMyStatus({ isMicOn });
  }, [isMicOn]);
  
  const { toggleMic, volumeLevel } = useMeetingMic(localStream, isMicOn, setIsMicOn);

  // Camera toggle logic
  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    const nextState = !isCameraOn;
  
    if (nextState && videoTracks.length === 0) { // Turning ON, but no track exists
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newStream.getVideoTracks()[0];
        localStream.addTrack(newTrack);
        
        const peerConnections: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ || [];
        peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(newTrack);
          else pc.addTrack(newTrack, localStream);
        });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera.' });
        return; // Don't change state if we failed
      }
    } else { // Toggling existing track
      videoTracks.forEach(track => track.enabled = nextState);
    }
    
    setIsCameraOn(nextState);
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
        peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(cameraTrack || null);
        });
        
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
            volumeLevel={volumeLevel}
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
