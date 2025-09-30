
// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
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
  volumeLevel?: number; // throttled (150ms) from parent
  isScreenSharing?: boolean;
  name?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onDoubleClick?: () => void;
  draggable?: boolean;
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

const VideoTile: React.FC<Props> = ({
  stream,
  isCameraOn,
  isMicOn = true,
  isHandRaised = false,
  isLocal = false,
  profileUrl = null,
  className = "",
  volumeLevel = 0,
  isScreenSharing = false,
  name = "User",
  isPinned = false,
  onTogglePin,
  onDoubleClick,
  draggable = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const volumeBarRef = useRef<HTMLDivElement | null>(null);

  // bind stream once (per stream object)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // new stream -> attach and play
    if (stream && stream !== streamRef.current) {
      streamRef.current = stream;
      try {
        // assign srcObject
        (videoEl as any).srcObject = stream;
      } catch {
        // some browsers can throw; guard
        videoEl.src = URL.createObjectURL(stream as any);
      }
      videoEl.play().catch(() => {});
    }

    // remove src when stream removed
    if (!stream && videoEl.srcObject) {
      try {
        (videoEl as any).srcObject = null;
      } catch {}
      streamRef.current = null;
    }
  }, [stream]);

  // only toggle visibility; never re-create the video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.style.opacity = isCameraOn && stream ? "1" : "0";
    videoEl.style.pointerEvents = isCameraOn && stream ? "auto" : "none";
  }, [isCameraOn, stream]);

  // volume bar DOM update (no heavy re-renders)
  useEffect(() => {
    if (volumeBarRef.current) {
      const w = `${Math.round(Math.min(1, clamp(volumeLevel)) * 100)}%`;
      volumeBarRef.current.style.width = w;
    }
  }, [volumeLevel]);

  const handleDouble = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.();
  };

  return (
    <div
      // IMPORTANT: overflow-visible + isolation ensures overlays (hand icon) are NOT clipped
      className={cn(
        "relative rounded-lg bg-black overflow-visible",
        className,
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      )}
      style={{ isolation: "isolate" }} // creates independent stacking context so z-index works predictably
      onDoubleClick={handleDouble}
      role="group"
    >
      {/* Hand Raised Icon (Top-Left) - always above everything when visible */}
      {isHandRaised && (
        <div
          className="absolute top-2 left-2 z-[9999] flex items-center justify-center p-2 rounded-full shadow-xl pointer-events-none"
          // use TeachMeet green explicitly so it matches your palette and stands out.
          style={{
            backgroundColor: "hsl(98 60% 50%)",
            transform: "translateZ(0)", // force compositing layer so it stays above video on all browsers
          }}
        >
          <Hand className="h-5 w-5 text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.6)]" />
        </div>
      )}

      {/* Video area (kept under overlays via z-0) */}
      <div className="relative w-full h-full z-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover transition-opacity duration-200 rounded-lg"
          style={{
            opacity: isCameraOn && stream ? 1 : 0,
            position: "relative",
            zIndex: 0, // explicitly place video below overlays
            // avoid pointer issues
            touchAction: "none",
          }}
        />

        {/* Avatar fallback (shown when camera off or no stream) */}
        {(!isCameraOn || !stream) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
              <AvatarImage src={profileUrl || undefined} alt={name} />
              <AvatarFallback className="text-5xl">
                {name?.charAt(0) ?? "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Camera status (top-right) */}
      <div className="absolute top-3 right-3 z-30 p-1 rounded-md bg-black/50">
        {isCameraOn ? (
          <Video className="h-5 w-5 text-white" />
        ) : (
          <VideoOff className="h-5 w-5 text-red-400" />
        )}
      </div>

      {/* Bottom-left overlay: avatar + name + mic + volume + screen-share */}
      <div className="absolute left-3 bottom-3 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm">
        <Avatar className="w-7 h-7 shrink-0">
          <AvatarImage src={profileUrl || undefined} alt={name} />
          <AvatarFallback>{name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="font-medium truncate max-w-[160px]">{name}</div>

        <div className="flex items-center gap-2">
          {/* Mic icon */}
          <div
            className="p-1 rounded-md flex items-center justify-center"
            title={isMicOn ? "Microphone on" : "Microphone off"}
          >
            {isMicOn ? (
              <Mic className="h-4 w-4 text-green-400" />
            ) : (
              <MicOff className="h-4 w-4 text-red-400" />
            )}
          </div>

          {/* Microphone activity bar (DOM updated) */}
          {isMicOn && (
            <div className="w-14 h-2 bg-gray-700 rounded overflow-hidden">
              <div
                ref={volumeBarRef}
                className="h-2 bg-green-400 transition-all duration-150"
                style={{ width: "0%" }}
              />
            </div>
          )}

          {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
        </div>
      </div>

      {/* Pin / fullscreen toggle (bottom-right) */}
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.();
          }}
          aria-label={isPinned ? "Unpin participant" : "Pin participant"}
          className="absolute bottom-3 right-3 z-30 p-1 rounded-md bg-black/60 hover:bg-black/70 text-white"
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
