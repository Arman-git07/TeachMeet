
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Video, VideoOff, Settings2, User as UserIcon, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth'; 
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; 
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';


type JoinRequestStatus = 'idle' | 'pending' | 'denied' | 'approved';

export default function WaitingAreaPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  
  const [appliedFilter, setAppliedFilter] = useState<string>("none");
  const [isFilterToggleOn, setIsFilterToggleOn] = useState<boolean>(false);
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [joinStatus, setJoinStatus] = useState<JoinRequestStatus>('idle');
  const [meetingCreatorId, setMeetingCreatorId] = useState<string | null>(null);
  const [isLoadingMeetingData, setIsLoadingMeetingData] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVideoStreamRef = useRef<MediaStream | null>(null);
  const currentMicStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  const isHost = user?.uid === meetingCreatorId;

  useEffect(() => {
    if (!meetingId || authLoading) return;
    
    setIsLoadingMeetingData(true);
    const meetingDocRef = doc(db, 'meetings', meetingId);

    getDoc(meetingDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setMeetingCreatorId(docSnap.data().creatorId || null);
      } else {
        toast({ variant: 'destructive', title: 'Meeting not found', description: 'This meeting does not seem to exist.'});
        router.push('/');
      }
    }).catch(err => {
      console.error("Error fetching meeting details:", err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch meeting details.'});
    }).finally(() => {
      setIsLoadingMeetingData(false);
    });
  }, [meetingId, authLoading, toast, router]);

  useEffect(() => {
    if (!user || !meetingId || isHost || joinStatus !== 'pending') return;

    // Listener for the user's specific join request document being deleted (denied)
    const joinRequestDocRef = doc(db, 'meetings', meetingId, 'joinRequests', user.uid);
    const unsubJoinRequest = onSnapshot(joinRequestDocRef, (doc) => {
      if (!doc.exists()) {
        if (joinStatus === 'pending') {
          setJoinStatus('denied');
        }
      }
    });
    
    // Listener for the user being added to the participants list (approved)
    const participantDocRef = doc(db, 'meetings', meetingId, 'participants', user.uid);
    const unsubParticipant = onSnapshot(participantDocRef, (doc) => {
        if (doc.exists()) {
            setJoinStatus('approved');
            toast({ title: "Request Approved!", description: "You are now joining the meeting." });
            const joinNowLinkPath = topic 
              ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}` 
              : `/dashboard/meeting/${meetingId}`;
            router.push(joinNowLinkPath);
        }
    });

    return () => {
      unsubJoinRequest();
      unsubParticipant();
    };
  }, [user, meetingId, joinStatus, router, topic, toast, isHost]);


  useEffect(() => {
    const storedFilter = localStorage.getItem("teachmeet-camera-filter");
    if (storedFilter) {
      setAppliedFilter(storedFilter);
      if (storedFilter !== "none") {
        setIsFilterToggleOn(true); 
      }
    }
    setMirrorVideo(localStorage.getItem('teachmeet-camera-mirror') === 'true');
  }, []);

  useEffect(() => {
    return () => {
      if (currentVideoStreamRef.current) {
        currentVideoStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (currentMicStreamRef.current) {
        currentMicStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleToggleCamera = async () => {
    if (isCameraActive) {
      if (currentVideoStreamRef.current) {
        currentVideoStreamRef.current.getTracks().forEach(track => track.stop());
        currentVideoStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      if (hasCameraPermission === false) { 
        toast({
          variant: "destructive",
          title: "Camera Access Denied",
          description: "Please enable camera permissions in your browser settings to use this feature.",
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        currentVideoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        setIsCameraActive(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setIsCameraActive(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Failed',
          description: 'Could not access the camera. Please ensure it is not in use by another application and that permissions are allowed.',
        });
      }
    }
  };

  const handleToggleMic = async () => {
    if (isMicActive) {
      if (currentMicStreamRef.current) {
        currentMicStreamRef.current.getTracks().forEach(track => track.stop());
        currentMicStreamRef.current = null;
      }
      setIsMicActive(false);
    } else {
      if (hasMicPermission === false) { 
        toast({
          variant: "destructive",
          title: "Microphone Access Denied",
          description: "Please enable microphone permissions in your browser settings.",
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentMicStreamRef.current = stream;
        setHasMicPermission(true);
        setIsMicActive(true);
        toast({
          title: "Microphone On",
          description: "Your microphone is now active.",
        });
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setHasMicPermission(false);
        setIsMicActive(false);
        toast({
          variant: 'destructive',
          title: 'Microphone Access Failed',
          description: 'Could not access the microphone. Please ensure it is not in use and permissions are allowed.',
        });
      }
    }
  };

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userAvatarSrc = user?.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;
  const userFallback = userName.charAt(0).toUpperCase();

  const displayTitle = topic ? `${topic}` : `Meeting ID: ${meetingId}`;
  
  const handleJoinAction = async () => {
    localStorage.setItem('teachmeet-desired-camera-state', isCameraActive ? 'on' : 'off');
    localStorage.setItem('teachmeet-desired-mic-state', isMicActive ? 'on' : 'off');
    
    if (!user) {
        toast({ variant: 'destructive', title: 'Not signed in', description: 'You must be signed in to join a meeting.'});
        return;
    }

    if (isHost) {
        try {
            // Even if host, we create the participant document here to ensure they exist.
            const participantRef = doc(db, 'meetings', meetingId, 'participants', user.uid);
            await setDoc(participantRef, {
                userId: user.uid,
                name: user.displayName || userName,
                photoURL: user.photoURL,
                isMicMuted: !isMicActive,
                isCameraOff: !isCameraActive,
                isHandRaised: false,
                isScreenSharing: false,
                joinedAt: serverTimestamp(),
            }, { merge: true }); // Merge to not overwrite if somehow already there

            const joinNowLinkPath = topic 
                ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}` 
                : `/dashboard/meeting/${meetingId}`;
            router.push(joinNowLinkPath);

        } catch (error) {
            console.error("Error setting host as participant:", error);
            toast({ variant: 'destructive', title: 'Join Failed', description: 'Could not register you as a participant. Check console and Firestore rules.' });
        }
    } else {
      // Logic for guests requesting to join
      setJoinStatus('pending');
      toast({ title: 'Request Sent', description: 'Your request to join has been sent to the host. Please wait for approval.'});
      
      try {
          const joinRequestRef = doc(db, 'meetings', meetingId, 'joinRequests', user.uid);
          await setDoc(joinRequestRef, {
            name: user.displayName || userName,
            photoURL: user.photoURL,
            timestamp: serverTimestamp(),
            status: 'pending'
          });
      } catch (error) {
          console.error("Error sending join request:", error);
          toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send your join request. Please check the meeting ID, your connection, and Firestore rules.'});
          setJoinStatus('idle');
      }
    }
  };

  const getButtonState = () => {
    if (authLoading || isLoadingMeetingData) {
      return { text: "Loading...", disabled: true, showSpinner: true };
    }

    if (isHost) {
      const disabled = !agreedToTerms;
      return { text: "Join Now as Host", disabled, showSpinner: false, onClick: handleJoinAction };
    }

    let text = "Ask to Join";
    let disabled = !agreedToTerms || joinStatus === 'pending' || joinStatus === 'approved';

    if (joinStatus === 'pending') text = "Waiting for Host...";
    if (joinStatus === 'approved') text = "Joining...";
    if (joinStatus === 'denied') {
      text = "Request Denied. Ask again?";
      disabled = !agreedToTerms;
      const originalOnClick = handleJoinAction;
      return { 
        text, 
        disabled, 
        showSpinner: false, 
        onClick: () => { setJoinStatus('idle'); originalOnClick(); }
      };
    }
    
    return { text, disabled, showSpinner: joinStatus === 'pending' || joinStatus === 'approved', onClick: handleJoinAction };
  };

  const { text: buttonText, disabled: buttonDisabled, showSpinner, onClick: buttonOnClick } = getButtonState();

  const videoClassNames = cn(
    "w-full h-full object-cover",
    {
      "video-mirror": mirrorVideo,
      "video-filter-grayscale": isFilterToggleOn && appliedFilter === "grayscale" && isCameraActive,
      "video-filter-sepia": isFilterToggleOn && appliedFilter === "sepia" && isCameraActive,
      "video-filter-vintage": isFilterToggleOn && appliedFilter === "vintage" && isCameraActive,
      "video-filter-luminous": isFilterToggleOn && appliedFilter === "luminous" && isCameraActive,
      "video-filter-dramatic": isFilterToggleOn && appliedFilter === "dramatic" && isCameraActive,
      "video-filter-goldenhour": isFilterToggleOn && appliedFilter === "goldenhour" && isCameraActive,
      "video-filter-softfocus": isFilterToggleOn && appliedFilter === "softfocus" && isCameraActive,
      "video-filter-brightclear": isFilterToggleOn && appliedFilter === "brightclear" && isCameraActive,
      "video-filter-naturalglow": isFilterToggleOn && appliedFilter === "naturalglow" && isCameraActive,
      "video-filter-radiantskin": isFilterToggleOn && appliedFilter === "radiantskin" && isCameraActive,
      "video-filter-smoothbright": isFilterToggleOn && appliedFilter === "smoothbright" && isCameraActive,
    }
  );

  const filterDisplayName = appliedFilter === "none" ? "No filter" : appliedFilter.charAt(0).toUpperCase() + appliedFilter.slice(1).replace(/([A-Z])/g, ' $1');;

  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <UserIcon className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">
            Joining: {displayTitle}
          </CardTitle>
          <CardDescription>Configure your audio and video before entering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="aspect-[9/16] md:aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <video ref={videoRef} className={videoClassNames} autoPlay muted playsInline />
            {(!isCameraActive || hasCameraPermission === false) && (
               <div className="absolute inset-0 bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                 {authLoading ? (
                      <p>Loading user info...</p>
                    ) : (
                      <Avatar className="w-28 h-28 md:w-36 md:h-36 mb-4 border-4 border-background shadow-lg">
                        <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar"/>
                        <AvatarFallback className="text-5xl md:text-6xl">{userFallback}</AvatarFallback>
                      </Avatar>
                    )}
                {hasCameraPermission === false && (
                  <>
                    <VideoOff className="h-8 w-8 mx-auto mb-1 text-destructive" />
                    <p className="font-semibold">Camera permission denied</p>
                    <p className="text-xs">To use your camera, please allow access in your browser settings.</p>
                  </>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3 z-30">
              <Button
                variant={isMicActive ? "default" : "destructive"}
                size="icon"
                className="rounded-full shadow-md"
                onClick={handleToggleMic}
                aria-label={isMicActive ? "Mute microphone" : "Unmute microphone"}
              >
                {isMicActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button
                variant={isCameraActive ? "default" : "destructive"}
                size="icon"
                className="rounded-full shadow-md"
                onClick={handleToggleCamera}
                aria-label={isCameraActive ? "Turn camera off" : "Turn camera on"}
              >
                {isCameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your camera to share your video.
                Please enable camera permissions in your browser settings and refresh the page or try toggling the camera again.
              </AlertDescription>
            </Alert>
          )}

          {hasMicPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Microphone Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your microphone to share your audio.
                Please enable microphone permissions in your browser settings and try toggling the microphone again.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
              <Label htmlFor="filter-toggle" className="text-sm text-muted-foreground">
                Apply Filter: <span className="font-medium text-foreground">{filterDisplayName}</span>
                {appliedFilter !== "none" && <span className="text-xs"> (from settings)</span>}
              </Label>
              <Switch
                id="filter-toggle"
                checked={isFilterToggleOn}
                onCheckedChange={setIsFilterToggleOn}
                disabled={appliedFilter === "none"}
                aria-label="Toggle camera filter"
              />
            </div>
          </div>

          <Button asChild variant="outline" className="w-full flex items-center justify-center gap-2 rounded-lg">
              <Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}`}>
                <Settings2 className="h-5 w-5" />
                Advanced Settings
              </Link>
            </Button>
          
          <div className="flex items-center space-x-2 p-3 border rounded-lg shadow-sm">
            <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)} />
            <Label htmlFor="terms" className="text-xs text-muted-foreground">
              I agree to the{' '}
              <Link href="/terms-of-service" target="_blank" className="text-accent hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/community-guidelines" target="_blank" className="text-accent hover:underline">
                Community Guidelines
              </Link>
              .
            </Label>
          </div>

          <Button onClick={buttonOnClick} className="w-full btn-gel text-lg py-3 rounded-lg" disabled={buttonDisabled}>
            {showSpinner && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {buttonText}
          </Button>
          {!agreedToTerms && (
            <p className="text-xs text-destructive text-center">
              You must agree to the terms and guidelines to join the meeting.
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            By joining, you acknowledge our{' '}
             <Link href="/privacy-policy" target="_blank" className="text-accent hover:underline">
                Privacy Policy
              </Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
