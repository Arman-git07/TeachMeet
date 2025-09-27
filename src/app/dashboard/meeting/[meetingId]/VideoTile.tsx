
// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MicOff, Mic, VideoOff, Video, Hand, ScreenShare, Maximize2, Minimize2 } from "lucide-react";
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
  isPinned?: boolean;
  onTogglePin?: () => void;         // toggles app-level pin
  onDoubleClick?: () => void;       // double click handler
  draggable?: boolean;              // small PiP tile draggable
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
  isPinned = false,
  onTogglePin,
  onDoubleClick,
  draggable = false,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const volumeBarRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // for draggable PiP
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Bind stream once and preserve srcObject
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && stream !== streamRef.current) {
      streamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }

    if (!stream && videoEl.srcObject) {
      try { videoEl.srcObject = null; } catch {}
      streamRef.current = null;
    }
  }, [stream]);

  // Toggle visibility only
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.style.opacity = isCameraOn && stream ? "1" : "0";
      videoEl.style.pointerEvents = isCameraOn && stream ? "auto" : "none";
    }
  }, [isCameraOn, stream]);

  // Volume bar DOM update (lightweight)
  useEffect(() => {
    if (volumeBarRef.current) {
      volumeBarRef.current.style.width = `${Math.min(1, volumeLevel) * 100}%`;
    }
  }, [volumeLevel]);

  // Fullscreen toggle (browser fullscreen)
  const [isFs, setIsFs] = useState(false);
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen({ navigationUI: "hide" } as any);
        setIsFs(true);
      } else {
        await document.exitFullscreen();
        setIsFs(false);
      }
    } catch (err) {
      // ignore
    }
  };

  // Keep track of fullscreen change to update button
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Double click handler
  const handleDoubleClick = () => {
    if (onDoubleClick) onDoubleClick();
  };

  // Drag handlers for PiP tiles
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !draggable) return;

    const onPointerDown = (e: PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      const rect = el.getBoundingClientRect();
      dragRef.current = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const left = dragRef.current.left + dx;
      const top = dragRef.current.top + dy;
      el.style.position = "fixed";
      el.style.left = `${Math.max(8, Math.min(window.innerWidth - rectWidth(el), left))}px`;
      el.style.top = `${Math.max(8, Math.min(window.innerHeight - rectHeight(el), top))}px`;
    };

    const onPointerUp = (e: PointerEvent) => {
      setIsDragging(false);
      dragRef.current = null;
    };

    // helper to get element dimensions
    const rectWidth = (el: HTMLElement) => el.getBoundingClientRect().width;
    const rectHeight = (el: HTMLElement) => el.getBoundingClientRect().height;

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggable]);

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className={cn("relative bg-gray-900 rounded-lg overflow-hidden", className, draggable ? "cursor-grab" : "")}
      style={{
        // if draggable and position already fixed by user, we keep inline styles applied
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-200 ${mirror ? "scale-x-[-1]" : ""}`}
        style={{ opacity: isCameraOn && stream ? 1 : 0 }}
      />

      {(!isCameraOn || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user"/>
            <AvatarFallback className="text-4xl">{name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute left-3 bottom-3 right-3 flex items-center justify-between bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user"/>
            <AvatarFallback>{name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
          <div className="font-medium truncate">{name}</div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-2">
          <div className="flex items-center gap-1">
            {isMicOn ? <Mic className="h-4 w-4 text-green-400" /> : <MicOff className="h-4 w-4 text-red-400" />}
            {isMicOn && (
              <div className="w-12 h-2 bg-gray-700 rounded overflow-hidden">
                <div ref={volumeBarRef} className="h-2 bg-green-400 transition-all duration-150" style={{ width: `${Math.min(1, volumeLevel) * 100}%` }} />
              </div>
            )}
          </div>

          {isCameraOn ? <Video className="h-4 w-4 text-white" /> : <VideoOff className="h-4 w-4 text-red-400" />}
          {isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
          {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
        </div>
      </div>

      {/* Right-bottom controls: Pin + Fullscreen */}
      <div className="absolute bottom-3 right-3 z-30 flex gap-1">
        {/* Pin (app-level) */}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin && onTogglePin(); }}
          aria-label={isPinned ? "Unpin" : "Pin"}
          className="p-1 rounded-md bg-black/50 hover:bg-black/60 text-white"
          title={isPinned ? "Unpin participant" : "Pin participant (make full screen)"}
        >
          {isPinned ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* Browser fullscreen */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
          className="p-1 rounded-md bg-black/50 hover:bg-black/60 text-white"
          title={isFs ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

export default React.memo(VideoTile);
