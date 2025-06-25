
'use client';
import React, { useState, useEffect, useRef, use } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from '@/components/ui/badge';
import { ShareOptionsPanel } from '@/components/common/ShareOptionsPanel';
import { Skeleton } from '@/components/ui/skeleton';


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
  Columns,
  Edit3,
  AlertTriangle,
  AlertCircle,
  ScreenShare,
  StopCircle,
  Loader2,
  Share2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, serverTimestamp, query, DocumentData, getDoc } from 'firebase/firestore';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';


const DISMISSED_MEETINGS_KEY = 'teachmeet-dismissed-meetings';

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

const ParticipantView = React.memo(function ParticipantView({
  name,
  isMe = false,
  isMicMuted = false,
  isCameraOff = false,
  stream,
  isHandRaisedForView,
  isScreenSharing,
  photoURL,
  hasCameraPermissionForView,
}: Participant) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  const handleFullScreenClick = () => {
    const targetElement = videoRef.current;
    if (targetElement && targetElement.srcObject) {
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
  const showVideo = !!stream && !isCameraOff && !isScreenSharing;

  return (
    <Card className="rounded-xl overflow-hidden relative shadow-lg border-2 border-border/30 hover:border-primary hover:shadow-primary/20 transition-all duration-300 ease-in-out group w-full h-full">
      <video
        ref={videoRef}
        muted={isMe}
        autoPlay
        playsInline
        className={cn("w-full h-full object-cover bg-muted", !showVideo && "hidden")}
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
                        <AvatarImage src={avatarSrc} alt={name} data-ai-hint="avatar user" />
                        <AvatarFallback className="text-3xl md:text-4xl">{avatarFallbackName}</AvatarFallback>
                    </Avatar>
                    <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
                    {isMe && hasCameraPermissionForView === false ? (
                      <p className="text-xs text-destructive-foreground bg-destructive px-2 py-1 rounded-md mt-1">Camera permission denied</p>
                    ) : (isCameraOff || !stream) && (
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


export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;

  const searchParamsHook = useSearchParams();
  const topic = searchParamsHook.get('topic');
  const { toast } = useToast();
  const router = useRouter();
  const currentUser = auth.currentUser;
  const { setHeaderContent } = useDynamicHeader();

  const [localMicMuted, setLocalMicMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      const desiredState = localStorage.getItem('teachmeet-desired-mic-state');
      return desiredState === 'off';
    }
    return false;
  });
  const [localCameraOff, setLocalCameraOff] = useState(() => {
    if (typeof window !== 'undefined') {
      const desiredState = localStorage.getItem('teachmeet-desired-camera-state');
      return desiredState === 'off';
    }
    return true;
  });
  const [localHandRaised, setLocalHandRaised] = useState(false);
  const [realtimeParticipants, setRealtimeParticipants] = useState<Participant[]>([]);
  const [joinStatus, setJoinStatus] = useState<'pending' | 'joining' | 'joined' | 'failed'>('pending');

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isScreenSharingActive, setIsScreenSharingActive] = useState(false);
  const [isShareScreenDialogVisible, setIsShareScreenDialogVisible] = useState(false);
  const [currentLayout, setCurrentLayout] = useState('grid');
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);

  const displayTitle = topic ? `${topic} (ID: ${meetingId})` : `Meeting ID: ${meetingId}`;
  const meetingLinkForShare = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/meeting/${meetingId}/wait${topic ? `?topic=${encodeURIComponent(topic)}` : ''}` : '';
  
  const combinedParticipants: Participant[] = currentUser
    ? [
        {
          id: currentUser.uid,
          name: currentUser.displayName || currentUser.email?.split('@')[0] || "You",
          isMe: true,
          isMicMuted: localMicMuted,
          isCameraOff: isScreenSharingActive ? true : localCameraOff,
          stream: isScreenSharingActive ? screenShareStreamRef.current : localStreamRef.current,
          hasCameraPermissionForView: hasCameraPermission,
          isHandRaisedForView: localHandRaised,
          isScreenSharing: isScreenSharingActive,
          photoURL: currentUser.photoURL
        },
        ...realtimeParticipants.filter(p => p.id !== currentUser.uid)
      ]
    : realtimeParticipants;

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
    router.push(`/dashboard/meeting/${meetingId}/participants${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`);
  };

  const handleSetLayout = (layout: string) => {
    setCurrentLayout(layout);
    toast({ title: "Layout Changed", description: `Switched to ${layout.replace('-', ' ')} view.` });
  };


  useEffect(() => {
    const newHeaderContent = (
      <div className="flex items-center justify-between w-full gap-2 sm:gap-4">
        <div className="flex-shrink min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-foreground truncate" title={displayTitle}>
            {displayTitle}
          </h2>
          {combinedParticipants.length > 0 && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              {combinedParticipants.length} Participant{combinedParticipants.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg">
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
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Columns className="mr-2 h-4 w-4" />
                <span>Change Layout</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="rounded-lg">
                <DropdownMenuItem onClick={() => handleSetLayout('grid')} className="rounded-md cursor-pointer">
                  Grid View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetLayout('speaker')} className="rounded-md cursor-pointer">
                  Speaker View
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleSetLayout('gallery')} className="rounded-md cursor-pointer">
                  Gallery View
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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
      combinedParticipants.length, 
      isScreenSharingActive, 
      router, 
    ]);


  useEffect(() => {
    console.log("[MeetingPage] Firestore join effect triggered. Status:", joinStatus, "User:", currentUser?.uid, "MeetingID:", meetingId);
    if (!currentUser || !meetingId || !db) {
      if (!currentUser) console.warn("[MeetingPage] Firestore join: Current user not available.");
      if (!meetingId) console.warn("[MeetingPage] Firestore join: MeetingId not available.");
      if (!db) console.warn("[MeetingPage] Firestore join: DB not available.");
      if (joinStatus === 'pending') setJoinStatus('failed');
      return;
    }

    const joinMeetingRoom = async () => {
      setJoinStatus('joining');
      console.log(`[MeetingPage] User ${currentUser.uid} attempting to join meeting ${meetingId}. Status: joining`);

      const meetingDocRef = doc(db, "meetings", meetingId);
      const participantDocRef = doc(meetingDocRef, "participants", currentUser.uid);

      try {
        const meetingDocSnap = await getDoc(meetingDocRef);
        if (!meetingDocSnap.exists()) {
          console.log(`[MeetingPage] Main meeting document for ${meetingId} does not exist. Creating it.`);
          const meetingTopicFromURL = searchParamsHook.get('topic') || `Meeting ${meetingId}`;
          await setDoc(meetingDocRef, {
            creatorId: currentUser.uid, 
            topic: meetingTopicFromURL,
            createdAt: serverTimestamp(),
          });
          console.log(`[MeetingPage] Successfully created main meeting document for ${meetingId}.`);
        } else {
          console.log(`[MeetingPage] Main meeting document for ${meetingId} already exists.`);
        }

        const initialCameraOffFromStorage = typeof window !== 'undefined' ? localStorage.getItem('teachmeet-desired-camera-state') === 'off' : true;
        const initialMicMutedFromStorage = typeof window !== 'undefined' ? localStorage.getItem('teachmeet-desired-mic-state') === 'off' : false;
        
        const participantData = {
          userId: currentUser.uid,
          name: currentUser.displayName || currentUser.email?.split('@')[0] || "Anonymous",
          photoURL: currentUser.photoURL,
          isMicMuted: initialMicMutedFromStorage,
          isCameraOff: initialCameraOffFromStorage,
          isHandRaised: false,
          isScreenSharing: false,
          joinedAt: serverTimestamp(),
        };

        console.log("[MeetingPage] Participant data to write to Firestore:", participantData);
        await setDoc(participantDocRef, participantData, { merge: true });
        console.log("[MeetingPage] Successfully added/updated self in participant list in Firestore.");
        setJoinStatus('joined');

      } catch (error) {
        console.error("[MeetingPage] CRITICAL: Failed to ensure meeting document or add participant:", error);
        toast({
          variant: "destructive",
          title: "Failed to Register in Meeting Room",
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

  useEffect(() => {
    if (joinStatus !== 'joined' || !meetingId || !db) return;

    console.log(`[MeetingPage] Setting up Firestore listener for participants in meeting ${meetingId}`);
    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const q = query(participantsColRef);
    const unsubscribeParticipants = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSnap: DocumentData) => {
        const data = docSnap.data();
        fetchedParticipants.push({
          id: docSnap.id,
          name: data.name || "Guest",
          photoURL: data.photoURL,
          isMicMuted: data.isMicMuted,
          isCameraOff: data.isCameraOff,
          isHandRaisedForView: data.isHandRaised,
          isScreenSharing: data.isScreenSharing,
        });
      });
      console.log("[MeetingPage] Fetched participants from Firestore:", fetchedParticipants);
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

    return () => {
      console.log(`[MeetingPage] Cleaning up Firestore listener for participants in meeting ${meetingId}`);
      unsubscribeParticipants();
    };
  }, [meetingId, toast, joinStatus]);

  useEffect(() => {
    if (joinStatus !== 'joined' || isScreenSharingActive) return;

    const initializeMedia = async () => {
      console.log("[MeetingPage] Initializing media devices.");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
        localStreamRef.current = stream;
        setHasCameraPermission(true);
        setHasMicPermission(true);
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !localCameraOff;
        }
        
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !localMicMuted;
        }
        console.log("[MeetingPage] Media initialized successfully.");

      } catch (err) {
        console.error("[MeetingPage] Failed to get media on mount:", err);
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          toast({ variant: 'destructive', title: 'Permissions Denied', description: 'Camera and microphone access was denied. Please enable them in your browser settings.' });
          setHasCameraPermission(false);
          setHasMicPermission(false);
          setLocalCameraOff(true);
          setLocalMicMuted(true);
          await updateUserStatusInFirestore({ isCameraOff: true, isMicMuted: true });
        } else {
            toast({ variant: 'destructive', title: 'Media Device Error', description: 'Could not find a camera or microphone. Please check your devices.' });
            setHasCameraPermission(false);
            setHasMicPermission(false);
        }
      }
    };

    initializeMedia();

    return () => {
      if (localStreamRef.current) {
        console.log("[MeetingPage] Cleaning up media stream on re-render/unmount.");
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [joinStatus, isScreenSharingActive]);

   useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (auth.currentUser && meetingId && db) {
        console.log(`[MeetingPage] beforeunload: Removing user ${auth.currentUser.uid} from meeting ${meetingId}`);
        await deleteDoc(doc(db, "meetings", meetingId, "participants", auth.currentUser.uid));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current?.getTracks().forEach(track => track.stop());
      console.log("[MeetingPage] Cleaned up media streams on unmount.");
    };
  }, [meetingId]);


  const updateUserStatusInFirestore = async (updates: Partial<Omit<Participant, 'id' | 'name' | 'stream' | 'hasCameraPermissionForView' | 'photoURL' | 'isMe'>>) => {
    if (!currentUser || !meetingId || !db || joinStatus !== 'joined') {
      console.warn("[MeetingPage] Skipping Firestore update: User not ready or not joined.", {currentUserPresent: !!currentUser, meetingId, dbPresent: !!db, joinStatus});
      return;
    }
    const userDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
    try {
      console.log(`[MeetingPage] Updating user ${currentUser.uid} status in Firestore:`, updates);
      await updateDoc(userDocRef, updates);
      console.log(`[MeetingPage] Successfully updated user ${currentUser.uid} status.`);
    } catch (error) {
      console.error("[MeetingPage] Error updating user status in Firestore:", error);
      toast({ variant: "destructive", title: "Sync Error", description: "Could not update your status." });
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
    } else {
        toast({ variant: "destructive", title: "No Audio Stream", description: "Could not find an active microphone stream to toggle."})
    }
  };

  const stopScreenShare = async (showToast = true) => {
    console.log("[MeetingPage] Attempting to stop screen share.");
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current = null;
    }
    setIsScreenSharingActive(false);
    await updateUserStatusInFirestore({ isScreenSharing: false });

    if (showToast) {
        toast({ title: "Screen Sharing Stopped" });
    }
  };

  const toggleCamera = async () => {
    if (isScreenSharingActive) {
      console.log("[MeetingPage] Screen sharing is active, stopping it before toggling camera.");
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

  const leaveMeeting = async () => {
    console.log("[MeetingPage] User leaving meeting.");
    try {
      await stopScreenShare(false);
    } catch (e) {
      console.error("[MeetingPage] Error stopping screen share on leave:", e);
    }

    localStreamRef.current?.getTracks().forEach(track => track.stop());


    if (currentUser && meetingId && db) {
      const userDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
      try {
        console.log(`[MeetingPage] Deleting participant ${currentUser.uid} from Firestore for meeting ${meetingId}.`);
        await deleteDoc(userDocRef);
        console.log(`[MeetingPage] Successfully deleted participant ${currentUser.uid}.`);
      } catch (error) {
        console.error("[MeetingPage] Error removing participant from Firestore on leave:", error);
      }
    }

    toast({ title: "Leaving Meeting", description: "You have left the meeting." });

    try {
      if (typeof window !== 'undefined' && meetingId) {
        const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
        let dismissedIds: string[] = [];
        try {
          dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
        } catch (e) {
          console.error("[MeetingPage] Error parsing dismissed meetings from localStorage on leave:", e);
          localStorage.removeItem(DISMISSED_MEETINGS_KEY);
        }

        if (!Array.isArray(dismissedIds)) {
            dismissedIds = [];
        }

        if (!dismissedIds.includes(meetingId)) {
          dismissedIds.push(meetingId);
          localStorage.setItem(DISMISSED_MEETINGS_KEY, JSON.stringify(dismissedIds));
          console.log(`[MeetingPage] Added meeting ${meetingId} to dismissed list in localStorage.`);
        }
      }
    } catch (e) {
      console.error("[MeetingPage] Error updating localStorage on leave:", e);
    }
    router.push('/');
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
      console.log("[MeetingPage] Requesting screen share stream.");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      console.log("[MeetingPage] Screen share stream acquired.");

      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = false;
      }

      screenShareStreamRef.current = stream;
      
      setIsScreenSharingActive(true);
      await updateUserStatusInFirestore({ isScreenSharing: true, isCameraOff: true });
      toast({ title: "Screen Sharing Started" });

      stream.getVideoTracks()[0].onended = () => {
        console.log("[MeetingPage] Screen share stream ended (e.g., user clicked 'Stop sharing' in browser UI).");
        stopScreenShare();
      };

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

  const renderLayout = () => {
    if (combinedParticipants.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p>Waiting for participants to join...</p>
        </div>
      );
    }
  
    switch (currentLayout) {
      case 'speaker':
        const speaker = combinedParticipants.find(p => p.isScreenSharing) || combinedParticipants.find(p => !p.isMe) || combinedParticipants[0];
        const otherParticipants = combinedParticipants.filter(p => p.id !== speaker.id);
        return (
          <div className="flex-1 flex flex-col md:flex-row gap-4 h-full">
            <div className="flex-grow rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <ParticipantView {...speaker} />
            </div>
            {otherParticipants.length > 0 && (
              <div className="w-full md:w-48 lg:w-64 flex-shrink-0 flex md:flex-col gap-4 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0">
                {otherParticipants.map(p => (
                  <div key={p.id} className="aspect-video rounded-lg overflow-hidden flex-shrink-0 md:flex-shrink-1 w-40 md:w-full">
                    <ParticipantView {...p} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
  
      case 'gallery':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {combinedParticipants.map(participant => (
              <div key={participant.id} className="aspect-video rounded-lg overflow-hidden">
                <ParticipantView {...participant} />
              </div>
            ))}
          </div>
        );
  
      case 'grid':
      default:
        const total = combinedParticipants.length;
        let cols = 'grid-cols-1';
        if (total >= 2) cols = 'grid-cols-1 sm:grid-cols-2';
        if (total >= 5) cols = 'grid-cols-2 md:grid-cols-3';
        if (total >= 7) cols = 'grid-cols-2 md:grid-cols-4';
        if (total >= 10) cols = 'grid-cols-3 md:grid-cols-4';

        return (
          <div className={cn('grid gap-4 flex-1', cols)}>
            {combinedParticipants.map(participant => (
              <div key={participant.id} className="min-h-[180px] rounded-lg overflow-hidden">
                <ParticipantView {...participant} />
              </div>
            ))}
          </div>
        );
    }
  };


  return (
    <div className="flex flex-col h-full bg-background relative">
      
      <main className="flex-1 p-2 sm:p-4 flex flex-col overflow-hidden">
        {hasCameraPermission === false && !isScreenSharingActive && (
           <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your camera to share your video.
                Please enable camera permissions in your browser settings.
              </AlertDescription>
            </Alert>
        )}
        {hasMicPermission === false && (
           <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Microphone Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your microphone to share your audio.
                Please enable microphone permissions in your browser settings.
              </AlertDescription>
            </Alert>
        )}
         
        {renderLayout()}

      </main>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center justify-center gap-4 bg-card/80 backdrop-blur-md p-3 rounded-full shadow-2xl border">
          <Button
            variant={localMicMuted ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full w-12 h-12"
            onClick={toggleMic}
            aria-label={localMicMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {localMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button
             variant={(localCameraOff && !isScreenSharingActive) ? "destructive" : "secondary"}
             size="icon"
             className="rounded-full w-12 h-12"
             onClick={toggleCamera}
             aria-label={(localCameraOff && !isScreenSharingActive) ? "Turn Camera On" : "Turn Camera Off"}
             disabled={isScreenSharingActive}
          >
            {(localCameraOff && !isScreenSharingActive) ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

           <Button
            size="icon"
            variant={localHandRaised ? "default" : "secondary"}
            className={cn(
              "rounded-full w-12 h-12",
              localHandRaised && "bg-accent text-accent-foreground ring-2 ring-offset-2 ring-offset-background ring-accent"
            )}
            onClick={toggleHandRaise}
            aria-label={localHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <Hand className="h-6 w-6" />
          </Button>
          
          <Button variant="destructive" size="lg" className="rounded-full px-6 h-12" onClick={leaveMeeting} aria-label="Leave Meeting">
            <PhoneOff className="h-6 w-6" />
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
