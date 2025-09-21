
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const initialCamState = searchParams.get('cam') !== 'false';
  const initialMicState = searchParams.get('mic') !== 'false';

  const [isCameraOn, setIsCameraOn] = useState(initialCamState);
  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);

  const startCamera = async () => {
    try {
      setLoadingMedia(true);
      // Always request a fresh stream when turning camera ON
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {}); // ensure playback
      }

      setIsCameraOn(true);
    } catch (err) {
      console.error("Error starting camera:", err);
      toast({
          variant: "destructive",
          title: "Camera Error",
          description: "Could not start camera. Please check browser permissions."
      });
      setIsCameraOn(false);
    } finally {
      setLoadingMedia(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };
  
  const handleToggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  useEffect(() => {
    async function setupMedia() {
      try {
        setLoadingMedia(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: initialCamState,
          audio: initialMicState,
        });
        streamRef.current = stream;

        // Apply initial mic state
        stream.getAudioTracks().forEach(track => track.enabled = initialMicState);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
        toast({
          variant: "destructive",
          title: "Media Access Denied",
          description: "Could not access camera or microphone. Please check browser permissions.",
        });
        setIsCameraOn(false);
        setIsMicOn(false);
      } finally {
        setLoadingMedia(false);
      }
    }
    setupMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initialCamState, initialMicState, toast]);


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
        ) : isCameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
            <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
                {userAvatar && <AvatarImage src={userAvatar} alt={userName} data-ai-hint="user avatar"/>}
                <AvatarFallback className="text-6xl bg-gray-700 text-white">
                {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Avatar>
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
