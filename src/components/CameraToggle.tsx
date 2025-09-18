
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type CameraToggleProps = {
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
};

export default function CameraToggle({ localStream, setLocalStream }: CameraToggleProps) {
  const [isCameraOn, setIsCameraOn] = useState(true);

  // Synchronize component state with the stream passed from the parent
  useEffect(() => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      setIsCameraOn(localStream.getVideoTracks().every(track => track.enabled));
    } else {
      setIsCameraOn(false);
    }
  }, [localStream]);

  const toggleCamera = async () => {
    if (localStream) {
      // If stream exists, toggle tracks
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !isCameraOn;
        videoTracks.forEach(track => {
          track.enabled = nextState;
        });
        setIsCameraOn(nextState);
        localStorage.setItem('teachmeet-camera-default', nextState ? 'on' : 'off');
      } else {
        // Stream exists but has no video track, try to add one
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = videoStream.getVideoTracks()[0];
          localStream.addTrack(videoTrack);
          setIsCameraOn(true);
          localStorage.setItem('teachmeet-camera-default', 'on');
        } catch (err) {
            console.error("Failed to get video track to add to existing stream", err);
            alert("Could not enable camera. Please check permissions.");
        }
      }
    } else {
      // If no stream exists, create a new one with video
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(newStream);
        setIsCameraOn(true);
        localStorage.setItem('teachmeet-camera-default', 'on');
      } catch (err) {
        console.error("Camera access denied or error:", err);
        alert("Please allow camera and microphone access to start your video.");
      }
    }
  };

  return (
    <Button
      variant={isCameraOn ? "default" : "destructive"}
      size="icon"
      className={cn("h-14 w-14 rounded-full flex flex-col items-center justify-center gap-1 text-xs text-white", !isCameraOn && "bg-destructive hover:bg-destructive/90")}
      onClick={toggleCamera}
      aria-label={isCameraOn ? "Stop Camera" : "Start Camera"}
    >
      {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
    </Button>
  );
}
