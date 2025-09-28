
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShareOptionsPanel } from '@/components/common/ShareOptionsPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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

  // A/V State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  useEffect(() => {
    // This logic now runs when the component mounts, ensuring a stable ID is set.
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
        
        setIsMicOn(desiredMicState);
        setIsCameraOn(desiredCamState);

        stream.getAudioTracks().forEach((track) => (track.enabled = desiredMicState));
        stream.getVideoTracks().forEach((track) => (track.enabled = desiredCamState));
        
        // Persist initial state for meeting page sync
        localStorage.setItem("micState", desiredMicState ? "true" : "false");
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setIsCameraOn(false);
        // Try getting mic only
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

    // Listen for meeting page updates
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

    // Cleanup function: stop all tracks when the component unmounts
    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      window.removeEventListener("storage", handleStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

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

    setIsCreatingMeeting(true);

    try {
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
    } catch (e) {
        console.error("Failed to update localStorage for ongoing meetings", e);
    }
    
    // Redirect to the meeting page with camera and mic status as query parameters.
    const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic.trim())}&cam=${isCameraOn}&mic=${isMicOn}`;
    router.push(meetingPath);
  };


  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL;
  
  const videoClassNames = cn(
    'h-full w-full object-cover transition-opacity duration-300',
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
    <div className="container mx-auto max-w-xl py-4 sm:py-8">
      <Card className="w-full shadow-2xl rounded-2xl border-border/50">
        <CardHeader className="relative text-center">
            <div className="absolute top-4 left-4">
                <SidebarTrigger>
                    <PanelLeftOpen className="h-6 w-6" />
                </SidebarTrigger>
            </div>
          {startError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to Start</AlertTitle>
              <AlertDescription>{startError}</AlertDescription>
            </Alert>
          )}
          <User className="mx-auto h-8 w-8 text-primary" />
          <CardTitle className="text-2xl">Ready to Join?</CardTitle>
          <CardDescription>
            Check your camera and mic before joining the meeting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden aspect-[9/16] sm:aspect-video">
            <video
                ref={videoRef}
                className={videoClassNames}
                autoPlay
                muted
                playsInline
            />
            {(!isCameraOn || hasCameraPermission === false) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground">
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="mirror-video"
                className="flex items-center gap-2 cursor-pointer"
              >
                <FlipHorizontal className="h-4 w-4" /> Mirror my video
              </Label>
              <Switch
                id="mirror-video"
                checked={mirrorVideo}
                onCheckedChange={setMirrorVideo}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label
                htmlFor="apply-filter"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" /> Apply Filter
              </Label>
              <Switch
                id="apply-filter"
                checked={applyFilter}
                onCheckedChange={setApplyFilter}
              />
            </div>
            <Select
              value={videoFilter}
              onValueChange={setVideoFilter}
              disabled={!applyFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a filter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brightclear">Bright & Clear</SelectItem>
                <SelectItem value="vintage">Vintage</SelectItem>
                <SelectItem value="grayscale">Grayscale</SelectItem>
                <SelectItem value="sepia">Sepia</SelectItem>
                <SelectItem value="luminous">Luminous</SelectItem>
                <SelectItem value="dramatic">Dramatic</SelectItem>
                <SelectItem value="goldenhour">Golden Hour</SelectItem>
                <SelectItem value="softfocus">Soft Focus</SelectItem>
                <SelectItem value="naturalglow">Natural Glow</SelectItem>
                <SelectItem value="radiantskin">Radiant Skin</SelectItem>
                <SelectItem value="smoothbright">Smooth & Bright</SelectItem>
              </SelectContent>
            </Select>

            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg">
                <Link href={`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic)}`}>
                    <Settings className="mr-2 h-4 w-4" /> Advanced A/V Settings
                </Link>
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Invite Others</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={meetingLink}
                className="pl-9 pr-10 rounded-lg text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => handleCopyToClipboard(meetingLink, 'Link')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={meetingCode}
                className="pl-9 pr-10 rounded-lg"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => handleCopyToClipboard(meetingCode, 'Code')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsSharePanelOpen(true)}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share Full Invite
            </Button>
          </div>
          <div>
            <Label htmlFor="meeting-topic">Meeting Topic</Label>
            <Input
              id="meeting-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(!!checked)}
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I agree to the{' '}
              <Link
                href="/terms-of-service"
                className="text-primary hover:underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/community-guidelines"
                className="text-primary hover:underline"
              >
                Community Guidelines
              </Link>
              .
            </label>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4 border-t pt-4">
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
          <Button asChild variant="link" className="text-muted-foreground">
            <Link href="/">Cancel and go to Homepage</Link>
          </Button>
        </CardFooter>
      </Card>
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
