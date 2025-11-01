// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  ScreenShare,
  Maximize2,
  Minimize2,
  ScreenShareOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HandRaiseIcon from "./HandRaiseIcon";
import { Button } from "@/components/ui/button";

// --- Main VideoTile Component ---
type Props = {
  stream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn?: boolean;
  isHandRaised?: boolean;
  isFirstHand?: boolean;
  raisedCount?: number;
  isLocal?: boolean;
  profileUrl?: string | null;
  className?: string;
  isScreenSharing?: boolean;
  name?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onDoubleClick?: () => void;
  draggable?: boolean;
  volumeLevel?: number;
  onStopShare?: () => void;
};

const VideoTile: React.FC<Props> = ({
  stream,
  isCameraOn,
  isMicOn = true,
  isHandRaised = false,
  isFirstHand = false,
  raisedCount = 0,
  isLocal = false,
  profileUrl = null,
  className = "",
  isScreenSharing = false,
  name = "User",
  isPinned = false,
  onTogglePin,
  onDoubleClick,
  draggable = false,
  volumeLevel = 0,
  onStopShare,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (stream && videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
    if (!stream) videoEl.srcObject = null;
  }, [stream]);

  return (
    <div
      onDoubleClick={onDoubleClick}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden",
        className,
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      )}
      role="group"
    >
      <div className="absolute top-2 left-2 z-30">
        <HandRaiseIcon
          isRaised={isHandRaised}
          totalRaisedHands={raisedCount}
          isFirst={isFirstHand}
        />
      </div>

      {/* Stop Sharing Button for local screen share */}
      {onStopShare && (
         <div className="absolute top-2 right-2 z-40">
           <Button
             onClick={onStopShare}
             variant="destructive"
             size="sm"
             className="h-auto px-3 py-1.5 text-xs rounded-full"
           >
             <ScreenShareOff className="mr-1.5 h-3 w-3" />
             Stop Sharing
           </Button>
         </div>
       )}

      {/* Video Layer */}
      <div className="relative w-full h-full z-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200 rounded-lg z-0",
            isCameraOn && stream ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Avatar fallback */}
        {(!isCameraOn || !stream) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
              <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
              <AvatarFallback className="text-5xl">
                {name?.charAt(0) ?? "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Camera status (top-right) - hidden if stop button is shown */}
      {!onStopShare && (
        <div className="absolute top-3 right-3 z-30 p-1 rounded-md bg-transparent backdrop-blur-0 shadow-none">
          {isCameraOn ? (
            <Video className="h-5 w-5 text-white" />
          ) : (
            <VideoOff className="h-5 w-5 text-red-400" />
          )}
        </div>
      )}

      {/* Bottom info container */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 flex items-end justify-between pointer-events-none">
        {/* Left-aligned info: Avatar, Name, Status icons */}
        <div className="flex items-center gap-2 text-white pointer-events-auto" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
            <AvatarFallback>{name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-sm font-medium truncate max-w-[160px]">{name}</div>
          
          {isMicOn ? (
            <Mic className="h-4 w-4 text-green-400" />
          ) : (
            <MicOff className="h-4 w-4 text-red-400" />
          )}
          {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
        </div>

        {/* Right-aligned info: Pin button */}
        {onTogglePin && (
          <div className="pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin?.();
              }}
              aria-label={isPinned ? "Unpin participant" : "Pin participant"}
              className="p-1 rounded-md bg-transparent backdrop-blur-0 shadow-none hover:bg-black/70 text-white"
              title={isPinned ? "Unpin (restore grid)" : "Pin (fullscreen)"}
            >
              {isPinned ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(VideoTile);
