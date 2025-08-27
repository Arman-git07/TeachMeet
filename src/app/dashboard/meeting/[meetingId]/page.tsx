
'use client';
import React, { useEffect, useRef, useState } from "react";

export default function MeetingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Start camera + mic
  useEffect(() => {
    async function initStream() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);

        // Attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Media access error:", err);
        alert("Please allow camera and microphone access.");
      }
    }
    initStream();

    // Cleanup when leaving
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Toggle microphone
  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !micOn;
      });
      setMicOn(!micOn);
    }
  };

  // Toggle camera
  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !camOn;
      });
      setCamOn(!camOn);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#1e2a38] text-white">
      {/* Video container */}
      <div className="relative w-full max-w-3xl h-[70vh] bg-black rounded-xl overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // prevents echo for self-view
          className="w-full h-full object-cover"
        />
        {/* Show avatar if camera off */}
        {!camOn && (
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold bg-gray-800">
            A
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-6 mt-6">
        {/* Mic Button */}
        <button
          onClick={toggleMic}
          className={`p-4 rounded-full ${
            micOn ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {micOn ? "🎤" : "🔇"}
        </button>

        {/* Camera Button */}
        <button
          onClick={toggleCam}
          className={`p-4 rounded-full ${
            camOn ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {camOn ? "📷" : "🚫"}
        </button>

        {/* Leave Button */}
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="p-4 rounded-full bg-red-700"
        >
          🚪
        </button>
      </div>
    </div>
  );
}
