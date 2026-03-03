'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
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
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';
const JOINED_MEETINGS_KEY_PREFIX = 'teachmeet-joined-meetings-';
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;


function PreJoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [topic, setTopic] = useState('Untitled Meeting');
  const [isHost, setIsHost] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingCode, setMeetingCode] = useState('');
  const [requestStatus, setRequestStatus] = useState<"idle" | "pending" | "approved" | "denied">("idle");

  const [agreed, setAgreed] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [applyFilter, setApplyFilter] = useState(true);
  const [videoFilter, setVideoFilter] = useState('brightclear');
  const [startError, setStartError] = useState<string | null>(null);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  
  useEffect(() => {
    const role = searchParams.get('role');
    const idFromParams = searchParams.get('meetingId');
    const topicFromParams = searchParams.get('topic');

    if (!idFromParams) {
        toast({variant: "destructive", title: "Missing Meeting ID", description: "No meeting ID was provided in the URL."});
        router.push('/dashboard');
        return;
    }
    
    const isHostRole = role === 'host';
    setIsHost(isHostRole);

    const rawId = idFromParams.trim();
    const finalMeetingId = rawId.startsWith('meeting-') ? rawId : `meeting-${rawId}`;
    const finalTopic = topicFromParams || (isHostRole ? 'Untitled Meeting' : 'Joining a Meeting');
    const finalCode = finalMeetingId.replace('meeting-', '');

    setMeetingId(finalMeetingId);
    setTopic(finalTopic);
    setMeetingCode(finalCode);
    
    if (typeof window !== 'undefined') {
      setMeetingLink(
        `${window.location.origin}/dashboard/join-meeting?meetingId=${finalMeetingId}`
      );
    }

    if (isHostRole && typeof window !== 'undefined' && user) {
        const STARTED_MEETINGS_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;
        const storedMeetingsRaw = localStorage.getItem(STARTED_MEETINGS_KEY);
        let meetings = storedMeetingsRaw ? JSON.parse(storedMeetingsRaw) : [];
        if (!Array.isArray(meetings)) meetings = [];

        const meetingExists = meetings.some((m: any) => m.id === finalMeetingId);
        if (!meetingExists) {
            const now = Date.now();
            meetings = meetings.filter(m => m && m.startedAt && (now - m.startedAt < TWO_HOURS_IN_MS));
            meetings.unshift({ id: finalMeetingId, title: finalTopic, startedAt: now });
            localStorage.setItem(STARTED_MEETINGS_KEY, JSON.stringify(meetings.slice(0, 5)));
            window.dispatchEvent(new CustomEvent('teachmeet_meeting_started'));
        }
    }
  }, [searchParams, router, toast, user]);

  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        if (!mounted) { stream.getTracks().forEach(track => track.stop()); return; }
        
        setHasCameraPermission(true); 
        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        const desiredMicState = localStorage.getItem('teachmeet-mic-state') !== 'false';
        const desiredCamState = localStorage.getItem('teachmeet-cam-state') !== 'false';
        
        setIsMicOn(desiredMicState); 
        setIsCameraOn(desiredCamState);
        
        stream.getAudioTracks().forEach((track) => (track.enabled = desiredMicState));
        stream.getVideoTracks().forEach((track) => (track.enabled = desiredCamState));
      } catch (error: any) {
        console.error('Error accessing media:', error);
        setHasCameraPermission(false); 
        setIsCameraOn(false);
        let description = "Please enable camera and microphone permissions in your browser settings to continue.";
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            description = "No camera or microphone was found. Please connect a device and grant permissions.";
        }
        toast({ variant: 'destructive', title: 'Media Access Denied', description: description, duration: 7000});
      }
    };
    
    getCameraPermission();

    return () => { 
        mounted = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
     };
  }, [toast]);
  
  useEffect(() => {
    if (!meetingId || isHost || !user) return;

    let mounted = true;
    const didRedirectRef = { current: false };
    const unsubRefs: { req?: () => void; part?: () => void } = {};

    const cleanupAll = () => {
      try { unsubRefs.req?.(); } catch {}
      try { unsubRefs.part?.(); } catch {}
    };

    const redirectToMeeting = () => {
      if (didRedirectRef.current || !mounted) return;
      didRedirectRef.current = true;
      cleanupAll();
      setRequestStatus('approved');

      // PERSIST JOINED MEETING FOR REJOIN ON DASHBOARD
      if (user && !isHost) {
          const JOINED_KEY = `${JOINED_MEETINGS_KEY_PREFIX}${user.uid}`;
          const storedMeetingsRaw = localStorage.getItem(JOINED_KEY);
          let meetings = storedMeetingsRaw ? JSON.parse(storedMeetingsRaw) : [];
          if (!Array.isArray(meetings)) meetings = [];

          const now = Date.now();
          meetings = meetings.filter(m => m && m.startedAt && (now - m.startedAt < TWO_HOURS_IN_MS));
          
          if (!meetings.some((m: any) => m.id === meetingId)) {
              meetings.unshift({ id: meetingId, title: topic.trim(), startedAt: now });
              localStorage.setItem(JOINED_KEY, JSON.stringify(meetings.slice(0, 5)));
              window.dispatchEvent(new CustomEvent('teachmeet_meeting_joined'));
          }
      }

      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic.trim())}&cam=${isCameraOn}&mic=${isMicOn}`;
      router.replace(destination);
    };
    
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
    const partRef = doc(db, "meetings", meetingId, "participants", user.uid);

    unsubRefs.part = onSnapshot(partRef, (snap) => {
      if (snap.exists()) {
        redirectToMeeting();
      }
    });

    unsubRefs.req = onSnapshot(reqRef, (snap) => {
        if (!mounted) return;
        if (snap.exists()) {
            const data = snap.data();
            if (data.status === "approved") {
                redirectToMeeting();
            } else if (data.status === "denied") {
                setRequestStatus("denied");
            } else if (data.status === "pending") {
                setRequestStatus("pending");
            }
        } else {
          setRequestStatus("idle");
        }
    });

    return () => {
      mounted = false;
      cleanupAll();
    };
  }, [meetingId, isHost, user, router, topic, isCameraOn, isMicOn]);

  useEffect(() => {
    if (!meetingId || !user || isHost || requestStatus !== 'pending') return;

    const reqRef = doc(db, 'meetings', meetingId, 'joinRequests', user.uid);
    const heartbeatInterval = setInterval(() => {
      updateDoc(reqRef, { lastHeartbeat: serverTimestamp() }).catch(() => {});
    }, 5000);

    const markCancelled = () => {
      updateDoc(reqRef, { status: 'cancelled' }).catch(() => {});
    };

    window.addEventListener('beforeunload', markCancelled);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', markCancelled);
      if (requestStatus === 'pending') {
        markCancelled();
      }
    };
  }, [meetingId, user, isHost, requestStatus]);

  const handleCreateAndJoinMeeting = async () => {
    if (!agreed || !user || !isHost) return;
    setIsCreatingMeeting(true);
  
    try {
      const meetingRef = doc(db, 'meetings', meetingId);
  
      await setDoc(meetingRef, {
        topic: topic.trim(),
        creatorId: user.uid,
        hostId: user.uid,
        creatorName: user.displayName || 'Anonymous Host',
        createdAt: serverTimestamp(),
        status: 'pending',
      });
  
      const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(
        topic.trim()
      )}&cam=${isCameraOn}&mic=${isMicOn}`;
      router.push(meetingPath);
    } catch (error) {
      console.error("Failed to create/join meeting:", error);
      toast({
        variant: "destructive",
        title: "Meeting Start Failed",
        description: "Could not create or join the meeting. Check Firestore rules and network.",
      });
      setIsCreatingMeeting(false);
    }
  };

  const handleAskToJoin = async () => {
    if (!user || !meetingId) {
        setStartError("Missing meeting or not signed in.");
        return;
    }
    if (!agreed) {
        toast({ variant: "destructive", title: "Please agree to Terms", description: "You must agree to the Terms of Service before joining."});
        return;
    }

    const meetingRef = doc(db, 'meetings', meetingId);
    const reqRef = doc(db, 'meetings', meetingId, 'joinRequests', user.uid);

    try {
        const meetingSnap = await getDoc(meetingRef);
        if (!meetingSnap.exists() || meetingSnap.data().status === 'ended') {
            setStartError("This meeting does not exist or has already ended.");
            toast({ variant: "destructive", title: "Meeting not available" });
            return;
        }

        if (user.uid === meetingSnap.data().hostId) {
            toast({ title: "You are the host", description: "Use 'Join Now as Host' to start the meeting." });
            return;
        }
        
        setRequestStatus("pending");
        await setDoc(reqRef, {
            userId: user.uid,
            userName: user.displayName || "Guest User",
            userPhotoURL: user.photoURL || "",
            status: "pending",
            requestedAt: serverTimestamp(),
            lastHeartbeat: serverTimestamp(),
        }, { merge: true });

        toast({ title: "Request Sent", description: "Waiting for the host to approve your request." });

    } catch (err: any) {
        console.error("AskToJoin: unexpected error:", err);
        if (err?.code === 'permission-denied') {
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Permission denied. Please check your Firestore rules.' });
            setStartError("Permission denied. Contact admin.");
        } else {
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send join request. Please try again.' });
            setStartError("Could not send join request. Try again.");
        }
        setRequestStatus("idle");
    }
  };

  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL;
  
  const renderJoinButton = () => {
    if (authLoading) {
      return <Button disabled className="w-full py-3 text-lg font-semibold rounded-xl"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Authenticating...</Button>
    }

    if (isHost) {
      return <Button onClick={handleCreateAndJoinMeeting} disabled={!agreed || isCreatingMeeting} className={cn("w-full py-3 text-lg font-semibold rounded-xl", agreed ? "btn-gel" : "bg-green-900/50 text-green-100/70 cursor-not-allowed")}>{isCreatingMeeting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Join Now as Host</Button>
    }

    switch (requestStatus) {
      case 'pending':
      case 'approved':
        return (
          <div className="text-center space-y-2">
              <Button disabled className="w-full py-3 text-lg font-semibold rounded-xl bg-primary/20 text-primary-foreground/80 border border-primary/30 cursor-wait"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Waiting for host...</Button>
              <p className="text-xs text-muted-foreground">{requestStatus === 'approved' ? 'Approved! Joining now...' : 'Waiting for the host to approve your request.'}</p>
          </div>
        );
      case 'denied':
         return (
          <div className="text-center space-y-2">
            <Button onClick={handleAskToJoin} disabled={!agreed} className={cn("w-full py-3 text-lg font-semibold rounded-xl", agreed ? "btn-gel" : "bg-primary/50 text-primary-foreground/70 cursor-not-allowed")}>
              Ask to Join Again
            </Button>
            <p className="text-xs text-destructive">Your previous request was declined.</p>
          </div>
         );
      case 'idle':
      default:
        return (
          <Button onClick={handleAskToJoin} disabled={!agreed} className={cn("w-full py-3 text-lg font-semibold rounded-xl", agreed ? "btn-gel" : "bg-primary/50 text-primary-foreground/70 cursor-not-allowed")}>
            Ask to Join
          </Button>
        );
    }
  };
  
  const handleMirrorToggle = (checked: boolean) => { setMirrorVideo(checked); localStorage.setItem('teachmeet-camera-mirror', String(checked)); };
  const toggleCamera = () => { if (!localStream) return; const nextState = !isCameraOn; setIsCameraOn(nextState); localStream.getVideoTracks().forEach((track) => track.enabled = nextState); localStorage.setItem('teachmeet-cam-state', nextState ? 'true' : 'false'); };
  const toggleMic = () => { if (!localStream) return; const nextState = !isMicOn; setIsMicOn(nextState); localStream.getAudioTracks().forEach((track) => track.enabled = nextState); localStorage.setItem('teachmeet-mic-state', nextState ? 'true' : 'false'); };
  const handleCopyToClipboard = (textToCopy: string, type: 'Link' | 'Code') => { navigator.clipboard.writeText(textToCopy).then(() => toast({ title: `${type} Copied!` })).catch(() => toast({ variant: 'destructive', title: 'Copy Failed' })); };
  const videoClassNames = cn('h-full w-full object-cover transition-opacity duration-300 rounded-2xl', mirrorVideo && 'transform -scale-x-100', (hasCameraPermission && isCameraOn) ? 'opacity-100' : 'opacity-0', { 'video-filter-brightclear': applyFilter && videoFilter === 'brightclear' });

  if (!meetingId) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
        <header className="flex-shrink-0 p-4 flex justify-between items-center"><div className="flex items-center gap-2"><SidebarTrigger><PanelLeftOpen className="h-6 w-6" /></SidebarTrigger><h1 className="text-xl font-semibold text-foreground">Ready to Join?</h1></div><Button asChild variant="link" className="text-muted-foreground"><Link href="/">Cancel</Link></Button></header>
        {startError && (<div className="px-4"><Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Meeting Not Found</AlertTitle><AlertDescription>{startError}</AlertDescription></Alert></div>)}
        {hasCameraPermission === false && (
            <div className="px-4 md:px-8">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera and Microphone Access Denied</AlertTitle>
                    <AlertDescription>
                        TeachMeet needs permission to use your camera and microphone. Please enable access in your browser's site settings to continue.
                    </AlertDescription>
                </Alert>
            </div>
        )}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8">
             <div className="relative w-full bg-muted rounded-2xl flex items-center justify-center overflow-hidden min-h-[250px] lg:min-h-0 shadow-inner">
                <video ref={videoRef} className={videoClassNames} autoPlay muted playsInline />
                {(!isCameraOn || hasCameraPermission === false) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">{userAvatar && <AvatarImage src={userAvatar} alt={userName} data-ai-hint="user avatar"/> }<AvatarFallback className="text-4xl">{userName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex flex-col items-center">{hasCameraPermission === false ? (<><VideoOff className="w-8 h-8 text-destructive" /><p className="text-sm mt-2 font-semibold">Camera access denied</p><p className="text-xs">Enable camera & mic in browser settings.</p></>) : (<><VideoOff className="w-8 h-8" /><p className="text-sm mt-2">Camera is off</p></>)}</div>
                </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button variant={isMicOn ? 'default' : 'destructive'} size="icon" className={cn("rounded-full h-12 w-12", isMicOn && "bg-primary hover:bg-primary/90")} onClick={toggleMic}>{isMicOn ? <Mic /> : <MicOff />}</Button>
                <Button variant={isCameraOn ? 'default' : 'destructive'} size="icon" className={cn("rounded-full h-12 w-12", isCameraOn && "bg-primary hover:bg-primary/90")} onClick={toggleCamera} disabled={hasCameraPermission === false}>{isCameraOn ? <Video /> : <VideoOff />}</Button>
                </div>
            </div>
            <div className="flex flex-col space-y-4">
                <Card className="rounded-2xl">
                    <CardHeader><CardTitle className="text-lg">Device & Appearance</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between"><Label htmlFor="mirror-video" className="flex items-center gap-2 cursor-pointer"><FlipHorizontal className="h-4 w-4" /> Mirror my video</Label><Switch id="mirror-video" checked={mirrorVideo} onCheckedChange={handleMirrorToggle}/></div>
                        <div className="flex items-center justify-between"><Label htmlFor="apply-filter" className="flex items-center gap-2 cursor-pointer"><Sparkles className="h-4 w-4" /> Apply Filter</Label><Switch id="apply-filter" checked={applyFilter} onCheckedChange={setApplyFilter}/></div>
                        <Select value={videoFilter} onValueChange={setVideoFilter} disabled={!applyFilter}><SelectTrigger className="rounded-lg"><SelectValue placeholder="Select a filter..." /></SelectTrigger><SelectContent className="rounded-lg"><SelectItem value="none">None</SelectItem><SelectItem value="brightclear">Bright & Clear</SelectItem><SelectItem value="naturalglow">Natural Glow</SelectItem><SelectItem value="radiantskin">Radiant Skin</SelectItem><SelectItem value="smoothbright">Smooth & Bright</SelectItem><SelectItem value="vintage">Vintage</SelectItem><SelectItem value="luminous">Luminous</SelectItem><SelectItem value="goldenhour">Golden Hour</SelectItem><SelectItem value="softfocus">Soft Focus</SelectItem><SelectItem value="grayscale">Grayscale</SelectItem><SelectItem value="sepia">Sepia</SelectItem><SelectItem value="dramatic">Dramatic</SelectItem></SelectContent></Select>
                        <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg text-sm"><Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic)}`}><Settings className="mr-2 h-4 w-4" /> More A/V Settings...</Link></Button>
                    </CardContent>
                </Card>
                 <Card className="rounded-2xl flex-grow">
                    <CardHeader><CardTitle className="text-lg">Meeting Details</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                         <div><Label htmlFor="meeting-topic">Meeting Topic</Label><Input id="meeting-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 rounded-lg" disabled={!isHost}/></div>
                         <div className="relative"><Label>Invite Link</Label><LinkIcon className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" /><Input readOnly value={meetingLink} className="pl-9 pr-10 rounded-lg text-xs"/><Button variant="ghost" size="icon" className="absolute right-1 top-7 h-8 w-8" onClick={() => handleCopyToClipboard(meetingLink, 'Link')}><Copy className="h-4 w-4" /></Button></div>
                        <div className="relative"><Label>Invite Code</Label><Hash className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" /><Input readOnly value={meetingCode} className="pl-9 pr-10 rounded-lg font-mono" /><Button variant="ghost" size="icon" className="absolute right-1 top-7 h-8 w-8" onClick={() => handleCopyToClipboard(meetingCode, 'Code')}><Copy className="h-4 w-4" /></Button></div>
                        <Button variant="outline" className="w-full rounded-lg" onClick={() => setIsSharePanelOpen(true)}><Share2 className="mr-2 h-4 w-4" /> Share Full Invite</Button>
                    </CardContent>
                </Card>
                <div className="flex items-center space-x-2 pt-2"><Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(!!checked)}/><label htmlFor="terms" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">I agree to the <Link href="/terms-of-service" target="_blank" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/community-guidelines" target="_blank" className="text-primary hover:underline">Community Guidelines</Link>.</label></div>
                {renderJoinButton()}
            </div>
        </main>
        <ShareOptionsPanel isOpen={isSharePanelOpen} onClose={() => setIsSharePanelOpen(false)} meetingLink={meetingLink} meetingCode={meetingCode} meetingTitle={topic} />
    </div>
  );
}

export default function PreJoinPage() {
    return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            <PreJoinPageContent />
        </Suspense>
    )
}
