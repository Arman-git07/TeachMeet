// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MicOff, Mic, VideoOff, Video, Hand, ScreenShare } from "lucide-react";
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

const VideoTile = ({
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
}: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const volumeBarRef = useRef<HTMLDivElement | null>(null);

  // Bind stream only once and never reset video on state changes
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && stream !== streamRef.current) {
      streamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }

    if (!stream && videoEl.srcObject) {
      videoEl.srcObject = null;
      streamRef.current = null;
    }
  }, [stream]);

  // Only toggle visibility, never re-render video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.style.opacity = isCameraOn && stream ? "1" : "0";
      videoEl.style.pointerEvents = isCameraOn && stream ? "auto" : "none";
    }
  }, [isCameraOn, stream]);

  // Smooth mic volume animation without re-rendering
  useEffect(() => {
    if (volumeBarRef.current) {
      volumeBarRef.current.style.width = `${Math.min(1, volumeLevel) * 100}%`;
    }
  }, [volumeLevel]);

  return (
    <div className={cn("relative bg-gray-900 rounded-lg overflow-hidden", className)}>
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-200 ${mirror ? "scale-x-[-1]" : ""}`}
        style={{ opacity: isCameraOn && stream ? 1 : 0 }}
      />

      {/* Avatar fallback */}
      {(!isCameraOn || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
            <AvatarImage src={profileUrl || undefined} alt="avatar" />
            <AvatarFallback className="text-4xl">{name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute left-3 bottom-3 right-3 flex items-center justify-between bg-black/50 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm">
        {/* Avatar + Name */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium truncate">{name}</div>
        </div>

        {/* Status icons */}
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {/* Mic */}
          <div className="flex items-center gap-1">
            {isMicOn ? (
              <Mic className="h-4 w-4 text-green-400" />
            ) : (
              <MicOff className="h-4 w-4 text-red-400" />
            )}
            {isMicOn && (
              <div className="w-12 h-2 bg-gray-700 rounded overflow-hidden">
                <div
                  ref={volumeBarRef}
                  className="h-2 bg-green-400 transition-all duration-150"
                  style={{ width: `0%` }} // Initial width, will be updated by useEffect
                />
              </div>
            )}
          </div>

          {/* Camera */}
          {isCameraOn ? (
            <Video className="h-4 w-4 text-white" />
          ) : (
            <VideoOff className="h-4 w-4 text-red-400" />
          )}

          {/* Hand Raised */}
          {isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}

          {/* Screen Sharing */}
          {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);