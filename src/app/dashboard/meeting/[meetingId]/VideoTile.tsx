import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  MicOff,
  Mic,
  VideoOff,
  Video,
  Pin,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "../lib/utils";

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

  const syncStream = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      // Only set srcObject if it's different to prevent flickers
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }

      const videoTracks = stream.getVideoTracks();
      const hasVideo = videoTracks.some(
        (track) => track.readyState === "live" && track.enabled
      );

      setHasVideoTrack(hasVideo);

      // Attach listeners to tracks to detect when they become active/inactive
      stream.getTracks().forEach(track => {
        track.onunmute = syncStream;
        track.onmute = syncStream;
        track.onended = syncStream;
      });

      // CRITICAL: Remote video MUST NOT be muted to hear audio, 
      // but browsers often block auto-playing unmuted video unless there's a user gesture.
      videoEl.muted = isLocal;

      videoEl.play().catch(err => {
        // If play fails (autoblock), we might need to mute to at least show video,
        // but for a meeting app, we want the user to click something to unblock.
        console.warn("Video play interrupted/blocked:", err);
      });
    } else {
      videoEl.srcObject = null;
      setHasVideoTrack(false);
    }
  }, [stream, isLocal]);

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
 
  const debugText = stream
    ? `Tracks: ${stream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.enabled}`).join(", ")}`
    : "No Stream";
  
  // FIX: We trust the isCameraOn prop as the intent, and only hide if we definitely have no live track logic
  // but we prefer showing the video element container if isCameraOn is true to ensure state sync.
  const isEffectivelyShowingVideo = (isCameraOn || isScreenSharing);
  const hasNoRounding = className?.includes('rounded-none');

  return (
    <div
      onDoubleClick={onDoubleClick}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "bg-slate-900 border border-white/5",
        !hasNoRounding && "rounded-[2rem]",
        isSpeaking ? "ring-4 ring-emerald-500 shadow-[0_0_30px_rgba(105,211,45,0.4)]" : "",
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
          muted={isLocal} // Sync with prop
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500 bg-[#0f172a]",
            isEffectivelyShowingVideo ? "opacity-100" : "opacity-0",
            isMirrored && "transform -scale-x-100"
          )}
        />

        {!isEffectivelyShowingVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1e2732]">
            <div className="w-44 h-44 rounded-full bg-[#2a3441] flex items-center justify-center text-5xl font-light text-slate-500 border border-slate-700/50 shadow-2xl transition-all duration-300 hover:scale-105">
              {profileUrl ? (
                <img src={profileUrl} alt={name} className="w-full h-full rounded-full object-cover" />
              ) : (
                name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
          </div>
        )}
        
        {/* Debug Tracks Info (As seen in screenshot) */}
        <div className="absolute bottom-2 right-2 z-50 pointer-events-none">
          <div className="bg-black/60 px-2 py-1 rounded-md text-[10px] font-mono text-slate-400 border border-white/5 backdrop-blur-sm">
            {debugText}
          </div>
        </div>
      </div>

      {/* Overlays */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/80 to-transparent z-10 pointer-events-none" />
      
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        {isPinned && <Pin className="w-4 h-4 text-white drop-shadow-lg" />}
        {isHandRaised && (
           <div className="bg-yellow-500 p-1.5 rounded-lg shadow-lg animate-bounce">
              <span className="text-xs font-black text-white">✋ {raisedCount > 1 ? raisedCount : ''}</span>
           </div>
        )}
      </div>
      
      <div className="absolute top-4 right-4 z-20">
        <div className="bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10">
            {isCameraOn ? (
              <Video className="w-4 h-4 text-emerald-400" />
            ) : (
              <VideoOff className="w-4 h-4 text-red-500" />
            )}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md pl-1.5 pr-4 py-1.5 rounded-2xl border border-white/5">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">
            {name?.charAt(0).toUpperCase()}
          </div>
          <div className="text-xs font-bold truncate max-w-[120px]">{name} {isLocal ? "(You)" : ""}</div>
          <div className="w-px h-3 bg-white/10" />
          {isMicOn ? (
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
        
        <button 
          onClick={onSpotlightClick}
          className="p-2 bg-black/40 backdrop-blur-md rounded-xl text-white hover:bg-white/10 transition-all pointer-events-auto"
        >
          {isSpotlight ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);
