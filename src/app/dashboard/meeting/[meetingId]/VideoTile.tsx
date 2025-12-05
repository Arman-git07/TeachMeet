
// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  ScreenShare,
  ScreenShareOff,
  Pin,
  Maximize,
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
  onDoubleClick?: () => void;
  draggable?: boolean;
  volumeLevel?: number;
  onStopShare?: () => void;
  isPinned?: boolean;
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
  onDoubleClick,
  draggable = false,
  volumeLevel = 0,
  onStopShare,
  isPinned = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (stream && videoEl.srcObject !== stream) {
      console.log("[VideoTile] Assigned stream to video element", stream.id, stream.getTracks().map(t => t.kind));
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
    if (!stream) videoEl.srcObject = null;
  }, [stream]);

  const isSpeaking = (volumeLevel ?? 0) > 0.1 && isMicOn;

  const handleFullscreen = () => {
    if (tileRef.current) {
      if (!document.fullscreenElement) {
        tileRef.current.requestFullscreen().catch(err => {
          alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div
      ref={tileRef}
      onDoubleClick={onDoubleClick}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden transition-all duration-300",
        isSpeaking ? "ring-4 ring-primary ring-offset-2 ring-offset-background" : "ring-0",
        className,
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
      role="group"
      title={`Double-click to pin/unpin ${name}`}
    >
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1">
        {isPinned && <Pin className="h-5 w-5 text-white/90" style={{ filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.5))" }} />}
        <HandRaiseIcon
          isRaised={isHandRaised}
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
            (isCameraOn || isScreenSharing) && stream ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Avatar fallback */}
        {(!isCameraOn && !isScreenSharing || !stream) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Avatar className={cn(
                "w-28 h-28 border-4 border-background shadow-lg transition-all duration-300",
                isSpeaking ? "ring-4 ring-primary ring-offset-2 ring-offset-background" : ""
              )}>
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
        <div className="absolute top-3 right-3 z-30 p-1 rounded-md bg-transparent">
          {isCameraOn ? (
            <Video className="h-5 w-5 text-white" />
          ) : (
            <VideoOff className="h-5 w-5 text-red-400" />
          )}
        </div>
      )}

      {/* Bottom info container */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 flex items-center justify-between pointer-events-none">
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
        
        {/* Right-aligned info: Fullscreen button */}
        <div className="pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            className="h-8 w-8 rounded-full text-white/80 hover:bg-black/50 hover:text-white"
            title="Toggle Fullscreen"
          >
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);
