
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
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';


type JoinRequestStatus = 'idle' | 'pending' | 'denied' | 'approved';

export default function WaitingAreaPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");
  const isExplicitHost = searchParams.get("host") === "true";
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  
  const [appliedFilter, setAppliedFilter] = useState<string>("none");
  const [isFilterToggleOn, setIsFilterToggleOn] = useState<boolean>(false);
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [joinStatus, setJoinStatus] = useState<JoinRequestStatus>('idle');
  const [isLoadingMeetingData, setIsLoadingMeetingData] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // Load preferences from localStorage on component mount
    const cameraPref = localStorage.getItem('teachmeet-desired-camera-state') !== 'off';
    const micPref = localStorage.getItem('teachmeet-desired-mic-state') === 'on';
    setIsCameraOn(cameraPref);
    setIsMicOn(micPref);

    const storedFilter = localStorage.getItem("teachmeet-camera-filter");
    if (storedFilter) {
      setAppliedFilter(storedFilter);
      if (storedFilter !== "none") {
        setIsFilterToggleOn(true); 
      }
    }
    setMirrorVideo(localStorage.getItem('teachmeet-camera-mirror') === 'true');
    setAgreedToTerms(localStorage.getItem('teachmeet-agreed-terms') === 'true');
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if(videoRef.current) videoRef.current.srcObject = null;
    }
  }, []);

  const getMedia = useCallback(async (video: boolean, audio: boolean) => {
    stopStream();
    if (!video && !audio) {
      setHasCameraPermission(true); // Technically, no permission needed if off
      setHasMicPermission(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(video ? true : hasCameraPermission);
      setHasMicPermission(audio ? true : hasMicPermission);
    } catch (err) {
      console.error('Error accessing media:', err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        if(video) setHasCameraPermission(false);
        if(audio) setHasMicPermission(false);
      } else {
        toast({ variant: 'destructive', title: 'Media Device Error', description: 'Could not find a camera or microphone. Please check your devices.' });
      }
      // If we failed, turn the toggles off
      if(video) setIsCameraOn(false);
      if(audio) setIsMicOn(false);
    }
  }, [stopStream, toast, hasCameraPermission, hasMicPermission]);

  useEffect(() => {
    getMedia(isCameraOn, isMicOn);
    return () => stopStream();
  }, [isCameraOn, isMicOn, getMedia, stopStream]);
  
  const handleToggleCamera = () => setIsCameraOn(prev => !prev);
  const handleToggleMic = () => setIsMicOn(prev => !prev);

  useEffect(() => {
    // Determine host status. Prioritize the explicit URL flag.
    if (isExplicitHost && user) {
      setIsHost(true);
      setIsLoadingMeetingData(false);
    } else if (user && !authLoading) {
      // If not explicitly a host, check the database for existing meeting.
      const meetingDocRef = doc(db, 'meetings', meetingId);
      getDoc(meetingDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setIsHost(docSnap.data().creatorId === user.uid);
        } else {
          // If doc doesn't exist and they don't have the flag, they are a guest.
          setIsHost(false);
        }
      }).catch(err => {
        console.error("Error checking host status:", err);
        setIsHost(false);
      }).finally(() => {
        setIsLoadingMeetingData(false);
      });
    }
    // If not logged in, they cannot be the host.
    if (!user && !authLoading) {
      setIsHost(false);
      setIsLoadingMeetingData(false);
    }
  }, [meetingId, user, authLoading, isExplicitHost]);

  // Listener for guests awaiting approval.
  useEffect(() => {
    if (!user || !meetingId || isHost || joinStatus !== 'pending') return;
    
    const participantDocRef = doc(db, 'meetings', meetingId, 'participants', user.uid);

    const unsubscribe = onSnapshot(participantDocRef, (participantSnap) => {
        if (participantSnap.exists()) {
            setJoinStatus('approved');
            toast({ title: "Request Approved!", description: "You are now joining the meeting." });
            const joinNowLinkPath = topic
                ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`
                : `/dashboard/meeting/${meetingId}`;
            router.push(joinNowLinkPath);
        }
    }, (error) => {
        console.error("Error listening to participant document:", error);
    });
    
    const requestDocRef = doc(db, 'meetings', meetingId, 'joinRequests', user.uid);
    const unsubscribeDenial = onSnapshot(requestDocRef, (requestSnap) => {
        if (!requestSnap.exists() && joinStatus === 'pending') {
            setTimeout(() => {
                if (joinStatus === 'pending') {
                    setJoinStatus('denied');
                }
            }, 1500);
        }
    });

    return () => {
        unsubscribe();
        unsubscribeDenial();
    };
  }, [user, meetingId, isHost, joinStatus, router, topic, toast]);

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userAvatarSrc = user?.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;
  const userFallback = userName.charAt(0).toUpperCase();

  const displayTitle = topic ? `${topic}` : `Meeting ID: ${meetingId}`;
  
  const handleJoinAction = async () => {
    // Persist settings for the next session
    localStorage.setItem('teachmeet-desired-camera-state', isCameraOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-desired-mic-state', isMicOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-agreed-terms', agreedToTerms ? 'true' : 'false');
    
    if (!user) {
        toast({ variant: 'destructive', title: 'Not signed in', description: 'You must be signed in to join a meeting.'});
        return;
    }

    if (isHost) {
        const meetingDocRef = doc(db, "meetings", meetingId);
        const participantDocRef = doc(db, "meetings", meetingId, "participants", user.uid);
        try {
            await setDoc(meetingDocRef, {
                creatorId: user.uid,
                topic: topic || "Untitled Meeting",
                createdAt: serverTimestamp(),
            });

            // Host also adds themselves as a participant immediately
            await setDoc(participantDocRef, {
                name: user.displayName || userName,
                photoURL: user.photoURL,
                isMicMuted: !isMicOn,
                isCameraOff: !isCameraOn,
                isHandRaised: false,
                isScreenSharing: false,
                joinedAt: serverTimestamp(),
            });

            const joinNowLinkPath = topic ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}` : `/dashboard/meeting/${meetingId}`;
            router.push(joinNowLinkPath);
        } catch (error) {
            console.error("Host failed to create/update meeting document:", error);
            toast({ variant: 'destructive', title: 'Failed to Start', description: 'Could not create the meeting room. Check Firestore rules.'});
        }
        return;
    }

    const requestRef = doc(db, `meetings/${meetingId}/joinRequests`, user.uid);
    const requestData = {
        name: user.displayName || userName,
        photoURL: user.photoURL,
        requestedAt: serverTimestamp(),
    };

    try {
      await setDoc(requestRef, requestData);
      setJoinStatus('pending');
      toast({ title: 'Request Sent', description: 'Your request to join has been sent to the host. Please wait for approval.'});
    } catch (error: any) {
        console.error("Join request failed:", error.code, error.message);
        toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send your join request. The meeting may not exist or there may be a permissions issue.'});
        setJoinStatus('idle');
    }
  };

  const getButtonState = () => {
    if (authLoading || isLoadingMeetingData) {
      return { text: "Loading...", disabled: true, showSpinner: true, onClick: () => {} };
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
      return { 
        text, 
        disabled, 
        showSpinner: false, 
        onClick: () => { setJoinStatus('idle'); handleJoinAction(); }
      };
    }
    
    return { text, disabled, showSpinner: joinStatus === 'pending' || joinStatus === 'approved', onClick: handleJoinAction };
  };

  const { text: buttonText, disabled: buttonDisabled, showSpinner, onClick: buttonOnClick } = getButtonState();

  const videoClassNames = cn(
    "w-full h-full object-cover",
    {
      "video-mirror": mirrorVideo,
      "video-filter-grayscale": isFilterToggleOn && appliedFilter === "grayscale" && isCameraOn,
      "video-filter-sepia": isFilterToggleOn && appliedFilter === "sepia" && isCameraOn,
      "video-filter-vintage": isFilterToggleOn && appliedFilter === "vintage" && isCameraOn,
      "video-filter-luminous": isFilterToggleOn && appliedFilter === "luminous" && isCameraOn,
      "video-filter-dramatic": isFilterToggleOn && appliedFilter === "dramatic" && isCameraOn,
      "video-filter-goldenhour": isFilterToggleOn && appliedFilter === "goldenhour" && isCameraOn,
      "video-filter-softfocus": isFilterToggleOn && appliedFilter === "softfocus" && isCameraOn,
      "video-filter-brightclear": isFilterToggleOn && appliedFilter === "brightclear" && isCameraOn,
      "video-filter-naturalglow": isFilterToggleOn && appliedFilter === "naturalglow" && isCameraOn,
      "video-filter-radiantskin": isFilterToggleOn && appliedFilter === "radiantskin" && isCameraOn,
      "video-filter-smoothbright": isFilterToggleOn && appliedFilter === "smoothbright" && isCameraOn,
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
            {(!isCameraOn || hasCameraPermission === false) && (
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
                variant={isMicOn ? "default" : "destructive"}
                size="icon"
                className="rounded-full shadow-md"
                onClick={handleToggleMic}
                aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
              >
                {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button
                variant={isCameraOn ? "default" : "destructive"}
                size="icon"
                className="rounded-full shadow-md"
                onClick={handleToggleCamera}
                aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
              >
                {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera Permission Denied</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your camera. Please enable it in your browser settings and try toggling the camera again.
              </AlertDescription>
            </Alert>
          )}

          {hasMicPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Microphone Permission Denied</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your microphone. Please enable it in your browser settings and try toggling the microphone again.
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
