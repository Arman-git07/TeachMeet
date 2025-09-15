
"use client";

import React, { useImperativeHandle, forwardRef, useMemo, useState, useEffect } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, VideoOff } from "lucide-react";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Participant = {
  id: string;
  name: string;
  avatar?: string;
  isCamOff: boolean;
  isMicOff: boolean;
};

type Props = { 
  meetingId: string; 
  userId: string;
  onMicToggle: (isOn: boolean) => void;
  onCamToggle: (isOn: boolean) => void;
  onUserJoined: (socketId: string) => void;
  onParticipantsChange: (participants: Participant[]) => void;
  onLocalStream: (stream: MediaStream) => void;
};

export interface MeetingClientRef {
  toggleMic: () => void;
  toggleCam: () => void;
}

const MeetingClient = forwardRef<MeetingClientRef, Props>(
  ({ meetingId, userId, onMicToggle, onCamToggle, onUserJoined, onParticipantsChange, onLocalStream }, ref) => {
  
  const { user } = useAuth();
  const [remoteSocketIds, setRemoteSocketIds] = useState<string[]>([]);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false); // Default to off
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const [liveParticipants, setLiveParticipants] = useState<Map<string, {name: string, photoURL?: string}>>(new Map());

  // Firestore listener for participants
  useEffect(() => {
    if (!meetingId) return;
    const participantsCol = collection(db, "meetings", meetingId, "participants");
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      const newParticipants = new Map<string, {name: string, photoURL?: string}>();
      snapshot.forEach(doc => {
        newParticipants.set(doc.id, doc.data() as {name: string, photoURL?: string});
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
    let mounted = true;
    (async () => {
      const desiredMicState = localStorage.getItem('teachmeet-desired-mic-state') !== 'off';
      const desiredCamState = localStorage.getItem('teachmeet-desired-camera-state') === 'on'; // Check if explicitly 'on'
      
      const localStream = await rtc.init(desiredMicState, desiredCamState);
      if (!mounted) return;
      
      setCamOn(rtc.isCamOn());
      onCamToggle(rtc.isCamOn());
      setMicOn(rtc.isMicOn());
      onMicToggle(rtc.isMicOn());
      
      if(localStream) {
        onLocalStream(localStream);
      }
    })();
    return () => {
      mounted = false;
      rtc.leave();
    };
  }, [rtc, onCamToggle, onMicToggle, onLocalStream]);
  
  useImperativeHandle(ref, () => ({
    toggleMic: () => {
      rtc.toggleMic();
      const newState = rtc.isMicOn();
      setMicOn(newState);
      onMicToggle(newState);
    },
    toggleCam: () => {
      rtc.toggleCam();
      const newState = rtc.isCamOn();
      setCamOn(newState);
      onCamToggle(newState);
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
  
  const allParticipants: Participant[] = useMemo(() => {
    const localUser = liveParticipants.get(userId);
    const self = { 
      id: userId, 
      name: localUser?.name || user?.displayName || "You", 
      avatar: localUser?.photoURL || user?.photoURL || undefined, 
      isCamOff: !camOn, 
      isMicOff: !micOn 
    };

    const remotes = Array.from(liveParticipants.entries())
      .filter(([id]) => id !== userId)
      .map(([id, data]) => ({
        id,
        name: data.name || `User ${id.substring(0, 4)}`,
        avatar: data.photoURL,
        // TODO: get real mic/cam state from liveParticipants data
        isCamOff: true, 
        isMicOff: true
      }));

    return [self, ...remotes];
  }, [user, camOn, micOn, liveParticipants, userId]);


  useEffect(() => {
    onParticipantsChange(allParticipants);
  }, [allParticipants, onParticipantsChange]);

  const LocalVideo = ({ stream }: { stream: MediaStream | undefined }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);
    return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
  };

  const ParticipantTile = ({ p }: { p: Participant }) => {
    const stream = p.id === userId ? rtc.getLocalStream() : remoteStreams.get(p.id);

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
          p.id === userId ? <LocalVideo stream={stream} /> : <RemoteVideo stream={stream} />
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
           {p.isMicOff ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400"/>}
           <span className="text-sm">{p.name}</span>
        </div>
        {p.isCamOff && <VideoOff className="h-5 w-5 absolute top-2 right-2 text-red-400 bg-black/50 p-1 rounded-full"/>}
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
  const mainParticipant = allParticipants.find(p => p.id !== userId) || allParticipants[0];

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
        {mainParticipant ? <ParticipantTile p={mainParticipant} /> :  <div className="text-muted-foreground">Waiting for participants...</div>}
    </div>
  );
});

MeetingClient.displayName = 'MeetingClient';
export default MeetingClient;
