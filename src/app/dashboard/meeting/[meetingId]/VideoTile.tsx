
// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MicOff, VideoOff, Hand, ScreenShare } from "lucide-react";

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
    <div className={`relative bg-gray-800 overflow-hidden ${className}`} style={{ minHeight: 80 }}>
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
                <AvatarFallback className="text-4xl">U</AvatarFallback>
            </Avatar>
        </div>
      )}
    </div>
  );
}

export default React.memo(
  VideoTileComponent,
  (prev, next) =>
    prev.stream === next.stream &&
    prev.isCameraOn === next.isCameraOn &&
    prev.profileUrl === next.profileUrl &&
    prev.mirror === next.mirror &&
    prev.isLocal === next.isLocal &&
    prev.isMicOn === next.isMicOn &&
    prev.isHandRaised === next.isHandRaised &&
    prev.volumeLevel === next.volumeLevel &&
    prev.isScreenSharing === next.isScreenSharing
);
