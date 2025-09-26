"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2 } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import VideoTile from "./VideoTile";

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

export default function MeetingClient({ meetingId, userId, initialCamOn, initialMicOn, onLeave }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(initialCamOn);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [loadingMedia, setLoadingMedia] = useState(true);

  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [liveParticipants, setLiveParticipants] = useState<Map<string, {name: string, photoURL?: string, isHandRaised?: boolean, isScreenSharing?: boolean}>>(new Map());
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // mic levels map (id -> level 0..1) stored in state but updated throttled
  const [volumeLevels, setVolumeLevels] = useState<Map<string, number>>(new Map());

  // Refs for local analyser
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const localAnimationRef = useRef<number | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);

  // Refs for remote analysers: map socketId -> { analyser, rafId, dataArray }
  const remoteAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; rafId: number | null; dataArray: Uint8Array }>>(new Map());
  const lastRemoteUpdateRef = useRef<number>(0);

  // Initialize local media once (MeetingClient manages its own stream)
  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    const initMedia = async () => {
      setLoadingMedia(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        if (mounted) setLoadingMedia(false);
      }
    };

    initMedia();

    return () => {
      mounted = false;
      stream?.getTracks().forEach(t => t.stop());
      // cleanup analysers if any
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      audioContextRef.current?.close().catch(() => {});
      remoteAnalysersRef.current.forEach(entry => {
        if (entry.rafId) cancelAnimationFrame(entry.rafId);
      });
      remoteAnalysersRef.current.clear();
    };
    // run once on mount
  }, []); // eslint-disable-line

  // Listen participants collection for metadata
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

  // MeshRTC instance (memoized)
  const rtc = useMemo(() => {
    if (!userId || !meetingId) return null;
    return new MeshRTC({
      roomId: meetingId,
      userId,
      onRemoteStream: (socketId, stream) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(socketId, stream);
          return next;
        });
      },
      onRemoteLeft: (socketId) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
        // cleanup analyser for that socket
        const entry = remoteAnalysersRef.current.get(socketId);
        if (entry && entry.rafId) cancelAnimationFrame(entry.rafId);
        remoteAnalysersRef.current.delete(socketId);
        setVolumeLevels(prev => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
      },
    });
  }, [meetingId, userId]);

  // Initialize rtc with localStream when available and cleanup on unmount
  useEffect(() => {
    if (localStream && rtc) {
      rtc.init(localStream);
    }
    return () => rtc?.leave();
  }, [rtc, localStream]);

  // Local analyser: throttle updates to ~150ms to avoid re-render storms
  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0 || !micOn) {
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      setVolumeLevels(prev => {
        const next = new Map(prev);
        next.set(userId, 0);
        return next;
      });
      return;
    }

    // create AudioContext/analyser once
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
        console.error("Failed to init local audio analyser:", err);
        return;
      }
    }

    const analyser = analyserRef.current!;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const step = (time: number) => {
      if (!analyserRef.current || !micOn) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      // throttle to ~150ms
      if (time - lastLocalUpdateRef.current > 150) {
        setVolumeLevels(prev => {
          const next = new Map(prev);
          next.set(userId, Math.min(1, avg / 255));
          return next;
        });
        lastLocalUpdateRef.current = time;
      }
      localAnimationRef.current = requestAnimationFrame(step);
    };

    localAnimationRef.current = requestAnimationFrame(step);

    return () => {
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      // keep audioContext alive to avoid re-creation cost (closed on unmount)
    };
  }, [localStream, micOn, userId]);

  // Remote analysers: create analyser for each incoming remote stream and sample their audio levels throttled
  useEffect(() => {
    // For each remote stream in remoteStreams, ensure an analyser exists
    remoteStreams.forEach((stream, id) => {
      if (!stream) return;
      if (remoteAnalysersRef.current.has(id)) return; // already created

      try {
        const audioCtx = audioContextRef.current || new AudioContext();
        if (!audioContextRef.current) audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const entry = { analyser, rafId: null as number | null, dataArray };
        remoteAnalysersRef.current.set(id, entry);

        const stepRemote = (time: number) => {
          const ent = remoteAnalysersRef.current.get(id);
          if (!ent || !ent.analyser) return;
          ent.analyser.getByteFrequencyData(ent.dataArray);
          let sum = 0;
          for (let i = 0; i < ent.dataArray.length; i++) sum += ent.dataArray[i];
          const avg = sum / ent.dataArray.length;
          // throttle global remote updates to ~150ms
          if (time - lastRemoteUpdateRef.current > 150) {
            setVolumeLevels(prev => {
              const next = new Map(prev);
              next.set(id, Math.min(1, avg / 255));
              return next;
            });
            lastRemoteUpdateRef.current = time;
          }
          const raf = requestAnimationFrame(stepRemote);
          const ent2 = remoteAnalysersRef.current.get(id);
          if (ent2) ent2.rafId = raf;
        };

        // start sampling
        entry.rafId = requestAnimationFrame(stepRemote);

      } catch (err) {
        console.error("Failed to create analyser for remote stream", id, err);
      }
    });

    // Clean up analysers for removed streams
    const existingIds = Array.from(remoteAnalysersRef.current.keys());
    existingIds.forEach(id => {
      if (!remoteStreams.has(id)) {
        const ent = remoteAnalysersRef.current.get(id);
        if (ent && ent.rafId) cancelAnimationFrame(ent.rafId);
        remoteAnalysersRef.current.delete(id);
        setVolumeLevels(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStreams]);

  // Build stable participants array for rendering (memoized)
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
      volumeLevel: volumeLevels.get(userId) ?? 0
    };

    const remotes: Participant[] = Array.from(liveParticipants.entries())
      .filter(([id]) => id !== userId)
      .map(([id, data]) => {
        const remoteStream = remoteStreams.get(id) || null;
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
          stream: remoteStream,
          volumeLevel: volumeLevels.get(id) ?? 0,
        };
      });

    return [self, ...remotes];
    // include volumeLevels since we want tiles to update with levels; throttled earlier
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevels]);

  const updateMyStatus = useCallback(async (status: Partial<{ isMicOn: boolean; isCameraOn: boolean; isHandRaised: boolean; isScreenSharing: boolean }>) => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try { await updateDoc(participantRef, status); } catch (err) { console.error("Error updating participant status:", err); }
    }
  }, [user, meetingId]);

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const nextState = !micOn;
    localStream.getAudioTracks().forEach(track => (track.enabled = nextState));
    setMicOn(nextState);
    updateMyStatus({ isMicOn: nextState });
    // ensure local level updates immediately when muted/unmuted
    setVolumeLevels(prev => {
      const next = new Map(prev);
      next.set(userId, nextState ? (next.get(userId) ?? 0) : 0);
      return next;
    });
  }, [localStream, micOn, updateMyStatus, userId]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setCamOn(nextState);
        updateMyStatus({ isCameraOn: nextState });
    }
  }, [localStream, updateMyStatus]);

  const handleToggleHandRaise = useCallback(() => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    updateMyStatus({ isHandRaised: next });
  }, [isHandRaised, updateMyStatus]);

  const handleScreenShare = useCallback(async () => {
    setShowScreenShareConfirm(false);
    if (!localStream || !rtc) return;

    if (isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        const cameraTrack = localStream.getVideoTracks().find(t => t.kind === 'video');
        if (cameraTrack) rtc.replaceTrack(cameraTrack);
        setIsScreenSharing(false);
        await updateMyStatus({ isScreenSharing: false });
        return;
    }

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error("No screen track found");
        screenTrack.onended = () => { if (isScreenSharing) handleScreenShare(); };
        rtc.replaceTrack(screenTrack);
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        await updateMyStatus({ isScreenSharing: true });
    } catch (err) {
        console.error("Screen share error:", err);
        toast({ variant: 'destructive', title: 'Screen Share Failed' });
    }
  }, [localStream, rtc, isScreenSharing, updateMyStatus, toast]);

  // Helper render for overlay UI on top of each tile (name, mic, cam, hand, volume)
  const TileWithOverlay = ({ p }: { p: Participant }) => {
    return (
      <div className="relative w-full h-full">
        <VideoTile
          stream={p.stream}
          isCameraOn={!p.isCamOff}
          isMicOn={!p.isMicOff}
          isHandRaised={p.isHandRaised}
          volumeLevel={p.volumeLevel}
          isLocal={!!p.isLocal}
          profileUrl={p.avatar}
          className="w-full h-full rounded-lg"
        />

        {/* Overlay: always positioned over tile */}
        <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-black/40 px-2 py-1 rounded-md text-white">
          <span className="text-sm font-medium">{p.name}</span>
          {p.isMicOff ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400" />}
          {p.isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
        </div>
      </div>
    );
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
             <div className="w-full h-full rounded-lg relative">
               <TileWithOverlay p={activeScreenSharer} />
             </div>
          </div>
          {otherParticipants.length > 0 && (
            <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">
              {otherParticipants.map(p => (
                <div key={p.id} className="md:h-32 aspect-video md:aspect-auto">
                   <TileWithOverlay p={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (count === 1) {
      const p = allParticipants[0];
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="w-full h-full rounded-lg relative"><TileWithOverlay p={p} /></div>
        </div>
      );
    }
  
    if (count === 2) {
      const remote = allParticipants.find((u) => !u.isLocal);
      const local = allParticipants.find((u) => u.isLocal);
      return (
        <div className="w-full h-full relative p-4">
          {remote && <div className="w-full h-full rounded-lg relative"><TileWithOverlay p={remote} /></div>}
          {local && 
            <div className="absolute bottom-6 right-6 w-48 h-32 z-20"><TileWithOverlay p={local} /></div>
          }
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
        {allParticipants.map((p) => (
          <div key={p.id} className="w-full h-full rounded-lg relative"><TileWithOverlay p={p} /></div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-grow min-h-0">
        {loadingMedia ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          renderLayout()
        )}
      </div>
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
    </div>
  );
}
