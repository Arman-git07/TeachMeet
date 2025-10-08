
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Share2,
  VideoOff,
  MicOff,
  Video,
  Mic,
  AlertTriangle,
  Link as LinkIcon,
  Settings,
  FlipHorizontal,
  Sparkles,
  User,
  Hash,
  PanelLeftOpen,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShareOptionsPanel } from '@/components/common/ShareOptionsPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const STARTED_MEETINGS_KEY = 'teachmeet-started-meetings';
const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;

export default function PreJoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [topic, setTopic] = useState('Untitled Meeting');
  const [meetingId, setMeetingId] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingCode, setMeetingCode] = useState('');

  // UI State
  const [agreed, setAgreed] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [applyFilter, setApplyFilter] = useState(true);
  const [videoFilter, setVideoFilter] = useState('brightclear');
  const [startError, setStartError] = useState<string | null>(null);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isHost, setIsHost] = useState(false);


  // A/V State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  useEffect(() => {
    const existingMeetingId = searchParams.get('meetingId');
    const id = existingMeetingId || `meeting-${uuidv4().slice(0, 11).replace(/-/g, '')}`;
    const code = id.replace('meeting-','');
    const topicFromParams = searchParams.get('topic');

    if(topicFromParams) setTopic(topicFromParams);
    
    setMeetingId(id);
    setMeetingCode(code);
    
    if (typeof window !== 'undefined') {
      setMeetingLink(
        `${window.location.origin}/dashboard/join-meeting?meetingId=${id}`
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (!meetingId || authLoading) return;
  
    const determineRole = async () => {
      setIsLoadingRole(true);
      if (!user) {
        // Not logged in, so they are a guest/participant.
        setIsHost(false);
        setIsLoadingRole(false);
        return;
      }
      try {
        const meetingDoc = await getDoc(doc(db, "meetings", meetingId));
        if (meetingDoc.exists()) {
          // Meeting exists, check if current user is the creator
          setIsHost(meetingDoc.data().creatorId === user.uid);
        } else {
          // Meeting doesn't exist, so the current user must be the host creating it.
          setIsHost(true);
        }
      } catch (error) {
        console.error("Error checking meeting host:", error);
        // On error, default to non-host to be safe.
        setIsHost(false);
      } finally {
        setIsLoadingRole(false);
      }
    };
  
    determineRole();
  }, [meetingId, user, authLoading]);

  useEffect(() => {
    let mounted = true;
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        setHasCameraPermission(true);
        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        const desiredMicState = localStorage.getItem('teachmeet-mic-default') !== 'off';
        const desiredCamState = localStorage.getItem('teachmeet-camera-default') !== 'off';
        const savedMirror = localStorage.getItem('teachmeet-camera-mirror') === 'true';

        setIsMicOn(desiredMicState);
        setIsCameraOn(desiredCamState);
        setMirrorVideo(savedMirror);

        stream.getAudioTracks().forEach((track) => (track.enabled = desiredMicState));
        stream.getVideoTracks().forEach((track) => (track.enabled = desiredCamState));
        
        localStorage.setItem("micState", desiredMicState ? "true" : "false");
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setIsCameraOn(false);
         try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!mounted) return;
            setLocalStream(audioStream);
            const desiredMicState = localStorage.getItem('teachmeet-mic-default') !== 'off';
            setIsMicOn(desiredMicState);
            audioStream.getAudioTracks().forEach(track => track.enabled = desiredMicState);
            localStorage.setItem("micState", desiredMicState ? "true" : "false");
        } catch (audioError) {
             toast({
              variant: 'destructive',
              title: 'Media Access Denied',
              description: 'Please enable camera and microphone permissions in your browser settings to use this app.',
            });
        }
      }
    };

    getCameraPermission();

    const handleStorage = (e: StorageEvent) => {
        if (e.key === "micState") {
            const state = e.newValue === "true";
            setIsMicOn(state);
            if (localStream) {
              localStream.getAudioTracks().forEach(track => (track.enabled = state));
            }
        }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [toast]);

  const handleMirrorToggle = (checked: boolean) => {
    setMirrorVideo(checked);
    localStorage.setItem('teachmeet-camera-mirror', String(checked));
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextState;
    });
    localStorage.setItem('teachmeet-camera-default', nextState ? 'on' : 'off');
  };
  
  const toggleMic = () => {
    if (!localStream) return;
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    localStream.getAudioTracks().forEach((track) => (track.enabled = nextState));
    localStorage.setItem("micState", nextState ? "true" : "false");
    localStorage.setItem('teachmeet-mic-default', nextState ? 'on' : 'off');
  };

  const handleCopyToClipboard = (textToCopy: string, type: 'Link' | 'Code') => {
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        toast({
          title: `${type} Copied!`,
          description: `${type} has been copied to your clipboard.`,
        });
      })
      .catch((err) => {
        toast({
          variant: 'destructive',
          title: 'Copy Failed',
          description: `Could not copy the ${type}.`,
        });
      });
  };

  const handleCreateAndJoinMeeting = async () => {
    if (!agreed) {
        toast({ variant: 'destructive', title: 'Agreement Required', description: 'You must agree to the terms to proceed.' });
        return;
    }
    if (!topic.trim()) {
        toast({ variant: 'destructive', title: 'Topic is required' });
        return;
    }
    if (!user) {
        toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please sign in to start a meeting.' });
        return;
    }


    setIsCreatingMeeting(true);

    try {
        const meetingRef = doc(db, 'meetings', meetingId);
        await setDoc(meetingRef, {
            topic: topic.trim(),
            creatorId: user.uid,
            creatorName: user.displayName || 'Anonymous Host',
            createdAt: serverTimestamp(),
        });

        // Add to recent meetings in local storage
        const rawMeetings = localStorage.getItem(STARTED_MEETINGS_KEY);
        let meetings = [];
        if (rawMeetings) {
            try {
                const now = Date.now();
                meetings = JSON.parse(rawMeetings).filter((m: any) => m && m.id && m.startedAt && (now - m.startedAt < THIRTY_MINUTES_IN_MS));
            } catch (e) {
                console.error("Error parsing stored meetings, resetting.", e);
            }
        }
        if (!meetings.some((m: any) => m.id === meetingId)) {
            meetings.push({ id: meetingId, title: topic.trim(), startedAt: Date.now() });
            localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(meetings));
            window.dispatchEvent(new CustomEvent('teachmeet_meeting_started'));
        }

        // Redirect to the meeting page
        const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic.trim())}&cam=${isCameraOn}&mic=${isMicOn}`;
        router.push(meetingPath);

    } catch (error) {
        console.error("Failed to create meeting:", error);
        setStartError("Failed to create the meeting. Please check your network connection and try again.");
        toast({ variant: "destructive", title: "Meeting Creation Failed", description: "Could not create the meeting record. Check Firestore rules." });
        setIsCreatingMeeting(false);
    }
  };

  const handleAskToJoin = async () => {
    if (!agreed) {
        toast({ variant: 'destructive', title: 'Agreement Required' });
        return;
    }
    if (!user) {
        router.push(`/auth/signin?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
    }
    setIsCreatingMeeting(true); // Reuse the loading state
    
    // The actual join request is handled on the meeting page now.
    // This button just needs to redirect the user there.
    const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic.trim())}&cam=${isCameraOn}&mic=${isMicOn}`;
    router.push(meetingPath);
  };


  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL;
  
  const videoClassNames = cn(
    'h-full w-full object-cover transition-opacity duration-300 rounded-2xl',
    mirrorVideo && 'transform -scale-x-100',
    (hasCameraPermission && isCameraOn) ? 'opacity-100' : 'opacity-0',
    {
      'video-filter-grayscale': applyFilter && videoFilter === 'grayscale',
      'video-filter-sepia': applyFilter && videoFilter === 'sepia',
      'video-filter-vintage': applyFilter && videoFilter === 'vintage',
      'video-filter-luminous': applyFilter && videoFilter === 'luminous',
      'video-filter-dramatic': applyFilter && videoFilter === 'dramatic',
      'video-filter-goldenhour': applyFilter && videoFilter === 'goldenhour',
      'video-filter-softfocus': applyFilter && videoFilter === 'softfocus',
      'video-filter-brightclear': applyFilter && videoFilter === 'brightclear',
      'video-filter-naturalglow': applyFilter && videoFilter === 'naturalglow',
      'video-filter-radiantskin': applyFilter && videoFilter === 'radiantskin',
      'video-filter-smoothbright': applyFilter && videoFilter === 'smoothbright',
    }
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
        <header className="flex-shrink-0 p-4 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <SidebarTrigger>
                    <PanelLeftOpen className="h-6 w-6" />
                </SidebarTrigger>
                <h1 className="text-xl font-semibold text-foreground">Ready to Join?</h1>
            </div>
             <Button asChild variant="link" className="text-muted-foreground">
                <Link href="/">Cancel</Link>
            </Button>
        </header>

        {startError && (
            <div className="px-4">
                <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Failed to Start</AlertTitle>
                <AlertDescription>{startError}</AlertDescription>
                </Alert>
            </div>
        )}
      
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8">
             <div className="relative w-full bg-muted rounded-2xl flex items-center justify-center overflow-hidden min-h-[250px] lg:min-h-0 shadow-inner">
                <video
                    ref={videoRef}
                    className={videoClassNames}
                    autoPlay
                    muted
                    playsInline
                />
                {(!isCameraOn || hasCameraPermission === false) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">
                    {userAvatar && <AvatarImage src={userAvatar} alt={userName} data-ai-hint="user avatar"/>}
                    <AvatarFallback className="text-4xl">
                        {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-center">
                    {hasCameraPermission === false ? (
                        <>
                        <VideoOff className="w-8 h-8 text-destructive" />
                        <p className="text-sm mt-2 font-semibold">
                            Camera access denied
                        </p>
                        <p className="text-xs">
                            Enable camera & mic in browser settings.
                        </p>
                        </>
                    ) : (
                        <>
                        <VideoOff className="w-8 h-8" />
                        <p className="text-sm mt-2">Camera is off</p>
                        </>
                    )}
                    </div>
                </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button
                    variant={isMicOn ? 'default' : 'destructive'}
                    size="icon"
                    className={cn("rounded-full h-12 w-12", isMicOn && "bg-primary hover:bg-primary/90")}
                    onClick={toggleMic}
                >
                    {isMicOn ? <Mic /> : <MicOff />}
                </Button>
                <Button
                    variant={isCameraOn ? 'default' : 'destructive'}
                    size="icon"
                    className={cn("rounded-full h-12 w-12", isCameraOn && "bg-primary hover:bg-primary/90")}
                    onClick={toggleCamera}
                    disabled={hasCameraPermission === false}
                >
                    {isCameraOn ? <Video /> : <VideoOff />}
                </Button>
                </div>
            </div>

            <div className="flex flex-col space-y-4">
                <Card className="rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg">Device & Appearance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="mirror-video" className="flex items-center gap-2 cursor-pointer"><FlipHorizontal className="h-4 w-4" /> Mirror my video</Label>
                            <Switch id="mirror-video" checked={mirrorVideo} onCheckedChange={handleMirrorToggle}/>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="apply-filter" className="flex items-center gap-2 cursor-pointer"><Sparkles className="h-4 w-4" /> Apply Filter</Label>
                            <Switch id="apply-filter" checked={applyFilter} onCheckedChange={setApplyFilter}/>
                        </div>
                        <Select value={videoFilter} onValueChange={setVideoFilter} disabled={!applyFilter}>
                            <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select a filter..." /></SelectTrigger>
                            <SelectContent className="rounded-lg">
                            <SelectItem value="brightclear">Bright & Clear</SelectItem>
                            <SelectItem value="vintage">Vintage</SelectItem>
                            <SelectItem value="naturalglow">Natural Glow</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg text-sm">
                            <Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic)}`}>
                                <Settings className="mr-2 h-4 w-4" /> More A/V Settings...
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                 <Card className="rounded-2xl flex-grow">
                    <CardHeader>
                         <CardTitle className="text-lg">Meeting Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         <div>
                            <Label htmlFor="meeting-topic">Meeting Topic</Label>
                            <Input id="meeting-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 rounded-lg"/>
                        </div>
                         <div className="relative">
                            <Label>Invite Link</Label>
                            <LinkIcon className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
                            <Input readOnly value={meetingLink} className="pl-9 pr-10 rounded-lg text-xs"/>
                            <Button variant="ghost" size="icon" className="absolute right-1 top-7 h-8 w-8" onClick={() => handleCopyToClipboard(meetingLink, 'Link')}><Copy className="h-4 w-4" /></Button>
                        </div>
                        <div className="relative">
                             <Label>Invite Code</Label>
                            <Hash className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
                            <Input readOnly value={meetingCode} className="pl-9 pr-10 rounded-lg font-mono" />
                            <Button variant="ghost" size="icon" className="absolute right-1 top-7 h-8 w-8" onClick={() => handleCopyToClipboard(meetingCode, 'Code')}><Copy className="h-4 w-4" /></Button>
                        </div>
                        <Button variant="outline" className="w-full rounded-lg" onClick={() => setIsSharePanelOpen(true)}>
                            <Share2 className="mr-2 h-4 w-4" /> Share Full Invite
                        </Button>
                    </CardContent>
                </Card>

                <div className="flex items-center space-x-2 pt-2">
                    <Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(!!checked)}/>
                    <label htmlFor="terms" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        I agree to the <Link href="/terms-of-service" target="_blank" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/community-guidelines" target="_blank" className="text-primary hover:underline">Community Guidelines</Link>.
                    </label>
                </div>
                 
                 {isLoadingRole ? (
                     <Button disabled className="w-full py-3 text-lg font-semibold rounded-xl">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Checking...
                    </Button>
                 ) : isHost ? (
                    <Button
                        onClick={handleCreateAndJoinMeeting}
                        disabled={!agreed || isCreatingMeeting}
                        className={cn(
                        "w-full py-3 text-lg font-semibold rounded-xl",
                        agreed
                            ? "btn-gel"
                            : "bg-green-900/50 text-green-100/70 cursor-not-allowed"
                        )}
                    >
                        {isCreatingMeeting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Join Now as Host
                    </Button>
                 ) : (
                    <Button onClick={handleAskToJoin} disabled={!agreed || isCreatingMeeting} className="w-full py-3 text-lg font-semibold rounded-xl btn-gel">
                        {isCreatingMeeting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Ask to Join
                    </Button>
                 )}
            </div>
        </main>
        <ShareOptionsPanel
            isOpen={isSharePanelOpen}
            onClose={() => setIsSharePanelOpen(false)}
            meetingLink={meetingLink}
            meetingCode={meetingCode}
            meetingTitle={topic}
        />
    </div>
  );
}
