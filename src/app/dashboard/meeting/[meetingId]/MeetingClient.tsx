
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, VideoOff, Hand } from "lucide-react";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  name: string;
  avatar?: string;
  isCamOff: boolean;
  isMicOff: boolean;
  isHandRaised?: boolean;
  isLocal?: boolean;
  stream: MediaStream | null;
  isScreenSharing?: boolean;
  volumeLevel?: number;
};

type Props = { 
  meetingId: string; 
  userId: string;
  onUserJoined: (socketId: string) => void;
  onParticipantsChange: (participants: any[]) => void;
  localStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  volumeLevel: number;
};

const VideoTile = ({ user, full }: { user: Participant; full?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (user.stream && !user.isCamOff) {
      videoEl.srcObject = user.stream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'NotAllowedError') {
             console.error("Video play error:", err);
          }
        });
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [user.stream, user.isCamOff]);

  return (
    <div className={cn(
        "bg-gray-800 flex items-center justify-center relative rounded-lg overflow-hidden",
        full ? "w-full h-full" : "w-full h-full"
    )}>
        {user.stream && !user.isCamOff ? (
            <video
              autoPlay
              playsInline
              muted={user.isLocal}
              ref={videoRef}
              className="w-full h-full object-cover"
            />
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
             <Avatar className={cn(
                "w-24 h-24 md:w-48 md:h-48 border-4 border-background shadow-lg transition-all duration-200",
                user.isLocal && user.isMicOff === false && "ring-4 ring-offset-2 ring-offset-gray-800 ring-green-500"
              )} style={{
                  boxShadow: user.isLocal && user.isMicOff === false ? `0 0 0 ${4 + (user.volumeLevel || 0) * 12}px rgba(52, 211, 153, ${0.2 + (user.volumeLevel || 0) * 0.3})` : undefined
              }}>
                <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="user avatar" />
                <AvatarFallback className="text-4xl md:text-6xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
             </Avatar>
           </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
           {user.isMicOff ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400"/>}
           <span className="text-sm">{user.name}{user.isLocal ? " (You)" : ""}</span>
        </div>
        {user.isCamOff && <VideoOff className="h-5 w-5 absolute top-2 right-2 text-red-400 bg-black/50 p-1 rounded-full"/>}
        {user.isHandRaised && <Hand className="h-5 w-5 absolute top-2 left-2 text-yellow-400 bg-black/50 p-1 rounded-full" />}
    </div>
  );
}

const MeetingClient = ({ meetingId, userId, onUserJoined, onParticipantsChange, localStream, micOn, camOn, volumeLevel }: Props) => {
  const { user } = useAuth();
  const [remoteSocketIds, setRemoteSocketIds] = useState<string[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [liveParticipants, setLiveParticipants] = useState<Map<string, {name: string, photoURL?: string, isHandRaised?: boolean, isScreenSharing?: boolean}>>(new Map());

  // Firestore listener for participants
  useEffect(() => {
    if (!meetingId) return;
    const participantsCol = collection(db, "meetings", meetingId, "participants");
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      const newParticipants = new Map<string, {name: string, photoURL?: string, isHandRaised?: boolean, isScreenSharing?: boolean}>();
      snapshot.forEach(doc => {
        newParticipants.set(doc.id, doc.data() as {name: string, photoURL?: string, isHandRaised?: boolean, isScreenSharing?: boolean});
      });
      setLiveParticipants(newParticipants);
    });
    return () => unsubscribe();
  }, [meetingId]);

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
  useEffect(() => {
    if (localStream) {
      rtc.init(localStream);
    }
    return () => {
      rtc.leave();
    };
  }, [rtc, localStream]);
  
  const allParticipants: Participant[] = useMemo(() => {
    const localUserDetails = liveParticipants.get(userId);
    
    const self: Participant = { 
      id: userId, 
      name: localUserDetails?.name || user?.displayName || "You", 
      avatar: localUserDetails?.photoURL || user?.photoURL || undefined, 
      isCamOff: !camOn, 
      isMicOff: !micOn,
      isHandRaised: localUserDetails?.isHandRaised,
      isScreenSharing: localUserDetails?.isScreenSharing,
      isLocal: true,
      stream: localStream,
      volumeLevel: volumeLevel
    };

    const remotes: Participant[] = Array.from(liveParticipants.entries())
      .filter(([id]) => id !== userId)
      .map(([id, data]) => {
        const remoteStream = remoteStreams.get(id);
        const videoTracks = remoteStream?.getVideoTracks() || [];
        const audioTracks = remoteStream?.getAudioTracks() || [];
        return {
          id,
          name: data.name || `User ${id.substring(0, 4)}`,
          avatar: data.photoURL,
          isHandRaised: data.isHandRaised,
          isScreenSharing: data.isScreenSharing,
          isCamOff: data.isScreenSharing ? false : (videoTracks.length === 0 || !videoTracks.some(t => t.enabled && !t.muted)),
          isMicOff: audioTracks.length === 0 || audioTracks.every(t => !t.enabled),
          stream: remoteStream || null,
        };
      });

    return [self, ...remotes];
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevel]);


  useEffect(() => {
    onParticipantsChange(allParticipants);
  }, [allParticipants, onParticipantsChange]);

  const renderLayout = () => {
    const count = allParticipants.length;

    if (count === 0) {
      return <div className="text-muted-foreground">Initializing...</div>;
    }
    
    const activeScreenSharer = allParticipants.find(p => p.isScreenSharing);
    if (activeScreenSharer) {
      const otherParticipants = allParticipants.filter(p => p.id !== activeScreenSharer.id);
      return (
        <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2">
          <div className="flex-1 min-h-0">
            <VideoTile user={activeScreenSharer} full />
          </div>
          {otherParticipants.length > 0 && (
            <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">
              {otherParticipants.map(p => (
                <div key={p.id} className="md:h-32 aspect-video md:aspect-auto">
                   <VideoTile user={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (count === 1) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <VideoTile user={allParticipants[0]} full />
        </div>
      );
    }
  
    if (count === 2) {
      const remote = allParticipants.find((u) => !u.isLocal);
      const local = allParticipants.find((u) => u.isLocal);
      return (
        <div className="w-full h-full relative p-4">
          {remote && <VideoTile user={remote} full />}
          {local && 
            <div className="absolute bottom-6 right-6 w-48 h-32 z-20">
              <VideoTile user={local} />
            </div>
          }
        </div>
      );
    }

    if (count === 3) {
       const remotes = allParticipants.filter((u) => !u.isLocal);
       const local = allParticipants.find((u) => u.isLocal);
       return (
        <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2">
            <div className="flex-1">
                {remotes[0] && <VideoTile user={remotes[0]} full/>}
            </div>
            <div className="flex-1 flex flex-col gap-2">
                <div className="flex-1">
                    {remotes[1] && <VideoTile user={remotes[1]} full/>}
                </div>
                <div className="flex-1">
                    {local && <VideoTile user={local} full/>}
                </div>
            </div>
        </div>
      );
    }
  
    if (count === 4) {
      return (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-2">
          {allParticipants.map((u) => (
            <VideoTile key={u.id} user={u} />
          ))}
        </div>
      );
    }
  
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return (
      <div 
        className="w-full h-full grid gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {allParticipants.map((u) => (
          <VideoTile key={u.id} user={u} />
        ))}
      </div>
    );
  };

  return <div className="w-full h-full">{renderLayout()}</div>;
};

export default MeetingClient;
