
"use client";

import React, { useImperativeHandle, forwardRef } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

type Props = { 
  meetingId: string; 
  userId: string;
  onMicToggle: (isOn: boolean) => void;
  onCamToggle: (isOn: boolean) => void;
  onUserJoined: (socketId: string) => void;
};

export interface MeetingClientRef {
  toggleMic: () => void;
  toggleCam: () => void;
}

const MeetingClient = forwardRef<MeetingClientRef, Props>(
  ({ meetingId, userId, onMicToggle, onCamToggle, onUserJoined }, ref) => {
  const localRef = React.useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const [remoteParticipantCount, setRemoteParticipantCount] = React.useState(0);
  const [remoteSocketIds, setRemoteSocketIds] = React.useState<string[]>([]);

  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);

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
      setRemoteSocketIds(prev => prev.filter(id => id !== socketId));
      const el = document.getElementById(`remote-container-${socketId}`);
      if (el?.parentElement) el.parentElement.removeChild(el);
    },
    onUserJoined: (socketId: string) => {
      setRemoteParticipantCount(prev => prev + 1);
      setRemoteSocketIds(prev => [...prev, socketId]);
      onUserJoined(socketId);
    },
  }));


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
  
  useImperativeHandle(ref, () => ({
    toggleMic: async () => {
      const next = !micOn;
      setMicOn(next);
      onMicToggle(next);
      await rtc.toggleMic(next);
    },
    toggleCam: async () => {
      const next = !camOn;
      setCamOn(next);
      onCamToggle(next);
      await rtc.toggleCam(next);
      if (next && localRef.current) {
          // If turning camera on, re-attach the stream
          rtc.attachLocal(localRef.current);
      }
    },
  }));

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userAvatarSrc = user?.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;
  const userFallback = userName.charAt(0).toUpperCase();

  const totalParticipants = remoteParticipantCount + 1;

  if (totalParticipants === 1) {
    // --- SOLO VIEW ---
    return (
      <div className="w-full h-full flex items-center justify-center bg-black p-4">
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
                  <Avatar className="w-48 h-48 border-4 border-background shadow-lg">
                      <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar"/>
                      <AvatarFallback className="text-6xl">{userFallback}</AvatarFallback>
                  </Avatar>
              </div>
          )}
        </div>
      </div>
    );
  }

  if (totalParticipants === 2) {
    // --- DUO VIEW (PIP) ---
    return (
      <div className="w-full h-full relative bg-black">
        {/* Remote participant takes the main stage */}
        <div className="w-full h-full" id="remotes"></div>
        
        {/* Local participant is in picture-in-picture */}
        <div className="absolute bottom-4 right-4 w-1/4 max-w-[250px] z-10">
          <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg border-2 border-background relative">
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
                  <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground text-xs p-1">
                      <Avatar className="w-full h-full rounded-none">
                        <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar" className="object-cover"/>
                        <AvatarFallback className="text-2xl rounded-none">{userFallback}</AvatarFallback>
                      </Avatar>
                  </div>
              )}
          </div>
        </div>
      </div>
    );
  }

  // --- GRID VIEW (3+ participants) ---
  return (
    <div className="w-full h-full p-2 md:p-4">
      <div 
        id="remotes"
        className="w-full h-full grid gap-2 md:gap-4"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`}}
      >
        {/* Local video is now part of the grid */}
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
                  <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                      <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar"/>
                      <AvatarFallback className="text-4xl">{userFallback}</AvatarFallback>
                  </Avatar>
                  <p className="mt-2 font-medium">You</p>
              </div>
            )}
        </div>
        {/* Remote videos will be appended here by the WebRTC logic */}
      </div>
    </div>
  );
});

MeetingClient.displayName = 'MeetingClient';
export default MeetingClient;
