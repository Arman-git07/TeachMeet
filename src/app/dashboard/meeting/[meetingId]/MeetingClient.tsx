// src/app/dashboard/meeting/[meetingId]/MeetingClient.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MeshRTC } from "@/lib/webrtc/mesh";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff, ScreenShare, ScreenShareOff, Loader2, Check, X, Users, Pin, MessageSquare, Minimize2, Maximize2, XCircle, AlertTriangle } from "lucide-react";
import { collection, onSnapshot, doc, updateDoc, getDoc, writeBatch, serverTimestamp, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { getDownloadURL } from "firebase/storage";
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
import { useRouter } from "next/navigation";
import { useBlock } from "@/contexts/BlockContext";
import { useMeetingRTC } from "@/contexts/MeetingRTCContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MeetingChatPanel } from "./chat/MeetingChatPanel";


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
  onLeave: (endForAll?: boolean) => void;
  topic: string;
  initialPinnedId?: string | null;
};

export default function MeetingClient({ meetingId, userId, onLeave, topic, initialPinnedId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { isBlockedByMe } = useBlock();
  const { rtc, setRtc, setIsRecording, setIsUploading, setRecordingControls, addChatMessage } = useMeetingRTC();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  
  const [loadingMedia, setLoadingMedia] = useState(true);

  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [liveParticipants, setLiveParticipants] = useState<Map<string, LiveParticipantInfo>>(new Map());
  const [isHandRaised, setIsHandRaised] = useState(false);
  
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
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  
  const participantDocCreated = useRef(false);
  const audioUnlockedRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const saveDestinationRef = useRef<'private' | 'public'>('private');

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    const context = audioContextRef.current;
    if (context && context.state === 'suspended') {
      context.resume().then(() => {
        audioUnlockedRef.current = true;
        console.log("AudioContext resumed successfully on user interaction.");
      }).catch(e => console.error("Error resuming AudioContext:", e));
    }
  }, []);

  const handleRemoteLeft = useCallback((remoteUserId: string) => {
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(remoteUserId);
      return next;
    });
    
    setLiveParticipants(prev => {
        const next = new Map(prev);
        next.delete(remoteUserId);
        return next;
    });

    const entry = remoteAnalysersRef.current.get(remoteUserId);
    if (entry && entry.rafId) cancelAnimationFrame(entry.rafId);
    remoteAnalysersRef.current.delete(remoteUserId);
    setVolumeLevels(prev => { const next = new Map(prev); next.delete(remoteUserId); return next; });
    setPinnedId(prev => prev === remoteUserId ? null : prev);
  }, []);

  useEffect(() => {
    const rtcInstance = new MeshRTC({
      roomId: meetingId,
      userId,
      onRemoteStream: (remoteUserId, stream) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(remoteUserId, stream);
          return next;
        });
      },
      onRemoteLeft: handleRemoteLeft,
      onChatMessage: addChatMessage,
    });

    setRtc(rtcInstance);

    return () => {
      rtcInstance?.leave();
      setRtc(null);
    }
  }, [meetingId, userId, setRtc, handleRemoteLeft, addChatMessage]);


  const updateMyStatus = useCallback(async (status: Partial<LiveParticipantInfo>) => {
    if (user && meetingId && participantDocCreated.current) {
      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
      try {
        await updateDoc(participantRef, status);
      } catch (err) {
        console.error("Error updating participant status:", err);
      }
    }
  }, [user, meetingId]);
  
  const toggleCamera = useCallback(async (forceState?: boolean) => {
    if (!localStream || !rtc) return;
    const nextState = typeof forceState === 'boolean' ? forceState : !camOn;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = nextState;
      // CRITICAL FIX: Ensure the video track is synced to all peer connections
      // and trigger renegotiation if turning ON.
      if (nextState) {
        await rtc.replaceTrack(videoTrack);
      }
    }
    
    setCamOn(nextState);
    localStorage.setItem('teachmeet-cam-state', String(nextState));
    updateMyStatus({ isCameraOn: nextState });
  }, [localStream, camOn, updateMyStatus, rtc]);

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

  const startRecording = useCallback(async () => {
    if (!localStream || !user) {
        toast({ variant: 'destructive', title: 'Cannot Record', description: 'Local media is not available.' });
        return;
    }

    try {
        const options = { mimeType: 'video/webm; codecs=vp9' };
        mediaRecorderRef.current = new MediaRecorder(localStream, options);
        recordedChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = async () => {
          setIsUploading(true);
          const toastId = toast({ title: 'Processing Recording...', duration: Infinity });

          try {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const durationMs = Date.now() - recordingStartRef.current;
            const durationStr = new Date(durationMs).toISOString().substr(11, 8);

            const fileName = `rec_${topic.replace(/\s/g, '_')}_${new Date().toISOString()}.webm`;
            const destination = saveDestinationRef.current;
            const filePath = `recordings/${user.uid}/${destination}/${fileName}`;

            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, blob);
            const downloadURL = await getDownloadURL(fileRef);

            await addDoc(collection(db, 'recordings'), {
              name: fileName,
              date: new Date().toLocaleDateString(),
              duration: durationStr,
              size: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
              thumbnailUrl: `https://placehold.co/300x180.png?text=${encodeURIComponent(durationStr)}`,
              downloadURL,
              storagePath: filePath,
              uploaderId: user.uid,
              isPrivate: destination === 'private',
              createdAt: serverTimestamp(),
            });
            
            toast.update(toastId, { title: 'Recording Saved!', description: `Your recording is available in your ${destination} recordings.` });
          } catch (e: any) {
            toast.update(toastId, { variant: 'destructive', title: 'Upload Failed', description: e.message });
          } finally {
            setIsUploading(false);
          }
        };
        
        mediaRecorderRef.current.start(1000); // 1-second timeslice
        recordingStartRef.current = Date.now();
        setIsRecording(true);
        toast({ title: 'Recording Started', description: 'Your local audio and video are being recorded.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Recording Error', description: e.message });
    }
  }, [localStream, user, setIsRecording, setIsUploading, toast, topic]);

  const stopRecording = useCallback(async (destination: 'private' | 'public') => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          saveDestinationRef.current = destination;
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          toast({ title: 'Recording Stopped', description: 'Finalizing and uploading your recording...' });
      }
  }, [setIsRecording, toast]);

  useEffect(() => {
    setRecordingControls({ start: startRecording, stop: stopRecording });
  }, [setRecordingControls, startRecording, stopRecording]);

  useEffect(() => {
    const fetchMeetingCreator = async () => {
      setIsLoadingRole(true);
      try {
        const meetingDoc = await getDoc(doc(db, "meetings", meetingId));
        if (meetingDoc.exists()) {
          const hostId = meetingDoc.data().hostId;
          setIsHost(userId === hostId);
        }
      } catch (err) {
        console.error("Meeting doc fetch failed (likely offline):", err);
      } finally {
        setIsLoadingRole(false);
      }
    };
    fetchMeetingCreator();
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

  const onModalConfirm = async (shareAudio: boolean, mode: ShareMode) => {
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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: shareAudio });
      setScreenShareStream(stream);
      await screenShareHelper.startSharingWithStream(mode, stream);
      setIsSharingScreen(true);
      updateMyStatus({ isScreenSharing: true });
    } catch (err) {
      console.error("Screen share cancelled or failed:", err);
      setScreenShareStream(null);
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
    setScreenShareStream(null);
  };

 useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;
    const initMedia = async () => {
      setLoadingMedia(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        
        const desiredCamState = localStorage.getItem('teachmeet-cam-state') !== 'false';
        const desiredMicState = localStorage.getItem('teachmeet-mic-state') !== 'false';
        
        setCamOn(desiredCamState);
        setMicOn(desiredMicState);
        
        stream.getVideoTracks().forEach(track => { track.enabled = desiredCamState; });
        stream.getAudioTracks().forEach(track => { track.enabled = desiredMicState; });
        
        setLocalStream(stream);
      } catch (err: any) { 
        console.error("Media init error:", err); 
        let description = "An unknown error occurred while accessing your camera and microphone.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            description = "Permission to access camera and microphone was denied. Please check your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            description = "No camera or microphone was found on your device.";
        }
        toast({ variant: "destructive", title: "Media Error", description });
      } 
      finally { if (mounted) setLoadingMedia(false); }
    };
    initMedia();
    return () => {
      mounted = false;
      stream?.getTracks().forEach(t => t.stop());
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      try { audioContextRef.current?.close(); } catch(e) {}
      remoteAnalysersRef.current.forEach(entry => { if (entry.rafId) cancelAnimationFrame(entry.rafId); });
      remoteAnalysersRef.current.clear();
      screenShareHelper?.stopSharing();
    };
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

      if (localParticipantData && localParticipantData.isCameraOn === false && camOn) {
        toggleCamera(false);
        toast({ title: "Camera Turned Off", description: "The host has turned off your camera." });
      }

      setLiveParticipants(newParticipants);
    }, (err) => {
        console.warn("Meeting participants snapshot error (likely offline):", err);
    });
    return () => unsubscribe();
  }, [meetingId, userId, camOn, toast, toggleCamera]);

  useEffect(() => { if (localStream && rtc && user) { rtc.init(localStream, user.displayName || 'User', user.photoURL || undefined); } }, [rtc, localStream, user]);

  useEffect(() => {
    if (!localStream || localStream.getAudioTracks().length === 0 || !micOn) {
      if (localAnimationRef.current) cancelAnimationFrame(localAnimationRef.current);
      setVolumeLevels(prev => { const next = new Map(prev); next.set(userId, 0); return next; });
      return;
    }
    if (!audioContextRef.current) {
        try {
          if (typeof window !== 'undefined' && window.AudioContext) {
            const audioContext = new AudioContext();
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
            sourceRef.current = audioContext.createMediaStreamSource(localStream);
            sourceRef.current.connect(analyserRef.current);
            audioContextRef.current = audioContext;
          }
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
      if (isBlockedByMe(id, 'audio')) return; 
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
          const avg = sum / dataArray.length;
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
      if (!remoteStreams.has(id) || isBlockedByMe(id, 'audio')) {
        const ent = remoteAnalysersRef.current.get(id);
        if (ent && ent.rafId) cancelAnimationFrame(ent.rafId);
        remoteAnalysersRef.current.delete(id);
        setVolumeLevels(prev => { const next = new Map(prev); next.delete(id); return next; });
      }
    });
  }, [remoteStreams, isBlockedByMe]);

  useEffect(() => {
    const addSelfToParticipants = async () => {
        if (user && meetingId && !isLoadingRole && localStream && !participantDocCreated.current) {
            const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
            try {
                await setDoc(participantRef, {
                    name: user.displayName || 'Anonymous',
                    photoURL: user.photoURL || '',
                    isHost: isHost,
                    isCameraOn: camOn,
                    isMicOn: micOn,
                    joinedAt: serverTimestamp(),
                }, { merge: true });
                participantDocCreated.current = true;
            } catch (error) {
                console.error("Failed to add participant document:", error);
            }
        }
    };
    addSelfToParticipants();
  }, [user, meetingId, isHost, isLoadingRole, localStream, camOn, micOn]);

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
    
    if (isSharingScreen && screenShareHelper?.currentMode === 'replace') {
        self.stream = screenShareStream;
    }

    const remotes: Participant[] = Array.from(liveParticipants.entries())
      .filter(([id]) => id !== userId)
      .map(([id, data]) => {
        const videoBlocked = isBlockedByMe(id, 'video');
        const audioBlocked = isBlockedByMe(id, 'audio');
        const remoteStream = remoteStreams.get(id) || null;
        
        if (remoteStream && audioBlocked) {
            remoteStream.getAudioTracks().forEach(t => t.enabled = false);
        } else if (remoteStream && !audioBlocked) {
            remoteStream.getAudioTracks().forEach(t => t.enabled = true);
        }

        return {
          id, name: data.name || `User ${id.substring(0, 4)}`, avatar: data.photoURL || `https://placehold.co/40x40.png?text=${(data.name || 'G').charAt(0)}`,
          isHandRaised: data.isHandRaised, handRaisedAt: data.handRaisedAt, isScreenSharing: data.isScreenSharing,
          isCamOff: videoBlocked || !data.isCameraOn,
          isMicOff: audioBlocked || !data.isMicOn,
          stream: remoteStream, 
          volumeLevel: audioBlocked ? 0 : (volumeLevels.get(id) ?? 0),
        };
      });
      
    let all = [self, ...remotes];

    if (isSharingScreen && screenShareHelper?.currentMode === 'alongside' && screenShareStream) {
        self.isScreenSharing = false; // Main tile is camera
        const screenShareParticipant: Participant = {
            id: `${userId}-screen`,
            name: `${self.name}'s Screen`,
            avatar: self.avatar,
            isCamOff: false,
            isMicOff: true,
            isLocal: true,
            stream: screenShareStream,
            isScreenSharing: true,
            volumeLevel: 0,
        };
        all.push(screenShareParticipant);
    }
    
    const remoteOnly = all.filter(p => !p.isLocal);

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
  }, [user, micOn, camOn, liveParticipants, userId, localStream, remoteStreams, volumeLevels, isHandRaised, isSharingScreen, pinnedId, isBlockedByMe, screenShareHelper, screenShareStream]);

  const handleToggleHandRaise = useCallback(() => { const next = !isHandRaised; setIsHandRaised(next); updateMyStatus({ isHandRaised: next, handRaisedAt: next ? Date.now() : null }); }, [isHandRaised, updateMyStatus]);
  
  const togglePin = useCallback((id: string) => { 
    const newPinnedId = pinnedId === id ? null : id;
    setPinnedId(newPinnedId);
    
    const url = new URL(window.location.href);
    if (newPinnedId) {
        url.searchParams.set('pin', newPinnedId);
    } else {
        url.searchParams.delete('pin');
    }
    window.history.pushState({}, '', url);

  }, [pinnedId]);
  
  const toggleSpotlight = useCallback((id: string) => {
    setSpotlightId(prev => (prev === id ? null : id));
  }, []);

  const renderLayout = () => {
    const spotlightParticipant = spotlightId ? allParticipants.find(p => p.id === spotlightId) : null;

    if (spotlightParticipant) {
      return (
        <div className="w-full h-full p-2">
          <VideoTile
            stream={spotlightParticipant.stream}
            isCameraOn={!spotlightParticipant.isCamOff}
            isMicOn={!spotlightParticipant.isMicOff}
            name={spotlightParticipant.name}
            isScreenSharing={spotlightParticipant.isScreenSharing}
            onDoubleClick={() => toggleSpotlight(spotlightParticipant.id)}
            onSpotlightClick={() => toggleSpotlight(spotlightParticipant.id)}
            onUnpin={() => togglePin(spotlightParticipant.id)}
            className="w-full h-full"
            isSpotlight={true}
          />
        </div>
      );
    }
      
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
                                name={p.name}
                                isScreenSharing={true}
                                onDoubleClick={() => togglePin(p.id)}
                                onUnpin={() => togglePin(p.id)}
                                className="w-full h-full"
                                isPinned={p.id === pinnedId}
                                onSpotlightClick={() => toggleSpotlight(p.id)}
                            />
                        </div>
                    ))}
                </div>
                {otherTiles.length > 0 && (
                    <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-auto">
                    {otherTiles.map(p => (
                        <div key={p.id} className="aspect-[9/16] md:h-32 md:aspect-auto">
                        <VideoTile
                            stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOn} 
                            isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} 
                            volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} 
                            isScreenSharing={p.isScreenSharing} isPinned={p.id === pinnedId} onDoubleClick={() => togglePin(p.id)} onUnpin={() => togglePin(p.id)}
                            onSpotlightClick={() => toggleSpotlight(p.id)}
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

    if (count === 1) return <div className="w-full h-full flex items-center justify-center p-2"><div className="w-full h-full"><VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} onUnpin={() => togglePin(localParticipant.id)} onSpotlightClick={() => toggleSpotlight(localParticipant.id)} className="w-full h-full" /></div></div>;

    if (count === 2 && remotes.length === 1 && localParticipant) {
      return (
        <div className="w-full h-full relative" ref={mainContainerRef}>
            <VideoTile stream={remotes[0].stream} isCameraOn={!remotes[0].isCamOff} isMicOn={!remotes[0].isMicOff} isHandRaised={remotes[0].isHandRaised||false} isFirstHand={remotes[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[0].volumeLevel} profileUrl={remotes[0].avatar} name={remotes[0].name} isScreenSharing={remotes[0].isScreenSharing} isPinned={remotes[0].id === pinnedId} onDoubleClick={() => togglePin(remotes[0].id)} onUnpin={() => togglePin(remotes[0].id)} onSpotlightClick={() => toggleSpotlight(remotes[0].id)} className="w-full h-full" />
            <motion.div
              drag
              dragConstraints={mainContainerRef}
              dragMomentum={false}
              className="absolute bottom-4 right-4 sm:right-6 w-1/3 sm:w-1/4 md:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing"
            >
              <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} onUnpin={() => togglePin(localParticipant.id)} onSpotlightClick={() => toggleSpotlight(localParticipant.id)} draggable={true} />
            </motion.div>
        </div>
      );
    }
    
    if (count >= 3 && count <= 5 && localParticipant) {
      return (
        <div className="w-full h-full flex flex-col gap-2 relative" ref={mainContainerRef}>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[0].stream} isCameraOn={!remotes[0].isCamOff} isMicOn={!remotes[0].isMicOff} isHandRaised={remotes[0].isHandRaised||false} isFirstHand={remotes[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[0].volumeLevel} profileUrl={remotes[0].avatar} name={remotes[0].name} isPinned={remotes[0].id === pinnedId} onDoubleClick={() => togglePin(remotes[0].id)} onUnpin={() => togglePin(remotes[0].id)} onSpotlightClick={() => toggleSpotlight(remotes[0].id)} className="w-full h-full" /></div>
            {remotes[1] && <div className="flex-1 min-w-0"><VideoTile stream={remotes[1].stream} isCameraOn={!remotes[1].isCamOff} isMicOn={!remotes[1].isMicOff} isHandRaised={remotes[1].isHandRaised||false} isFirstHand={remotes[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[1].volumeLevel} profileUrl={remotes[1].avatar} name={remotes[1].name} isPinned={remotes[1].id === pinnedId} onDoubleClick={() => togglePin(remotes[1].id)} onUnpin={() => togglePin(remotes[1].id)} onSpotlightClick={() => toggleSpotlight(remotes[1].id)} className="w-full h-full" /></div>}
          </div>
          <div className="flex-1 flex gap-2 min-h-0">
            {remotes[2] && <div className="flex-1 min-w-0"><VideoTile stream={remotes[2].stream} isCameraOn={!remotes[2].isCamOff} isMicOn={!remotes[2].isMicOff} isHandRaised={remotes[2].isHandRaised||false} isFirstHand={remotes[2].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[2].volumeLevel} profileUrl={remotes[2].avatar} name={remotes[2].name} isPinned={remotes[2].id === pinnedId} onDoubleClick={() => togglePin(remotes[2].id)} onUnpin={() => togglePin(remotes[2].id)} onSpotlightClick={() => toggleSpotlight(remotes[2].id)} className="w-full h-full" /></div>}
            {remotes[3] && <div className="flex-1 min-w-0"><VideoTile stream={remotes[3].stream} isCameraOn={!remotes[3].isCamOff} isMicOn={!remotes[3].isMicOff} isHandRaised={remotes[3].isHandRaised||false} isFirstHand={remotes[3].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[3].volumeLevel} profileUrl={remotes[3].avatar} name={remotes[3].name} isPinned={remotes[3].id === pinnedId} onDoubleClick={() => togglePin(remotes[3].id)} onUnpin={() => togglePin(remotes[3].id)} onSpotlightClick={() => toggleSpotlight(remotes[3].id)} className="w-full h-full" /></div>}
          </div>
          <motion.div drag dragConstraints={mainContainerRef} dragMomentum={false} className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing z-30">
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} onUnpin={() => togglePin(localParticipant.id)} onSpotlightClick={() => toggleSpotlight(localParticipant.id)} draggable={true} />
          </motion.div>
        </div>
      );
    }
    
    if (count > 5 && localParticipant) {
      return (
        <div className="w-full h-full flex flex-col gap-2 relative" ref={mainContainerRef}>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[0].stream} isCameraOn={!remotes[0].isCamOff} isMicOn={!remotes[0].isMicOff} isHandRaised={remotes[0].isHandRaised||false} isFirstHand={remotes[0].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[0].volumeLevel} profileUrl={remotes[0].avatar} name={remotes[0].name} isPinned={remotes[0].id === pinnedId} onDoubleClick={() => togglePin(remotes[0].id)} onUnpin={() => togglePin(remotes[0].id)} onSpotlightClick={() => toggleSpotlight(remotes[0].id)} className="w-full h-full" /></div>
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[1].stream} isCameraOn={!remotes[1].isCamOff} isMicOn={!remotes[1].isMicOff} isHandRaised={remotes[1].isHandRaised||false} isFirstHand={remotes[1].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[1].volumeLevel} profileUrl={remotes[1].avatar} name={remotes[1].name} isPinned={remotes[1].id === pinnedId} onDoubleClick={() => togglePin(remotes[1].id)} onUnpin={() => togglePin(remotes[1].id)} onSpotlightClick={() => toggleSpotlight(remotes[1].id)} className="w-full h-full" /></div>
          </div>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="flex-1 min-w-0"><VideoTile stream={remotes[2].stream} isCameraOn={!remotes[2].isCamOff} isMicOn={!remotes[2].isMicOff} isHandRaised={remotes[2].isHandRaised||false} isFirstHand={remotes[2].id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={remotes[2].volumeLevel} profileUrl={remotes[2].avatar} name={remotes[2].name} isPinned={remotes[2].id === pinnedId} onDoubleClick={() => togglePin(remotes[2].id)} onUnpin={() => togglePin(remotes[2].id)} onSpotlightClick={() => toggleSpotlight(remotes[2].id)} className="w-full h-full" /></div>
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
                  onUnpin={() => togglePin(remotes[3].id)}
                  onSpotlightClick={() => toggleSpotlight(remotes[3].id)}
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
            <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} onUnpin={() => togglePin(localParticipant.id)} onSpotlightClick={() => toggleSpotlight(localParticipant.id)} draggable={true} />
          </motion.div>
        </div>
      );
    }
    
    if (remotes.length > 0 && localParticipant) {
        const gridCols = Math.ceil(Math.sqrt(remotes.length));
        return (
            <div className="w-full h-full relative" ref={mainContainerRef}>
                <div className="w-full h-full grid gap-2 overflow-auto" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                    {remotes.map((p) => (
                        <div key={p.id} className="w-full h-full rounded-lg relative aspect-[9/16] md:aspect-video">
                            <VideoTile stream={p.stream} isCameraOn={!p.isCamOff} isMicOn={!p.isMicOff} isHandRaised={p.isHandRaised || false} isFirstHand={p.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={p.volumeLevel} isLocal={!!p.isLocal} profileUrl={p.avatar} name={p.name} isScreenSharing={p.isScreenSharing} isPinned={p.id === pinnedId} onDoubleClick={() => togglePin(p.id)} onUnpin={() => togglePin(p.id)} onSpotlightClick={() => toggleSpotlight(p.id)} />
                        </div>
                    ))}
                </div>
                 <motion.div drag dragConstraints={mainContainerRef} dragMomentum={false} className="absolute bottom-4 right-4 sm:right-6 w-1/4 sm:w-1/5 max-w-xs shadow-lg rounded-lg aspect-[9/16] md:aspect-video isolate cursor-grab active:cursor-grabbing z-30">
                    <VideoTile stream={localParticipant.stream} isCameraOn={!localParticipant.isCamOff} isMicOn={!localParticipant.isMicOff} isHandRaised={localParticipant.isHandRaised || false} isFirstHand={localParticipant.id === firstHandRaisedId} raisedCount={raisedCount} volumeLevel={localParticipant.volumeLevel} isLocal={true} profileUrl={localParticipant.avatar} name={localParticipant.name} isScreenSharing={localParticipant.isScreenSharing} isPinned={localParticipant.id === pinnedId} className="w-full h-full" onDoubleClick={() => togglePin(localParticipant.id)} onUnpin={() => togglePin(localParticipant.id)} onSpotlightClick={() => toggleSpotlight(localParticipant.id)} draggable={true} />
                </motion.div>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1" onClick={unlockAudio}>
      <MeetingChatPanel />
      {isHost && <HostJoinRequestNotification meetingId={meetingId} />}
      <ScreenShareModal open={isScreenShareModalOpen} onClose={() => setIsScreenShareModalOpen(false)} onConfirm={onModalConfirm} />

      <main className="flex-1 overflow-hidden relative" ref={mainContainerRef}>
          <div className={"w-full h-full p-2 transition-all duration-300"}>
            {loadingMedia ? (
                <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
              renderLayout()
            )}
          </div>
          {isSharingScreen && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center pointer-events-none">
              <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-3 pointer-events-auto">
                <p className="text-foreground font-medium">You're sharing your screen with everyone</p>
                <Button onClick={handleStopSharing} variant="destructive" size="sm" className="rounded-full px-4">
                  <ScreenShareOff className="mr-2 h-4 w-4" />
                  Stop sharing
                </Button>
              </div>
            </div>
          )}
      </main>

      <footer className="p-2 sm:p-4 bg-background shrink-0 relative z-10">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button onClick={toggleMic} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", micOn ? "bg-primary/80 hover:bg-primary" : "bg-destructive hover:bg-destructive/90")} aria-label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> : <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={() => toggleCamera()} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", camOn ? "bg-primary/80 hover:bg-primary" : "bg-destructive hover:bg-destructive/90")} aria-label={camOn ? "Stop Camera" : "Start Camera"}>{camOn ? <Video className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleShareClick} variant="ghost" className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isSharingScreen ? "bg-red-600 text-white hover:bg-red-700" : "bg-secondary/50 hover:bg-secondary/70 text-foreground")} aria-label={isSharingScreen ? "Stop Sharing" : "Share Screen"}>{isSharingScreen ? <ScreenShareOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <ScreenShare className="h-5 w-5 sm:h-6 sm:w-6" />}</Button>
            <Button onClick={handleToggleHandRaise} className={cn("rounded-full flex items-center justify-center transition-colors h-12 w-12 sm:h-14 sm:w-14", isHandRaised ? "bg-primary/80 hover:bg-primary" : "bg-destructive hover:bg-destructive/90")} aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}><Hand className="h-5 w-5 sm:h-6 sm:w-6" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="h-12 sm:h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors px-4 sm:px-6" aria-label="Leave Meeting"><PhoneOff className="h-5 w-5 sm:h-6 sm:6" /><span className="ml-2 font-semibold hidden sm:inline">Leave</span></Button>
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
