
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { ShareOptionsPanel } from '@/components/common/ShareOptionsPanel';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Settings,
  Users,
  MoreVertical,
  Hand,
  Maximize,
  Edit3,
  AlertTriangle,
  AlertCircle,
  ScreenShare,
  StopCircle,
  Loader2,
  Share2,
  LayoutGrid,
  PanelRight,
  GalleryVertical,
  Radio,
  PanelLeftClose,
  PanelRightClose,
  ShieldCheck,
  Bell,
  Check,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { auth, db, storage } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, serverTimestamp, query, DocumentData, getDoc, addDoc, arrayRemove, arrayUnion, writeBatch, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

interface Participant {
  id: string;
  name: string;
  isMe?: boolean;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  stream?: MediaStream | null;
  hasCameraPermissionForView?: boolean | null;
  isHandRaisedForView?: boolean;
  isScreenSharing?: boolean;
  photoURL?: string | null;
}

interface JoinRequest {
  id: string; // userId of the requestor
  name: string;
  photoURL?: string | null;
}

const ParticipantView = React.memo(({
  name,
  isMe = false,
  isMicMuted = false,
  isCameraOff = false,
  stream,
  isHandRaisedForView,
  isScreenSharing,
  photoURL,
}: Participant) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mirrorVideo, setMirrorVideo] = useState(false);

  useEffect(() => {
      if (isMe) {
        setMirrorVideo(localStorage.getItem('teachmeet-camera-mirror') === 'true');
      }
  }, [isMe]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  const handleFullScreenClick = () => {
    const targetElement = videoRef.current;
    if (targetElement && (targetElement.srcObject || !isCameraOff)) {
      if (targetElement.requestFullscreen) {
        targetElement.requestFullscreen().catch((err) => {
          console.error("Error entering fullscreen:", err);
          toast({ variant: 'destructive', title: 'Fullscreen Error', description: 'Could not enter fullscreen mode.' });
        });
      } else {
        toast({ variant: 'destructive', title: 'Fullscreen Not Supported', description: 'Your browser does not support this fullscreen action.' });
      }
    } else {
      toast({ title: 'No Video Stream', description: 'Cannot enter full screen without an active video stream.' });
    }
  };

  const avatarFallbackName = name ? name.charAt(0).toUpperCase() : 'U';
  const avatarSrc = photoURL || `https://placehold.co/128x128.png?text=${avatarFallbackName}`;
  const showVideo = stream && !isCameraOff && !isScreenSharing;

  return (
    <Card className="rounded-xl overflow-hidden relative shadow-lg border-2 border-border/30 hover:border-primary hover:shadow-primary/20 transition-all duration-300 ease-in-out group w-full h-full">
      <video
        ref={videoRef}
        muted={isMe} // Only self-view should be muted
        autoPlay
        playsInline
        className={cn("w-full h-full object-cover bg-black", !showVideo && "hidden", isMe && mirrorVideo && "video-mirror")}
      />
      
      {!showVideo && (
        <div className="absolute inset-0 w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
            {isScreenSharing ? (
                <>
                    <ScreenShare className="w-16 h-16 text-muted-foreground mb-2"/>
                    <p className="text-base font-medium text-foreground">{isMe ? "You are sharing your screen" : `${name} is sharing`}</p>
                </>
            ) : (
                <>
                    <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
                        <AvatarImage src={avatarSrc} alt={name} data-ai-hint="user avatar" />
                        <AvatarFallback className="text-3xl md:text-4xl">{avatarFallbackName}</AvatarFallback>
                    </Avatar>
                    <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
                    {isCameraOff && (
                      <VideoOff className="w-7 h-7 text-muted-foreground mt-1" title="Camera off"/>
                    )}
                </>
            )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-gradient-to-r from-black/70 to-transparent px-3 py-1.5 rounded-md backdrop-blur-sm">
        <p className="text-sm font-medium text-white shadow-sm">{name} {isMe && <span className="text-xs opacity-80">(You)</span>}</p>
      </div>
      <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm shadow-md">
        {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </div>
      {isHandRaisedForView && (
        <div className="absolute top-2 left-2 bg-accent/80 text-accent-foreground p-1.5 rounded-full backdrop-blur-sm shadow-md animate-pulse">
          <Hand className="h-4 w-4" />
        </div>
      )}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button
          variant="ghost"
          size="icon"
          className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm shadow-md"
          onClick={handleFullScreenClick}
          aria-label="Toggle full screen"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
});
ParticipantView.displayName = 'ParticipantView';

const RecordingTimer = React.memo(({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return <span className="text-xs font-mono tabular-nums">{formatTime(elapsed)}</span>;
});
RecordingTimer.displayName = 'RecordingTimer';


export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;

  const searchParamsHook = useSearchParams();
  const topic = searchParamsHook.get('topic');
  const { toast, dismiss } = useToast();
  const router = useRouter();
  const currentUser = auth.currentUser;
  const { setHeaderContent } = useDynamicHeader();

  const [localMicMuted, setLocalMicMuted] = useState(true);
  const [localCameraOff, setLocalCameraOff] = useState(true);
  const [localHandRaised, setLocalHandRaised] = useState(false);
  const [realtimeParticipants, setRealtimeParticipants] = useState<Participant[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [joinStatus, setJoinStatus] = useState<'pending' | 'joining' | 'joined' | 'failed'>('pending');

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);

  const [isScreenSharingActive, setIsScreenSharingActive] = useState(false);
  const [isShareScreenDialogVisible, setIsShareScreenDialogVisible] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);

  const [meetingCreatorId, setMeetingCreatorId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  
  const displayTitle = topic ? `${topic}` : `Meeting ID: ${meetingId}`;
  const meetingLinkForShare = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/meeting/${meetingId}/wait${topic ? `?topic=${encodeURIComponent(topic)}` : ''}` : '';
  
  const acceptedParticipants = realtimeParticipants;
  const selfView = acceptedParticipants.find(p => p.id === currentUser?.uid);
  const remoteParticipants = acceptedParticipants.filter(p => p.id !== currentUser?.uid);

  const host = remoteParticipants.find(p => p.id === meetingCreatorId);
  const otherParticipants = remoteParticipants.filter(p => p.id !== meetingCreatorId);

  const mainGridParticipants = (host ? [host] : []).concat(otherParticipants).slice(0, 4);

  const isCurrentUserHost = currentUser?.uid === meetingCreatorId;

  const prevRequestCountRef = useRef(0);
  
  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(error => {
      console.error("Failed to play notification sound:", error);
    });
  }, []);

  const handleDenyRequest = useCallback(async (request: JoinRequest) => {
    if (!isCurrentUserHost) return;
    try {
        const requestRef = doc(db, "meetings", meetingId, "joinRequests", request.id);
        await deleteDoc(requestRef);
        toast({ title: "Request Denied", description: `${request.name}'s request to join has been denied.` });
    } catch (error) {
        console.error("Failed to deny request:", error);
        toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not deny the request.' });
    }
  }, [isCurrentUserHost, meetingId, toast]);
  
  const handleApproveRequest = useCallback(async (request: JoinRequest) => {
    if (!isCurrentUserHost) return;
    
    try {
        const batch = writeBatch(db);
        
        const requestDocRef = doc(db, "meetings", meetingId, "joinRequests", request.id);
        const requestDataSnap = await getDoc(requestDocRef);

        if (requestDataSnap.exists()) {
             const participantRef = doc(db, "meetings", meetingId, "participants", request.id);
             batch.set(participantRef, {
                ...requestDataSnap.data(),
                isMicMuted: true,
                isCameraOff: true,
                isHandRaised: false,
                isScreenSharing: false,
                joinedAt: serverTimestamp(),
            });
            batch.delete(requestDocRef);
        } else {
          throw new Error("Request document no longer exists.");
        }
        
        await batch.commit();

        toast({ title: "Request Approved", description: `${request.name} has been allowed to join.` });
    } catch (error) {
        console.error("Failed to approve request:", error);
        toast({ variant: 'destructive', title: 'Approval Failed', description: 'Could not add the participant. Check Firestore rules.' });
    }
  }, [isCurrentUserHost, meetingId, toast]);


  useEffect(() => {
    if (!isCurrentUserHost || !meetingId) return;
  
    const requestsRef = collection(db, `meetings/${meetingId}/joinRequests`);
    const q = query(requestsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const pending = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as JoinRequest));
        setJoinRequests(pending);

        if (pending.length > prevRequestCountRef.current && pending.length > 0) {
            playNotificationSound();
        }
        prevRequestCountRef.current = pending.length;
    }, (error) => {
        console.error("Error listening for join requests:", error);
        toast({ variant: "destructive", title: "Join Request Error", description: "Could not listen for join requests. Check Firestore rules."})
    });

    return () => unsubscribe();
  }, [isCurrentUserHost, meetingId, toast, playNotificationSound]);

  useEffect(() => {
      const displayedToasts = new Set<string>();

      joinRequests.forEach(request => {
          const toastId = `join-request-${request.id}`;
          if (displayedToasts.has(toastId)) return;

          toast({
              id: toastId,
              title: 'Join Request',
              description: `${request.name || 'A user'} wants to join the meeting.`,
              duration: Infinity,
              action: (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-lg h-8" onClick={() => { handleApproveRequest(request); dismiss(toastId); }}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-lg h-8" onClick={() => { handleDenyRequest(request); dismiss(toastId); }}>
                     <X className="h-4 w-4 mr-1" /> Deny
                  </Button>
                </div>
              ),
          });
          displayedToasts.add(toastId);
      });

  }, [joinRequests, toast, dismiss, handleApproveRequest, handleDenyRequest]);


  const handleReportIssue = () => {
    toast({
      title: "Report Issue",
      description: "Issue reporting feature is planned. For now, please note the issue and report through help channels.",
      duration: 5000,
    });
  };

  const handleOpenSharePanel = () => {
    setIsSharePanelOpen(true);
  };

  const handleToggleShareScreen = () => {
    if (isScreenSharingActive) {
      stopScreenShare();
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast({
            variant: "destructive",
            title: "Screen Share Not Supported",
            description: "Screen sharing is not available in your browser or current environment. Please try a different browser or ensure you are on a secure connection (HTTPS).",
            duration: 7000
        });
        return;
      }
      setIsShareScreenDialogVisible(true);
    }
  };
  
  const handleOpenWhiteboard = () => {
    router.push(`/dashboard/meeting/${meetingId}/whiteboard`);
  };

  const handleOpenChat = () => {
    router.push(`/dashboard/meeting/${meetingId}/chat${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`);
  };

  const handleOpenParticipants = () => {
    setIsParticipantsPanelOpen(true);
  };

  const handleToggleRecording = async () => {
    if (!isCurrentUserHost || !currentUser) return;
    
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      const endTime = Date.now();
      const durationMs = recordingStartTime ? endTime - recordingStartTime : 0;
      setRecordingStartTime(null);

      const durationMinutes = Math.floor(durationMs / 60000);
      const durationSeconds = Math.round((durationMs % 60000) / 1000);
      const durationString = `${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;

      toast({ title: "Recording Stopped", description: `Processing recording... Duration: ${durationString}` });
      
      const recordingName = `${topic || 'TeachMeet Recording'} - ${new Date().toLocaleDateString()}`;
      const recordingSize = (Math.random() * 200 + 50).toFixed(2); // Mock size in MB
      
      try {
        const userId = currentUser.uid;
        const storagePath = `recordings/${userId}/public/${Date.now()}-${recordingName.replace(/\s+/g, '_')}.mp4`;
        
        const placeholderBlob = new Blob(["mock recording data"], { type: 'video/mp4' });
        const fileRef = storageRef(storage, storagePath);
        await uploadBytes(fileRef, placeholderBlob);
        const downloadURL = `https://placehold.co/300x180.png?text=Recorded`;

        await addDoc(collection(db, "recordings"), {
          name: recordingName,
          date: new Date().toLocaleDateString(),
          duration: durationString,
          size: `${recordingSize}MB`,
          uploaderId: userId,
          isPrivate: false, 
          downloadURL,
          storagePath,
          createdAt: serverTimestamp(),
          thumbnailUrl: `https://placehold.co/300x180.png?text=${encodeURIComponent(topic?.substring(0,10) || 'Rec')}`,
        });
        
        toast({ title: "Recording Saved!", description: "The recording is now available in your library." });
      } catch (error) {
        console.error("Failed to save recording:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the recording file.' });
      }
    } else {
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      toast({ title: "Recording Started", description: "The meeting is now being recorded." });
    }
  };


  useEffect(() => {
    const newHeaderContent = (
      <div className="flex items-center justify-between w-full gap-2 sm:gap-4">
        <div className="flex-shrink min-w-0 flex items-center gap-2">
           {isRecording && recordingStartTime && (
            <div className="flex items-center gap-1.5 text-red-500 animate-pulse bg-red-500/10 px-2 py-1 rounded-md">
              <Radio className="h-4 w-4" />
              <RecordingTimer startTime={recordingStartTime} />
            </div>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground truncate" title={displayTitle}>
              {displayTitle}
            </h2>
            {acceptedParticipants.length > 0 && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                {acceptedParticipants.length} Participant{acceptedParticipants.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg">
             {isCurrentUserHost && (
              <DropdownMenuItem onClick={handleToggleRecording} className="cursor-pointer">
                {isRecording ? <StopCircle className="mr-2 h-4 w-4 text-destructive" /> : <Radio className="mr-2 h-4 w-4" />}
                {isRecording ? "Stop Recording" : "Start Recording"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleOpenSharePanel} className="cursor-pointer">
              <Share2 className="mr-2 h-4 w-4" /> Share Invite
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleShareScreen} className="cursor-pointer">
              {isScreenSharingActive ? <StopCircle className="mr-2 h-4 w-4 text-destructive" /> : <ScreenShare className="mr-2 h-4 w-4" />}
              {isScreenSharingActive ? "Stop Sharing Screen" : "Share Screen"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenWhiteboard} className="cursor-pointer">
              <Edit3 className="mr-2 h-4 w-4" /> Open Whiteboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenChat} className="cursor-pointer">
              <MessageSquare className="mr-2 h-4 w-4" /> Chat
            </DropdownMenuItem>
             <DropdownMenuItem onClick={handleOpenParticipants} className="cursor-pointer"><Users className="mr-2 h-4 w-4" /> Participants</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleReportIssue} className="text-destructive focus:text-destructive cursor-pointer">
              <AlertCircle className="mr-2 h-4 w-4" /> Report Issue
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
    setHeaderContent(newHeaderContent);

    return () => {
      setHeaderContent(null);
    };
  }, [
      setHeaderContent, 
      displayTitle, 
      acceptedParticipants.length, 
      isScreenSharingActive, 
      router, 
      isCurrentUserHost,
      isRecording,
      recordingStartTime
    ]);


  useEffect(() => {
    if (!currentUser || !meetingId || !db) {
      if (joinStatus === 'pending') setJoinStatus('failed');
      return;
    }

    const joinMeetingRoom = async () => {
      setJoinStatus('joining');

      const initialCameraOff = typeof window !== 'undefined' ? localStorage.getItem('teachmeet-desired-camera-state') !== 'on' : true;
      const initialMicMuted = typeof window !== 'undefined' ? localStorage.getItem('teachmeet-desired-mic-state') !== 'on' : true;
      setLocalCameraOff(initialCameraOff);
      setLocalMicMuted(initialMicMuted);

      const meetingDocRef = doc(db, "meetings", meetingId);
      
      try {
        const meetingDocSnap = await getDoc(meetingDocRef);
        if (!meetingDocSnap.exists()) {
          console.error("[MeetingPage] Meeting document does not exist. This shouldn't happen.");
          setJoinStatus('failed');
          return;
        }

        const meetingData = meetingDocSnap.data();
        const creatorId = meetingData?.creatorId || null;
        setMeetingCreatorId(creatorId);
        
        const participantDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
        
        await setDoc(participantDocRef, {
            name: currentUser.displayName || currentUser.email?.split('@')[0] || "User",
            photoURL: currentUser.photoURL,
            isMicMuted: initialMicMuted,
            isCameraOff: initialCameraOff,
            isHandRaised: false,
            isScreenSharing: false,
            joinedAt: serverTimestamp(),
        }, { merge: true });
        
        setJoinStatus('joined');

      } catch (error) {
        console.error("[MeetingPage] CRITICAL: Failed to join meeting room:", error);
        toast({
          variant: "destructive",
          title: "Failed to Join Meeting Room",
          description: `Could not register your presence: ${(error as Error).message}. Check console & Firestore rules.`,
          duration: 10000,
        });
        setJoinStatus('failed');
      }
    };

    if (joinStatus === 'pending') {
      joinMeetingRoom();
    }
  }, [currentUser, meetingId, db, toast, joinStatus, searchParamsHook]);

  const stopScreenShare = useCallback(async (showToast = true) => {
    if (!isScreenSharingActive) return;

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current = null;
    }
    setIsScreenSharingActive(false);
    await updateUserStatusInFirestore({ isScreenSharing: false, isCameraOff: localCameraOff });

    if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !localCameraOff;
        }
    }

    if (showToast) {
        toast({ title: "Screen Sharing Stopped" });
    }
    setRealtimeParticipants(prev => [...prev]);
  }, [isScreenSharingActive, localCameraOff, toast]);

  const leaveMeeting = useCallback(async (shouldRedirect = true) => {
    if(isScreenSharingActive) {
        await stopScreenShare(false).catch(e => console.error("Error stopping screen share on leave:", e));
    }
    localStreamRef.current?.getTracks().forEach(track => track.stop());

    if (currentUser && meetingId && db) {
      try {
        if (isCurrentUserHost) {
          // If host leaves, delete the entire meeting document
          await deleteDoc(doc(db, "meetings", meetingId));

          // Also remove from localStorage
          const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';
          const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
          if (startedMeetingsRaw) {
              let startedMeetings = JSON.parse(startedMeetingsRaw);
              if (Array.isArray(startedMeetings)) {
                  startedMeetings = startedMeetings.filter((m: any) => m.id !== meetingId);
                  localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(startedMeetings));
              }
          }

          toast({ title: "Meeting Ended", description: "As the host, you have ended the meeting for all participants." });
        } else {
          // If participant leaves, just delete their own document
          await deleteDoc(doc(db, "meetings", meetingId, "participants", currentUser.uid));
        }
      } catch (error) {
        console.error("[MeetingPage] Error on leave:", error);
      }
    }
    
    if (shouldRedirect) {
      router.push('/');
    }
  }, [isScreenSharingActive, stopScreenShare, currentUser, meetingId, db, isCurrentUserHost, router, toast]);

   useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (auth.currentUser && meetingId && db) {
        await leaveMeeting(false); // Call leaveMeeting on unload, without redirect
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [meetingId, leaveMeeting]);

  useEffect(() => {
    if (joinStatus !== 'joined') return;

    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const q = query(participantsColRef);
    const unsubscribeParticipants = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSnap: DocumentData) => {
        const data = docSnap.data();
        const participantId = docSnap.id;
        const isCurrentUser = currentUser?.uid === participantId;
        
        fetchedParticipants.push({
          id: participantId,
          name: data.name || "Guest",
          photoURL: data.photoURL,
          isMicMuted: data.isMicMuted,
          isCameraOff: isCurrentUser ? (isScreenSharingActive ? true : localCameraOff) : data.isCameraOff,
          isHandRaisedForView: data.isHandRaised,
          isScreenSharing: data.isScreenSharing,
          isMe: isCurrentUser,
          stream: isCurrentUser ? (isScreenSharingActive ? screenShareStreamRef.current : localStreamRef.current) : null,
        });
      });
      setRealtimeParticipants(fetchedParticipants);
    }, (error) => {
        console.error("[MeetingPage] Error fetching participants from Firestore:", error);
        toast({
          variant: "destructive",
          title: "Participant List Error",
          description: "Could not load participant list. Error: " + error.message,
          duration: 7000,
        });
    });

    const meetingDocRef = doc(db, 'meetings', meetingId);
    const unsubscribeMeeting = onSnapshot(meetingDocRef, (docSnap) => {
        if (!docSnap.exists()) {
            toast({
                title: "Meeting Ended",
                description: "The host has ended the meeting.",
                duration: 5000,
            });
            router.push('/');
        }
    });

    return () => {
      unsubscribeParticipants();
      unsubscribeMeeting();
    };
  }, [meetingId, toast, joinStatus, currentUser, localCameraOff, isScreenSharingActive, router]);

  useEffect(() => {
    if (joinStatus !== 'joined') return;

    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
        localStreamRef.current = stream;
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !localCameraOff;
        }
        
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !localMicMuted;
        }
        setRealtimeParticipants(prev => [...prev]);

      } catch (err) {
        console.error("[MeetingPage] Failed to get media on mount:", err);
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          toast({ variant: 'destructive', title: 'Permissions Denied', description: 'Camera and microphone access was denied. Please enable them in your browser settings.' });
          setLocalCameraOff(true);
          setLocalMicMuted(true);
          await updateUserStatusInFirestore({ isCameraOff: true, isMicMuted: true });
        } else {
            toast({ variant: 'destructive', title: 'Media Device Error', description: 'Could not find a camera or microphone. Please check your devices.' });
        }
      }
    };

    if (!isScreenSharingActive) {
      initializeMedia();
    }
    
  }, [joinStatus, isScreenSharingActive, localCameraOff, localMicMuted, toast]);

  const updateUserStatusInFirestore = async (updates: { [key: string]: any }) => {
    if (!currentUser || !meetingId || !db || joinStatus !== 'joined') return;
    const userDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
    try {
      await updateDoc(userDocRef, updates);
    } catch (error) {
      if ((error as any).code !== 'not-found') {
        console.error("[MeetingPage] Error updating user status in Firestore:", error);
        toast({ variant: "destructive", title: "Sync Error", description: "Could not update your status." });
      }
    }
  };

  const toggleMic = async () => {
    const newMicStateIsMuted = !localMicMuted;
    setLocalMicMuted(newMicStateIsMuted);
    await updateUserStatusInFirestore({ isMicMuted: newMicStateIsMuted });

    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !newMicStateIsMuted;
        toast({ title: newMicStateIsMuted ? "Microphone OFF" : "Microphone ON" });
      }
    }
  };

  const toggleCamera = async () => {
    if (isScreenSharingActive) {
      await stopScreenShare(false);
    }
    
    const newCameraStateIsOff = !localCameraOff;
    setLocalCameraOff(newCameraStateIsOff);
    await updateUserStatusInFirestore({ isCameraOff: newCameraStateIsOff });

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !newCameraStateIsOff;
      }
    }
  };

  const toggleHandRaise = () => {
    const newHandState = !localHandRaised;
    setLocalHandRaised(newHandState);
    updateUserStatusInFirestore({ isHandRaised: newHandState });
    if (newHandState) {
      toast({ title: "Hand Raised!", description: "You raised your hand." });
    } else {
      toast({ title: "Hand Lowered", description: "You lowered your hand." });
    }
  };

  const handleConfirmShareScreen = async () => {
    setIsShareScreenDialogVisible(false);
    if (isScreenSharingActive) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast({
        variant: "destructive",
        title: "Screen Share Not Supported",
        description: "Screen sharing is not available in your browser or current environment. Please ensure you are on a secure (HTTPS) connection.",
        duration: 7000
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = false;
      }

      screenShareStreamRef.current = stream;
      
      setIsScreenSharingActive(true);
      await updateUserStatusInFirestore({ isScreenSharing: true, isCameraOff: true });
      toast({ title: "Screen Sharing Started" });

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      setRealtimeParticipants(prev => [...prev]);

    } catch (err) {
      console.error("[MeetingPage] Error starting screen share:", err);
      if ((err as DOMException).name === 'NotAllowedError') {
        toast({ variant: "destructive", title: "Screen Share Cancelled", description: "You cancelled screen selection or denied permission." });
      } else {
        toast({ variant: "destructive", title: "Screen Share Failed", description: "Could not start screen sharing." });
      }
    }
  };
  

  if (joinStatus === 'pending' || joinStatus === 'joining') {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {joinStatus === 'pending' ? 'Preparing Meeting Room...' : 'Joining Meeting Room...'}
        </h2>
        <p className="text-muted-foreground">Please wait a moment.</p>
      </div>
    );
  }

  if (joinStatus === 'failed') {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">
          Failed to Join Meeting
        </h2>
        <p className="text-muted-foreground mb-6">
          We couldn't register your presence in the meeting. This might be due to a network issue, a problem with the meeting setup, or Firestore security rules preventing access. Please check the browser console for more details.
        </p>
        <Button onClick={() => router.push('/')} className="rounded-lg">
          Go to Homepage
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background/95 relative overflow-hidden">
      <div className={cn("flex flex-1 overflow-hidden transition-all duration-300 ease-in-out", isParticipantsPanelOpen ? "mr-[300px]" : "mr-0")}>
        <main className="flex-1 p-2 sm:p-4">
            {(() => {
            if (remoteParticipants.length === 0) {
                return (
                <div className="h-full w-full">
                    {selfView ? (
                    <ParticipantView {...selfView} />
                    ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center bg-muted rounded-xl">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground">Connecting your video...</p>
                        <p className="text-xs text-muted-foreground mt-2">Make sure you've granted camera permissions.</p>
                    </div>
                    )}
                </div>
                );
            }
            if (remoteParticipants.length === 1) {
                return (
                <div className="h-full w-full">
                    <ParticipantView {...remoteParticipants[0]} />
                </div>
                );
            }
            if (remoteParticipants.length === 2) {
                return (
                <div className="h-full w-full flex flex-col gap-2 sm:gap-4">
                    {remoteParticipants.map(participant => (
                    <div key={participant.id} className="flex-1 min-h-0">
                        <ParticipantView {...participant} />
                    </div>
                    ))}
                </div>
                );
            }
            if (remoteParticipants.length === 3) {
                const topParticipant = host || remoteParticipants[0];
                const bottomParticipants = remoteParticipants.filter(p => p.id !== topParticipant.id);
                return (
                <div className="h-full w-full flex flex-col gap-2 sm:gap-4">
                    <div className="flex-1 min-h-0">
                    <ParticipantView {...topParticipant} />
                    </div>
                    <div className="flex-1 min-h-0 flex gap-2 sm:gap-4">
                    {bottomParticipants.map(participant => (
                        <div key={participant.id} className="flex-1 min-h-0">
                        <ParticipantView {...participant} />
                        </div>
                    ))}
                    </div>
                </div>
                );
            }
            return (
                <div className="h-full w-full grid grid-cols-2 grid-rows-2 gap-2 sm:gap-4">
                {mainGridParticipants.map(participant => (
                    <div key={participant.id} className="min-h-0">
                    <ParticipantView {...participant} />
                    </div>
                ))}
                </div>
            );
            })()}
        </main>
      </div>

      <div
        className={cn(
          "fixed top-[var(--header-height)] bottom-0 right-0 z-30 w-[300px] bg-card border-l transform transition-transform duration-300 ease-in-out",
          isParticipantsPanelOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ '--header-height': '64px' } as React.CSSProperties}
      >
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold text-foreground">Participants ({acceptedParticipants.length})</h3>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsParticipantsPanelOpen(false)}>
                    <PanelRightClose className="h-5 w-5"/>
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {acceptedParticipants.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={p.photoURL || `https://placehold.co/32x32.png?text=${p.name.charAt(0)}`} alt={p.name} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate">{p.name}{p.isMe ? ' (You)' : ''}{p.id === meetingCreatorId ? <ShieldCheck className="inline h-4 w-4 ml-1.5 text-primary" title="Host"/> : ''}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                                {p.isHandRaisedForView && <Hand className="h-4 w-4 text-accent animate-pulse"/>}
                                {p.isMicMuted ? <MicOff className="h-4 w-4"/> : <Mic className="h-4 w-4"/>}
                                {p.isCameraOff ? <VideoOff className="h-4 w-4"/> : <Video className="h-4 w-4"/>}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
      </div>
      
      {remoteParticipants.length > 0 && selfView && (
          <div className="absolute bottom-20 md:bottom-24 right-2 sm:right-4 w-40 h-28 md:w-56 md:h-36 rounded-xl overflow-hidden z-20 shadow-2xl border-2 border-background">
            <ParticipantView {...selfView} />
          </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center justify-center gap-2 sm:gap-4 bg-card/80 backdrop-blur-md p-2 sm:p-3 rounded-full shadow-2xl border">
          <Button
            variant={localMicMuted ? "destructive" : "default"}
            size="icon"
            className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
            onClick={toggleMic}
            aria-label={localMicMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            <MicOff className={cn("h-5 w-5 sm:h-6 sm:w-6", !localMicMuted && "hidden")} />
            <Mic className={cn("h-5 w-5 sm:h-6 sm:w-6", localMicMuted && "hidden")} />
          </Button>
          <Button
             variant={localCameraOff ? "destructive" : "default"}
             size="icon"
             className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
             onClick={toggleCamera}
             aria-label={localCameraOff ? "Turn Camera On" : "Turn Camera Off"}
          >
             <VideoOff className={cn("h-5 w-5 sm:h-6 sm:w-6", !localCameraOff && "hidden")} />
             <Video className={cn("h-5 w-5 sm:h-6 sm:w-6", localCameraOff && "hidden")} />
          </Button>
           <Button
            size="icon"
            variant="default"
            className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
            onClick={() => setIsParticipantsPanelOpen(prev => !prev)}
            aria-label={isParticipantsPanelOpen ? "Close Participants Panel" : "Open Participants Panel"}
           >
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
           </Button>

           <Button
            size="icon"
            variant={localHandRaised ? "default" : "destructive"}
            className={cn(
              "rounded-full w-10 h-10 sm:w-12 sm:h-12",
              localHandRaised && "ring-2 ring-offset-2 ring-offset-background ring-offset-primary"
            )}
            onClick={toggleHandRaise}
            aria-label={localHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <Hand className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          
          <Button variant="destructive" size="lg" className="rounded-full px-4 sm:px-6 h-10 sm:h-12" onClick={() => leaveMeeting()} aria-label="Leave Meeting">
            <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

      <AlertDialog open={isShareScreenDialogVisible} onOpenChange={setIsShareScreenDialogVisible}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Share Your Screen?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to share your screen. Ensure no sensitive information is visible.
              Your camera will be turned off while sharing your screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmShareScreen} className="rounded-lg">Share Screen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareOptionsPanel
        isOpen={isSharePanelOpen}
        onClose={() => setIsSharePanelOpen(false)}
        meetingLink={meetingLinkForShare}
        meetingTitle={topic || `Meeting: ${meetingId}`}
      />
    </div>
  );
}
