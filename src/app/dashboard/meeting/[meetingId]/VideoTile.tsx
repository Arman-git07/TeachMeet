// src/app/dashboard/meeting/[meetingId]/VideoTile.tsx
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  stream: MediaStream | null;      // MediaStream or null
  isCameraOn: boolean;            // whether camera is logically ON
  isLocal?: boolean;              // true for local user (for muted autoplay)
  profileUrl?: string | null;     // fallback avatar url
  mirror?: boolean;               // mirror CSS
  className?: string;
};

function VideoTileComponent({
  stream,
  isCameraOn,
  isLocal = false,
  profileUrl = null,
  mirror = false,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- always bind the incoming stream to the <video> element reliably ---
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // If stream changed (different object), reattach
    if (stream && stream !== streamRef.current) {
      streamRef.current = stream;
      videoEl.srcObject = stream;
      // attempt to play (autoplay might be blocked without muted)
      const p = videoEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }

    // If stream becomes null, clear srcObject but keep element in DOM
    if (!stream && videoEl.srcObject) {
      videoEl.srcObject = null;
      streamRef.current = null;
    }
  }, [stream]);

  // --- show/hide the video via opacity (do not unmount <video>) ---
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isCameraOn && stream) {
      videoEl.style.opacity = "1";
      videoEl.style.pointerEvents = "auto";
      const p = videoEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      // hide the video (keeps srcObject intact)
      videoEl.style.opacity = "0";
      videoEl.style.pointerEvents = "none";
    }
  }, [isCameraOn, stream]);

  return (
    <div className={`relative bg-gray-800 overflow-hidden ${className}`} style={{ minHeight: 80 }}>
      {/* Always-rendered <video> element — prevents mount/unmount races */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} /* must be muted for self-view autoplay on many browsers */
        className={`w-full h-full object-cover transition-opacity duration-150 ${mirror ? "scale-x-[-1]" : ""}`}
        style={{ display: "block", width: "100%", height: "100%", opacity: (isCameraOn && stream) ? 1 : 0 }}
      />

      {/* Avatar overlay shown only when camera is off */}
      {(!isCameraOn || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center">
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarImage src={profileUrl || undefined} alt="avatar" />
                <AvatarFallback className="text-4xl">U</AvatarFallback>
            </Avatar>
        </div>
      )}
    </div>
  );
}

// Memoize: only re-render if these relevant props actually change
export default React.memo(
  VideoTileComponent,
  (prev, next) =>
    prev.stream === next.stream &&
    prev.isCameraOn === next.isCameraOn &&
    prev.profileUrl === next.profileUrl &&
    prev.mirror === next.mirror &&
    prev.isLocal === next.isLocal
);
