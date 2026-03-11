import React, { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  Pin,
  Maximize2,
  Minimize2,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HandRaiseIcon from "./HandRaiseIcon";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";

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
  const router = useRouter();
const params = useParams();

const meetingId = Array.isArray(params?.meetingId)
  ? params?.meetingId[0]
  : params?.meetingId || "";
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

  const syncStream = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) {
      setHasVideoTrack(false);
      return;
    }

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
  }, [stream, name]);

  useEffect(() => {
    syncStream();

    if (stream) {
      stream.addEventListener('addtrack', syncStream);
      stream.addEventListener('removetrack', syncStream);
    }

    return () => {
      if (stream) {
        stream.removeEventListener('addtrack', syncStream);
        stream.removeEventListener('removetrack', syncStream);
      }
    };
  }, [stream, syncStream]);

  const isSpeaking = (volumeLevel ?? 0) > 0.1 && isMicOn;
  const isEffectivelyShowingVideo = (isCameraOn || isScreenSharing) && hasVideoTrack;
  const hasNoRounding = className?.includes('rounded-none');

  return (
    <div
      onDoubleClick={onDoubleClick}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "bg-background dark:bg-card border dark:border-white/5",
        !hasNoRounding && "rounded-lg",
        isSpeaking ? "ring-2 sm:ring-4 ring-primary" : "",
        className,
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
    >
      {/* Background Video Layer */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || !isMicOn}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200 bg-black",
            isEffectivelyShowingVideo ? "opacity-100" : "opacity-0",
            isMirrored && "transform -scale-x-100"
          )}
        />

        {!isEffectivelyShowingVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Avatar 
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/meeting/${meetingId}/participants`);
              }}
              className="w-1/3 aspect-square h-auto max-w-24 max-h-24 md:w-28 md:h-28 border-4 border-background shadow-lg transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95"
            >
              <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
              <AvatarFallback className="text-3xl md:text-5xl bg-muted text-muted-foreground">
                {name?.trim().charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Top Overlays */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-foreground/10 dark:from-black/40 to-transparent z-30 pointer-events-none" />
      <div className="absolute top-2 left-2 z-40 flex items-center gap-1">
        {isPinned && (
            <button className="cursor-pointer p-1 hover:bg-foreground/10 dark:hover:bg-black/50 rounded-full" title="Pinned" onClick={onUnpin}>
                <Pin className="h-4 w-4 sm:h-5 sm:w-5 text-foreground dark:text-white/90 drop-shadow-md" />
            </button>
        )}
        <HandRaiseIcon isRaised={isHandRaised} isFirst={isFirstHand} />
      </div>
      
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-40">
        <div className="bg-background/20 dark:bg-black/20 backdrop-blur-sm p-1.5 rounded-lg border border-foreground/10 dark:border-white/10 shadow-sm">
            {isCameraOn ? (
              <Video className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            ) : (
              <VideoOff className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            )}
        </div>
      </div>

      {/* Bottom Overlays */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-foreground/20 dark:from-black/60 via-foreground/5 dark:via-black/30 to-transparent z-30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 z-40 p-2 sm:p-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 text-foreground dark:text-white pointer-events-auto bg-background/80 dark:bg-black/40 backdrop-blur-md px-2 py-1.5 rounded-xl border border-foreground/10 dark:border-white/5 shadow-sm">
          <Avatar className="w-6 h-6 sm:w-7 sm:h-7 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
            <AvatarFallback className="text-xs sm:text-sm">{name?.trim().charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-xs sm:text-sm font-bold truncate max-w-[100px] sm:max-w-[150px]">{name}</div>
          <div className="w-px h-3 bg-foreground/20 dark:bg-white/20 mx-0.5" />
          {isMicOn ? (
            <Mic className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
          ) : (
            <MicOff className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
          )}
        </div>
        
        <div className="pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSpotlightClick}
            className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-background/80 dark:bg-black/40 backdrop-blur-md text-foreground/90 dark:text-white/90 hover:bg-primary/10 dark:hover:bg-black/60 border border-foreground/10 dark:border-white/10"
            title={isSpotlight ? "Standard View" : "Immersive View"}
          >
            {isSpotlight ? <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);
