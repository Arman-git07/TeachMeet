
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Video, VideoOff, Settings2, User as UserIcon, AlertTriangle, Image as ImageIconLucide } from "lucide-react"; // Added ImageIconLucide
import Link from "next/link";
import React, { useState, useEffect, useRef, use } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth"; 
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; 
import { useSearchParams } from "next/navigation";
import Image from "next/image"; // Import next/image

export default function WaitingAreaPage(props: { params: Promise<{ meetingId: string }> }) {
  const resolvedParams = use(props.params);
  const { meetingId } = resolvedParams;
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");

  const { user, loading: authLoading } = useAuth(); 

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVideoStreamRef = useRef<MediaStream | null>(null);
  const currentMicStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const [isVirtualBgActive, setIsVirtualBgActive] = useState(false);
  const [virtualBgImageUrl, setVirtualBgImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Load virtual background settings from localStorage
    const enabled = localStorage.getItem('teachmeet-virtual-bg-enabled') === 'true';
    const imageUrl = localStorage.getItem('teachmeet-virtual-bg-image');
    if (enabled && imageUrl) {
      setIsVirtualBgActive(true);
      setVirtualBgImageUrl(imageUrl);
    } else {
      setIsVirtualBgActive(false);
      setVirtualBgImageUrl(null);
    }

    // Cleanup streams on unmount
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

  const displayTitle = topic ? `${topic} (ID: ${meetingId})` : `Meeting ID: ${meetingId}`;

  return (
    <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
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
            <video ref={videoRef} className="w-full h-full object-cover relative z-10" autoPlay muted playsInline />
            {(!isCameraActive || hasCameraPermission === false) && (
              <div className="absolute inset-0 bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center text-center text-muted-foreground p-4 z-20">
                {isVirtualBgActive && virtualBgImageUrl ? (
                  <Image
                    src={virtualBgImageUrl}
                    alt="Selected virtual background"
                    layout="fill"
                    objectFit="cover"
                    className="rounded-lg"
                    data-ai-hint="virtual background preview"
                  />
                ) : (
                  <>
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
                  </>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3 z-30">
              <Button
                variant={isMicActive ? "secondary" : "destructive"}
                size="icon"
                className="rounded-full shadow-md"
                onClick={handleToggleMic}
                aria-label={isMicActive ? "Mute microphone" : "Unmute microphone"}
              >
                {isMicActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button
                variant={isCameraActive ? "secondary" : "destructive"}
                size="icon"
                className="rounded-full shadow-md"
                onClick={handleToggleCamera}
                aria-label={isCameraActive ? "Turn camera off" : "Turn camera on"}
              >
                {isCameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your camera to share your video.
                Please enable camera permissions in your browser settings and refresh the page or try toggling the camera again.
              </AlertDescription>
            </Alert>
          )}

          {hasMicPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Microphone Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your microphone to share your audio.
                Please enable microphone permissions in your browser settings and try toggling the microphone again.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="virtualBackground" checked={isVirtualBgActive} disabled/>
              <Label htmlFor="virtualBackground">
                {isVirtualBgActive ? "Virtual background active (from settings)" : "Enable virtual background in settings"}
              </Label>
            </div>
             <div className="flex items-center space-x-2">
              <Checkbox id="cameraFilter" />
              <Label htmlFor="cameraFilter">Apply Camera Filter</Label>
            </div>
          </div>

          <Link href="/dashboard/settings?highlight=advancedMeetingSettings" passHref legacyBehavior>
            <Button asChild variant="outline" className="w-full flex items-center justify-center gap-2 rounded-lg">
              <a>
                <Settings2 className="h-5 w-5" />
                Advanced Settings
              </a>
            </Button>
          </Link>

          <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior>
            <Button className="w-full btn-gel text-lg py-3 rounded-lg">
              Join Now
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            By joining, you agree to TeachMeet&apos;s Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
