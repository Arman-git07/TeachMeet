
import React from "react";
import { Hand, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2, ScreenShare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  stream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn?: boolean;
  isHandRaised?: boolean;
  isLocal?: boolean;
  profileUrl?: string | null;
  className?: string;
  volumeLevel?: number;
  isScreenSharing?: boolean;
  name?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onDoubleClick?: () => void;
  draggable?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = React.memo(
  ({
    stream,
    isCameraOn,
    isMicOn,
    isHandRaised,
    isLocal,
    profileUrl,
    className,
    volumeLevel,
    isScreenSharing,
    name = "User",
    isPinned,
    onTogglePin,
    onDoubleClick,
    draggable
  }) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [mirror, setMirror] = React.useState(false);

    React.useEffect(() => {
        if (isLocal) {
            setMirror(localStorage.getItem('teachmeet-camera-mirror') === 'true');
        }
    }, [isLocal]);

    React.useEffect(() => {
      if (videoRef.current && stream) {
        if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
        }
        videoRef.current.style.opacity = isCameraOn ? "1" : "0";
      } else if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }, [stream, isCameraOn]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDoubleClick?.();
    };

    return (
      <div
        ref={containerRef}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "relative bg-black rounded-lg overflow-visible", // ✅ allow overflow
          className,
          draggable ? "cursor-grab active:cursor-grabbing" : ""
        )}
        style={{ isolation: "isolate" }} // ✅ ensure proper z-index stacking
        role="group"
      >
        {/* Video Element & Fallback */}
        <div className="relative w-full h-full z-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200 rounded-lg z-0",
              mirror && "scale-x-[-1]"
            )}
            style={{
              opacity: isCameraOn && stream ? 1 : 0,
              position: "relative",
              zIndex: 0, // ✅ ensures video is *below* overlays
            }}
          />
          {(!isCameraOn || !stream) && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
                <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
                <AvatarFallback className="text-5xl">{name?.charAt(0) ?? "U"}</AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
    
        {/* ✋ Hand Raised Icon (Top-Left) */}
        {isHandRaised && (
          <div
            className="absolute top-2 left-2 z-[9999999] flex items-center justify-center p-2 bg-[hsl(98,60%,50%)] rounded-full shadow-xl"
            style={{
              position: "absolute",
              pointerEvents: "auto", // ✅ allows clicks to pass through
            }}
          >
            <Hand className="h-5 w-5 text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.7)]" />
          </div>
        )}
    
        {/* Camera Status (Top-Right) */}
        <div className="absolute top-3 right-3 z-50 p-1 rounded-md bg-black/50">
          {isCameraOn ? <Video className="h-5 w-5 text-white" /> : <VideoOff className="h-5 w-5 text-red-400" />}
        </div>
    
        {/* Bottom Overlay: Name + Mic + ScreenShare */}
        <div className="absolute left-3 bottom-3 z-50 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user" />
            <AvatarFallback>{name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-sm font-medium truncate max-w-[160px]">{name}</div>
          <div className="flex items-center gap-2">
            {isMicOn ? <Mic className="h-4 w-4 text-green-400" /> : <MicOff className="h-4 w-4 text-red-400" />}
            {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
          </div>
        </div>
    
        {/* Pin Button */}
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin?.();
            }}
            aria-label={isPinned ? "Unpin participant" : "Pin participant"}
            className="absolute bottom-3 right-3 z-50 p-1 rounded-md bg-black/60 hover:bg-black/70 text-white"
            title={isPinned ? "Unpin (restore grid)" : "Pin (fullscreen)"}
          >
            {isPinned ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  }
);

VideoTile.displayName = "VideoTile";
export default VideoTile;
