
"use client";

import React, { useImperativeHandle, forwardRef, useMemo } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, VideoOff } from "lucide-react";

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
  
  const { user } = useAuth();
  const [remoteSocketIds, setRemoteSocketIds] = React.useState<string[]>([]);

  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [remoteStreams, setRemoteStreams] = React.useState<Map<string, MediaStream>>(new Map());

  const rtc = useMemo(() => new MeshRTC({
    roomId: meetingId,
    userId,
    onRemoteStream: (socketId, stream) => {
      setRemoteStreams(prev => new Map(prev).set(socketId, stream));
    },
    onRemoteLeft: (socketId) => {
      setRemoteSocketIds(prev => prev.filter(id => id !== socketId));
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(socketId);
        return newMap;
      });
    },
    onUserJoined: (socketId: string) => {
      setRemoteSocketIds(prev => [...prev, socketId]);
      onUserJoined(socketId);
    },
  }), [meetingId, userId, onUserJoined]);


  // Init once
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const desiredCamState = localStorage.getItem('teachmeet-desired-camera-state') !== 'off';
      const desiredMicState = localStorage.getItem('teachmeet-desired-mic-state') !== 'off';
      
      setCamOn(desiredCamState);
      onCamToggle(desiredCamState);
      setMicOn(desiredMicState);
      onMicToggle(desiredMicState);

      await rtc.init(desiredMicState, desiredCamState);
      if (!mounted) return;
      
      const localVideoContainer = document.getElementById('local-video-container');
      if (localVideoContainer) {
        const videoEl = document.createElement('video');
        videoEl.id = 'local-video-element';
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.className = 'w-full h-full object-cover';
        localVideoContainer.appendChild(videoEl);
        rtc.attachLocal(videoEl);
      }
    })();
    return () => {
      mounted = false;
      rtc.leave();
    };
  }, [rtc, onCamToggle, onMicToggle]);
  
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
    },
  }));

  const RemoteVideo = ({ stream }: { stream: MediaStream }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }, [stream]);
    return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
  };
  
  // Dummy data for example layout
  const allParticipants = [
    { id: 'local', name: user?.displayName || "User", avatar: user?.photoURL, isCamOff: !camOn, isMicOff: !micOn },
    ...remoteSocketIds.map(id => ({ id, name: `User ${id.slice(0,4)}`, avatar: `https://placehold.co/128x128.png?text=${id.charAt(0)}`, isCamOff: false, isMicOff: true })) // Simulating states
  ];


  const ParticipantTile = ({ p }: { p: typeof allParticipants[0] }) => {
    const stream = p.id === 'local' ? rtc.getLocalStream() : remoteStreams.get(p.id);

    return (
      <div className="w-full h-full bg-black rounded-lg overflow-hidden shadow-lg relative flex items-center justify-center">
        {p.isCamOff || !stream ? (
           <div className="flex flex-col items-center text-muted-foreground">
             <Avatar className="w-24 h-24 md:w-48 md:h-48 border-4 border-background shadow-lg">
                <AvatarImage src={p.avatar} alt={p.name} data-ai-hint="user avatar" />
                <AvatarFallback className="text-4xl md:text-6xl">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
             </Avatar>
           </div>
        ) : (
          p.id === 'local' ? (
            // This is just a placeholder, the actual local video is in the floating pip
            <div className="flex flex-col items-center text-muted-foreground">
                <Avatar className="w-24 h-24 md:w-48 md:h-48 border-4 border-background shadow-lg">
                    <AvatarImage src={p.avatar} alt={p.name} data-ai-hint="user avatar" />
                    <AvatarFallback className="text-4xl md:text-6xl">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
            </div>
          ) : (
            <RemoteVideo stream={stream} />
          )
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
           {p.isMicOff ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400"/>}
           <span className="text-sm">{p.name}</span>
        </div>
        {!p.isCamOff && p.isCamOff && <VideoOff className="h-5 w-5 absolute top-2 right-2 text-red-400 bg-black/50 p-1 rounded-full"/>}
      </div>
    );
  };
  
  if (allParticipants.length === 1) {
    return (
       <div className="w-full h-full flex items-center justify-center p-4">
          <ParticipantTile p={allParticipants[0]} />
      </div>
    )
  }

  // A more dynamic grid for > 1 participants could be implemented here.
  // For now, let's just show the first remote participant for simplicity.
  const remoteParticipant = allParticipants.find(p => p.id !== 'local');

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
        {remoteParticipant ? <ParticipantTile p={remoteParticipant} /> :  <ParticipantTile p={allParticipants[0]} />}
    </div>
  );
});

MeetingClient.displayName = 'MeetingClient';
export default MeetingClient;
