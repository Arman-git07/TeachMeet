
// src/app/dashboard/meeting/[meetingId]/MeetingClient.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2, Check, X } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc, getDoc, query, writeBatch, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import VideoTile from "./VideoTile";
import { ScreenShareHelper, type ShareMode } from "@/lib/webrtc/screenShare";
import { ScreenShareModal } from "@/components/modals/ScreenShareModal";
import HostJoinRequestNotification from "@/components/meeting/HostJoinRequestNotification";
import type { JoinRequest } from '@/app/dashboard/classrooms/[classroomId]/page';


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
    isHost?: boolean;
};

type RemoteScreen = {
  peerId: string;
  stream: MediaStream;
}

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
  
  // Screen Share State
  const [isScreenShareModalOpen, setIsScreenShareModalOpen] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  
  const [remoteScreenTiles, setRemoteScreenTiles] = useState<RemoteScreen[]>([]);
  
  const [isHost, setIsHost] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  const [volumeLevels, setVolumeLevels] = useState<Map<string, number>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const localAnimationRef = useRef<number | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const remoteAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; rafId: number | null; dataArray: Uint8Array }>>(new Map());
  const lastRemoteUpdateRef = useRef<number>(0);

  const [pinnedId, setPinnedId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMeetingCreator = async () => {
      setIsLoadingRole(true);
      const meetingDoc = await getDoc(doc(db, "meetings", meetingId));
      if (meetingDoc.exists()) {
        const hostId = meetingDoc.data().hostId; // Use hostId
        setIsHost(userId === hostId);
      }
      setIsLoadingRole(false);
    };
    fetchMeetingCreator();
  }, [meetingId, userId]);

  const rtc = useMemo(() => {
    if (!userId || !meetingId || !user?.displayName) return null;
    return new MeshRTC({
      roomId: meetingId,
      userId,
      userName: user.displayName, // Pass user name for auth
      onRemoteStream: (remoteSocketId, stream) => {
        if(stream.getVideoTracks().some(t => t.label.includes('screen'))) {
           setRemoteScreenTiles(prev => [...prev, { peerId: remoteSocketId, stream }]);
        } else {
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.set(remoteSocketId, stream);
            return next;
          });
        }
      },
      onRemoteLeft: (socketId) => {
        setRemoteStreams(prev => { const next = new Map(prev); next.delete(socketId); return next; });
        setRemoteScreenTiles(prev => prev.filter(t => t.peerId !== socketId));
        const entry = remoteAnalysersRef.current.get(socketId);
        if (entry && entry.rafId) cancelAnimationFrame(entry.rafId);
        remoteAnalysersRef.current.delete(socketId);
        setVolumeLevels(prev => { const next = new Map(prev); next.delete(socketId); return next; });
        setPinnedId(prev => prev === socketId ? null : prev);
      },
    });
  }, [meetingId, userId, user?.displayName]);

  const screenShareHelper = useMemo(() => {
    if (!rtc) return null;
    return new ScreenShareHelper(rtc);
  }, [rtc]);
  
  useEffect(() => {
    if (!screenShareHelper) return;
    const off = screenShareHelper.onStop(() => setIsSharingScreen(false));
    return () => off();
  }, [screenShareHelper]);

  const handleShareClick = () => { setIsScreenShareModalOpen(true); };

  const onModalConfirm = async (mode: ShareMode) => {
    setIsScreenShareModalOpen(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      alert("Your browser does not support screen sharing or this is not a secure context (HTTPS).");
      return;
    }
    if (!screenShareHelper) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      await screenShareHelper.startSharingWithStream(mode, stream);
      setIsSharingScreen(true);
    } catch (err) {
      console.error("Screen share cancelled or failed:", err);
      toast({ variant: "destructive", title: "Screen Share Failed", description: "Could not start screen sharing. Please grant permission and try again."});
      setIsSharingScreen(false);
    }
  };
  
  const handleStopSharing = async () => { await screenShareHelper?.stopSharing(); setIsSharingScreen(false); };

  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;
    const initMedia = async () => {
      setLoadingMedia(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getVideoTracks().forEach(track => { track.enabled = initialCamOn; });
        stream.getAudioTracks().forEach(track => { track.enabled = initialMicOn; });
        setLocalStream(stream); setCamOn(initialCamOn); setMicOn(initialMicOn);
      } catch (err) { console.error("Media init error:", err); toast({ variant: "destructive", title: "Media Error" }); } 
      finally { if (mounted) setLoadingMedia(false); }
    };
    initMedia();
    return () => {
      mounted = false;
      stream?.getTracks().forEach(t => t.stop());
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      audioContextRef.current?.close().catch(() => {});
      remoteAnalysersRef.current.forEach(entry => { if (entry.rafId) cancelAnimationFrame(entry.rafId); });
      remoteAnalysersRef.current.clear();
      screenShareHelper?.stopSharing();
    };
  }, [initialCamOn, initialMicOn, toast, screenShareHelper]);

  const previousRaisedHands = useRef<Set<string>>(new Set());
  const firstParticipantsSnapshot = useRef(true);

  useEffect(() => {
    if (!liveParticipants || liveParticipants.size === 0) return;
    if (firstParticipantsSnapshot.current) {
        const initial = new Set<string>();
        liveParticipants.forEach((meta, id) => { if (meta?.isHandRaised) initial.add(id); });
        previousRaisedHands.current = initial;
        firstParticipantsSnapshot.current = false;
        return;
    }
    liveParticipants.forEach((meta, id) => {
        const nowRaised = !!meta?.isHandRaised;
        const wasRaised = previousRaisedHands.current.has(id);
        if (nowRaised && !wasRaised) { toast({ title: "Hand Raised", description: `${meta?.name || 'Someone'} raised their hand.` }); }
    });
    const nextSet = new Set<string>();
    liveParticipants.forEach((meta, id) => { if (meta?.isHandRaised) nextSet.add(id); });
    previousRaisedHands.current = nextSet;
  }, [liveParticipants, toast]);

  useEffect(() => {
    if (!meetingId) return;
    const participantsCol = collection(db, "meetings", meetingId, "participants");
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      const newParticipants = new Map<string, LiveParticipantInfo>();
      snapshot.forEach(doc => { newParticipants.set(doc.id, doc.data() as LiveParticipantInfo); });
      setLiveParticipants(newParticipants);
    });
    return () => unsubscribe();
  }, [meetingId]);

  useEffect(() => { if (localStream && rtc) { rtc.init(localStream); } return () => rtc?.leave(); }, [rtc, localStream]);

  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0 || !micOn) {
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      setVolumeLevels(prev => { const next = new Map(prev); next.set(userId, 0); return next; });
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
        setVolumeLevels(prev => { const next = new Map(prev); next.set(userId, Math.min(1, avg / 255)); return next; });
        lastLocalUpdateRef.current = time;
      }
      localAnimationRef.current = requestAnimationFrame(step);
    };
    localAnimationRef.current = requestAnimationFrame(step);
    return () => { if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current); };
  }, [localStream, micOn, userId]);

  useEffect(() => {
    remoteStreams.forEach((stream, id) => {
      if (!stream || stream.getAudioTracks().length === 0 || remoteAnalysersRef.current.has(id)) return;
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
            setVolumeLevels(prev => { const next = new Map(prev); next.set(id, Math.min(1, avg / 255)); return next; });
            lastRemoteUpdateRef.current = time;
          }
          entry.rafId = requestAnimationFrame(stepRemote);
        };
        entry.rafId = requestAnimationFrame(stepRemote);
      } catch (err) { console.error("Failed to create analyser for remote stream", id, err); }
    });
    const existingIds = Array.from(remoteAnalysersRef.current.keys());
    existingIds.forEach(id => {
      if (!remoteStreams.has(id)) {
        const ent = remoteAnalysersRef.current.get(id);
        if (ent && ent.rafId) cancelAnimationFrame(ent.rafId);
        remoteAnalysersRef.current.delete(id);
        setVolumeLevels(prev => { const next = new Map(prev); next.delete(id); return next; });
      }
    });
  }, [remoteStreams]);

  useEffect(() => {
    if (!rtc?.socket) return;
    const handleStarted = ({ userId: sharerId }: { userId: string }) => {};
    const handleStopped = ({ userId: sharerId }: { userId: string }) => {};
    rtc.socket.on("screen-share-started", handleStarted);
    rtc.socket.on("screen-share-stopped", handleStopped);
    const handleParticipantStarted = ({ participantId }: { participantId: string }) => {};
    const handleParticipantStopped = ({ participantId }: { participantId: string }) => { setRemoteScreenTiles(prev => prev.filter(t => t.peerId !== participantId)); };
    rtc.socket.on('participant-started-sharing', handleParticipantStarted);
    rtc.socket.on('participant-stopped-sharing', handleParticipantStopped);
    return () => {
      rtc.socket.off("screen-share-started", handleStarted);
      rtc.socket.off("screen-share-stopped", handleStopped);
      rtc.socket.off('participant-started-sharing', handleParticipantStarted);
      rtc.socket.off('participant-stopped-sharing', handleParticipantStopped);
    };
  }, [rtc, userId]);

  useEffect(() => {
    const addSelfToParticipants = async () => {
        if (user && meetingId && !isLoadingRole) {
            const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
            // Check if doc exists to avoid overwriting on re-renders
            const docSnap = await getDoc(participantRef);
            if (!docSnap.exists()) {
                await setDoc(participantRef, {
                    name: user.displayName || 'Anonymous',
                    photoURL: user.photoURL || '',
                    isHost: isHost,
                    joinedAt: serverTimestamp(),
                });
            }
        }
    };
    addSelfToParticipants();
  }, [user, meetingId, isHost, isLoadingRole]);

  const { allParticipants, firstHandRaisedId, raisedCount } = useMemo(() => {
    const localUserDetails = liveParticipants.get(userId);
    const self: Participant = {
      id: userId,
      name: localUserDetails?.name || user?.displayName || "You",
      avatar: localUserDetails?.photoURL || user?.photoURL || `https://placehold.co/128x128.png?text=${(user?.displayName || 'Y').charAt(0)}`,
      isCamOff: !camOn, isMicOff: !micOn, isHandRaised, handRaisedAt: localUserDetails?.handRaisedAt,
      isScreenSharing: isSharingScreen, isLocal: true, stream: localStream,
      volumeLevel: volumeLevels.get(userId) ?? 0
    };
    const remotes: Participant[] = Array.from(liveParticipants.entries())
      .filter(([id]) => id !== userId)
      .map(([id, data]) => {
        const remoteStream = remoteStreams.get(id) || null;
        const videoTracks = remoteStream?.getVideoTracks() || [];
        const audioTracks = remoteStream?.getAudioTracks() || [];
        return {
          id, name: data.name || `User ${id.substring(0, 4)}`, avatar: data.photoURL || `https://placehold.co/128x128.png?text=${(data.name || 'G').charAt(0)}`,
          isHandRaised: data.isHandRaised, handRaisedAt: data.handRaisedAt, isScreenSharing: data.isScreenSharing,
          isCamOff: data.isScreenSharing ? false : (videoTracks.length === 0 || !videoTracks.some(t => t.enabled && !t.muted)),
          isMicOff: audioTracks.length === 0 || audioTracks.every(t => !t.enabled),
          stream: remoteStream, volumeLevel: volumeLevels.get(id) ?? 0,
        };
      });
    const all = [self, ...remotes];
    const firstHandRaised = all.filter(p => p.isHandRaised && p.handRaisedAt).sort((a, b) => (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0))[0];
    const raisedCount = all.filter(p => p.isHandRaised).length;
    return { allParticipants: all, firstHandRaisedId: firstHandRaised?.id || null, raisedCount };
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevels, isHandRaised, isSharingScreen]);

  const updateMyStatus = useCallback(async (status: Partial<LiveParticipantInfo>) => {
    if (user && meetingId) {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try { await updateDoc(participantRef, status); } catch (err) { console.error("Error updating participant status:", err); }
    }
  }, [user, meetingId]);

  const toggleMic = useCallback(() => { if (!localStream) return; const nextState = !micOn; localStream.getAudioTracks().forEach(track => (track.enabled = nextState)); setMicOn(nextState); updateMyStatus({ isMicOn: nextState }); setVolumeLevels(prev => { const next = new Map(prev); next.set(userId, nextState ? (next.get(userId) ?? 0) : 0); return next; }); }, [localStream, micOn, updateMyStatus, userId]);
  const toggleCamera = useCallback(() => { if (!localStream) return; const videoTrack = localStream.getVideoTracks()[0]; if (videoTrack) { const nextState = !videoTrack.enabled; videoTrack.enabled = nextState; setCamOn(nextState); updateMyStatus({ isCameraOn: nextState }); } }, [localStream, updateMyStatus, camOn]);
  const handleToggleHandRaise = useCallback(() => { const next = !isHandRaised; setIsHandRaised(next); updateMyStatus({ isHandRaised: next, handRaisedAt: next ? Date.now() : null }); }, [isHandRaised, updateMyStatus]);
  const togglePin = useCallback((id: string) => { setPinnedId(prev => prev === id ? null : id); }, []);

  const renderLayout = () => {
    const mainParticipants = allParticipants.filter(p => !remoteScreenTiles.some(s => s.peerId === p.id));
    const allTiles = [...mainParticipants, ...remoteScreenTiles.map(s => ({ id: s.peerId, stream: s.stream, name: liveParticipants.get(s.peerId)?.name || 'Screen', isScreenSharing: true, isCamOff: false, isMicOff: true }))];

    if (pinnedId) {
      const pinned = allTiles.find(p => p.id === pinnedId);
      const others = allTiles.filter(p => p.id !== pinnedId);
      return (
        <div className="w-full h-full flex gap-2 p-0">
          <div className="flex-1 min-h-0 relative">{pinned && (<div className="w-full h-full relative"><VideoTile stream={pinned.stream} isCameraOn={!pinned.isCamOff} isMicOn={!pinned.isMicOff} isHandRaised={(pinned as Participant).isHandRaised || false} isFirstHand={pinned.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={(pinned as Participant).volumeLevel} isLocal={!!(pinned as Participant).isLocal} profileUrl={(pinned as Participant).avatar} name={pinned.name} isScreenSharing={pinned.isScreenSharing} isPinned={true} onTogglePin={() => togglePin(pinned.id)} onDoubleClick={() => togglePin(pinned.id)} className="w-full h-full" onStopShare={isSharingScreen && pinned.id === userId ? handleStopSharing : undefined} /></div>)}</div>
          {others.length > 0 && (<div className="w-48 hidden md:flex md:flex-col gap-2 overflow-auto">{others.map(p => (<div key={p.id} className="h-28 rounded-lg"><VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={(p as Participant).isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={(p as Participant).volumeLevel} isLocal={!!(p as Participant).isLocal} profileUrl={(p as Participant).avatar} name={p.name} isScreenSharing={p.isScreenSharing} onTogglePin={() => togglePin(p.id)} onDoubleClick={() => togglePin(p.id)} className="w-full h-full" onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/></div>))}</div>)}
        </div>
      );
    }
    
    if (remoteScreenTiles.length > 0) {
      const screenTile = remoteScreenTiles[0];
      const otherTiles = allTiles.filter(p => p.id !== screenTile.peerId);
      return (
        <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2">
          <div className="flex-1 min-h-0"><div className="w-full h-full relative"><VideoTile stream={screenTile.stream} isCameraOn={true} name={liveParticipants.get(screenTile.peerId)?.name + "'s Screen" || 'Screen Share'} isScreenSharing={true} onTogglePin={() => togglePin(screenTile.peerId)} onDoubleClick={() => togglePin(screenTile.peerId)} className="w-full h-full" /></div></div>
          {otherTiles.length > 0 && (<div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">{otherTiles.map(p => (<div key={p.id} className="md:h-32 aspect-video md:aspect-auto"><VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={(p as Participant).isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={(p as Participant).volumeLevel} isLocal={!!(p as Participant).isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} onTogglePin={() => togglePin(p.id)} onDoubleClick={() => togglePin(p.id)} onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/></div>))}</div>)}
        </div>
      );
    }

    const count = allParticipants.length;
    if (count === 1) return <div className="w-full h-full p-0"><VideoTile stream={allParticipants[0].stream} isCameraOn={!allParticipants[0].isCamOff} isMicOn={!allParticipants[0].isMicOff} isHandRaised={allParticipants[0].isHandRaised || false} isFirstHand={allParticipants[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={allParticipants[0].volumeLevel} isLocal={!!allParticipants[0].isLocal} profileUrl={allParticipants[0].avatar} name={allParticipants[0].name} isScreenSharing={allParticipants[0].isScreenSharing} onTogglePin={count > 1 ? () => togglePin(allParticipants[0].id) : undefined} onDoubleClick={count > 1 ? () => togglePin(allParticipants[0].id) : undefined} className="w-full h-full" onStopShare={isSharingScreen && allParticipants[0].id === userId ? handleStopSharing : undefined} /></div>;

    if (count === 2) {
      const remote = allParticipants.find((u) => !u.isLocal); const local = allParticipants.find((u) => u.isLocal);
      return (
        <div className="w-full h-full p-0">
          {remote && <div className="w-full h-full relative"><VideoTile stream={remote.stream} isCameraOn={!remote.isCamOff} isMicOn={!remote.isMicOff} isHandRaised={remote.isHandRaised || false} isFirstHand={remote.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remote.volumeLevel} isLocal={!!remote.isLocal} profileUrl={remote.avatar} name={remote.name} isScreenSharing={remote.isScreenSharing} onTogglePin={() => togglePin(remote.id)} onDoubleClick={() => togglePin(remote.id)} className="w-full h-full"/></div>}
          {local && <div className="absolute bottom-[5.125rem] right-4 sm:right-6 w-1/4 sm:w-1/5 z-50 shadow-lg rounded-lg overflow-hidden aspect-[9/16] md:aspect-video"><VideoTile stream={local.stream} isCameraOn={!local.isCamOff} isMicOn={!local.isMicOff} isHandRaised={local.isHandRaised || false} isFirstHand={local.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={local.volumeLevel} isLocal={!!local.isLocal} profileUrl={local.avatar} name={local.name} isScreenSharing={local.isScreenSharing} onTogglePin={() => togglePin(local.id)} onDoubleClick={() => togglePin(local.id)} draggable={true} onStopShare={isSharingScreen && local.id === userId ? handleStopSharing : undefined}/></div>}
        </div>
      );
    }

    const cols = Math.ceil(Math.sqrt(count));
    return (
      <div className="w-full h-full grid gap-2 p-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {allParticipants.map((p) => (<div key={p.id} className="w-full h-full rounded-lg relative aspect-video"><VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} onTogglePin={() => togglePin(p.id)} onDoubleClick={() => togglePin(p.id)} onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/></div>))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
      {isHost && <HostJoinRequestNotification meetingId={meetingId} />}

      <ScreenShareModal open={isScreenShareModalOpen} onClose={() => setIsScreenShareModalOpen(false)} onConfirm={onModalConfirm} cameraOn={camOn} />

      <main className="flex-1 overflow-hidden relative bg-black">
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {loadingMedia ? (
                <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                renderLayout()
            )}
        </div>
      </main>

      {isSharingScreen && (<div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg z-50">🔴 You’re sharing your screen</div>)}

      <footer className="p-2 sm:p-4 bg-background/80 backdrop-blur-sm border-t border-border shrink-0 relative z-10">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button onClick={toggleMic} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", micOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90")} aria-label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> : <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={toggleCamera} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", camOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90")} aria-label={camOn ? "Stop Camera" : "Start Camera"}>{camOn ? <Video className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleShareClick} variant="ghost" className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm-w-14", isSharingScreen ? "bg-red-600 text-white hover:bg-red-700" : "bg-secondary/50 hover:bg-secondary/70 text-white")} aria-label={isSharingScreen ? "Stop Sharing" : "Share Screen"}>{isSharingScreen ? <ScreenShareOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <ScreenShare className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleToggleHandRaise} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isHandRaised ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90")} aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}><Hand className="h-5 w-5 sm:h-6 sm:w-6" /></Button>
            <Button onClick={onLeave} className="h-12 sm:h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors px-4 sm:px-6" aria-label="Leave Meeting"><PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" /><span className="ml-2 font-semibold hidden sm:inline">Leave</span></Button>
        </div>
      </footer>
    </div>
  );
}
