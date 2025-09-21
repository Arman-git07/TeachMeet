
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Hand, Users, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function MeetingPage() {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const initialCamState = searchParams.get('cam') !== 'false';
  const initialMicState = searchParams.get('mic') !== 'false';

  const [isCameraOn, setIsCameraOn] = useState(initialCamState);
  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    async function setupMedia() {
      try {
        setLoadingMedia(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true, // Always request video to get permission
          audio: true, // Always request audio
        });
        streamRef.current = stream;
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Apply initial states from URL params
        stream.getVideoTracks().forEach(track => track.enabled = initialCamState);
        stream.getAudioTracks().forEach(track => track.enabled = initialMicState);

        setIsCameraOn(initialCamState);
        setIsMicOn(initialMicState);

      } catch (err) {
        console.error("Error accessing media devices:", err);
        toast({
          variant: "destructive",
          title: "Media Access Denied",
          description: "Could not access camera or microphone. Please check browser permissions.",
        });
        setIsCameraOn(false);
        setIsMicOn(false);
        setHasCameraPermission(false);
      } finally {
        setLoadingMedia(false);
      }
    }
    setupMedia();

    return () => {
      // Clean up stream on component unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initialCamState, initialMicState, toast]);


  const handleToggleCamera = useCallback(() => {
    if (!streamRef.current || hasCameraPermission === false) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsCameraOn(nextState);
    }
  }, [hasCameraPermission]);

  const handleToggleMic = useCallback(() => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  }, []);

  const handleToggleHandRaise = () => {
    setIsHandRaised((prev) => !prev);
  };
  
  const handleLeave = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    window.location.href = "/";
  };


  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL;

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      {/* Video or Avatar */}
      <div className="flex-1 flex items-center justify-center w-full">
        {loadingMedia ? (
          <div className="text-lg text-gray-400">Initializing Media...</div>
        ) : (
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Video element is always present but hidden if camera is off */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn("w-full h-full object-cover transition-opacity", isCameraOn ? "opacity-100" : "opacity-0")}
            />
            {/* Avatar is shown when camera is off */}
            {(!isCameraOn || hasCameraPermission === false) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
                        {userAvatar && <AvatarImage src={userAvatar} alt={userName} data-ai-hint="user avatar"/>}
                        <AvatarFallback className="text-6xl bg-gray-700 text-white">
                        {userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                     {hasCameraPermission === false && (
                         <div className="mt-4">
                            <p className="text-sm font-semibold text-destructive">Camera access denied</p>
                            <p className="text-xs">Enable camera permissions in your browser.</p>
                         </div>
                     )}
                 </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 p-3 bg-black/30 backdrop-blur-md rounded-full shadow-2xl border border-white/10">
        {/* Mic Button */}
        <Button
          onClick={handleToggleMic}
          className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors", 
            isMicOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
          )}
          aria-label={isMicOn ? "Mute" : "Unmute"}
        >
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        {/* Camera Button */}
        <Button
          onClick={handleToggleCamera}
          className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors",
            isCameraOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
          )}
          aria-label={isCameraOn ? "Stop Camera" : "Start Camera"}
          disabled={hasCameraPermission === false}
        >
          {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>

        <div className="h-8 w-px bg-white/20 mx-2" />

        {/* Participants Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20"
          aria-label="Participants"
        >
          <Users className="h-6 w-6" />
        </Button>

        {/* Hand Raise Button */}
        <Button
          onClick={handleToggleHandRaise}
          className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors",
            isHandRaised ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
          )}
          aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
        >
          <Hand className="h-6 w-6" />
        </Button>
        
        <div className="h-8 w-px bg-white/20 mx-2" />

        {/* Leave Meeting Button */}
        <Button
          onClick={handleLeave}
          className="h-14 w-14 rounded-full flex items-center justify-center bg-destructive hover:bg-destructive/90 transition-colors"
          aria-label="Leave Meeting"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
