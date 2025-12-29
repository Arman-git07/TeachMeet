
// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  ScreenShare,
  ScreenShareOff,
  Pin,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HandRaiseIcon from "./HandRaiseIcon";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  onUnpin?: () => void;
  onSpotlightClick?: () => void;
  draggable?: boolean;
  volumeLevel?: number;
  isPinned?: boolean;
  isSpotlight?: boolean;
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
  onUnpin,
  onSpotlightClick,
  draggable = false,
  volumeLevel = 0,
  isPinned = false,
  isSpotlight = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tileRef = useRef<HTMLDivElement | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);

  useEffect(() => {
    // Only apply mirror setting for the local user's camera feed
    if (isLocal && !isScreenSharing) {
      const mirrorSetting = localStorage.getItem('teachmeet-camera-mirror');
      setIsMirrored(mirrorSetting === 'true');
    } else {
      setIsMirrored(false);
    }
  }, [isLocal, isScreenSharing]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      if (stream && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch(e => console.warn(`[VideoTile ${name}] Autoplay was prevented:`, e));
      } else if (!stream) {
        videoEl.srcObject = null;
      }
    }
  }, [stream, name]);

  const isSpeaking = (volumeLevel ?? 0) > 0.1 && isMicOn;

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
        {isPinned && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <button className="cursor-pointer p-1 hover:bg-black/50 rounded-full" title="Click to unpin">
                    <Pin className="h-5 w-5 text-white/90" style={{ filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.5))" }} />
                 </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unpin Participant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to unpin {name}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onUnpin}>Unpin</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        )}
        <HandRaiseIcon
          isRaised={isHandRaised}
          isFirst={isFirstHand}
        />
      </div>
      
      {/* Video Layer */}
      <div className="relative w-full h-full z-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200 rounded-lg z-0",
            (isCameraOn || isScreenSharing) && stream ? "opacity-100" : "opacity-0",
            isMirrored && "transform -scale-x-100"
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
        <div className="absolute top-3 right-3 z-30 p-1 rounded-md bg-transparent">
          {isCameraOn ? (
            <Video className="h-5 w-5 text-white" />
          ) : (
            <VideoOff className="h-5 w-5 text-red-400" />
          )}
        </div>

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
            onClick={onSpotlightClick}
            className="h-8 w-8 rounded-full text-white/80 hover:bg-black/50 hover:text-white"
            title={isSpotlight ? "Exit Spotlight" : "Spotlight User"}
          >
            {isSpotlight ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);
