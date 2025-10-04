
// src/app/dashboard/meeting/[meetingId]/MeetingClient.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2 } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  handRaisedAt?: number | null; // For sorting
  isLocal?: boolean;
  stream: MediaStream | null;
  isScreenSharing?: boolean;
  volumeLevel?: number;
};

type LiveParticipantInfo = {
    name: string;
    photoURL?: string;
    isHandRaised?: boolean;
    handRaisedAt?: number | null;
    isScreenSharing?: boolean;
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
  const [liveParticipants, setLiveParticipants] = useState<Map<string, LiveParticipantInfo>>(new Map());
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenShareConfirm, setShowScreenShareConfirm] = useState(false);
  
  const screenStreamRef = useRef<MediaStream | null>(null);

  // mic levels map (id -> level 0..1) stored in state but updated throttled
  const [volumeLevels, setVolumeLevels] = useState<Map<string, number>>(new Map());

  // Refs for analysers etc
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const localAnimationRef = useRef<number | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const remoteAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; rafId: number | null; dataArray: Uint8Array }>>(new Map());
  const lastRemoteUpdateRef = useRef<number>(0);

  // pin / fullscreen (app-level)
  const [pinnedId, setPinnedId] = useState<string | null>(null);

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
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close().catch(() => {});
      }
      remoteAnalysersRef.current.forEach(entry => {
        if (entry.rafId) cancelAnimationFrame(entry.rafId);
      });
      remoteAnalysersRef.current.clear();
    };
  }, [initialCamOn, initialMicOn, toast]);

  const previousRaisedHands = useRef<Set<string>>(new Set());
  const firstParticipantsSnapshot = useRef(true);

  useEffect(() => {
    if (!liveParticipants || liveParticipants.size === 0) return;

    if (firstParticipantsSnapshot.current) {
        const initial = new Set<string>();
        liveParticipants.forEach((meta, id) => {
        if (meta?.isHandRaised) initial.add(id);
        });
        previousRaisedHands.current = initial;
        firstParticipantsSnapshot.current = false;
        return;
    }

    liveParticipants.forEach((meta, id) => {
        const nowRaised = !!meta?.isHandRaised;
        const wasRaised = previousRaisedHands.current.has(id);

        if (nowRaised && !wasRaised) {
            toast({
                title: "Hand Raised",
                description: `${meta?.name || 'Someone'} raised their hand.`,
            });
        }
    });

    const nextSet = new Set<string>();
    liveParticipants.forEach((meta, id) => {
        if (meta?.isHandRaised) nextSet.add(id);
    });
    previousRaisedHands.current = nextSet;
  }, [liveParticipants, toast]);


  useEffect(() => {
    if (!meetingId) return;
    const participantsCol = collection(db, "meetings", meetingId, "participants");
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      const newParticipants = new Map<string, LiveParticipantInfo>();
      snapshot.forEach(doc => {
        newParticipants.set(doc.id, doc.data() as LiveParticipantInfo);
      });
      setLiveParticipants(newParticipants);
    });
    return () => unsubscribe();
  }, [meetingId]);

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
        const entry = remoteAnalysersRef.current.get(socketId);
        if (entry && entry.rafId) cancelAnimationFrame(entry.rafId);
        remoteAnalysersRef.current.delete(socketId);
        setVolumeLevels(prev => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
        setPinnedId(prev => prev === socketId ? null : prev);
      },
    });
  }, [meetingId, userId]);

  useEffect(() => {
    if (localStream && rtc) {
      rtc.init(localStream);
    }
    return () => rtc?.leave();
  }, [rtc, localStream]);

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

    if (!audioContextRef.current) {
        const audioContext = new AudioContext();
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 256;
        sourceRef.current = audioContext.createMediaStreamSource(localStream);
        sourceRef.current.connect(analyserRef.current);
        audioContextRef.current = audioContext;
    }

    const analyser = analyserRef.current!;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const step = (time: number) => {
      if (!analyserRef.current || !micOn) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;

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
    };
  }, [localStream, micOn, userId]);

  useEffect(() => {
    remoteStreams.forEach((stream, id) => {
      if (!stream || stream.getAudioTracks().length === 0) return;
      if (remoteAnalysersRef.current.has(id)) return;

      try {
        const audioCtx = audioContextRef.current;
        if (!audioCtx || audioCtx.state === 'closed') return;
        
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
          
          if (time - lastRemoteUpdateRef.current > 150) {
            setVolumeLevels(prev => {
              const next = new Map(prev);
              next.set(id, Math.min(1, avg / 255));
              return next;
            });
            lastRemoteUpdateRef.current = time;
          }
          entry.rafId = requestAnimationFrame(stepRemote);
        };
        entry.rafId = requestAnimationFrame(stepRemote);
      } catch (err) {
        console.error("Failed to create analyser for remote stream", id, err);
      }
    });

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
  }, [remoteStreams]);

  const { allParticipants, firstHandRaisedId, raisedCount } = useMemo(() => {
    const localUserDetails = liveParticipants.get(userId);
    const self: Participant = {
      id: userId,
      name: localUserDetails?.name || user?.displayName || "You",
      avatar: localUserDetails?.photoURL || user?.photoURL || `https://placehold.co/128x128.png?text=${(user?.displayName || 'Y').charAt(0)}`,
      isCamOff: !camOn,
      isMicOff: !micOn,
      isHandRaised: isHandRaised, // Use local state for local user
      handRaisedAt: localUserDetails?.handRaisedAt,
      isScreenSharing: isScreenSharing,
      isLocal: true,
      stream: isScreenSharing ? screenStreamRef.current : localStream,
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
          handRaisedAt: data.handRaisedAt,
          isScreenSharing: data.isScreenSharing,
          isCamOff: data.isScreenSharing ? false : (videoTracks.length === 0 || !videoTracks.some(t => t.enabled && !t.muted)),
          isMicOff: audioTracks.length === 0 || audioTracks.every(t => !t.enabled),
          stream: remoteStream,
          volumeLevel: volumeLevels.get(id) ?? 0,
        };
      });

    const all = [self, ...remotes];

    const firstHandRaised = all
      .filter(p => p.isHandRaised && p.handRaisedAt)
      .sort((a, b) => (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0))[0];
    
    const raisedCount = all.filter(p => p.isHandRaised).length;

    return { allParticipants: all, firstHandRaisedId: firstHandRaised?.id || null, raisedCount };
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevels, isHandRaised, isScreenSharing]);

  const updateMyStatus = useCallback(async (status: Partial<LiveParticipantInfo>) => {
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
  }, [localStream, updateMyStatus, camOn]);

  const handleToggleHandRaise = useCallback(() => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    updateMyStatus({ isHandRaised: next, handRaisedAt: next ? Date.now() : null });
  }, [isHandRaised, updateMyStatus]);
  
  const stopScreenShareAndRestoreCamera = useCallback(async () => {
    console.log("🔄 Restoring camera...");
    if (!localStream) {
        console.error("❌ Cannot restore camera, localStream is missing.");
        return;
    }
    const cameraTrack = localStream.getVideoTracks()[0];
    if (cameraTrack) {
        MeshRTC.getAllConnections().forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(cameraTrack).catch(e => console.error("Failed to restore camera track:", e));
          }
        });
        console.log("✅ Camera restored.");
    } else {
        console.error("❌ Failed to find camera track to restore.");
    }

    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    
    setIsScreenSharing(false);
    await updateMyStatus({ isScreenSharing: false });
  }, [localStream, updateMyStatus]);
  
  const startScreenShare = useCallback(async () => {
    setShowScreenShareConfirm(false); // Close dialog
    try {
      console.log("🔄 Requesting screen share...");
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: true,
      });
  
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error("No video track found from display media.");
  
      console.log("✅ Screen stream acquired.");
      screenStreamRef.current = screenStream;
  
      MeshRTC.getAllConnections().forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
          console.log("📺 Replaced video track with screen track for a peer.");
        }
      });
  
      screenTrack.onended = async () => {
        console.log("📴 Screen share stopped by user (via browser UI).");
        await stopScreenShareAndRestoreCamera();
      };
      
      setIsScreenSharing(true);
      await updateMyStatus({ isScreenSharing: true });
      console.log("✅ Screen sharing started.");
  
    } catch (err: any) {
      console.error("❌ Screen share failed:", err);
      toast({ variant: 'destructive', title: "Screen Share Failed", description: "Please ensure you've granted permission and try again."});
    }
  }, [stopScreenShareAndRestoreCamera, updateMyStatus, toast]);

  // toggle pin / fullscreen for a participant (app-level pin)
  const togglePin = useCallback((id: string) => {
    setPinnedId(prev => prev === id ? null : prev);
  }, []);

  const renderLayout = () => {
    const count = allParticipants.length;

    // pinned view
    if (pinnedId) {
      const pinned = allParticipants.find(p => p.id === pinnedId);
      const others = allParticipants.filter(p => p.id !== pinnedId);
      return (
        <div className="w-full h-full flex gap-2 p-0">
          <div className="flex-1 min-h-0 relative">
            {pinned && (
              <div className="w-full h-full relative">
                <VideoTile
                  stream={pinned.stream}
                  isCameraOn={!pinned.isCamOff}
                  isMicOn={!pinned.isMicOff}
                  isHandRaised={pinned.isHandRaised || false}
                  isFirstHand={pinned.id === firstHandRaisedId}
                  raisedCount={raisedCount}
                  volumeLevel={pinned.volumeLevel}
                  isLocal={!!pinned.isLocal}
                  profileUrl={pinned.avatar}
                  name={pinned.name}
                  isScreenSharing={pinned.isScreenSharing}
                  isPinned={true}
                  onTogglePin={() => togglePin(pinned.id)}
                  onDoubleClick={() => togglePin(pinned.id)}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          {/* thumbnails column */}
          {others.length > 0 && (
            <div className="w-48 hidden md:flex md:flex-col gap-2 overflow-auto">
              {others.map(p => (
                <div key={p.id} className="h-28 rounded-lg">
                  <VideoTile
                    stream={p.stream}
                    isCameraOn={!p.isCamOff}
                    isMicOn={!p.isMicOff}
                    isHandRaised={p.isHandRaised || false}
                    isFirstHand={p.id === firstHandRaisedId}
                    raisedCount={raisedCount}
                    volumeLevel={p.volumeLevel}
                    isLocal={!!p.isLocal}
                    profileUrl={p.avatar}
                    name={p.name}
                    isScreenSharing={p.isScreenSharing}
                    onTogglePin={() => togglePin(p.id)}
                    onDoubleClick={() => togglePin(p.id)}
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    const activeScreenSharer = allParticipants.find(p => p.isScreenSharing);
    if (activeScreenSharer) {
      const otherParticipants = allParticipants.filter(p => p.id !== activeScreenSharer.id);
      return (
        <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2">
          <div className="flex-1 min-h-0">
             <div className="w-full h-full relative">
               <VideoTile
                  stream={activeScreenSharer.stream}
                  isCameraOn={!activeScreenSharer.isCamOff}
                  isMicOn={!activeScreenSharer.isMicOff}
                  isHandRaised={activeScreenSharer.isHandRaised || false}
                  isFirstHand={activeScreenSharer.id === firstHandRaisedId}
                  raisedCount={raisedCount}
                  volumeLevel={activeScreenSharer.volumeLevel}
                  isLocal={!!activeScreenSharer.isLocal}
                  profileUrl={activeScreenSharer.avatar}
                  name={activeScreenSharer.name}
                  isScreenSharing={activeScreenSharer.isScreenSharing}
                  onTogglePin={() => togglePin(activeScreenSharer.id)}
                  onDoubleClick={() => togglePin(activeScreenSharer.id)}
                  className="w-full h-full"
                />
             </div>
          </div>
          {otherParticipants.length > 0 && (
            <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">
              {otherParticipants.map(p => (
                <div key={p.id} className="md:h-32 aspect-video md:aspect-auto">
                   <VideoTile
                      stream={p.stream}
                      isCameraOn={!p.isCamOff}
                      isMicOn={!p.isMicOff}
                      isHandRaised={p.isHandRaised || false}
                      isFirstHand={p.id === firstHandRaisedId}
                      raisedCount={raisedCount}
                      volumeLevel={p.volumeLevel}
                      isLocal={!!p.isLocal}
                      profileUrl={p.avatar}
                      name={p.name}
                      isScreenSharing={p.isScreenSharing}
                      onTogglePin={() => togglePin(p.id)}
                      onDoubleClick={() => togglePin(p.id)}
                    />
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
        <div className="w-full h-full p-0">
          <VideoTile
            stream={p.stream}
            isCameraOn={!p.isCamOff}
            isMicOn={!p.isMicOff}
            isHandRaised={p.isHandRaised || false}
            isFirstHand={p.id === firstHandRaisedId}
            raisedCount={raisedCount}
            volumeLevel={p.volumeLevel}
            isLocal={!!p.isLocal}
            profileUrl={p.avatar}
            name={p.name}
            isScreenSharing={p.isScreenSharing}
            onTogglePin={count > 1 ? () => togglePin(p.id) : undefined}
            onDoubleClick={count > 1 ? () => togglePin(p.id) : undefined}
            className="w-full h-full"
          />
        </div>
      );
    }

    if (count === 2) {
      const remote = allParticipants.find((u) => !u.isLocal);
      const local = allParticipants.find((u) => u.isLocal);
      return (
        <div className="w-full h-full relative p-0">
          {remote && 
            <div className="w-full h-full relative">
              <VideoTile
                stream={remote.stream}
                isCameraOn={!remote.isCamOff}
                isMicOn={!remote.isMicOff}
                isHandRaised={remote.isHandRaised || false}
                isFirstHand={remote.id === firstHandRaisedId}
                raisedCount={raisedCount}
                volumeLevel={remote.volumeLevel}
                isLocal={!!remote.isLocal}
                profileUrl={remote.avatar}
                name={remote.name}
                isScreenSharing={remote.isScreenSharing}
                onTogglePin={() => togglePin(remote.id)}
                onDoubleClick={() => togglePin(remote.id)}
                className="w-full h-full"
              />
            </div>
          }
          {local && 
            <div className="absolute bottom-6 right-6 w-48 h-32 z-50 shadow-lg">
              <VideoTile
                stream={local.stream}
                isCameraOn={!local.isCamOff}
                isMicOn={!local.isMicOff}
                isHandRaised={local.isHandRaised || false}
                isFirstHand={local.id === firstHandRaisedId}
                raisedCount={raisedCount}
                volumeLevel={local.volumeLevel}
                isLocal={!!local.isLocal}
                profileUrl={local.avatar}
                name={local.name}
                isScreenSharing={local.isScreenSharing}
                onTogglePin={() => togglePin(local.id)}
                onDoubleClick={() => togglePin(local.id)}
                draggable={true}
              />
            </div>
          }
        </div>
      );
    }

    const cols = Math.ceil(Math.sqrt(count));
    return (
      <div
        className="w-full h-full grid gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        }}
      >
        {allParticipants.map((p) => (
          <div key={p.id} className="w-full h-full rounded-lg relative aspect-video">
            <VideoTile
              stream={p.stream}
              isCameraOn={!p.isCamOff}
              isMicOn={!p.isMicOff}
              isHandRaised={p.isHandRaised || false}
              isFirstHand={p.id === firstHandRaisedId}
              raisedCount={raisedCount}
              volumeLevel={p.volumeLevel}
              isLocal={!!p.isLocal}
              profileUrl={p.avatar}
              name={p.name}
              isScreenSharing={p.isScreenSharing}
              onTogglePin={() => togglePin(p.id)}
              onDoubleClick={() => togglePin(p.id)}
            />
          </div>
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
                      onClick={() => { isScreenSharing ? stopScreenShareAndRestoreCamera() : setShowScreenShareConfirm(true) }}
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
                    <AlertDialogAction onClick={startScreenShare}>Share Screen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={handleToggleHandRaise}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-colors text-white",
                isHandRaised
                  ? "bg-[hsl(98,60%,50%)] hover:bg-[hsl(98,60%,45%)]" // Green when raised
                  : "bg-secondary/50 hover:bg-secondary/70"
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
