
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Loader2, Link as LinkIcon, User as UserIcon, Settings } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth'; 
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; 
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { db, auth } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";


const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

export default function PrejoinPage() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const meetingId = searchParams.get("meetingId"); // Get meetingId from URL
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(false); // Default mic to off
  const [isJoining, setIsJoining] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInDevices, setAudioInDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('default');
  const [selectedAudioInDevice, setSelectedAudioInDevice] = useState<string>('default');
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const getDevices = useCallback(async () => {
    try {
      // First, get permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop tracks immediately after getting permissions
      stream.getTracks().forEach(track => track.stop());

      // Now, enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioInDevices(devices.filter(d => d.kind === 'audioinput'));
      setHasPermissions(true);
    } catch (err) {
      console.error("Error getting A/V devices:", err);
      setHasPermissions(false);
      setCamOn(false);
      setMicOn(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    
    // Load saved device preferences
    setSelectedVideoDevice(localStorage.getItem('teachmeet-video-device') || 'default');
    setSelectedAudioInDevice(localStorage.getItem('teachmeet-audioin-device') || 'default');
    
    getDevices();
  }, [user, authLoading, getDevices]);
  
   useEffect(() => {
    const setupStream = async () => {
        // Stop any existing stream
        if (currentStreamRef.current) {
            currentStreamRef.current.getTracks().forEach(track => track.stop());
        }

        if (camOn || micOn) {
            try {
                const constraints = {
                    video: camOn ? (selectedVideoDevice === 'default' ? true : { deviceId: { exact: selectedVideoDevice } }) : false,
                    audio: micOn ? (selectedAudioInDevice === 'default' ? true : { deviceId: { exact: selectedAudioInDevice } }) : false,
                };
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                currentStreamRef.current = newStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
            } catch (err) {
                console.error("Failed to get media with selected devices:", err);
                toast({ variant: 'destructive', title: "Device Error", description: "Could not use the selected camera or microphone." });
            }
        } else {
            // If both are off, ensure the video element is cleared
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    };
    
    if(hasPermissions) {
      setupStream();
    }
    
    // Cleanup function to stop tracks when component unmounts or dependencies change
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [camOn, micOn, selectedVideoDevice, selectedAudioInDevice, hasPermissions, toast]);

  const handleJoin = async () => {
    if (!user || !meetingId) {
      toast({ variant: 'destructive', title: 'Not authenticated or Missing ID' });
      return;
    }
    setIsJoining(true);
    
    try {
        const meetingDocRef = doc(db, "meetings", meetingId);
        await setDoc(meetingDocRef, {
            hostId: user.uid,
            topic: topic,
            createdAt: serverTimestamp(),
        });
        
        localStorage.setItem('teachmeet-desired-camera-state', camOn ? 'on' : 'off');
        localStorage.setItem('teachmeet-desired-mic-state', micOn ? 'on' : 'off');
        localStorage.setItem('teachmeet-video-device', selectedVideoDevice);
        localStorage.setItem('teachmeet-audioin-device', selectedAudioInDevice);
        
        // Update local storage for "Ongoing Meetings" list
        try {
            const startedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
            let startedMeetings = startedMeetingsRaw ? JSON.parse(startedMeetingsRaw) : [];
            if (!Array.isArray(startedMeetings)) startedMeetings = [];
            
            startedMeetings.unshift({ id: meetingId, title: topic, startedAt: Date.now() });
            
            localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(startedMeetings.slice(0, 10)));
            window.dispatchEvent(new CustomEvent('teachmeet_meeting_started'));
        } catch (error) {
            console.error("Failed to update local meeting records:", error);
        }

        router.push(`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`);

    } catch (err) {
        console.error("Error creating meeting document:", err);
        toast({
            variant: "destructive",
            title: "Failed to Start Meeting",
            description: "Could not create the meeting room. Please check your Firestore rules and internet connection.",
            duration: 7000,
        });
        setIsJoining(false);
    }
  };

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userAvatarSrc = user?.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;
  const userFallback = userName.charAt(0).toUpperCase();

  const videoClassNames = cn("w-full h-full object-cover", { "video-mirror": true });

  if(authLoading) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-background text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4 text-lg">Loading...</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <UserIcon className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">
            Joining: {topic}
          </CardTitle>
          <CardDescription>Check your camera and mic before joining.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                <video ref={videoRef} className={videoClassNames} autoPlay muted playsInline />
                {!camOn && (
                   <div className="absolute inset-0 bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                      <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">
                        <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="avatar user"/>
                        <AvatarFallback className="text-4xl">{userFallback}</AvatarFallback>
                      </Avatar>
                  </div>
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-3 z-10">
                  <Button
                    variant={micOn ? "default" : "destructive"}
                    size="icon"
                    className="rounded-full shadow-md"
                    onClick={() => setMicOn(!micOn)}
                    aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
                    disabled={hasPermissions === false}
                  >
                    {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant={camOn ? "default" : "destructive"}
                    size="icon"
                    className="rounded-full shadow-md"
                    onClick={() => setCamOn(!camOn)}
                    aria-label={camOn ? "Turn camera off" : "Turn camera on"}
                    disabled={hasPermissions === false}
                  >
                    {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="video-device-select">Camera</Label>
                   <Select value={selectedVideoDevice} onValueChange={setSelectedVideoDevice} disabled={!hasPermissions}>
                      <SelectTrigger id="video-device-select" className="rounded-lg"><SelectValue placeholder="Select a camera..." /></SelectTrigger>
                      <SelectContent className="rounded-lg">
                          <SelectItem value="default">Default</SelectItem>
                          {videoDevices.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}
                      </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audio-in-device-select">Microphone</Label>
                   <Select value={selectedAudioInDevice} onValueChange={setSelectedAudioInDevice} disabled={!hasPermissions}>
                      <SelectTrigger id="audio-in-device-select" className="rounded-lg"><SelectValue placeholder="Select a microphone..." /></SelectTrigger>
                      <SelectContent className="rounded-lg">
                          <SelectItem value="default">Default</SelectItem>
                          {audioInDevices.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}
                      </SelectContent>
                  </Select>
                </div>
                <Button asChild variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                  <Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic)}`}>
                    <Settings className="h-4 w-4 mr-2"/> Advanced Settings
                  </Link>
                </Button>
              </div>
          </div>

          <Button onClick={handleJoin} className="w-full btn-gel text-lg py-3 rounded-lg" disabled={isJoining || hasPermissions === false}>
            {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isJoining ? "Joining..." : "Join Now"}
          </Button>
        </CardContent>
         <CardFooter>
            <Button variant="link" asChild className="text-muted-foreground">
                <Link href="/"><LinkIcon className="mr-2 h-4 w-4"/> Cancel and go to Homepage</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

