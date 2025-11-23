
// src/app/dashboard/meeting/[meetingId]/MeetingClient.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2, Check, X, Users } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc, getDoc, query, writeBatch, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import VideoTile from "./VideoTile";
import { ScreenShareHelper, type ShareMode } from "@/lib/webrtc/screenShare";
import { ScreenShareModal } from "@/components/modals/ScreenShareModal";
import HostJoinRequestNotification from "@/components/meeting/HostJoinRequestNotification";
import type { JoinRequest } from '@/app/dashboard/classrooms/[classroomId]/page';
import Link from "next/link";


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
    isCameraOn?: boolean;
    isMicOn?: boolean;
};

type Props = { 
  meetingId: string; 
  userId: string;
  initialCamOn: boolean;
  initialMicOn: boolean;
  onLeave: () => void;
  topic: string;
};

export default function MeetingClient({ meetingId, userId, initialCamOn, initialMicOn, onLeave, topic }: Props) {
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
  const mainContainerRef = useRef<HTMLDivElement>(null);

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
    if (!userId || !meetingId) return null;
    return new MeshRTC({
      roomId: meetingId,
      userId,
      onRemoteStream: (remoteSocketId, stream) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(remoteSocketId, stream);
          return next;
        });
      },
      onRemoteLeft: (socketId) => {
        setRemoteStreams(prev => { const next = new Map(prev); next.delete(socketId); return next; });
        const entry = remoteAnalysersRef.current.get(socketId);
        if (entry && entry.rafId) cancelAnimationFrame(entry.rafId);
        remoteAnalysersRef.current.delete(socketId);
        setVolumeLevels(prev => { const next = new Map(prev); next.delete(socketId); return next; });
        setPinnedId(prev => prev === socketId ? null : prev);
      },
    });
  }, [meetingId, userId]);

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
      updateMyStatus({ isScreenSharing: true });
    } catch (err) {
      console.error("Screen share cancelled or failed:", err);
      // This toast handles the case where the user explicitly cancels the browser's permission prompt.
      toast({ variant: "default", title: "Screen Share Canceled", description: "You did not grant permission to share your screen."});
      setIsSharingScreen(false);
      updateMyStatus({ isScreenSharing: false });
    }
  };
  
  const handleStopSharing = async () => { 
    await screenShareHelper?.stopSharing(); 
    setIsSharingScreen(false); 
    updateMyStatus({ isScreenSharing: false });
  };

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
      let localParticipantData: LiveParticipantInfo | undefined;
      
      snapshot.forEach(doc => { 
        const data = doc.data() as LiveParticipantInfo;
        if (doc.id === userId) {
          localParticipantData = data;
        }
        newParticipants.set(doc.id, data); 
      });

      // Handle host turning off camera remotely
      if (localParticipantData && localParticipantData.isCameraOn === false && camOn) {
        toggleCamera(false); // Force camera off
        toast({ title: "Camera Turned Off", description: "The host has turned off your camera." });
      }

      setLiveParticipants(newParticipants);
    });
    return () => unsubscribe();
  }, [meetingId, userId, camOn]);

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
    const addSelfToParticipants = async () => {
        if (user && meetingId && !isLoadingRole) {
            const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
            const docSnap = await getDoc(participantRef);
            if (!docSnap.exists()) {
                await setDoc(participantRef, {
                    name: user.displayName || 'Anonymous',
                    photoURL: user.photoURL || '',
                    isHost: isHost,
                    isCameraOn: initialCamOn,
                    isMicOn: initialMicOn,
                    joinedAt: serverTimestamp(),
                });
            }
        }
    };
    addSelfToParticipants();
  }, [user, meetingId, isHost, isLoadingRole, initialCamOn, initialMicOn]);

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
        return {
          id, name: data.name || `User ${id.substring(0, 4)}`, avatar: data.photoURL || `https://placehold.co/128x128.png?text=${(data.name || 'G').charAt(0)}`,
          isHandRaised: data.isHandRaised, handRaisedAt: data.handRaisedAt, isScreenSharing: data.isScreenSharing,
          isCamOff: !data.isCameraOn,
          isMicOff: !data.isMicOn,
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

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
  
    const newState = !micOn;
    audioTrack.enabled = newState;
    setMicOn(newState);
    
    updateMyStatus({ isMicOn: newState });
    setVolumeLevels(prev => {
      const next = new Map(prev);
      next.set(userId, newState ? (next.get(userId) ?? 0) : 0);
      return next;
    });
  }, [localStream, micOn, updateMyStatus, userId]);

  const toggleCamera = useCallback((forceState?: boolean) => {
    if (!localStream) return;
    const nextState = typeof forceState === 'boolean' ? forceState : !camOn;
    localStream.getVideoTracks().forEach(track => { track.enabled = nextState; });
    setCamOn(nextState);
    updateMyStatus({ isCameraOn: nextState });
  }, [localStream, camOn, updateMyStatus]);
  const handleToggleHandRaise = useCallback(() => { const next = !isHandRaised; setIsHandRaised(next); updateMyStatus({ isHandRaised: next, handRaisedAt: next ? Date.now() : null }); }, [isHandRaised, updateMyStatus]);
  const togglePin = useCallback((id: string) => { setPinnedId(prev => prev === id ? null : id); }, []);

  const renderLayout = () => {
    if (pinnedId) {
      const pinned = allParticipants.find(p => p.id === pinnedId);
      const others = allParticipants.filter(p => p.id !== pinnedId);
      return (
        <div className="w-full h-full flex gap-2">
          <div className="flex-1 min-h-0"><div className="w-full h-full relative"><VideoTile stream={pinned!.stream} isCameraOn={!pinned!.isCamOff} isMicOn={!pinned!.isMicOff} isHandRaised={pinned!.isHandRaised || false} isFirstHand={pinned!.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={pinned!.volumeLevel} isLocal={!!pinned!.isLocal} profileUrl={pinned!.avatar} name={pinned!.name} isScreenSharing={pinned!.isScreenSharing} isPinned={true} onTogglePin={() => togglePin(pinned!.id)} onDoubleClick={() => togglePin(pinned!.id)} className="w-full h-full" onStopShare={isSharingScreen && pinned!.id === userId ? handleStopSharing : undefined} /></div></div>
          {others.length > 0 && (<div className="w-48 hidden md:flex md:flex-col gap-2 overflow-auto">{others.map(p => (<div key={p.id} className="h-28 rounded-lg aspect-[9/16] md:aspect-video"><VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} onTogglePin={() => togglePin(p.id)} onDoubleClick={() => togglePin(p.id)} className="w-full h-full" onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/></div>))}</div>)}
        </div>
      );
    }
    
    const screenSharingParticipant = allParticipants.find(p => p.isScreenSharing);
    if (screenSharingParticipant) {
      const otherTiles = allParticipants.filter(p => p.id !== screenSharingParticipant.id);
      return (
        <div className="w-full h-full flex flex-col md:flex-row gap-2">
          <div className="flex-1 min-h-0"><div className="w-full h-full relative"><VideoTile stream={screenSharingParticipant.stream} isCameraOn={!screenSharingParticipant.isCamOff} isMicOn={!screenSharingParticipant.isMicOff} name={screenSharingParticipant.name + "'s Screen" || 'Screen Share'} isScreenSharing={true} onTogglePin={() => togglePin(screenSharingParticipant.id)} onDoubleClick={() => togglePin(screenSharingParticipant.id)} className="w-full h-full" onStopShare={isSharingScreen && screenSharingParticipant.id === userId ? handleStopSharing : undefined} /></div></div>
          {otherTiles.length > 0 && (<div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">{otherTiles.map(p => (<div key={p.id} className="aspect-[9/16] md:h-32 md:aspect-auto"><VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} onTogglePin={() => togglePin(p.id)} onDoubleClick={() => togglePin(p.id)} onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/></div>))}</div>)}
        </div>
      );
    }

    const count = allParticipants.length;
    const remoteParticipants = allParticipants.filter((p) => !p.isLocal);
    const localParticipant = allParticipants.find((p) => p.isLocal);

    if (count === 1) return <div className="w-full h-full flex items-center justify-center p-2"><div className="w-full h-full"><VideoTile stream={allParticipants[0].stream} isCameraOn={!allParticipants[0].isCamOff} isMicOn={!allParticipants[0].isMicOff} isHandRaised={allParticipants[0].isHandRaised || false} isFirstHand={allParticipants[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={allParticipants[0].volumeLevel} isLocal={!!allParticipants[0].isLocal} profileUrl={allParticipants[0].avatar} name={allParticipants[0].name} isScreenSharing={allParticipants[0].isScreenSharing} onTogglePin={count > 1 ? () => togglePin(allParticipants[0].id) : undefined} onDoubleClick={count > 1 ? () => togglePin(allParticipants[0].id) : undefined} className="w-full h-full" onStopShare={isSharingScreen && allParticipants[0].id === userId ? handleStopSharing : undefined} /></div></div>;

    if (count === 2 && remoteParticipants.length === 1 && localParticipant) {
      const remote = remoteParticipants[0];
      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
            <VideoTile stream={remote.stream} isCameraOn={!remote.isCamOff} isMicOn={!remote.isMicOff} isHandRaised={remote.isHandRaised || false} isFirstHand={remote.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remote.volumeLevel} profileUrl={remote.avatar} name={remote.name} isScreenSharing={remote.isScreenSharing} onTogglePin={() => togglePin(remote.id)} onDoubleClick={() => togglePin(remote.id)} className="w-full h-full" />
            <motion.div
              drag
              dragConstraints={mainContainerRef}
              dragMomentum={false}
              className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
            >
              <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} className="w-full h-full" onTogglePin={() => togglePin(localParticipant.id)} onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
            </motion.div>
        </div>
      );
    }
    
    if (count === 3 && localParticipant && remoteParticipants.length === 2) {
      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
          <div className="w-full h-full flex flex-col md:flex-row gap-2">
            <div className="w-full md:w-1/2 h-1/2 md:h-full min-h-0">
              <VideoTile stream={remoteParticipants[0].stream} isCameraOn={!remoteParticipants[0].isCamOff} isMicOn={!remoteParticipants[0].isMicOff} isHandRaised={remoteParticipants[0].isHandRaised || false} isFirstHand={remoteParticipants[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[0].volumeLevel} profileUrl={remoteParticipants[0].avatar} name={remoteParticipants[0].name} isScreenSharing={remoteParticipants[0].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[0].id)} onDoubleClick={() => togglePin(remoteParticipants[0].id)} className="w-full h-full" />
            </div>
            <div className="w-full md:w-1/2 h-1/2 md:h-full min-h-0">
              <VideoTile stream={remoteParticipants[1].stream} isCameraOn={!remoteParticipants[1].isCamOff} isMicOn={!remoteParticipants[1].isMicOff} isHandRaised={remoteParticipants[1].isHandRaised || false} isFirstHand={remoteParticipants[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[1].volumeLevel} profileUrl={remoteParticipants[1].avatar} name={remoteParticipants[1].name} isScreenSharing={remoteParticipants[1].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[1].id)} onDoubleClick={() => togglePin(remoteParticipants[1].id)} className="w-full h-full" />
            </div>
          </div>
          <motion.div
            drag
            dragConstraints={mainContainerRef}
            dragMomentum={false}
            className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
          >
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} className="w-full h-full" onTogglePin={() => togglePin(localParticipant.id)} onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
          </motion.div>
        </div>
      );
    }
    
    if (count === 4 && localParticipant && remoteParticipants.length === 3) {
      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
          <div className="w-full h-full flex flex-col gap-2">
            <div className="w-full h-1/2 flex gap-2">
              <div className="w-1/2 h-full min-h-0">
                  <VideoTile stream={remoteParticipants[0].stream} isCameraOn={!remoteParticipants[0].isCamOff} isMicOn={!remoteParticipants[0].isMicOff} isHandRaised={remoteParticipants[0].isHandRaised || false} isFirstHand={remoteParticipants[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[0].volumeLevel} profileUrl={remoteParticipants[0].avatar} name={remoteParticipants[0].name} isScreenSharing={remoteParticipants[0].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[0].id)} onDoubleClick={() => togglePin(remoteParticipants[0].id)} className="w-full h-full" />
              </div>
              <div className="w-1/2 h-full min-h-0">
                  <VideoTile stream={remoteParticipants[1].stream} isCameraOn={!remoteParticipants[1].isCamOff} isMicOn={!remoteParticipants[1].isMicOff} isHandRaised={remoteParticipants[1].isHandRaised || false} isFirstHand={remoteParticipants[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[1].volumeLevel} profileUrl={remoteParticipants[1].avatar} name={remoteParticipants[1].name} isScreenSharing={remoteParticipants[1].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[1].id)} onDoubleClick={() => togglePin(remoteParticipants[1].id)} className="w-full h-full" />
              </div>
            </div>
            <div className="w-full h-1/2 min-h-0">
              <VideoTile stream={remoteParticipants[2].stream} isCameraOn={!remoteParticipants[2].isCamOff} isMicOn={!remoteParticipants[2].isMicOff} isHandRaised={remoteParticipants[2].isHandRaised || false} isFirstHand={remoteParticipants[2].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[2].volumeLevel} profileUrl={remoteParticipants[2].avatar} name={remoteParticipants[2].name} isScreenSharing={remoteParticipants[2].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[2].id)} onDoubleClick={() => togglePin(remoteParticipants[2].id)} className="w-full h-full" />
            </div>
          </div>
          <motion.div
            drag
            dragConstraints={mainContainerRef}
            dragMomentum={false}
            className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
          >
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} className="w-full h-full" onTogglePin={() => togglePin(localParticipant.id)} onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
          </motion.div>
        </div>
      );
    }

    if (count === 5 && localParticipant && remoteParticipants.length === 4) {
      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
          <div className="w-full h-full flex flex-col gap-2">
            {/* Top Row */}
            <div className="w-full h-1/2 flex gap-2">
              <div className="w-1/2 h-full min-h-0">
                  <VideoTile stream={remoteParticipants[0].stream} isCameraOn={!remoteParticipants[0].isCamOff} isMicOn={!remoteParticipants[0].isMicOff} isHandRaised={remoteParticipants[0].isHandRaised || false} isFirstHand={remoteParticipants[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[0].volumeLevel} profileUrl={remoteParticipants[0].avatar} name={remoteParticipants[0].name} isScreenSharing={remoteParticipants[0].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[0].id)} onDoubleClick={() => togglePin(remoteParticipants[0].id)} className="w-full h-full" />
              </div>
              <div className="w-1/2 h-full min-h-0">
                  <VideoTile stream={remoteParticipants[1].stream} isCameraOn={!remoteParticipants[1].isCamOff} isMicOn={!remoteParticipants[1].isMicOff} isHandRaised={remoteParticipants[1].isHandRaised || false} isFirstHand={remoteParticipants[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[1].volumeLevel} profileUrl={remoteParticipants[1].avatar} name={remoteParticipants[1].name} isScreenSharing={remoteParticipants[1].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[1].id)} onDoubleClick={() => togglePin(remoteParticipants[1].id)} className="w-full h-full" />
              </div>
            </div>
            {/* Bottom Row */}
            <div className="w-full h-1/2 flex gap-2">
              <div className="w-1/2 h-full min-h-0">
                  <VideoTile stream={remoteParticipants[2].stream} isCameraOn={!remoteParticipants[2].isCamOff} isMicOn={!remoteParticipants[2].isMicOff} isHandRaised={remoteParticipants[2].isHandRaised || false} isFirstHand={remoteParticipants[2].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[2].volumeLevel} profileUrl={remoteParticipants[2].avatar} name={remoteParticipants[2].name} isScreenSharing={remoteParticipants[2].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[2].id)} onDoubleClick={() => togglePin(remoteParticipants[2].id)} className="w-full h-full" />
              </div>
              <div className="w-1/2 h-full min-h-0">
                  <VideoTile stream={remoteParticipants[3].stream} isCameraOn={!remoteParticipants[3].isCamOff} isMicOn={!remoteParticipants[3].isMicOff} isHandRaised={remoteParticipants[3].isHandRaised || false} isFirstHand={remoteParticipants[3].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remoteParticipants[3].volumeLevel} profileUrl={remoteParticipants[3].avatar} name={remoteParticipants[3].name} isScreenSharing={remoteParticipants[3].isScreenSharing} onTogglePin={() => togglePin(remoteParticipants[3].id)} onDoubleClick={() => togglePin(remoteParticipants[3].id)} className="w-full h-full" />
              </div>
            </div>
          </div>
          <motion.div
            drag
            dragConstraints={mainContainerRef}
            dragMomentum={false}
            className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
          >
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} className="w-full h-full" onTogglePin={() => togglePin(localParticipant.id)} onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
          </motion.div>
        </div>
      );
    }
    
    if (count > 5) {
      const p1 = remoteParticipants[0];
      const p2 = remoteParticipants[1];
      const p3 = remoteParticipants[2];
      const p4 = remoteParticipants[3]; // The fifth person overall
      const othersCount = count - 5; // Total participants - 4 remotes - 1 local
      const participantsUrl = `/dashboard/meeting/${meetingId}/participants?topic=${encodeURIComponent(topic)}`;

      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
          <div className="w-full h-full flex flex-col gap-2">
            {/* Top Row */}
            <div className="w-full h-1/2 flex gap-2">
              <div className="w-1/2 h-full min-h-0"><VideoTile stream={p1.stream} isCameraOn={!p1.isCamOff} isMicOn={!p1.isMicOff} isHandRaised={p1.isHandRaised||false} isFirstHand={p1.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p1.volumeLevel} profileUrl={p1.avatar} name={p1.name} onTogglePin={() => togglePin(p1.id)} onDoubleClick={() => togglePin(p1.id)} className="w-full h-full" /></div>
              <div className="w-1/2 h-full min-h-0"><VideoTile stream={p2.stream} isCameraOn={!p2.isCamOff} isMicOn={!p2.isMicOff} isHandRaised={p2.isHandRaised||false} isFirstHand={p2.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p2.volumeLevel} profileUrl={p2.avatar} name={p2.name} onTogglePin={() => togglePin(p2.id)} onDoubleClick={() => togglePin(p2.id)} className="w-full h-full" /></div>
            </div>
            {/* Bottom Row */}
            <div className="w-full h-1/2 flex gap-2">
              <div className="w-1/2 h-full min-h-0"><VideoTile stream={p3.stream} isCameraOn={!p3.isCamOff} isMicOn={!p3.isMicOff} isHandRaised={p3.isHandRaised||false} isFirstHand={p3.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p3.volumeLevel} profileUrl={p3.avatar} name={p3.name} onTogglePin={() => togglePin(p3.id)} onDoubleClick={() => togglePin(p3.id)} className="w-full h-full" /></div>
              <div className="w-1/2 h-full min-h-0 relative">
                  <VideoTile stream={p4.stream} isCameraOn={!p4.isCamOff} isMicOn={!p4.isMicOff} isHandRaised={p4.isHandRaised||false} isFirstHand={p4.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p4.volumeLevel} profileUrl={p4.avatar} name={p4.name} onTogglePin={() => togglePin(p4.id)} onDoubleClick={() => togglePin(p4.id)} className="w-full h-full" />
                   <Link href={participantsUrl} className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer">
                      <Users className="h-10 w-10" />
                      <p className="font-bold text-xl mt-2">+{othersCount} more</p>
                    </Link>
              </div>
            </div>
          </div>
          <motion.div
            drag
            dragConstraints={mainContainerRef}
            dragMomentum={false}
            className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
          >
            <VideoTile stream={localParticipant?.stream} isCameraOn={!localParticipant?.isCamOff} isMicOn={!localParticipant?.isMicOff} isHandRaised={localParticipant?.isHandRaised || false} isFirstHand={localParticipant?.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant?.volumeLevel} isLocal={true} profileUrl={localParticipant?.avatar} name={localParticipant?.name} isScreenSharing={localParticipant?.isScreenSharing} className="w-full h-full" onTogglePin={() => togglePin(localParticipant!.id)} onDoubleClick={() => togglePin(localParticipant!.id)} draggable={true} onStopShare={isSharingScreen && localParticipant?.id === userId ? handleStopSharing : undefined} />
          </motion.div>
        </div>
      );
    }

    // Fallback for > 2 participants, which is now covered by specific cases up to 6+
    if (count > 2) {
        const gridCols = Math.ceil(Math.sqrt(allParticipants.length));
        return (
            <div className="w-full h-full relative">
                <div className="w-full h-full grid gap-2 overflow-auto" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                    {allParticipants.map((p) => (
                        <div key={p.id} className="w-full h-full rounded-lg relative aspect-[9/16] md:aspect-video">
                            <VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} onTogglePin={() => togglePin(p.id)} onDoubleClick={() => togglePin(p.id)} onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1">
      {isHost && <HostJoinRequestNotification meetingId={meetingId} />}

      <ScreenShareModal open={isScreenShareModalOpen} onClose={() => setIsScreenShareModalOpen(false)} onConfirm={onModalConfirm} cameraOn={camOn} />

      <main className="flex-1 overflow-hidden relative p-2" ref={mainContainerRef}>
          {loadingMedia ? (
              <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
          ) : (
              renderLayout()
          )}
      </main>

      {isSharingScreen && (<div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg z-50">🔴 You’re sharing your screen</div>)}

      <footer className="p-2 sm:p-4 bg-background shrink-0 relative z-10">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button onClick={toggleMic} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", micOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90")} aria-label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> : <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={() => toggleCamera()} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", camOn ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90")} aria-label={camOn ? "Stop Camera" : "Start Camera"}>{camOn ? <Video className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleShareClick} variant="ghost" className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isSharingScreen ? "bg-red-600 text-white hover:bg-red-700" : "bg-secondary/50 hover:bg-secondary/70 text-white")} aria-label={isSharingScreen ? "Stop Sharing" : "Share Screen"}>{isSharingScreen ? <ScreenShareOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <ScreenShare className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleToggleHandRaise} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isHandRaised ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90")} aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}><Hand className="h-5 w-5 sm:h-6 sm:w-6" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="h-12 sm:h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors px-4 sm:px-6" aria-label="Leave Meeting"><PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" /><span className="ml-2 font-semibold hidden sm:inline">Leave</span></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Leave Meeting?</AlertDialogTitle>
                      <AlertDialogDescription>
                          Are you sure you want to leave the meeting?
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onLeave} className={cn(buttonVariants({variant: "destructive"}))}>Leave</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </footer>
    </div>
  );
}
