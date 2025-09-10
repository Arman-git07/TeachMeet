
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Loader2, Link as LinkIcon, User as UserIcon, Settings, ImageIcon, FlipHorizontal, Copy, Share2, Hash } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth'; 
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; 
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";


export default function PrejoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); 

  const [topic, setTopic] = useState(searchParams.get("topic") || "Untitled Meeting");
  const [meetingId, setMeetingId] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  
  const [mirrorCamera, setMirrorCamera] = useState(false);
  const [appliedFilter, setAppliedFilter] = useState<string>('none');
  const [isFilterToggleOn, setIsFilterToggleOn] = useState(false);
  
  useEffect(() => {
    const id = "meeting-" + crypto.randomUUID().slice(0, 11).replace(/-/g, '');
    setMeetingId(id);
    if (typeof window !== "undefined") {
      setMeetingLink(`${window.location.origin}/dashboard/join-meeting?meetingId=${id}`);
    }
  }, []);

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
    if (isJoining || !agreedToTerms || !topic.trim() || !user) {
      if (!agreedToTerms) toast({ variant: "destructive", title: "Agreement Required", description: "You must agree to the terms to proceed." });
      return;
    }

    setIsJoining(true);
    
    // Store device preferences in localStorage so the meeting page can pick them up
    localStorage.setItem('teachmeet-desired-camera-state', camOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-desired-mic-state', micOn ? 'on' : 'off');

    try {
      const meetingRef = doc(db, "meetings", meetingId);
      await setDoc(meetingRef, {
        hostId: user.uid,
        topic: topic.trim(),
        createdAt: serverTimestamp(),
      });
      
      const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic.trim())}`;
      router.push(meetingPath);
    } catch (err) {
      console.error("Error creating meeting:", err);
      toast({
        variant: "destructive",
        title: "Failed to Start",
        description: "Could not create the meeting room. Check Firestore rules and try again.",
      });
      setIsJoining(false);
    }
  };
  
  const handleCopyToClipboard = (textToCopy: string, type: 'Link' | 'Code') => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({ title: `${type} Copied!`, description: `${type} has been copied to your clipboard.`});
    }).catch(err => {
      toast({ variant: 'destructive', title: 'Copy Failed', description: `Could not copy the ${type}.`});
    });
  };

  const handleShareInvite = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join my TeachMeet meeting: ${topic}`,
        text: `You're invited to join my meeting on TeachMeet. Use this link or code:\nLink: ${meetingLink}\nCode: ${meetingId}`,
        url: meetingLink,
      }).catch(console.error);
    } else {
      handleCopyToClipboard(`Join my TeachMeet meeting: ${topic}\nLink: ${meetingLink}\nCode: ${meetingId}`, 'Link');
    }
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
      <Card className="w-full max-w-4xl shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <UserIcon className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">
            Ready to Join?
          </CardTitle>
          <CardDescription>Check your camera and mic before joining.</CardDescription>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-2 gap-6 items-start">
          
          <div className="space-y-4">
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
            
          </div>
          
          <div className="space-y-4">
            <div className="space-y-4 pt-4 border-t lg:border-t-0 lg:pt-0">
              <div className="flex items-center justify-between">
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
              <div className="flex items-center justify-between">
                  <Label htmlFor="filter-toggle" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Apply Filter</Label>
                  <Switch id="filter-toggle" checked={isFilterToggleOn} onCheckedChange={setIsFilterToggleOn} disabled={appliedFilter === 'none'}/>
              </div>
              <Button asChild variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                <Link href={`/dashboard/settings?highlight=advancedMeetingSettings`}>
                  <Settings className="h-4 w-4 mr-2"/> Advanced Settings
                </Link>
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Invite Others</Label>
              <div className="space-y-2">
                  <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input readOnly value={meetingLink} className="pl-9 pr-10 rounded-lg text-xs" />
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopyToClipboard(meetingLink, 'Link')}>
                          <Copy className="h-4 w-4" />
                      </Button>
                  </div>
                   <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input readOnly value={meetingId} className="pl-9 pr-10 rounded-lg text-sm font-mono" />
                       <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopyToClipboard(meetingId, 'Code')}>
                          <Copy className="h-4 w-4" />
                      </Button>
                  </div>
              </div>
            </div>
            <Button variant="outline" className="w-full rounded-lg" onClick={handleShareInvite}>
                <Share2 className="mr-2 h-4 w-4" /> Share Full Invite
            </Button>
             <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="meetingTopicInput">Meeting Topic</Label>
              <Input
                id="meetingTopicInput"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="rounded-lg text-lg"
                placeholder="E.g., Weekly Team Sync"
              />
            </div>
          </div>
        </CardContent>
         <CardFooter className="flex-col gap-4 border-t pt-4">
            <div className="flex items-center space-x-2">
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
                disabled={!agreedToTerms || isJoining || !topic.trim()}
                className={cn(
                  "w-full text-lg py-3 rounded-lg transition-all duration-200 font-semibold text-white flex items-center justify-center",
                  (!agreedToTerms || isJoining || !topic.trim())
                    ? "bg-primary/50 cursor-not-allowed"
                    : "btn-gel"
                )}
              >
                {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isJoining ? "Starting..." : "Join Now"}
            </button>
            <Button variant="link" asChild className="text-muted-foreground text-sm">
                <Link href="/"><LinkIcon className="mr-2 h-4 w-4"/> Cancel and go to Homepage</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
