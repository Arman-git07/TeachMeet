"use client";

import { useState, useEffect, useCallback } from 'react';
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

export default function PreJoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const meetingId = searchParams.get('meetingId');
  const [topic, setTopic] = useState('Untitled Meeting');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingCode, setMeetingCode] = useState('');

  // UI State
  const [agreed, setAgreed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [applyFilter, setApplyFilter] = useState(true);
  const [videoFilter, setVideoFilter] = useState('bright-clear');
  const [startError, setStartError] = useState<string | null>(null);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);

  // A/V State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(
    null
  );
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  useEffect(() => {
    if (meetingId && typeof window !== 'undefined') {
      setMeetingLink(
        `${window.location.origin}/dashboard/join-meeting?meetingId=${meetingId}`
      );
      setMeetingCode(meetingId);
    }
  }, [meetingId]);

  const getCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setHasCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      stream.getAudioTracks().forEach((track) => (track.enabled = true));
      stream.getVideoTracks().forEach((track) => (track.enabled = true));

      setIsMicOn(true);
      setIsCameraOn(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      setIsCameraOn(false);
      setIsMicOn(false);
    }
  }, []);

  useEffect(() => {
    getCameraPermission();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [getCameraPermission]);

  const toggleCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !isCameraOn));
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleMic = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach((track) => (track.enabled = !isMicOn));
      setIsMicOn(!isMicOn);
    }
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

  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Card className="w-full max-w-xl shadow-2xl rounded-2xl border-border/50">
        <CardHeader className="text-center">
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
          <div className="relative aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {hasCameraPermission && isCameraOn ? (
              <video
                ref={videoRef}
                className={cn(
                  'h-full w-full object-cover',
                  mirrorVideo && 'transform -scale-x-100'
                )}
                autoPlay
                muted
                playsInline
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
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
                variant={isMicOn ? 'secondary' : 'destructive'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={toggleMic}
              >
                {isMicOn ? <Mic /> : <MicOff />}
              </Button>
              <Button
                variant={isCameraOn ? 'secondary' : 'destructive'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={toggleCamera}
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
                <SelectItem value="bright-clear">Bright & Clear</SelectItem>
                <SelectItem value="vintage">Vintage</SelectItem>
                <SelectItem value="grayscale">Grayscale</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between">
              <Label
                htmlFor="advanced-settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" /> Advanced Settings
              </Label>
              <Switch
                id="advanced-settings"
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
              />
            </div>
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
            onClick={() => {
              if (meetingId) {
                router.push(`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`);
              } else {
                toast({ variant: 'destructive', title: "Error", description: "Meeting ID is missing."});
              }
            }}
            disabled={!agreed}
            className={`w-full py-3 text-lg font-semibold rounded-xl transition-colors ${
              agreed ? "bg-primary text-primary-foreground hover:bg-primary/90 btn-gel" : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
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
