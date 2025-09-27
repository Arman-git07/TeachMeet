// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, Hand, ScreenShare } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  stream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn?: boolean;
  isHandRaised?: boolean;
  isLocal?: boolean;
  profileUrl?: string | null;
  mirror?: boolean;
  className?: string;
  volumeLevel?: number;
  isScreenSharing?: boolean;
  name?: string;
};

function VideoTileComponent({
  stream,
  isCameraOn,
  isMicOn = true,
  isHandRaised = false,
  isLocal = false,
  profileUrl = null,
  mirror = false,
  className = "",
  volumeLevel = 0,
  isScreenSharing = false,
  name = "User",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- always bind the incoming stream to the <video> element reliably ---
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && stream !== streamRef.current) {
      streamRef.current = stream;
      videoEl.srcObject = stream;
      const p = videoEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }

    if (!stream && videoEl.srcObject) {
      videoEl.srcObject = null;
      streamRef.current = null;
    }
  }, [stream]);

  // --- show/hide the video via opacity ---
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isCameraOn && stream) {
      videoEl.style.opacity = "1";
      videoEl.style.pointerEvents = "auto";
      const p = videoEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      videoEl.style.opacity = "0";
      videoEl.style.pointerEvents = "none";
    }
  }, [isCameraOn, stream]);

  return (
    <div className={cn(`relative bg-gray-800 overflow-hidden`, className)} style={{ minHeight: 80 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-150 ${mirror ? "scale-x-[-1]" : ""}`}
        style={{ display: "block", width: "100%", height: "100%", opacity: (isCameraOn && stream) ? 1 : 0 }}
      />

      {(!isCameraOn || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center">
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarImage src={profileUrl || undefined} alt="avatar" />
                <AvatarFallback className="text-4xl">{name.charAt(0)}</AvatarFallback>
            </Avatar>
        </div>
      )}
      
      {/* --- OVERLAY --- Moved from MeetingClient.tsx into here */}
      <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-black/40 px-2 py-1 rounded-md text-white text-sm font-medium">
          <span>{name}</span>
          {isMicOn ? <Mic className="h-4 w-4 text-green-400" /> : <MicOff className="h-4 w-4 text-red-400" />}
          {isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
      </div>
       {isMicOn && volumeLevel > 0.01 && (
        <div 
          className="absolute inset-0 rounded-lg border-2 transition-colors duration-100 pointer-events-none"
          style={{ borderColor: `rgba(50, 205, 50, ${Math.min(volumeLevel * 2, 1)})` }} 
        />
      )}
    </div>
  );
}

export default React.memo(
  VideoTileComponent,
  (prev, next) =>
    prev.stream === next.stream &&
    prev.isCameraOn === next.isCameraOn &&
    prev.isMicOn === next.isMicOn &&
    prev.isHandRaised === next.isHandRaised &&
    prev.volumeLevel === next.volumeLevel &&
    prev.isScreenSharing === next.isScreenSharing &&
    prev.profileUrl === next.profileUrl &&
    prev.mirror === next.mirror &&
    prev.isLocal === next.isLocal &&
    prev.name === next.name
);