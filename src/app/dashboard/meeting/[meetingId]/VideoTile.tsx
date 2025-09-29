
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
  className?: string;
  volumeLevel?: number; // throttled (150ms) from parent
  isScreenSharing?: boolean;
  name?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;         // toggles app-level pin
  onDoubleClick?: () => void;       // double click handler
  draggable?: boolean;              // small PiP tile draggable
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

const VideoTile = ({
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
}: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [mirror, setMirror] = useState(false);

  useEffect(() => {
    if (isLocal) {
      setMirror(localStorage.getItem('teachmeet-camera-mirror') === 'true');
    }
  }, [isLocal]);

  // lightweight DOM driven mic pulse (no heavy re-renders)
  const micIconRef = useRef<SVGElement | null>(null);

  // draggable PiP state
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // bind stream once (preserve srcObject)
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

  // toggle visibility only
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.style.opacity = isCameraOn && stream ? "1" : "0";
    videoEl.style.pointerEvents = isCameraOn && stream ? "auto" : "none";
  }, [isCameraOn, stream]);

  // mic pulse effect (uses DOM styles to avoid re-renders)
  useEffect(() => {
    const el = micIconRef.current;
    if (!el) return;
    const level = clamp(volumeLevel ?? 0);
    // scale from 1 to 1.45, opacity from 0.7 to 1
    const scale = 1 + level * 0.45;
    const opacity = 0.6 + level * 0.4;
    el.style.transform = `scale(${scale})`;
    el.style.opacity = `${opacity}`;
    el.style.transition = `transform 120ms linear, opacity 120ms linear`;
  }, [volumeLevel]);

  // drag handlers for PiP tiles (simple)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !draggable) return;

    const onPointerDown = (e: PointerEvent) => {
      // only start drag on left mouse / primary pointer
      if (e.button && e.button !== 0) return;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        left: el.getBoundingClientRect().left,
        top: el.getBoundingClientRect().top,
      };
      setIsDragging(true);
      (e.target as Element).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      let left = dragRef.current.left + dx;
      let top = dragRef.current.top + dy;

      // clamp to viewport with 8px margin
      const width = el.getBoundingClientRect().width;
      const height = el.getBoundingClientRect().height;
      left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
      top = Math.max(8, Math.min(window.innerHeight - height - 8, top));

      el.style.position = "fixed";
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.zIndex = "60";
    };

    const onPointerUp = (e: PointerEvent) => {
      setIsDragging(false);
      dragRef.current = null;
    };

    el.addEventListener("pointerdown", onPointerDown as any);
    window.addEventListener("pointermove", onPointerMove as any);
    window.addEventListener("pointerup", onPointerUp as any);

    return () => {
      try {
        el.removeEventListener("pointerdown", onPointerDown as any);
      } catch {}
      window.removeEventListener("pointermove", onPointerMove as any);
      window.removeEventListener("pointerup", onPointerUp as any);
    };
  }, [draggable]);

  const handleDouble = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.();
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDouble}
      className={cn("relative bg-black rounded-lg overflow-visible w-full h-full", className, draggable ? "cursor-grab" : "")}
      role="group"
    >
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-200 rounded-lg ${mirror ? "scale-x-[-1]" : ""}`}
        style={{ opacity: isCameraOn && stream ? 1 : 0 }}
      />

      {isHandRaised && (
        <div
            className="absolute top-3 left-3 flex items-center justify-center bg-[hsl(98,60%,50%)] text-white p-2 rounded-full shadow-xl z-[9999] pointer-events-none"
            style={{ zIndex: 9999 }}
            title="Hand Raised"
        >
            <Hand className="h-6 w-6" />
        </div>
      )}
      
      {/* Camera icon top-right */}
      <div className="absolute top-3 right-3 z-30">
        {isCameraOn ? (
          <div className="p-1 rounded-md bg-black/50">
            <Video className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="p-1 rounded-md bg-black/50">
            <VideoOff className="h-5 w-5 text-red-400" />
          </div>
        )}
      </div>

      {/* Avatar fallback when camera off */}
      {(!isCameraOn || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user"/>
            <AvatarFallback className="text-5xl">{name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Bottom-left overlay: name + mic (mic icon pulses based on volume) */}
      <div className="absolute left-3 bottom-3 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarImage src={profileUrl || undefined} alt={name} data-ai-hint="avatar user"/>
            <AvatarFallback>{name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-sm font-medium truncate max-w-[160px]">{name}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* mic icon only (pulses) */}
          <div
            className="p-1 rounded-md"
            title={isMicOn ? "Microphone on" : "Microphone off"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {isMicOn ? (
              <Mic ref={micIconRef as any} className="h-4 w-4 text-green-400" />
            ) : (
              <MicOff className="h-4 w-4 text-red-400" />
            )}
          </div>

          {/* screen share */}
          {isScreenSharing && <ScreenShare className="h-4 w-4 text-blue-400" />}
        </div>
      </div>

      {/* Pin button bottom-right (app-level fullscreen/pin). Single button only. */}
      {onTogglePin && (
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
          aria-label={isPinned ? "Unpin participant" : "Pin participant"}
          className="absolute bottom-3 right-3 z-30 p-1 rounded-md bg-black/60 hover:bg-black/70 text-white"
          title={isPinned ? "Unpin participant (restore grid)" : "Pin participant (make full meeting view)"}
        >
          {isPinned ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      )}

    </div>
  );
};

export default React.memo(VideoTile);
