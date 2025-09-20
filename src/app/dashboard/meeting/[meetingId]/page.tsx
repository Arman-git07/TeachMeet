
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Hand, Users, MessageSquare, PhoneOff } from "lucide-react";

export default function MeetingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(true);

  useEffect(() => {
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
        setIsMicOn(true);
      } catch (err) {
        console.error("Error accessing media devices:", err);
      } finally {
        setLoadingCamera(false);
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

  const handleToggleCamera = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (isCameraOn) {
      // Turn camera OFF
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
      }
      setIsCameraOn(false);
    } else {
      // Turn camera ON
      try {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newVideoStream.getVideoTracks()[0];
        
        // Find and remove any old video tracks before adding the new one
        const oldVideoTracks = localStream.getVideoTracks();
        oldVideoTracks.forEach(track => {
            track.stop();
            localStream.removeTrack(track);
        });

        localStream.addTrack(newVideoTrack);
        
        // Re-assign the srcObject to ensure the video element updates
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }

        setIsCameraOn(true);
      } catch (err) {
        console.error("Error turning camera back on:", err);
      }
    }
  };


  const handleToggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

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
        {loadingCamera ? (
          <div className="text-lg text-gray-400">Initializing Camera...</div>
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
        <button
          onClick={handleToggleMic}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
            isMicOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
          }`}
          aria-label={isMicOn ? "Mute" : "Unmute"}
        >
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>

        {/* Camera Button */}
        <button
          onClick={handleToggleCamera}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
            isCameraOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
          }`}
          aria-label={isCameraOn ? "Stop Camera" : "Start Camera"}
        >
          {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>

        <div className="h-8 w-px bg-white/20 mx-2" />

        {/* Participants Button */}
        <button
          className="h-14 w-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Participants"
        >
          <Users className="h-6 w-6" />
        </button>

        {/* Hand Raise Button */}
        <button
          onClick={handleToggleHandRaise}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
            isHandRaised ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
          }`}
          aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
        >
          <Hand className="h-6 w-6" />
        </button>
        
        <div className="h-8 w-px bg-white/20 mx-2" />

        {/* Leave Meeting Button */}
        <button
          onClick={handleLeave}
          className="h-14 w-14 rounded-full flex items-center justify-center bg-destructive hover:bg-destructive/90 transition-colors"
          aria-label="Leave Meeting"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
