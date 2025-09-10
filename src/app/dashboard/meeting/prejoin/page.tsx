
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Loader2, Link as LinkIcon, User as UserIcon, Settings, ImageIcon, FlipHorizontal } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth'; 
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; 
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";


export default function PrejoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const meetingId = searchParams.get("meetingId");
  const topic = searchParams.get("topic") || "Untitled Meeting";
  
  const { user, loading: authLoading } = useAuth(); 

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  
  const [mirrorCamera, setMirrorCamera] = useState(false);
  const [appliedFilter, setAppliedFilter] = useState<string>('none');
  const [isFilterToggleOn, setIsFilterToggleOn] = useState(false);

  const getDevicesAndPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop()); 
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
    setCamOn(localStorage.getItem('teachmeet-camera-default') !== 'off');
    setMicOn(localStorage.getItem('teachmeet-mic-default') === 'on');
    setMirrorCamera(localStorage.getItem('teachmeet-camera-mirror') === 'true');
    const filter = localStorage.getItem('teachmeet-camera-filter') || 'none';
    setAppliedFilter(filter);
    setIsFilterToggleOn(filter !== 'none' && localStorage.getItem('teachmeet-filter-toggle') === 'on');
    
    getDevicesAndPermissions();
  }, [user, authLoading, getDevicesAndPermissions]);
  
   useEffect(() => {
    const setupStream = async () => {
        if (currentStreamRef.current) {
            currentStreamRef.current.getTracks().forEach(track => track.stop());
        }

        if (hasPermissions && (camOn || micOn)) {
            try {
                const constraints: MediaStreamConstraints = { video: camOn, audio: micOn };
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                currentStreamRef.current = newStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
            } catch (err) {
                console.error("Failed to get media:", err);
                toast({ variant: 'destructive', title: "Device Error", description: "Could not use the camera or microphone." });
            }
        } else {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    };
    
    setupStream();
    
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [camOn, micOn, hasPermissions, toast]);

  const handleJoinNow = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: "Not Authenticated", description: "You must be signed in to start a meeting." });
      return;
    }
    if (!meetingId) {
      toast({ variant: 'destructive', title: "Meeting ID Missing", description: "Cannot join without a valid meeting ID. Please start again." });
      router.push('/dashboard');
      return;
    }

    setIsJoining(true);
    
    // Save device preferences for next time
    localStorage.setItem('teachmeet-desired-camera-state', camOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-desired-mic-state', micOn ? 'on' : 'off');

    router.push(`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`);
  };

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userAvatarSrc = user?.photoURL || `https://placehold.co/128x128.png?text=${userName.charAt(0).toUpperCase()}`;
  const userFallback = userName.charAt(0).toUpperCase();

  const videoClassNames = cn(
    "w-full h-full object-cover",
    {
      "video-mirror": mirrorCamera,
      "video-filter-grayscale": isFilterToggleOn && appliedFilter === "grayscale",
      "video-filter-sepia": isFilterToggleOn && appliedFilter === "sepia",
      "video-filter-vintage": isFilterToggleOn && appliedFilter === "vintage",
      "video-filter-luminous": isFilterToggleOn && appliedFilter === "luminous",
      "video-filter-dramatic": isFilterToggleOn && appliedFilter === "dramatic",
      "video-filter-goldenhour": isFilterToggleOn && appliedFilter === "goldenhour",
      "video-filter-softfocus": isFilterToggleOn && appliedFilter === "softfocus",
      "video-filter-brightclear": isFilterToggleOn && appliedFilter === "brightclear",
      "video-filter-naturalglow": isFilterToggleOn && appliedFilter === "naturalglow",
      "video-filter-radiantskin": isFilterToggleOn && appliedFilter === "radiantskin",
      "video-filter-smoothbright": isFilterToggleOn && appliedFilter === "smoothbright",
    }
  );

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
                        <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="user avatar"/>
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
                 <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                    <Label htmlFor="mirror-camera" className="flex items-center gap-2"><FlipHorizontal className="h-4 w-4" /> Mirror my video</Label>
                    <Switch id="mirror-camera" checked={mirrorCamera} onCheckedChange={setMirrorCamera}/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="video-filter">Video Filter</Label>
                    <Select value={appliedFilter} onValueChange={setAppliedFilter}>
                        <SelectTrigger id="video-filter" className="rounded-lg"><SelectValue placeholder="Select a filter..." /></SelectTrigger>
                        <SelectContent className="rounded-lg">
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="grayscale">Grayscale</SelectItem>
                            <SelectItem value="sepia">Sepia</SelectItem>
                            <SelectItem value="vintage">Vintage</SelectItem>
                            <SelectItem value="luminous">Luminous</SelectItem>
                            <SelectItem value="dramatic">Dramatic</SelectItem>
                            <SelectItem value="goldenhour">Golden Hour</SelectItem>
                            <SelectItem value="softfocus">Soft Focus</SelectItem>
                             <SelectItem value="brightclear">Bright & Clear</SelectItem>
                            <SelectItem value="naturalglow">Natural Glow</SelectItem>
                            <SelectItem value="radiantskin">Radiant Skin</SelectItem>
                            <SelectItem value="smoothbright">Smooth & Bright</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                    <Label htmlFor="filter-toggle" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Apply Filter: {appliedFilter}</Label>
                    <Switch id="filter-toggle" checked={isFilterToggleOn} onCheckedChange={setIsFilterToggleOn} disabled={appliedFilter === 'none'}/>
                </div>
                <Button asChild variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                  <Link href={`/dashboard/settings?highlight=advancedMeetingSettings`}>
                    <Settings className="h-4 w-4 mr-2"/> Advanced Settings
                  </Link>
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
          
          <button
            id="join-now-host"
            type="button"
            onClick={handleJoinNow}
            disabled={!agreedToTerms || isJoining}
            className={cn(
              "w-full text-lg py-3 rounded-lg transition-all duration-200 font-semibold text-white flex items-center justify-center",
              (!agreedToTerms || isJoining)
                ? "bg-primary/50 cursor-not-allowed"
                : "btn-gel"
            )}
          >
            {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isJoining ? "Joining..." : "Join Now as Host"}
          </button>

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
