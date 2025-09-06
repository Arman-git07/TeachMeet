
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Loader2, Link as LinkIcon, User as UserIcon } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth'; 
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; 
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { db, auth } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';


const generateRandomId = (length: number) => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';

export default function PrejoinPage() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(false); // Default mic to off
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean|null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        const intendedUrl = `/dashboard/meeting/prejoin?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
        return;
    }

    const getMedia = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(mediaStream);
            setHasPermissions(true);
        } catch (err) {
            console.error("Error accessing media devices:", err);
            setHasPermissions(false);
            setCamOn(false);
            setMicOn(false);
        }
    };
    getMedia();

    return () => {
        stream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router, searchParams]);

  useEffect(() => {
    if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  useEffect(() => {
      stream?.getAudioTracks().forEach(track => track.enabled = micOn);
  }, [stream, micOn]);
  
  useEffect(() => {
      stream?.getVideoTracks().forEach(track => track.enabled = camOn);
  }, [stream, camOn]);


  const handleJoin = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not authenticated' });
      return;
    }
    setIsJoining(true);

    const meetingId = generateRandomId(9);
    
    try {
        const meetingDocRef = doc(db, "meetings", meetingId);
        await setDoc(meetingDocRef, {
            hostId: user.uid,
            topic: topic,
            createdAt: serverTimestamp(),
        });
        
        localStorage.setItem('teachmeet-desired-camera-state', camOn ? 'on' : 'off');
        localStorage.setItem('teachmeet-desired-mic-state', micOn ? 'on' : 'off');
        
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

        router.push(`/dashboard/meeting/${meetingId}`);

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
          <div className="aspect-[9/16] md:aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <video ref={videoRef} className={videoClassNames} autoPlay muted playsInline />
            {(!camOn || hasPermissions === false) && (
               <div className="absolute inset-0 bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                 {authLoading ? (
                      <p>Loading user info...</p>
                    ) : (
                      <Avatar className="w-28 h-28 md:w-36 md:h-36 mb-4 border-4 border-background shadow-lg">
                        <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="avatar user"/>
                        <AvatarFallback className="text-5xl md:text-6xl">{userFallback}</AvatarFallback>
                      </Avatar>
                    )}
                {hasPermissions === false && (
                    <p className="font-semibold mt-2 text-destructive">Camera/Mic permission denied</p>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3 z-30">
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
