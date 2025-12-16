
// src/app/dashboard/meeting/[meetingId]/MeetingClient.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2, Check, X, Users, Maximize, Pin, MessageSquare } from "lucide-react";
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
import type { JoinRequest, PrivateMessageActivityItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import Link from "next/link";
import { useRouter } from "next/navigation";


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
  onLeave: (endForAll?: boolean) => void;
  topic: string;
  initialPinnedId?: string | null;
};

const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';


export default function MeetingClient({ meetingId, userId, initialCamOn, initialMicOn, onLeave, topic, initialPinnedId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
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

  const [pinnedId, setPinnedId] = useState<string | null>(initialPinnedId || null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const [privateMessage, setPrivateMessage] = useState<PrivateMessageActivityItem | null>(null);


  useEffect(() => {
    const handleStorageUpdate = () => {
      if (!user) return;
      try {
        const LATEST_ACTIVITY_KEY = `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`;
        const rawActivity = localStorage.getItem(LATEST_ACTIVITY_KEY);
        if (!rawActivity) return;
        const activities: PrivateMessageActivityItem[] = JSON.parse(rawActivity);
        const latestPrivateMessage = activities.find(
          (act): act is PrivateMessageActivityItem =>
            act.type === 'privateMessage' && act.meetingId === meetingId
        );
        if (latestPrivateMessage && latestPrivateMessage.id !== privateMessage?.id) {
          setPrivateMessage(latestPrivateMessage);
        }
      } catch (e) {
        console.error("Failed to parse activity from localStorage", e);
      }
    };

    handleStorageUpdate(); // Check on mount
    window.addEventListener('teachmeet_activity_updated', handleStorageUpdate);
    return () => window.removeEventListener('teachmeet_activity_updated', handleStorageUpdate);
  }, [user, meetingId, privateMessage?.id]);

  const handleNotificationClick = (message: PrivateMessageActivityItem) => {
    const url = `/dashboard/meeting/${message.meetingId}/chat?topic=${encodeURIComponent(message.meetingTopic)}&privateWith=${message.senderId}&privateWithName=${encodeURIComponent(message.from)}`;
    router.push(url);
    // Clear the message after navigating
    setPrivateMessage(null);
  };


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
    const mesh = new MeshRTC({
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
    return mesh;
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

  const handleShareClick = () => {
    if (isSharingScreen) {
      handleStopSharing();
    } else {
      setIsScreenShareModalOpen(true);
    }
  };

  const onModalConfirm = async (mode: ShareMode) => {
    setIsScreenShareModalOpen(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      toast({
        variant: "destructive",
        title: "Screen Share Not Supported",
        description: "Your browser does not support screen sharing or you are not in a secure (HTTPS) environment.",
      });
      return;
    }
    if (!screenShareHelper) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      await screenShareHelper.startSharingWithStream(mode, stream);
      setIsSharingScreen(true);
      updateMyStatus({ isScreenSharing: true });
    } catch (err) {
      console.error("Screen share cancelled or failed:", err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
         toast({ variant: "default", title: "Screen Share Canceled", description: "You did not grant permission to share your screen." });
      } else if (err instanceof Error) {
        toast({ variant: "destructive", title: "Screen Share Failed", description: err.message });
      } else {
        toast({ variant: "destructive", title: "Screen Share Failed", description: "An unknown error occurred." });
      }
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
        setLocalStream(stream);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, screenShareHelper]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, userId]);

  useEffect(() => { if (localStream && rtc) { rtc.init(localStream); } return () => rtc?.leave(); }, [rtc, localStream]);

  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0 || !micOn) {
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      setVolumeLevels(prev => { const next = new Map(prev); next.set(userId, 0); return next; });
      return;
    }
    if (!audioContextRef.current) {
        try {
          const audioContext = new AudioContext();
          analyserRef.current = audioContext.createAnalyser();
          analyserRef.current.fftSize = 256;
          sourceRef.current = audioContext.createMediaStreamSource(localStream);
          sourceRef.current.connect(analyserRef.current);
          audioContextRef.current = audioContext;
        } catch(e) {
            console.error("Could not create AudioContext for local stream", e);
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
                    isCameraOn: camOn,
                    isMicOn: micOn,
                    joinedAt: serverTimestamp(),
                });
            } else {
              // If doc exists, update the on/off state in case of refresh
              await updateDoc(participantRef, { isCameraOn: camOn, isMicOn: micOn });
            }
        }
    };
    addSelfToParticipants();
  }, [user, meetingId, isHost, isLoadingRole, camOn, micOn]);

  const { allParticipants, localParticipant, remoteParticipants, firstHandRaisedId, raisedCount } = useMemo(() => {
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
      
    let all = [self, ...remotes];
    const remoteOnly = [...remotes];

    // Reorder based on pinnedId
    if (pinnedId) {
        const pinnedIndex = all.findIndex(p => p.id === pinnedId);
        if (pinnedIndex > -1) {
            const [pinnedItem] = all.splice(pinnedIndex, 1);
            all.unshift(pinnedItem);
        }
        const remotePinnedIndex = remoteOnly.findIndex(p => p.id === pinnedId);
        if (remotePinnedIndex > -1) {
            const [pinnedItem] = remoteOnly.splice(remotePinnedIndex, 1);
            remoteOnly.unshift(pinnedItem);
        }
    }
    
    const firstHandRaised = all.filter(p => p.isHandRaised && p.handRaisedAt).sort((a, b) => (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0))[0];
    const raisedCount = all.filter(p => p.isHandRaised).length;
    return { allParticipants: all, localParticipant: self, remoteParticipants: remoteOnly, firstHandRaisedId: firstHandRaised?.id || null, raisedCount };
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevels, isHandRaised, isSharingScreen, pinnedId]);

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
    localStorage.setItem('teachmeet-mic-state', String(newState));
    
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
    localStorage.setItem('teachmeet-cam-state', String(nextState));
    updateMyStatus({ isCameraOn: nextState });
  }, [localStream, camOn, updateMyStatus]);

  const handleToggleHandRaise = useCallback(() => { const next = !isHandRaised; setIsHandRaised(next); updateMyStatus({ isHandRaised: next, handRaisedAt: next ? Date.now() : null }); }, [isHandRaised, updateMyStatus]);
  
  const togglePin = useCallback((id: string) => { 
    const newPinnedId = pinnedId === id ? null : id;
    setPinnedId(newPinnedId);
    
    // Update URL without navigation to allow for refreshing/sharing pinned view
    const url = new URL(window.location.href);
    if (newPinnedId) {
        url.searchParams.set('pin', newPinnedId);
    } else {
        url.searchParams.delete('pin');
    }
    window.history.pushState({}, '', url);

  }, [pinnedId]);

  const renderLayout = () => {
    const screenSharingParticipants = allParticipants.filter(p => p.isScreenSharing);
    if (screenSharingParticipants.length > 0) {
        const otherTiles = allParticipants.filter(p => !p.isScreenSharing);
        const gridCols = Math.ceil(Math.sqrt(screenSharingParticipants.length));
        
        return (
            <div className="w-full h-full flex flex-col md:flex-row gap-2">
                <div className="flex-1 min-h-0 grid gap-2" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`}}>
                    {screenSharingParticipants.map(p => (
                        <div key={p.id} className="w-full h-full relative">
                            <VideoTile 
                                stream={p.stream} 
                                isCameraOn={!p.isCamOff} 
                                isMicOn={!p.isMicOff} 
                                name={p.name + "'s Screen"}
                                isScreenSharing={true}
                                onDoubleClick={() => togglePin(p.id)} 
                                className="w-full h-full"
                                onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}
                                isPinned={p.id === pinnedId}
                            />
                        </div>
                    ))}
                </div>
                {otherTiles.length > 0 && (
                    <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">
                    {otherTiles.map(p => (
                        <div key={p.id} className="aspect-[9/16] md:h-32 md:aspect-auto">
                        <VideoTile
                            stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} 
                            isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} 
                            volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} 
                            isScreenSharing={p.isScreenSharing} isPinned={p.id === pinnedId} onDoubleClick={() => togglePin(p.id)}
                        />
                        </div>
                    ))}
                    </div>
                )}
            </div>
        );
    }

    const count = allParticipants.length;
    const remotes = remoteParticipants;

    if (count === 1) return <div className="w-full h-full flex items-center justify-center p-2"><div className="w-full h-full"><VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} /></div></div>;

    if (count === 2 && remotes.length === 1 && localParticipant) {
      const remote = remotes[0];
      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
            <VideoTile stream={remote.stream} isCameraOn={!remote.isCamOff} isMicOn={!remote.isMicOff} isHandRaised={remote.isHandRaised || false} isFirstHand={remote.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remote.volumeLevel} profileUrl={remote.avatar} name={remote.name} isScreenSharing={remote.isScreenSharing} isPinned={remote.id === pinnedId} onDoubleClick={() => togglePin(remote.id)} className="w-full h-full" />
            <motion.div
              drag
              dragConstraints={mainContainerRef}
              dragMomentum={false}
              className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
            >
              <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
            </motion.div>
        </div>
      );
    }
    
    if (count >= 3 && count <= 5 && localParticipant) {
      return (
        <div className="w-full h-full flex flex-col gap-2 relative" ref={mainContainerRef}>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[0].stream} isCameraOn={!remotes[0].isCamOff} isMicOn={!remotes[0].isMicOff} isHandRaised={remotes[0].isHandRaised||false} isFirstHand={remotes[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[0].volumeLevel} profileUrl={remotes[0].avatar} name={remotes[0].name} isPinned={remotes[0].id === pinnedId} onDoubleClick={() => togglePin(remotes[0].id)} className="w-full h-full" /></div>
            {remotes[1] && <div className="flex-1 min-w-0"><VideoTile stream={remotes[1].stream} isCameraOn={!remotes[1].isCamOff} isMicOn={!remotes[1].isMicOff} isHandRaised={remotes[1].isHandRaised||false} isFirstHand={remotes[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[1].volumeLevel} profileUrl={remotes[1].avatar} name={remotes[1].name} isPinned={remotes[1].id === pinnedId} onDoubleClick={() => togglePin(remotes[1].id)} className="w-full h-full" /></div>}
          </div>
          <div className="flex-1 flex gap-2 min-h-0">
            {remotes[2] && <div className="flex-1 min-w-0"><VideoTile stream={remotes[2].stream} isCameraOn={!remotes[2].isCamOff} isMicOn={!remotes[2].isMicOff} isHandRaised={remotes[2].isHandRaised||false} isFirstHand={remotes[2].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[2].volumeLevel} profileUrl={remotes[2].avatar} name={remotes[2].name} isPinned={remotes[2].id === pinnedId} onDoubleClick={() => togglePin(remotes[2].id)} className="w-full h-full" /></div>}
            {remotes[3] && <div className="flex-1 min-w-0"><VideoTile stream={remotes[3].stream} isCameraOn={!remotes[3].isCamOff} isMicOn={!remotes[3].isMicOff} isHandRaised={remotes[3].isHandRaised||false} isFirstHand={remotes[3].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[3].volumeLevel} profileUrl={remotes[3].avatar} name={remotes[3].name} isPinned={remotes[3].id === pinnedId} onDoubleClick={() => togglePin(remotes[3].id)} className="w-full h-full" /></div>}
          </div>
          <motion.div drag dragConstraints={mainContainerRef} dragMomentum={false} className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing z-30">
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
          </motion.div>
        </div>
      );
    }
    
    // For more than 5 participants
    if (count > 5 && localParticipant) {
      return (
        <div className="w-full h-full flex flex-col gap-2 relative" ref={mainContainerRef}>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[0].stream} isCameraOn={!remotes[0].isCamOff} isMicOn={!remotes[0].isMicOff} isHandRaised={remotes[0].isHandRaised||false} isFirstHand={remotes[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[0].volumeLevel} profileUrl={remotes[0].avatar} name={remotes[0].name} isPinned={remotes[0].id === pinnedId} onDoubleClick={() => togglePin(remotes[0].id)} className="w-full h-full" /></div>
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[1].stream} isCameraOn={!remotes[1].isCamOff} isMicOn={!remotes[1].isMicOff} isHandRaised={remotes[1].isHandRaised||false} isFirstHand={remotes[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[1].volumeLevel} profileUrl={remotes[1].avatar} name={remotes[1].name} isPinned={remotes[1].id === pinnedId} onDoubleClick={() => togglePin(remotes[1].id)} className="w-full h-full" /></div>
          </div>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[2].stream} isCameraOn={!remotes[2].isCamOff} isMicOn={!remotes[2].isMicOff} isHandRaised={remotes[2].isHandRaised||false} isFirstHand={remotes[2].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[2].volumeLevel} profileUrl={remotes[2].avatar} name={remotes[2].name} isPinned={remotes[2].id === pinnedId} onDoubleClick={() => togglePin(remotes[2].id)} className="w-full h-full" /></div>
            <div className="flex-1 min-w-0 relative">
              {remotes[3] && (
                <VideoTile
                  stream={remotes[3].stream}
                  isCameraOn={!remotes[3].isCamOff}
                  isMicOn={!remotes[3].isMicOff}
                  isHandRaised={remotes[3].isHandRaised || false}
                  isFirstHand={remotes[3].id === firstHandRaisedId}
                  raisedCount={raisedCount}
                  volumeLevel={remotes[3].volumeLevel}
                  profileUrl={remotes[3].avatar}
                  name={remotes[3].name}
                  isPinned={remotes[3].id === pinnedId}
                  onDoubleClick={() => togglePin(remotes[3].id)}
                  className="w-full h-full"
                />
              )}
              <Link href={`/dashboard/meeting/${meetingId}/participants?topic=${encodeURIComponent(topic)}`} className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center text-white hover:bg-black/50 transition-colors cursor-pointer z-20">
                  <Users className="h-10 w-10" />
                  <p className="font-bold text-xl mt-2">+{allParticipants.length - 5} more</p>
              </Link>
            </div>
          </div>
          <motion.div drag dragConstraints={mainContainerRef} dragMomentum={false} className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing z-30">
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
          </motion.div>
        </div>
      );
    }
    
    // Fallback for any uncovered case, renders a simple grid of all remote users.
    if (remotes.length > 0 && localParticipant) {
        const gridCols = Math.ceil(Math.sqrt(remotes.length));
        return (
            <div className="w-full h-full relative" ref={mainContainerRef}>
                <div className="w-full h-full grid gap-2 overflow-auto" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                    {remotes.map((p) => (
                        <div key={p.id} className="w-full h-full rounded-lg relative aspect-[9/16] md:aspect-video">
                            <VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} isPinned={p.id === pinnedId} onDoubleClick={() => togglePin(p.id)} onStopShare={isSharingScreen && p.id === userId ? handleStopSharing : undefined}/>
                        </div>
                    ))}
                </div>
                 <motion.div drag dragConstraints={mainContainerRef} dragMomentum={false} className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing z-30">
                    <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} draggable={true} onStopShare={isSharingScreen && localParticipant.id === userId ? handleStopSharing : undefined} />
                </motion.div>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1">
      {isHost && <HostJoinRequestNotification meetingId={meetingId} />}

      {privateMessage && (
        <div
          onClick={() => handleNotificationClick(privateMessage)}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-background/80 text-foreground backdrop-blur-sm rounded-2xl shadow-2xl border border-primary/30 px-6 py-4 flex items-center justify-between w-[90%] max-w-lg animate-slideDown cursor-pointer hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">New Private Message</p>
              <p className="text-sm text-muted-foreground">From: {privateMessage.from}</p>
            </div>
          </div>
          <Button size="sm">View</Button>
        </div>
      )}

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
            <Button onClick={toggleMic} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", micOn ? "bg-primary/80 hover:bg-primary" : "bg-destructive hover:bg-destructive/90")} aria-label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> : <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={() => toggleCamera()} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", camOn ? "bg-primary/80 hover:bg-primary" : "bg-destructive hover:bg-destructive/90")} aria-label={camOn ? "Stop Camera" : "Start Camera"}>{camOn ? <Video className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleShareClick} variant="ghost" className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isSharingScreen ? "bg-red-600 text-white hover:bg-red-700" : "bg-secondary/50 hover:bg-secondary/70 text-foreground")} aria-label={isSharingScreen ? "Stop Sharing" : "Share Screen"}>{isSharingScreen ? <ScreenShareOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <ScreenShare className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleToggleHandRaise} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isHandRaised ? "bg-primary/80 hover:bg-primary" : "bg-destructive hover:bg-destructive/90")} aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}><Hand className="h-5 w-5 sm:h-6 sm:w-6" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="h-12 sm:h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors px-4 sm:px-6" aria-label="Leave Meeting"><PhoneOff className="h-5 w-5 sm:h-6 sm-6" /><span className="ml-2 font-semibold hidden sm:inline">Leave</span></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isHost ? 'End or Leave Meeting?' : 'Leave Meeting?'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isHost 
                      ? "As the host, you can end the meeting for all participants or just leave yourself."
                      : "Are you sure you want to leave the meeting?"
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  {isHost ? (
                    <>
                      <AlertDialogAction onClick={() => onLeave(false)} className={cn(buttonVariants({variant: "outline"}))}>Leave Meeting</AlertDialogAction>
                      <AlertDialogAction onClick={() => onLeave(true)} className={cn(buttonVariants({variant: "destructive"}))}>End for All</AlertDialogAction>
                    </>
                  ) : (
                    <AlertDialogAction onClick={() => onLeave(false)} className={cn(buttonVariants({variant: "destructive"}))}>Leave</AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </footer>
    </div>
  );
}
