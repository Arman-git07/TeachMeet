
'use client';
import { useState, useEffect, use, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Upload, MessageSquare, Settings, Users, MoreVertical, Hand, Maximize, Columns, Edit3, AlertTriangle, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSearchParams, useRouter } from 'next/navigation';

const DISMISSED_MEETINGS_KEY = 'teachmeet-dismissed-meetings';

const ParticipantView = ({ 
  name, 
  isMe = false, 
  isMicMuted = false, 
  isCameraOff = false, 
  videoRef,
  hasCameraPermissionForView,
  isHandRaisedForView
}: { 
  name: string, 
  isMe?: boolean, 
  isMicMuted?: boolean, 
  isCameraOff?: boolean,
  videoRef?: React.RefObject<HTMLVideoElement>,
  hasCameraPermissionForView?: boolean | null,
  isHandRaisedForView?: boolean
}) => {
  const showAvatar = (isMe && isCameraOff) || (isMe && hasCameraPermissionForView === false);

  const handleFullScreenClick = () => {
    // Placeholder: In a real app, use browser Fullscreen API
    console.log(`Full screen requested for ${name}`);
    // Example: if (videoRef?.current) { videoRef.current.requestFullscreen(); }
  };

  return (
    <Card className="aspect-video rounded-xl overflow-hidden relative shadow-lg border-2 border-border/30 hover:border-primary hover:shadow-primary/20 transition-all duration-300 ease-in-out group w-full h-full">
      {isMe ? (
        <>
          <video 
            ref={videoRef} 
            muted 
            autoPlay 
            playsInline 
            className={cn("w-full h-full object-cover", { 'hidden': isCameraOff || hasCameraPermissionForView === false })} 
          />
          {showAvatar && (
            <div className="absolute inset-0 w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
              <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
                <AvatarImage src={`https://placehold.co/128x128.png?text=${name.charAt(0).toUpperCase()}`} alt={name} data-ai-hint="avatar user" />
                <AvatarFallback className="text-3xl md:text-4xl">{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {hasCameraPermissionForView === false && <VideoOff className="w-7 h-7 text-muted-foreground mb-1" />}
              <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
              {hasCameraPermissionForView === false && <p className="text-xs text-muted-foreground">Camera permission denied</p>}
            </div>
          )}
        </>
      ) : isCameraOff ? (
        <div className="w-full h-full bg-muted/70 flex flex-col items-center justify-center p-4 text-center">
          <Avatar className="w-20 h-20 md:w-24 md:h-24 mb-3 border-2 border-background shadow-md">
            <AvatarImage src={`https://placehold.co/128x128.png?text=${name.charAt(0).toUpperCase()}`} alt={name} data-ai-hint="avatar user"/>
            <AvatarFallback className="text-3xl md:text-4xl">{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <VideoOff className="w-7 h-7 text-muted-foreground mb-1" />
          <p className="text-base font-medium text-foreground truncate max-w-full px-2">{name}</p>
        </div>
      ) : (
        <Image src={`https://placehold.co/800x450.png`} alt={`${name}'s video`} layout="fill" objectFit="cover" data-ai-hint="participant video" />
      )}
      <div className="absolute bottom-2 left-2 bg-gradient-to-r from-black/70 to-transparent px-3 py-1.5 rounded-md backdrop-blur-sm">
        <p className="text-sm font-medium text-white shadow-sm">{name} {isMe && <span className="text-xs opacity-80">(You)</span>}</p>
      </div>
      <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm shadow-md">
        {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </div>
      {isHandRaisedForView && (
        <div className="absolute top-2 left-2 bg-accent/80 text-accent-foreground p-1.5 rounded-full backdrop-blur-sm shadow-md animate-pulse">
          <Hand className="h-4 w-4" />
        </div>
      )}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button
          variant="ghost"
          size="icon"
          className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm shadow-md"
          onClick={handleFullScreenClick}
          aria-label="Toggle full screen"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export default function MeetingPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(paramsPromise);
  const searchParams = useSearchParams(); 
  const topic = searchParams.get('topic'); 
  const { toast } = useToast();
  const router = useRouter();

  const [isMicMuted, setIsMicMuted] = useState(false); 
  const [isCameraOff, setIsCameraOff] = useState(() => {
    if (typeof window !== 'undefined') {
      const desiredState = localStorage.getItem('teachmeet-desired-camera-state');
      localStorage.removeItem('teachmeet-desired-camera-state'); 
      return desiredState !== 'on'; 
    }
    return true; 
  });
  
  const [isHandRaised, setIsHandRaised] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const currentLocalStreamRef = useRef<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); 

  useEffect(() => {
    const initializeCameraAndPermissions = async () => {
      if (!isCameraOff) { 
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          currentLocalStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setHasCameraPermission(true);
        } catch (err) {
          console.error("Failed to get camera on mount:", err);
          setHasCameraPermission(false);
          setIsCameraOff(true); 
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      } else { 
         navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            setHasCameraPermission(true);
            stream.getTracks().forEach(track => track.stop()); 
          })
          .catch(() => {
            setHasCameraPermission(false); 
          });
      }
    };

    initializeCameraAndPermissions();

    return () => {
      currentLocalStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const toggleMic = () => setIsMicMuted(prev => !prev); 

  const toggleCamera = async () => {
    const newCameraStateIsOff = !isCameraOff; 

    if (!newCameraStateIsOff) { 
      if (hasCameraPermission === false) { 
        toast({ variant: 'destructive', title: 'Camera Permission Denied', description: 'Please enable camera permissions in browser settings.' });
        return;
      }
      if (!currentLocalStreamRef.current || !currentLocalStreamRef.current.active) { 
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          currentLocalStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setHasCameraPermission(true); 
          setIsCameraOff(false);
        } catch (err) {
          console.error("Failed to get camera on toggle:", err);
          setHasCameraPermission(false); 
          setIsCameraOff(true); 
          toast({ variant: 'destructive', title: 'Camera Access Failed', description: 'Could not access camera.' });
          return; 
        }
      } else { 
        if (localVideoRef.current && currentLocalStreamRef.current) {
            localVideoRef.current.srcObject = currentLocalStreamRef.current;
        }
        setIsCameraOff(false);
      }
    } else { 
      currentLocalStreamRef.current?.getTracks().forEach(track => track.stop());
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setIsCameraOff(true);
    }
  };
  
  const toggleHandRaise = () => {
    const newHandState = !isHandRaised;
    setIsHandRaised(newHandState);
    if (newHandState) {
      toast({ title: "Hand Raised!", description: "You raised your hand." });
    } else {
      toast({ title: "Hand Lowered", description: "You lowered your hand." });
    }
  };

  const leaveMeeting = () => {
    toast({ title: "Leaving Meeting", description: "You have left the meeting." });

    if (typeof window !== 'undefined' && meetingId) {
      const dismissedIdsString = localStorage.getItem(DISMISSED_MEETINGS_KEY);
      let dismissedIds: string[] = [];
      try {
        dismissedIds = dismissedIdsString ? JSON.parse(dismissedIdsString) : [];
      } catch (e) {
        console.error("Error parsing dismissed meetings from localStorage on leave:", e);
        localStorage.removeItem(DISMISSED_MEETINGS_KEY);
      }

      if (!Array.isArray(dismissedIds)) {
          dismissedIds = [];
      }

      if (!dismissedIds.includes(meetingId)) {
        dismissedIds.push(meetingId);
        localStorage.setItem(DISMISSED_MEETINGS_KEY, JSON.stringify(dismissedIds));
      }
    }
    router.push('/');
  };

  const handleReportIssue = () => {
    toast({
      title: "Report Issue",
      description: "Issue reporting feature is planned. For now, please note the issue and report through help channels.",
      duration: 5000,
    });
  };

  const participants = [
    { id: "currentUser", name: "You", isMe: true, isMicMuted, isCameraOff, videoRef: localVideoRef, hasCameraPermissionForView: hasCameraPermission, isHandRaisedForView: isHandRaised },
  ];

  const displayTitle = topic ? `${topic} (ID: ${meetingId})` : `Meeting ID: ${meetingId}`;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-xl font-semibold text-foreground" title={displayTitle}>{displayTitle}</h2>
          <span className="text-sm text-muted-foreground">{participants.length} Participant{participants.length === 1 ? '' : 's'}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg">
            <DropdownMenuItem><Upload className="mr-2 h-4 w-4" /> Share Screen</DropdownMenuItem>
            <DropdownMenuItem><Edit3 className="mr-2 h-4 w-4" /> Open Whiteboard</DropdownMenuItem>
            <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4" /> Chat</DropdownMenuItem>
            <DropdownMenuItem><Users className="mr-2 h-4 w-4" /> Participants</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Columns className="mr-2 h-4 w-4" /> Change Layout</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleReportIssue} className="text-destructive focus:text-destructive">
              <AlertCircle className="mr-2 h-4 w-4" /> Report Issue
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 p-4 overflow-y-auto flex flex-col">
        {hasCameraPermission === false && ( 
           <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Camera Permission Required</AlertTitle>
              <AlertDescription>
                TeachMeet needs access to your camera to share your video.
                Please enable camera permissions in your browser settings.
              </AlertDescription>
            </Alert>
        )}
        {participants.length === 1 && participants[0].isMe ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="w-full h-full max-w-5xl max-h-[calc(100vh-15rem)] relative">
              <ParticipantView
                name={participants[0].name}
                isMe={participants[0].isMe}
                isMicMuted={participants[0].isMicMuted}
                isCameraOff={participants[0].isCameraOff} 
                videoRef={localVideoRef}
                hasCameraPermissionForView={hasCameraPermission}
                isHandRaisedForView={participants[0].isHandRaisedForView}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {participants.map(p => (
              <ParticipantView 
                key={p.id} 
                name={p.name} 
                isMe={p.isMe} 
                isMicMuted={p.isMicMuted} 
                isCameraOff={p.isMe ? isCameraOff : p.isCameraOff} 
                videoRef={p.isMe ? localVideoRef : undefined}
                hasCameraPermissionForView={p.isMe ? hasCameraPermission : undefined}
                isHandRaisedForView={p.isHandRaisedForView}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="p-4 border-t border-border bg-background/80 backdrop-blur-md sticky bottom-0">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <Button variant={isMicMuted ? "destructive" : "secondary"} size="lg" className="rounded-full p-4 btn-gel" onClick={toggleMic} aria-label={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}>
            {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button variant={isCameraOff ? "destructive" : "secondary"} size="lg" className="rounded-full p-4 btn-gel" onClick={toggleCamera} aria-label={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}>
            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
          <Button
            variant={isHandRaised ? "default" : "default"} 
            size="lg"
            className={cn(
              "rounded-full p-4",
              isHandRaised 
                ? "bg-accent text-accent-foreground ring-2 ring-offset-2 ring-offset-background ring-accent shadow-lg" 
                : "btn-gel shadow-md" 
            )}
            onClick={toggleHandRaise}
            aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <Hand className="h-6 w-6" />
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full p-4" onClick={leaveMeeting} aria-label="Leave Meeting">
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

