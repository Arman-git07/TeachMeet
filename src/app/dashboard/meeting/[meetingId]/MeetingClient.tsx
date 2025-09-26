
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2 } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  initialCamOn: boolean;
  initialMicOn: boolean;
  onLeave: () => void;
};

const VideoTile = ({ user }: { user: Participant; }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && user.stream) {
      if (videoRef.current.srcObject !== user.stream) {
        videoRef.current.srcObject = user.stream;
      }
    }
  }, [user.stream]);

  const showVideo = user.stream && !user.isCamOff;

  return (
    <div className={cn(
        "bg-gray-800 flex items-center justify-center relative rounded-lg overflow-hidden w-full h-full"
    )}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={user.isLocal}
          className="w-full h-full object-cover"
          onLoadedMetadata={() => videoRef.current?.play().catch(e => console.error("Video play error:", e))}
        />
      ) : (
        <div className="flex flex-col items-center text-muted-foreground">
          <Avatar className={cn(
            "w-24 h-24 md:w-48 md:h-48 border-4 border-background shadow-lg transition-all duration-200",
            user.isLocal && !user.isMicOff && "ring-4 ring-offset-2 ring-offset-gray-800 ring-green-500"
          )} style={{
              boxShadow: user.isLocal && !user.isMicOff && (user.volumeLevel || 0) > 0.01 ? `0 0 0 ${4 + (user.volumeLevel || 0) * 12}px rgba(52, 211, 153, ${0.2 + (user.volumeLevel || 0) * 0.3})` : undefined
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
      {user.isCamOff && !user.isScreenSharing && <VideoOff className="h-5 w-5 absolute top-2 right-2 text-red-400 bg-black/50 p-1 rounded-full"/>}
      {user.isHandRaised && <Hand className="h-5 w-5 absolute top-2 left-2 text-yellow-400 bg-black/50 p-1 rounded-full" />}
    </div>
  );
}

const MeetingClient = ({ meetingId, userId, initialCamOn, initialMicOn, onLeave }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Media State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(initialCamOn);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [loadingMedia, setLoadingMedia] = useState(true);

  // Meeting State
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [liveParticipants, setLiveParticipants] = useState<Map<string, {name: string, photoURL?: string, isHandRaised?: boolean, isScreenSharing?: boolean}>>(new Map());
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Initialize media ONCE
  useEffect(() => {
    let stream: MediaStream | null = null;
    let mounted = true;

    const initMedia = async () => {
      setLoadingMedia(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        
        if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        stream.getVideoTracks().forEach(track => { track.enabled = initialCamOn; });
        stream.getAudioTracks().forEach(track => { track.enabled = initialMicOn; });

        setLocalStream(stream);
        setCamOn(initialCamOn);
        setMicOn(initialMicOn);

      } catch (err) {
        console.error("Media init error:", err);
        toast({ variant: "destructive", title: "Media Error", description: "Could not access camera or microphone." });
      } finally {
        if(mounted) setLoadingMedia(false);
      }
    };
    
    initMedia();

    return () => {
      mounted = false;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [initialCamOn, initialMicOn, toast]);

  // Volume Meter Logic
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0 || !micOn) {
      if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setVolumeLevel(0);
      return;
    };

    if (!audioContextRef.current) {
        try {
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(localStream);
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceRef.current = source;
        } catch (err) {
            console.error("Failed to initialize audio context for volume meter", err);
            return;
        }
    }
    
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      if (!analyserRef.current || !micOn) {
          setVolumeLevel(0);
          if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          return;
      };
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      setVolumeLevel(avg / 255); // normalize 0-1
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();
    
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [localStream, micOn]);

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
    onRemoteStream: (socketId, stream) => setRemoteStreams(prev => new Map(prev).set(socketId, stream)),
    onRemoteLeft: (socketId) => setRemoteStreams(prev => { const newMap = new Map(prev); newMap.delete(socketId); return newMap; }),
  }), [meetingId, userId]);

  useEffect(() => {
    if (localStream) {
      rtc.init(localStream);
    }
    return () => rtc.leave();
  }, [rtc, localStream]);
  
  const allParticipants: Participant[] = useMemo(() => {
    const localUserDetails = liveParticipants.get(userId);
    const self: Participant = { 
      id: userId, 
      name: localUserDetails?.name || user?.displayName || "You", 
      avatar: localUserDetails?.photoURL || user?.photoURL || `https://placehold.co/128x128.png?text=${(user?.displayName || 'Y').charAt(0)}`,
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
          avatar: data.photoURL || `https://placehold.co/128x128.png?text=${(data.name || 'G').charAt(0)}`,
          isHandRaised: data.isHandRaised,
          isScreenSharing: data.isScreenSharing,
          isCamOff: data.isScreenSharing ? false : (videoTracks.length === 0 || !videoTracks.some(t => t.enabled && !t.muted)),
          isMicOff: audioTracks.length === 0 || audioTracks.every(t => !t.enabled),
          stream: remoteStream || null,
        };
      });

    return [self, ...remotes];
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevel]);

  const updateMyStatus = async (status: Partial<{ isMicOn: boolean; isCameraOn: boolean; isHandRaised: boolean; isScreenSharing: boolean }>) => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try { await updateDoc(participantRef, status); } catch (err) { console.error("Error updating participant status:", err); }
    }
  };
  
  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const nextState = !micOn;
    localStream.getAudioTracks().forEach(track => (track.enabled = nextState));
    setMicOn(nextState);
    updateMyStatus({ isMicOn: nextState });
  }, [localStream, micOn, updateMyStatus]);

  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    const nextState = !camOn;
    videoTracks.forEach(track => (track.enabled = nextState));
    setCamOn(nextState);
    updateMyStatus({ isCameraOn: nextState });
  };

  const handleToggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    updateMyStatus({ isHandRaised: next });
  };
  
  const handleScreenShare = async () => {
    setShowScreenShareConfirm(false);
    if (!localStream) return;
    const peerConnections: RTCPeerConnection[] = (window as any).__PEER_CONNECTIONS__ || [];

    if (isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        
        const cameraTrack = localStream.getVideoTracks().find(t => t.kind === 'video' && !t.label.includes('screen'));
        if (cameraTrack) {
             peerConnections.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(cameraTrack);
            });
        }
        
        setIsScreenSharing(false);
        await updateMyStatus({ isScreenSharing: false });
        return;
    }

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => handleScreenShare();
        
        peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
            else pc.addTrack(screenTrack, screenStream);
        });
        
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        await updateMyStatus({ isScreenSharing: true });

    } catch (err) {
        console.error("Screen share error:", err);
        toast({ variant: 'destructive', title: 'Screen Share Failed' });
    }
  };

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
            <VideoTile user={activeScreenSharer} />
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
          <VideoTile user={allParticipants[0]} />
        </div>
      );
    }
  
    if (count === 2) {
      const remote = allParticipants.find((u) => !u.isLocal);
      const local = allParticipants.find((u) => u.isLocal);
      return (
        <div className="w-full h-full relative p-4">
          {remote && <VideoTile user={remote} />}
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
                {remotes[0] && <VideoTile user={remotes[0]} />}
            </div>
            <div className="flex-1 flex flex-col gap-2">
                <div className="flex-1">
                    {remotes[1] && <VideoTile user={remotes[1]} />}
                </div>
                <div className="flex-1">
                    {local && <VideoTile user={local} />}
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

  return (
    <>
      {loadingMedia ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        renderLayout()
      )}
      <div className="flex-none p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
        <div className="flex items-center justify-center relative">
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={toggleMic}
              className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors", 
                micOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
              )}
              aria-label={micOn ? "Mute" : "Unmute"}
            >
              {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>
            <Button
              onClick={toggleCamera}
              className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                camOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
              )}
              aria-label={camOn ? "Stop Camera" : "Start Camera"}
            >
              {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
            <AlertDialog open={showScreenShareConfirm} onOpenChange={setShowScreenShareConfirm}>
               <AlertDialogTrigger asChild>
                   <Button
                      onClick={() => { isScreenSharing ? handleScreenShare() : setShowScreenShareConfirm(true) }}
                      variant="ghost"
                      className={cn(
                        "h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                        isScreenSharing ? "bg-green-600 text-white hover:bg-green-700" : "bg-secondary/50 hover:bg-secondary/70 text-white"
                      )}
                      aria-label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                    >
                       {isScreenSharing ? <ScreenShareOff className="h-6 w-6" /> : <ScreenShare className="h-6 w-6" />}
                    </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Share Your Screen?</AlertDialogTitle>
                    <AlertDialogDescription>This will allow everyone in the meeting to see your screen.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleScreenShare}>Share Screen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button
              onClick={handleToggleHandRaise}
              className={cn("h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                isHandRaised ? "bg-yellow-500 hover:bg-yellow-600" : "bg-secondary/50 hover:bg-secondary/70 text-white"
              )}
              aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
            >
              <Hand className="h-6 w-6" />
            </Button>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <Button
              onClick={onLeave}
              className="h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors px-6"
              aria-label="Leave Meeting"
            >
              <PhoneOff className="h-6 w-6" />
              <span className="ml-2 font-semibold hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MeetingClient;
