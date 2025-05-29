
'use client';
import { useState, useEffect, use, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Settings, Users, MoreVertical, Hand, Maximize, Columns, Edit3, AlertTriangle, AlertCircle, ScreenShare, StopCircle, PanelLeftOpen, Loader2, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, serverTimestamp, query } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { ShareOptionsPanel } from '@/components/common/ShareOptionsPanel';


const DISMISSED_MEETINGS_KEY = 'teachmeet-dismissed-meetings';

interface Participant {
  id: string;
  name: string;
  isMe?: boolean;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  hasCameraPermissionForView?: boolean | null;
  isHandRaisedForView?: boolean;
  isScreenSharing?: boolean;
  photoURL?: string | null;
}

const ParticipantView = ({
  name,
  isMe = false,
  isMicMuted = false,
  isCameraOff = false,
  videoRef,
  hasCameraPermissionForView,
  isHandRaisedForView,
  isScreenSharing,
  photoURL
}: Participant) => {
  const { toast } = useToast();

  const handleFullScreenClick = () => {
    const targetElement = isScreenSharing && videoRef?.current?.srcObject ? videoRef.current : videoRef?.current;

    if (targetElement && targetElement.srcObject) {
        if (targetElement.requestFullscreen) {
            targetElement.requestFullscreen().catch(err => {
            console.error("Error entering fullscreen:", err);
            toast({ variant: 'destructive', title: 'Fullscreen Error', description: 'Could not enter fullscreen mode.' });
            });
        } else {
            toast({ variant: 'destructive', title: 'Fullscreen Not Supported', description: 'Your browser does not support this fullscreen action.' });
        }
    } else if (isScreenSharing && !targetElement?.srcObject) { // Screen sharing is active, but srcObject is null (e.g. placeholder)
        toast({ title: 'Screen Share Active', description: 'Screen is being shared. Fullscreen will apply to the shared content when available.' });
    } else {
        toast({ title: 'No Video Stream', description: 'Cannot enter full screen without an active video stream or screen share.' });
    }
  };

  const avatarFallbackName = name.charAt(0).toUpperCase() || 'U';

  return (
    <Card className="aspect-video rounded-xl overflow-hidden relative shadow-lg border-2 border-border/30 hover:border-primary hover:shadow-primary/20 transition-all duration-300 ease-in-out group w-full h-full">
      {isMe ? (
        <>
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className={cn("w-full h-full object-contain bg-muted", { 'hidden': !videoRef?.current?.srcObject && !isScreenSharing}, { 'block': isScreenSharing && videoRef?.current?.srcObject})}
          />
          {((isCameraOff && !isScreenSharing) || hasCameraPermissionForView === false || (!videoRef?.current?.srcObject && !isScreenSharing)) && (
            <div className="absolute inset-0 w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
              <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
                <AvatarImage src={photoURL || `https://placehold.co/128x128.png?text=${avatarFallbackName}`} alt={name} data-ai-hint="avatar user" />
                <AvatarFallback className="text-3xl md:text-4xl">{avatarFallbackName}</AvatarFallback>
              </Avatar>
              {hasCameraPermissionForView === false && <VideoOff className="w-7 h-7 text-muted-foreground mb-1" />}
              <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
              {hasCameraPermissionForView === false && <p className="text-xs text-muted-foreground">Camera permission denied</p>}
            </div>
          )}
           {isScreenSharing && !videoRef?.current?.srcObject && (
             <div className="absolute inset-0 w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
                <ScreenShare className="w-16 h-16 text-muted-foreground mb-2"/>
                <p className="text-base font-medium text-foreground">Sharing Screen...</p>
             </div>
           )}
        </>
      ) : isCameraOff ? (
        <div className="w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
          <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
             <AvatarImage src={photoURL || `https://placehold.co/128x128.png?text=${avatarFallbackName}`} alt={name} data-ai-hint="avatar user"/>
             <AvatarFallback className="text-3xl md:text-4xl">{avatarFallbackName}</AvatarFallback>
          </Avatar>
          <VideoOff className="w-7 h-7 text-muted-foreground mb-1" />
          <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
           {isScreenSharing ? <ScreenShare className="w-7 h-7 text-muted-foreground mt-1" /> : ''}
        </div>
      ) : ( 
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center p-4 text-center">
          <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
             <AvatarImage src={photoURL || `https://placehold.co/128x128.png?text=${avatarFallbackName}`} alt={name} data-ai-hint="avatar user"/>
             <AvatarFallback className="text-3xl md:text-4xl">{avatarFallbackName}</AvatarFallback>
          </Avatar>
           <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
           {isScreenSharing ? <ScreenShare className="w-7 h-7 text-muted-foreground mt-1" /> : <Video className="w-7 h-7 text-muted-foreground mt-1" />}
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
};


export default function MeetingPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const resolvedParams = use(paramsPromise);
  const { meetingId } = resolvedParams;

  const searchParamsHook = useSearchParams();
  const topic = searchParamsHook.get('topic');
  const { toast } = useToast();
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [localMicMuted, setLocalMicMuted] = useState(false);
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const currentLocalStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScreenSharingActive, setIsScreenSharingActive] = useState(false);
  const [isShareScreenDialogVisible, setIsShareScreenDialogVisible] = useState(false);
  const [currentLayout, setCurrentLayout] = useState('grid');
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);


  useEffect(() => {
    if (!currentUser || !meetingId || !db) {
      if(!currentUser) console.warn("MeetingPage: Current user not available for Firestore join.");
      if(!meetingId) console.warn("MeetingPage: MeetingId not available for Firestore join.");
      if(!db) console.warn("MeetingPage: DB not available for Firestore join.");
      if(joinStatus === 'pending') setJoinStatus('failed'); 
      return;
    }

    if (joinStatus === 'pending') {
      setJoinStatus('joining');
      const userDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
      
      const initialCameraOffFromStorage = typeof window !== 'undefined' ? localStorage.getItem('teachmeet-desired-camera-state') === 'off' : true;

      const participantData = {
        userId: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split('@')[0] || "Anonymous",
        photoURL: currentUser.photoURL,
        isMicMuted: false, 
        isCameraOff: initialCameraOffFromStorage, 
        isHandRaised: false, 
        isScreenSharing: false, 
        joinedAt: serverTimestamp(),
      };

      setDoc(userDocRef, participantData, { merge: true })
        .then(() => {
          setJoinStatus('joined');
          console.log("Successfully added/updated self in participant list in Firestore.");
        })
        .catch(error => {
          console.error("CRITICAL: Failed to add self to participant list:", error);
          toast({
            variant: "destructive",
            title: "Failed to Register in Meeting Room",
            description: `Could not register your presence: ${error.message}. Check console & Firestore rules.`,
            duration: 10000,
          });
          setJoinStatus('failed');
        });
    }
  }, [currentUser, meetingId, db, toast, joinStatus]); 

  useEffect(() => {
    if (joinStatus !== 'joined' || !meetingId || !db) return; 

    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const q = query(participantsColRef);
    const unsubscribeParticipants = onSnapshot(q, (querySnapshot) => {
      const fetchedParticipants: Participant[] = [];
      querySnapshot.forEach((docSnap) => { 
        const data = docSnap.data();
        fetchedParticipants.push({
          id: docSnap.id,
          name: data.name || "Guest",
          isMicMuted: data.isMicMuted,
          isCameraOff: data.isCameraOff,
          isHandRaisedForView: data.isHandRaised,
          isScreenSharing: data.isScreenSharing,
          photoURL: data.photoURL,
        });
      });
      setRealtimeParticipants(fetchedParticipants);
    }, (error) => {
        console.error("Error fetching participants from Firestore:", error);
        toast({ 
          variant: "destructive", 
          title: "Participant List Error", 
          description: "Could not load participant list. Error: " + error.message,
          duration: 7000,
        });
    });

    return () => {
      unsubscribeParticipants();
    };
  }, [meetingId, db, toast, joinStatus]); 

  useEffect(() => {
    const initializeCameraAndPermissions = async () => {
      if (!localCameraOff) { 
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          currentLocalStreamRef.current = stream;
          if (localVideoRef.current && !isScreenSharingActive) { 
            localVideoRef.current.srcObject = stream;
          }
          setHasCameraPermission(true);
        } catch (err) {
          console.error("Failed to get camera on mount:", err);
          setHasCameraPermission(false);
          setLocalCameraOff(true); 
          updateUserStatusInFirestore({ isCameraOff: true });
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      } else { 
        try {
          await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t=>t.stop()));
          setHasCameraPermission(true);
        } catch {
          setHasCameraPermission(false);
        }
         if (currentLocalStreamRef.current) {
            currentLocalStreamRef.current.getTracks().forEach(track => track.stop());
            currentLocalStreamRef.current = null;
            if(localVideoRef.current) localVideoRef.current.srcObject = null;
        }
      }
    };

    if (joinStatus === 'joined') { 
        initializeCameraAndPermissions();
    }

    return () => {
      currentLocalStreamRef.current?.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [localCameraOff, toast, joinStatus, isScreenSharingActive]);


   useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (auth.currentUser && meetingId && db) {
        await deleteDoc(doc(db, "meetings", meetingId, "participants", auth.currentUser.uid));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [meetingId, db]);


  const updateUserStatusInFirestore = async (updates: Partial<Omit<Participant, 'id' | 'name' | 'videoRef' | 'hasCameraPermissionForView' | 'photoURL' | 'isMe'>>) => {
    if (!currentUser || !meetingId || !db || joinStatus !== 'joined') return;
    const userDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
    try {
      await updateDoc(userDocRef, updates);
    } catch (error) {
      console.error("Error updating user status in Firestore:", error);
      toast({ variant: "destructive", title: "Sync Error", description: "Could not update your status." });
    }
  };

  const toggleMic = () => {
    const newMicState = !localMicMuted;
    setLocalMicMuted(newMicState);
    updateUserStatusInFirestore({ isMicMuted: newMicState });
  };

  const stopScreenShare = async (showToast = true) => {
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current = null;
    }
    setIsScreenSharingActive(false);
    await updateUserStatusInFirestore({ isScreenSharing: false });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null; 
    }
    if (showToast) {
        toast({ title: "Screen Sharing Stopped" });
    }
    
    if (!localCameraOff && currentLocalStreamRef.current && currentLocalStreamRef.current.active) {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = currentLocalStreamRef.current;
        }
    } else if (!localCameraOff && hasCameraPermission) { 
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          currentLocalStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Failed to re-initialize camera after screen share stop:", err);
          setLocalCameraOff(true); 
          updateUserStatusInFirestore({ isCameraOff: true });
        }
    }
  };

  const toggleCamera = async () => {
    const newCameraStateIsOff = !localCameraOff;

    if (isScreenSharingActive) {
      await stopScreenShare(false); 
    }
    
    setLocalCameraOff(newCameraStateIsOff); 

    if (!newCameraStateIsOff) { 
      if (hasCameraPermission === false) {
        toast({ variant: 'destructive', title: 'Camera Permission Denied', description: 'Please enable camera permissions in browser settings.' });
        setLocalCameraOff(true); 
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        currentLocalStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true); 
        await updateUserStatusInFirestore({ isCameraOff: false });
      } catch (err) {
        console.error("Failed to get camera on toggle:", err);
        setHasCameraPermission(false);
        setLocalCameraOff(true); 
        await updateUserStatusInFirestore({ isCameraOff: true });
        toast({ variant: 'destructive', title: 'Camera Access Failed', description: 'Could not access camera.' });
        return;
      }
    } else { 
      currentLocalStreamRef.current?.getTracks().forEach(track => track.stop());
      currentLocalStreamRef.current = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      await updateUserStatusInFirestore({ isCameraOff: true });
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
    try {
      await stopScreenShare(false); 
    } catch (e) {
      console.error("Error stopping screen share on leave:", e);
    }

    currentLocalStreamRef.current?.getTracks().forEach(track => track.stop());

    if (currentUser && meetingId && db) {
      const userDocRef = doc(db, "meetings", meetingId, "participants", currentUser.uid);
      try {
        await deleteDoc(userDocRef);
      } catch (error) {
        console.error("Error removing participant from Firestore on leave:", error);
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
          console.error("Error parsing dismissed meetings from localStorage on leave:", e);
          localStorage.removeItem(DISMISSED_MEETINGS_KEY); 
        }

        if (!Array.isArray(dismissedIds)) { 
            dismissedIds = [];
        }

        if (!dismissedIds.includes(meetingId)) {
          dismissedIds.push(meetingId);
          localStorage.setItem(DISMISSED_MEETINGS_KEY, JSON.stringify(dismissedIds));
        }
      }
    } catch (e) {
      console.error("Error updating localStorage on leave:", e);
    }
    router.push('/');
  };


  const handleReportIssue = () => {
    toast({
      title: "Report Issue",
      description: "Issue reporting feature is planned. For now, please note the issue and report through help channels.",
      duration: 5000,
    });
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

  const handleConfirmShareScreen = async () => {
    setIsShareScreenDialogVisible(false);
    if (isScreenSharingActive) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      // This check is redundant if done in handleToggleShareScreen, but good for safety
      toast({
        variant: "destructive",
        title: "Screen Share Not Supported",
        description: "Screen sharing is not available in your browser or current environment.",
        duration: 7000
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

      if (currentLocalStreamRef.current) { 
        currentLocalStreamRef.current.getTracks().forEach(track => track.stop());
        currentLocalStreamRef.current = null; 
        if (localVideoRef.current) localVideoRef.current.srcObject = null; 
      }

      screenShareStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream; 
      }
      setIsScreenSharingActive(true);
      setLocalCameraOff(true); 
      await updateUserStatusInFirestore({ isScreenSharing: true, isCameraOff: true });
      toast({ title: "Screen Sharing Started" });

      stream.getVideoTracks()[0].onended = () => { 
        stopScreenShare();
      };

    } catch (err) {
      console.error("Error starting screen share:", err);
      if ((err as DOMException).name === 'NotAllowedError') {
        toast({ variant: "destructive", title: "Screen Share Cancelled", description: "You cancelled screen selection or denied permission." });
      } else {
        toast({ variant: "destructive", title: "Screen Share Failed", description: "Could not start screen sharing." });
      }
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
  
  const handleOpenSharePanel = () => {
    setIsSharePanelOpen(true);
  };


  const combinedParticipants = currentUser
    ? [
        {
          id: currentUser.uid,
          name: currentUser.displayName || currentUser.email?.split('@')[0] || "You",
          isMe: true,
          isMicMuted: localMicMuted,
          isCameraOff: isScreenSharingActive ? true : localCameraOff, 
          videoRef: localVideoRef,
          hasCameraPermissionForView: hasCameraPermission,
          isHandRaisedForView: localHandRaised,
          isScreenSharing: isScreenSharingActive,
          photoURL: currentUser.photoURL
        },
        ...realtimeParticipants.filter(p => p.id !== currentUser.uid) 
      ]
    : realtimeParticipants;


  const displayTitle = topic ? `${topic} (ID: ${meetingId})` : `Meeting ID: ${meetingId}`;
  const meetingLinkForShare = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/meeting/${meetingId}/wait${topic ? `?topic=${encodeURIComponent(topic)}` : ''}` : '';


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
          We couldn't register your presence in the meeting. This might be due to a network issue or a problem with the meeting setup or Firestore rules.
        </p>
        <Button onClick={() => router.push('/')} className="rounded-lg">
          Go to Homepage
        </Button>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full bg-background">
      <header className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-xl font-semibold text-foreground truncate max-w-xs sm:max-w-md md:max-w-lg" title={displayTitle}>{displayTitle}</h2>
          <span className="text-sm text-muted-foreground">{combinedParticipants.length} Participant{combinedParticipants.length === 1 ? '' : 's'}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="h-6 w-6" />
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
      </header>

      <main className="flex-1 p-4 overflow-y-auto flex flex-col">
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
         {combinedParticipants.length === 1 && combinedParticipants[0].isMe ? (
            <div className={cn(
                "flex-grow flex items-center justify-center",
                currentLayout === 'speaker' && "p-4 bg-muted rounded-lg",
                currentLayout === 'gallery' && "p-4 bg-accent/20 rounded-lg",
                currentLayout === 'grid' && "p-0" 
            )}>
                <div className="w-full h-full max-w-5xl max-h-[calc(100vh-15rem)] relative">
                 {currentLayout === 'speaker' && (
                    <Badge variant="default" className="absolute top-2 left-2 z-20 bg-primary/80 text-primary-foreground backdrop-blur-sm">Speaker View Active</Badge>
                )}
                {currentLayout === 'gallery' && (
                    <Badge variant="default" className="absolute top-2 left-2 z-20 bg-accent/80 text-accent-foreground backdrop-blur-sm">Gallery View Active</Badge>
                )}
                <ParticipantView
                    {...combinedParticipants[0]}
                />
                </div>
            </div>
            ) : (
            <div className={cn(
                "grid gap-4 flex-1",
                combinedParticipants.length === 0 ? "grid-cols-1" : 
                combinedParticipants.length === 1 ? "grid-cols-1" : 
                combinedParticipants.length === 2 ? "grid-cols-1 md:grid-cols-2" :
                combinedParticipants.length === 3 ? "grid-cols-1 md:grid-cols-3" :
                combinedParticipants.length >= 4 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3" :
                "grid-cols-1" 
            )}>
                {combinedParticipants.map(participant => (
                <ParticipantView key={participant.id} {...participant} />
                ))}
            </div>
            )}
      </main>

      <footer className="p-4 border-t border-border bg-background/80 backdrop-blur-md sticky bottom-0">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <Button
            variant={localMicMuted ? "destructive" : "default"}
            size="lg"
            className="rounded-full p-4 btn-gel"
            onClick={toggleMic}
            aria-label={localMicMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {localMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button
             variant={(localCameraOff && !isScreenSharingActive) ? "destructive" : "default"}
             size="lg"
             className={cn(
                "rounded-full p-4",
                isScreenSharingActive ? "opacity-50 cursor-not-allowed" : "btn-gel" 
             )}
             onClick={toggleCamera}
             aria-label={(localCameraOff && !isScreenSharingActive) ? "Turn Camera On" : "Turn Camera Off"}
             disabled={isScreenSharingActive} 
          >
            {(localCameraOff && !isScreenSharingActive) ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
           <Button
            size="lg"
            className={cn(
              "rounded-full p-4",
              localHandRaised
                ? "bg-accent text-accent-foreground ring-2 ring-offset-2 ring-offset-background ring-accent shadow-lg" 
                : "btn-gel shadow-md" 
            )}
            onClick={toggleHandRaise}
            aria-label={localHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <Hand className="h-6 w-6" />
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full p-4" onClick={leaveMeeting} aria-label="Leave Meeting">
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </footer>

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
        // Meeting code isn't readily available here, panel will handle its absence
      />
    </div>
  );
}
