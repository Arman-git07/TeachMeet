
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Video, VideoOff, Settings2, User as UserIcon, AlertTriangle, ShieldAlert, Loader2, Link as LinkIcon, CheckCircle } from "lucide-react";
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

export default function WaitingAreaPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const isHostFromUrl = searchParams.get("host") === "true";
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [joinStatus, setJoinStatus] = useState<JoinRequestStatus>('idle');
  const [isLoadingMeetingData, setIsLoadingMeetingData] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVideoStreamRef = useRef<MediaStream | null>(null);
  const currentMicStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  const [isHost, setIsHost] = useState(false);

  // Effect 1: Determine Host Status & Initial Setup
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
        const intendedUrl = `/dashboard/meeting/${meetingId}/wait?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
        return;
    }

    setIsHost(isHostFromUrl);
    setIsLoadingMeetingData(false);

    const checkPermissions = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
        } catch (e) {
            setHasCameraPermission(false);
        }
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setHasMicPermission(true);
        } catch (e) {
            setHasMicPermission(false);
        }
    };
    checkPermissions();

  }, [meetingId, user, authLoading, isHostFromUrl, router, searchParams]);

  // Effect 2: Guest listener for join request status
  useEffect(() => {
    if (!user || isHost || !meetingId) return;

    const requestRef = doc(db, 'meetings', meetingId, 'joinRequests', user.uid);
    const unsubscribe = onSnapshot(requestRef, (snap) => {
        if (snap.exists()) {
            const status = snap.data().status as JoinRequestStatus;
            if (status === 'approved') {
                toast({ title: "Request Approved!", description: "You are now joining the meeting." });
                const joinNowLinkPath = topic ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}` : `/dashboard/meeting/${meetingId}`;
                router.push(joinNowLinkPath);
            } else if (status === 'denied') {
                toast({ variant: 'destructive', title: "Request Denied", description: "The host has denied your request to join." });
                setJoinStatus('denied');
            } else {
                 setJoinStatus(status);
            }
        } else if (joinStatus === 'pending') {
            setJoinStatus('denied');
            toast({ variant: 'destructive', title: "Request Denied", description: "The host has denied your request to join." });
        }
    });

    return () => unsubscribe();
  }, [user, meetingId, isHost, router, topic, toast, joinStatus]);


  // Effect 3: Gracefully stop media tracks on component unmount
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
        const joinNowLinkPath = topic ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}` : `/dashboard/meeting/${meetingId}`;
        router.push(joinNowLinkPath);
        return;
    }
    
    setJoinStatus('pending');
    try {
        const requestRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
        await setDoc(requestRef, {
            name: user.displayName || userName,
            photoURL: user.photoURL,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Request Sent', description: 'Waiting for the host to let you in.' });
    } catch (err) {
        console.error("Join request failed:", err);
        toast({ variant: 'destructive', title: "Request Failed", description: "Could not send join request. The meeting may not exist or there may be a permissions issue."});
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

    if (joinStatus === 'pending') {
        return { text: "Waiting for Host...", disabled: true, showSpinner: true, onClick: () => {} };
    }
    
    if (joinStatus === 'denied') {
        return { 
            text: "Request Denied. Ask again?", 
            disabled: !agreedToTerms, 
            showSpinner: false, 
            onClick: handleJoinAction
        };
    }
    
    return { text: "Ask to Join", disabled: !agreedToTerms, showSpinner: false, onClick: handleJoinAction };
  };

  const { text: buttonText, disabled: buttonDisabled, showSpinner, onClick: buttonOnClick } = getButtonState();

  const videoClassNames = cn("w-full h-full object-cover", { "video-mirror": true });

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
        </CardContent>
         <CardFooter>
            <Button variant="link" asChild className="text-muted-foreground">
                <Link href="/"><LinkIcon className="mr-2 h-4 w-4"/> Go to Homepage</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
