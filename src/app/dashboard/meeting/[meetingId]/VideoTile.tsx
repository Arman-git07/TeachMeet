// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  ScreenShare,
  Pin,
  Maximize2,
  Minimize2,
  Pencil,
  X,
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
  const [isMirrored, setIsMirrored] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  useEffect(() => {
    if (isLocal && !isScreenSharing) {
      setIsMirrored(localStorage.getItem('teachmeet-camera-mirror') === 'true');
    } else {
      setIsMirrored(false);
    }
  }, [isLocal, isScreenSharing]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) {
      setHasVideoTrack(false);
      return;
    }

    const syncStream = () => {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      
      const hasVideo = stream.getVideoTracks().length > 0;
      setHasVideoTrack(hasVideo);

      if (hasVideo || stream.getAudioTracks().length > 0) {
        videoEl.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn(`[VideoTile] Playback issue for ${name}:`, e);
          }
        });
      }
    };

    syncStream();

    // Listen for tracks being added to the stream (WebRTC often adds audio then video)
    stream.addEventListener('addtrack', syncStream);
    stream.addEventListener('removetrack', syncStream);

    return () => {
      stream.removeEventListener('addtrack', syncStream);
      stream.removeEventListener('removetrack', syncStream);
    };
  }, [stream, name]);

  const isSpeaking = (volumeLevel ?? 0) > 0.1 && isMicOn;
  
  // A tile is effectively showing video if the UI thinks it's on AND the stream actually has a track.
  const isEffectivelyShowingVideo = (isCameraOn || isScreenSharing) && hasVideoTrack;

  return (
    <div
      onDoubleClick={onDoubleClick}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden transition-all duration-300",
        isSpeaking ? "ring-2 sm:ring-4 ring-primary" : "",
        className,
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
    >
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1">
        {isPinned && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <button className="cursor-pointer p-1 hover:bg-black/50 rounded-full" title="Click to unpin">
                    <Pin className="h-4 w-4 sm:h-5 sm:w-5 text-white/90" style={{ filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.5))" }} />
                 </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unpin Participant?</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to unpin {name}?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onUnpin}>Unpin</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        )}
        <HandRaiseIcon isRaised={isHandRaised} isFirst={isFirstHand} />
      </div>
      
      <div className="relative w-full h-full z-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || !isMicOn}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200 rounded-lg",
            isEffectivelyShowingVideo ? "opacity-100" : "opacity-0",
            isMirrored && "transform -scale-x-100"
          )}
        />

        {!isEffectivelyShowingVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/10">
            <Avatar className="w-1/3 aspect-square h-auto max-w-24 max-h-24 md:w-28 md:h-28 border-4 border-background shadow-lg transition-all duration-300">
              <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
              <AvatarFallback className="text-3xl md:text-5xl">{name?.charAt(0) ?? "U"}</AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30">
        {isCameraOn ? <Video className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> : <VideoOff className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 p-2 sm:p-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 text-white pointer-events-auto" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
          <Avatar className="w-6 h-6 sm:w-7 sm:h-7 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
            <AvatarFallback className="text-xs sm:text-sm">{name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-xs sm:text-sm font-medium truncate">{name}</div>
          {isMicOn ? <Mic className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" /> : <MicOff className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" />}
        </div>
        
        <div className="pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSpotlightClick}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full text-white/80 hover:bg-black/50 hover:text-white"
          >
            {isSpotlight ? <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);