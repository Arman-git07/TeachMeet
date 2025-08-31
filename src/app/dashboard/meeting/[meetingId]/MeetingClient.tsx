
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
        container.className = "w-full h-full bg-muted rounded-2xl overflow-hidden shadow-lg relative";

        el = document.createElement("video");
        el.id = `remote-${socketId}`;
        el.autoplay = true;
        el.playsInline = true;
        el.controls = false;
        el.muted = false; // Remote streams should not be muted
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "cover";
        
        container.appendChild(el);
        // The container is now positioned by the React render logic
      }
      el.srcObject = stream;
    },
    onRemoteLeft: (socketId) => {
      setRemoteSocketIds(prev => prev.filter(id => id !== socketId));
      const el = document.getElementById(`remote-container-${socketId}`);
      if (el?.parentElement) el.parentElement.removeChild(el);
    },
    onUserJoined: (socketId: string) => {
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

  const totalParticipants = remoteSocketIds.length + 1;

  const VideoTile = ({ isLocal = false }: { isLocal?: boolean }) => (
    <div className="w-full h-full bg-black rounded-2xl overflow-hidden shadow-lg relative">
      <video
        ref={isLocal ? localRef : null}
        id={isLocal ? "local" : ""}
        className="w-full h-full object-cover"
        muted={isLocal}
        playsInline
        autoPlay
        style={{ display: isLocal ? (camOn ? 'block' : 'none') : 'block' }}
      />
      {isLocal && !camOn && (
        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center text-muted-foreground">
          <Avatar className="w-48 h-48 border-4 border-background shadow-lg">
            <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar" />
            <AvatarFallback className="text-6xl">{userFallback}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
  
  const RemoteTile = ({ socketId }: { socketId: string }) => (
    <div id={`remote-container-${socketId}`} className="w-full h-full bg-muted rounded-2xl overflow-hidden shadow-lg relative" />
  );


  if (totalParticipants === 1) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black p-4">
        <VideoTile isLocal />
      </div>
    );
  }

  if (totalParticipants === 2) {
    return (
      <div className="w-full h-full grid grid-cols-2 gap-2 p-2 bg-black">
        <VideoTile isLocal />
        <RemoteTile socketId={remoteSocketIds[0]} />
      </div>
    );
  }

  if (totalParticipants <= 4) {
     return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-2 bg-black">
          <VideoTile isLocal />
          {remoteSocketIds.map(socketId => <RemoteTile key={socketId} socketId={socketId} />)}
        </div>
     );
  }

  // 5+ participants
  return (
    <div className="w-full h-full grid grid-cols-3 gap-2 p-2 bg-black">
        <VideoTile isLocal />
        {remoteSocketIds.map(socketId => <RemoteTile key={socketId} socketId={socketId} />)}
    </div>
  );
});

MeetingClient.displayName = 'MeetingClient';
export default MeetingClient;
