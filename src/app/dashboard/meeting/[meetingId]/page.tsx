
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Hand, Users, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MeetingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const initialCamState = searchParams.get('cam') === 'true';
  const initialMicState = searchParams.get('mic') === 'true';

  const [isCameraOn, setIsCameraOn] = useState(initialCamState);
  const [isMicOn, setIsMicOn] = useState(initialMicState);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);

  useEffect(() => {
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        stream.getVideoTracks().forEach(track => track.enabled = initialCamState);
        stream.getAudioTracks().forEach(track => track.enabled = initialMicState);

        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
        toast({
            variant: "destructive",
            title: "Media Access Denied",
            description: "Could not access your camera or microphone. Please check browser permissions."
        });
      } finally {
        setLoadingMedia(false);
      }
    };

    setupMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleCamera = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
    }
  }, [localStream]);

  const handleToggleMic = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  }, [localStream]);

  const handleToggleHandRaise = () => {
    setIsHandRaised((prev) => !prev);
  };
  
  const handleLeave = () => {
    // In a real app, this would disconnect from the call and redirect.
    console.log("Leaving meeting.");
    window.location.href = "/";
  };


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
          <div className="w-32 h-32 flex items-center justify-center rounded-full bg-gray-700 text-4xl font-bold">
            A
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
