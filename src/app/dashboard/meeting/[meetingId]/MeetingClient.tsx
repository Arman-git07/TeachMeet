
"use client";

import React from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { VideoOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Props = { 
  meetingId: string; 
  userId: string;
  onMicToggle: (isOn: boolean) => void;
  onCamToggle: (isOn: boolean) => void;
  onUserJoined: (socketId: string) => void;
};

export default function MeetingClient({ meetingId, userId, onMicToggle, onCamToggle, onUserJoined }: Props) {
  const localRef = React.useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const [remoteParticipantCount, setRemoteParticipantCount] = React.useState(0);

  const [rtc] = React.useState(() => new MeshRTC({
    roomId: meetingId,
    userId,
    onRemoteStream: (socketId, stream) => {
      // create/attach a remote video tile
      let el = document.getElementById(`remote-${socketId}`) as HTMLVideoElement | null;
      if (!el) {
        const container = document.createElement("div");
        container.id = `remote-container-${socketId}`;
        container.className = "w-full h-full aspect-video bg-muted rounded-2xl overflow-hidden shadow-lg relative";

        el = document.createElement("video");
        el.id = `remote-${socketId}`;
        el.autoplay = true;
        el.playsInline = true;
        el.controls = false;
        el.muted = false;
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "cover";
        
        container.appendChild(el);
        document.getElementById("remotes")?.appendChild(container);
      }
      el.srcObject = stream;
    },
    onRemoteLeft: (socketId) => {
      setRemoteParticipantCount(prev => Math.max(0, prev - 1));
      const el = document.getElementById(`remote-container-${socketId}`);
      if (el?.parentElement) el.parentElement.removeChild(el);
    },
    onUserJoined: (socketId: string) => {
      setRemoteParticipantCount(prev => prev + 1);
      onUserJoined(socketId);
    },
  }));

  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);

  // Init once
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      // Load initial state from localStorage
      const desiredCamState = localStorage.getItem('teachmeet-desired-camera-state') === 'on';
      const desiredMicState = localStorage.getItem('teachmeet-desired-mic-state') === 'on';

      setCamOn(desiredCamState);
      onCamToggle(desiredCamState);
      setMicOn(desiredMicState);
      onMicToggle(desiredMicState);

      await rtc.init(desiredMicState, desiredCamState);
      if (!mounted) return;
      if (localRef.current) rtc.attachLocal(localRef.current);
    })();
    return () => {
      mounted = false;
      rtc.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    onMicToggle(next);
    await rtc.toggleMic(next);
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    onCamToggle(next);
    await rtc.toggleCam(next);
    if (next && localRef.current) {
        // If turning camera on, re-attach the stream
        rtc.attachLocal(localRef.current);
    }
  };

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userAvatarSrc = user?.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;
  const userFallback = userName.charAt(0).toUpperCase();

  const hasRemotes = remoteParticipantCount > 0;

  return (
    <div className="w-full h-full relative">
      <div className={cn(
        "absolute top-0 left-0 w-full h-full p-2 md:p-4 transition-all duration-300",
        hasRemotes
          ? "grid grid-cols-1 md:grid-cols-4 grid-rows-4 md:grid-rows-1 gap-2 md:gap-4"
          : "flex items-center justify-center"
      )}>
        {/* Remote videos container - only shown if there are remotes */}
        {hasRemotes && (
          <div 
            id="remotes"
            className="w-full h-full col-span-1 row-span-3 md:col-span-3 md:row-span-1 grid grid-cols-2 grid-rows-2 sm:grid-cols-3 gap-2 md:gap-4"
          />
        )}
        
        {/* Local video tile - styling adjusts based on remote presence */}
        <div className={cn(
          "flex items-center justify-center",
          hasRemotes
            ? "w-full h-full col-span-1 row-span-1"
            : "w-full h-full max-w-4xl" // Takes up more space when alone
        )}>
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg relative">
                 <video
                    ref={localRef}
                    id="local"
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    autoPlay
                    style={{ display: camOn ? 'block' : 'none' }}
                />
                {!camOn && (
                    <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">
                            <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar"/>
                            <AvatarFallback className="text-4xl">{userFallback}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                           <VideoOff className="h-5 w-5" />
                           <p>Camera is off</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
      
      {/* Hidden buttons for external control from the main page */}
      <div style={{ display: 'none' }}>
        <button id="meeting-client-mic-toggle" onClick={toggleMic}>Toggle Mic</button>
        <button id="meeting-client-cam-toggle" onClick={toggleCam}>Toggle Cam</button>
      </div>
    </div>
  );
}
