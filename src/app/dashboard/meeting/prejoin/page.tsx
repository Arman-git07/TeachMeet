
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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import AskToJoinButton from '@/components/meeting/AskToJoinButton';


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
  const [isHost, setIsHost] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  // A/V State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  
  useEffect(() => {
    const role = searchParams.get('role');
    setIsHost(role === 'host');
    setIsLoadingRole(false);
    
    const existingMeetingId = searchParams.get('meetingId');
    if (!existingMeetingId) {
        toast({variant: "destructive", title: "Missing Meeting ID", description: "No meeting ID was provided in the URL."});
        router.push('/dashboard');
        return;
    }

    const id = existingMeetingId;
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
  }, [searchParams, router, toast]);

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
        
        const desiredMicState = localStorage.getItem('teachmeet-mic-default') !== 'off';
        const desiredCamState = localStorage.getItem('teachmeet-camera-default') !== 'off';
        
        setIsMicOn(desiredMicState); 
        setIsCameraOn(desiredCamState);
        
        stream.getAudioTracks().forEach((track) => (track.enabled = desiredMicState));
        stream.getVideoTracks().forEach((track) => (track.enabled = desiredCamState));
      } catch (error) {
        console.error('Error accessing media:', error);
        setHasCameraPermission(false); 
        setIsCameraOn(false);
        toast({ variant: 'destructive', title: 'Media Access Denied', description: 'Please enable camera and microphone permissions.'});
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

  const handleCreateAndJoinMeeting = async () => {
    if (!agreed || !user) return;
    setIsCreatingMeeting(true);
  
    try {
      const meetingRef = doc(db, 'meetings', meetingId);
  
      await setDoc(meetingRef, {
        topic: topic.trim(),
        hostId: user.uid,
        creatorName: user.displayName || 'Anonymous Host',
        createdAt: serverTimestamp(),
        status: 'pending',
      }, { merge: true });
  
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

  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL;
  
  const renderJoinButton = () => {
    if (isLoadingRole || authLoading) {
      return <Button disabled className="w-full py-3 text-lg font-semibold rounded-xl"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Authenticating...</Button>
    }

    if (isHost) {
      return <Button onClick={handleCreateAndJoinMeeting} disabled={!agreed || isCreatingMeeting} className={cn("w-full py-3 text-lg font-semibold rounded-xl", agreed ? "btn-gel" : "bg-green-900/50 text-green-100/70 cursor-not-allowed")}>{isCreatingMeeting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Join Now as Host</Button>
    }

    return <AskToJoinButton disabled={!agreed} />;
  };
  
  const handleMirrorToggle = (checked: boolean) => { setMirrorVideo(checked); localStorage.setItem('teachmeet-camera-mirror', String(checked)); };
  const toggleCamera = () => { if (!localStream) return; const nextState = !isCameraOn; setIsCameraOn(nextState); localStream.getVideoTracks().forEach((track) => track.enabled = nextState); localStorage.setItem('teachmeet-camera-default', nextState ? 'on' : 'off'); };
  const toggleMic = () => { if (!localStream) return; const nextState = !isMicOn; setIsMicOn(nextState); localStream.getAudioTracks().forEach((track) => track.enabled = nextState); localStorage.setItem('teachmeet-mic-default', nextState ? 'on' : 'off'); };
  const handleCopyToClipboard = (textToCopy: string, type: 'Link' | 'Code') => { navigator.clipboard.writeText(textToCopy).then(() => toast({ title: `${type} Copied!` })).catch(() => toast({ variant: 'destructive', title: 'Copy Failed' })); };
  const videoClassNames = cn('h-full w-full object-cover transition-opacity duration-300 rounded-2xl', mirrorVideo && 'transform -scale-x-100', (hasCameraPermission && isCameraOn) ? 'opacity-100' : 'opacity-0', { 'video-filter-brightclear': applyFilter && videoFilter === 'brightclear' });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
        <header className="flex-shrink-0 p-4 flex justify-between items-center"><div className="flex items-center gap-2"><SidebarTrigger><PanelLeftOpen className="h-6 w-6" /></SidebarTrigger><h1 className="text-xl font-semibold text-foreground">Ready to Join?</h1></div><Button asChild variant="link" className="text-muted-foreground"><Link href="/">Cancel</Link></Button></header>
        {startError && (<div className="px-4"><Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Meeting Not Found</AlertTitle><AlertDescription>{startError}</AlertDescription></Alert></div>)}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8">
             <div className="relative w-full bg-muted rounded-2xl flex items-center justify-center overflow-hidden min-h-[250px] lg:min-h-0 shadow-inner">
                <video ref={videoRef} className={videoClassNames} autoPlay muted playsInline />
                {(!isCameraOn || hasCameraPermission === false) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">{userAvatar && <AvatarImage src={userAvatar} alt={userName} data-ai-hint="user avatar"/>}<AvatarFallback className="text-4xl">{userName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex flex-col items-center">{hasCameraPermission === false ? (<><VideoOff className="w-8 h-8 text-destructive" /><p className="text-sm mt-2 font-semibold">Camera access denied</p><p className="text-xs">Enable camera & mic in browser settings.</p></>) : (<><VideoOff className="w-8 h-8" /><p className="text-sm mt-2">Camera is off</p></>)}</div>
                </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button variant={isMicOn ? 'default' : 'destructive'} size="icon" className={cn("rounded-full h-12 w-12", isMicOn && "bg-primary hover:bg-primary/90")} onClick={toggleMic}><Mic /></Button>
                <Button variant={isCameraOn ? 'default' : 'destructive'} size="icon" className={cn("rounded-full h-12 w-12", isCameraOn && "bg-primary hover:bg-primary/90")} onClick={toggleCamera} disabled={hasCameraPermission === false}>{isCameraOn ? <Video /> : <VideoOff />}</Button>
                </div>
            </div>
            <div className="flex flex-col space-y-4">
                <Card className="rounded-2xl">
                    <CardHeader><CardTitle className="text-lg">Device & Appearance</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between"><Label htmlFor="mirror-video" className="flex items-center gap-2 cursor-pointer"><FlipHorizontal className="h-4 w-4" /> Mirror my video</Label><Switch id="mirror-video" checked={mirrorVideo} onCheckedChange={handleMirrorToggle}/></div>
                        <div className="flex items-center justify-between"><Label htmlFor="apply-filter" className="flex items-center gap-2 cursor-pointer"><Sparkles className="h-4 w-4" /> Apply Filter</Label><Switch id="apply-filter" checked={applyFilter} onCheckedChange={setApplyFilter}/></div>
                        <Select value={videoFilter} onValueChange={setVideoFilter} disabled={!applyFilter}><SelectTrigger className="rounded-lg"><SelectValue placeholder="Select a filter..." /></SelectTrigger><SelectContent className="rounded-lg"><SelectItem value="brightclear">Bright & Clear</SelectItem><SelectItem value="vintage">Vintage</SelectItem><SelectItem value="naturalglow">Natural Glow</SelectItem></SelectContent></Select>
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
