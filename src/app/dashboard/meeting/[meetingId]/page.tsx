
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Hand, Users, MessageSquare, PhoneOff } from "lucide-react";

export default function MeetingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true); // start with camera ON
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

        // attach stream immediately
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // default ON states
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
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // === Toggle Handlers ===
  const handleToggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
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
            isMicOn ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
          }`}
          aria-label={isMicOn ? "Mute" : "Unmute"}
        >
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>

        {/* Camera Button */}
        <button
          onClick={handleToggleCamera}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
            isCameraOn ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
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
            isHandRaised ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
          }`}
          aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
        >
          <Hand className="h-6 w-6" />
        </button>
        
        <div className="h-8 w-px bg-white/20 mx-2" />

        {/* Leave Meeting Button */}
        <button
          onClick={handleLeave}
          className="h-14 w-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
          aria-label="Leave Meeting"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
