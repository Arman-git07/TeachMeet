import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  Hand,
  ScreenShare,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  stream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn?: boolean;
  isHandRaised?: boolean;
  isLocal?: boolean;
  profileUrl?: string | null;
  className?: string;
  isScreenSharing?: boolean;
  name?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onDoubleClick?: () => void;
  draggable?: boolean;
  volumeLevel?: number; // Added back from previous context for completeness
};

const VideoTile: React.FC<Props> = ({
  stream,
  isCameraOn,
  isMicOn = true,
  isHandRaised = false,
  isLocal = false,
  profileUrl = null,
  className = "",
  isScreenSharing = false,
  name = "User",
  isPinned = false,
  onTogglePin,
  onDoubleClick,
  draggable = false,
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
        "relative bg-black rounded-lg overflow-visible isolate", // ✅ Fixed: allow overflow + stacking context
        className,
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      )}
      role="group"
    >
      {/* ✅ Hand Raised Icon */}
      {isHandRaised && (
        <div
          className="absolute top-2 left-2 z-[50] flex items-center justify-center bg-yellow-500 rounded-full p-2 shadow-lg"
          style={{
            pointerEvents: "none", // ensures it doesn't block clicks
          }}
        >
          <Hand className="text-white w-5 h-5" />
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
            "w-full h-full object-cover transition-opacity duration-200 rounded-lg relative z-[10]", // ✅ Fixed
            isCameraOn && stream ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Avatar fallback */}
        {(!isCameraOn || !stream) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
              <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user"/>
              <AvatarFallback className="text-5xl">
                {name?.charAt(0) ?? "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Camera status (top-right) */}
      <div className="absolute top-3 right-3 z-[20] p-1 rounded-md bg-black/50">
        {isCameraOn ? (
          <Video className="h-5 w-5 text-white" />
        ) : (
          <VideoOff className="h-5 w-5 text-red-400" />
        )}
      </div>

      {/* Bottom-left info */}
      <div className="absolute left-3 bottom-3 z-[20] flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
        <Avatar className="w-7 h-7 shrink-0">
          <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user"/>
          <AvatarFallback>{name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="text-sm font-medium truncate max-w-[160px]">{name}</div>

        {/* Mic + screen share */}
        <div className="flex items-center gap-2">
          {isMicOn ? (
            <Mic className="h-4 w-4 text-green-400" />
          ) : (
            <MicOff className="h-4 w-4 text-red-400" />
          )}
          {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
        </div>
      </div>

      {/* Pin toggle (bottom-right) */}
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.();
          }}
          aria-label={isPinned ? "Unpin participant" : "Pin participant"}
          className="absolute bottom-3 right-3 z-[20] p-1 rounded-md bg-black/60 hover:bg-black/70 text-white"
          title={isPinned ? "Unpin (restore grid)" : "Pin (fullscreen)"}
        >
          {isPinned ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
};

export default React.memo(VideoTile);
