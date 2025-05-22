
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Video, VideoOff, Settings2, User, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function WaitingAreaPage({ params: { meetingId } }: { params: { meetingId: string } }) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false); // Visual toggle for now
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  // const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null); // For future mic implementation

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Cleanup stream on component unmount
  useEffect(() => {
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleToggleCamera = async () => {
    if (isCameraActive) {
      // Turn camera off
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
        currentStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      // Try to turn camera on
      if (hasCameraPermission === false) { // Permission previously denied
        toast({
          variant: "destructive",
          title: "Camera Access Denied",
          description: "Please enable camera permissions in your browser settings to use this feature.",
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        currentStreamRef.current = stream;
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

  const handleToggleMic = () => {
    // Placeholder for mic toggle, only visual for now
    setIsMicActive(prev => !prev);
    if (!isMicActive) {
        // Logic to request mic permission and start stream would go here
        // For now, just a toast if we were to implement it
        // toast({ title: "Microphone On (Mock)", description: "Microphone access would be requested here." });
    } else {
        // Logic to stop mic stream
        // toast({ title: "Microphone Off (Mock)" });
    }
  };

  return (
    <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-2xl shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <User className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Joining Meeting: {meetingId}</CardTitle>
          <CardDescription>Configure your audio and video before entering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="aspect-[9/16] md:aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            {(!isCameraActive || hasCameraPermission === false) && (
              <div className="absolute inset-0 bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                {hasCameraPermission === false ? (
                  <>
                    <VideoOff className="h-16 w-16 mx-auto mb-2 text-destructive" />
                    <p className="font-semibold">Camera permission denied</p>
                    <p className="text-xs">To use your camera, please allow access in your browser settings.</p>
                  </>
                ) : (
                  <>
                    <VideoOff className="h-16 w-16 mx-auto mb-2" />
                    <p>Camera is off</p>
                  </>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3 z-10">
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

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="virtualBackground" />
              <Label htmlFor="virtualBackground">Enable Virtual Background</Label>
            </div>
             <div className="flex items-center space-x-2">
              <Checkbox id="cameraFilter" />
              <Label htmlFor="cameraFilter">Apply Camera Filter</Label>
            </div>
          </div>

          <Link href="/dashboard/settings" passHref legacyBehavior>
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
