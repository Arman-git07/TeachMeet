
'use client';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  MessageSquare,
  Brush,
  MonitorUp,
  Hand,
  Phone,
  Settings,
  MoreVertical,
} from 'lucide-react';
import React, { useEffect, useState, useCallback, use } from 'react';
import { Button } from '@/components/ui/button';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import MeetingClient from './MeetingClient';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


export default function MeetingPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const { user, loading } = useAuth();
  const router = useRouter();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();

  useEffect(() => {
    // Load initial state from localStorage to set the UI toggles correctly on mount
    const desiredCamState = localStorage.getItem('teachmeet-desired-camera-state') !== 'off';
    const desiredMicState = localStorage.getItem('teachmeet-desired-mic-state') === 'on';
    setCamOn(desiredCamState);
    setMicOn(desiredMicState);
  }, []);
  
  useEffect(() => {
    setHeaderContent(
        <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold truncate">{topic}</h1>
        </div>
    );
    setHeaderAction(
      <div className="flex items-center gap-2">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push(`/dashboard/settings?highlight=advancedMeetingSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic)}`)}>
                    <Settings className="mr-2 h-4 w-4"/>
                    <span>Meeting Settings</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
    return () => {
        setHeaderContent(null);
        setHeaderAction(null);
    }
  }, [setHeaderContent, setHeaderAction, topic, meetingId, router]);


  const handleMicToggle = useCallback((isOn: boolean) => setMicOn(isOn), []);
  const handleCamToggle = useCallback((isOn: boolean) => setCamOn(isOn), []);
  
  const triggerControl = (controlId: string) => {
    const button = document.getElementById(controlId) as HTMLButtonElement | null;
    if (button) {
      button.click();
    } else {
      console.warn(`Control button with id "${controlId}" not found.`);
    }
  };

  const userId = user?.uid;

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center bg-[#1e2a38] text-white">Loading...</div>;
  }
  if (!userId) {
    // This should be handled by the layout, but as a fallback
    router.replace(`/auth/signin?redirect=/dashboard/meeting/${meetingId}`);
    return null;
  }
  
  const backToDashboard = () => router.push('/dashboard/classrooms');

  return (
    <div className="w-full h-full flex flex-col bg-[#1e2a38] text-white overflow-hidden">
      <div className="flex-grow relative">
        <MeetingClient 
            meetingId={meetingId} 
            userId={userId} 
            onMicToggle={handleMicToggle} 
            onCamToggle={handleCamToggle}
        />
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 flex items-center justify-center gap-2 md:gap-4 max-w-2xl mx-auto">
          <Button
            variant={micOn ? 'secondary' : 'destructive'}
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={() => triggerControl('meeting-client-mic-toggle')}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>
          <Button
            variant={camOn ? 'secondary' : 'destructive'}
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={() => triggerControl('meeting-client-cam-toggle')}
            aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          <div className="w-px h-8 bg-white/20 mx-1 md:mx-3" />

          <Button asChild variant="ghost" size="icon" className="rounded-full w-12 h-12 md:w-14 md:h-14 text-white hover:bg-white/10 hover:text-white" aria-label="Participants">
             <Link href={`/dashboard/meeting/${meetingId}/participants?topic=${encodeURIComponent(topic)}`}><Users className="h-6 w-6" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full w-12 h-12 md:w-14 md-h-14 text-white hover:bg-white/10 hover:text-white" aria-label="Chat">
            <Link href={`/dashboard/meeting/${meetingId}/chat?topic=${encodeURIComponent(topic)}`}><MessageSquare className="h-6 w-6" /></Link>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 md:w-14 md:h-14 text-white hover:bg-white/10 hover:text-white" aria-label="Raise hand">
            <Hand className="h-6 w-6" />
          </Button>
           <Button asChild variant="ghost" size="icon" className="rounded-full w-12 h-12 md:w-14 md:h-14 text-white hover:bg-white/10 hover:text-white" aria-label="Whiteboard">
            <Link href={`/dashboard/meeting/${meetingId}/whiteboard?topic=${encodeURIComponent(topic)}`}><Brush className="h-6 w-6" /></Link>
          </Button>
           <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 md:w-14 md:h-14 text-white hover:bg-white/10 hover:text-white" aria-label="Share screen">
            <MonitorUp className="h-6 w-6" />
          </Button>

          <div className="w-px h-8 bg-white/20 mx-1 md:mx-3" />

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14"
            onClick={backToDashboard}
            aria-label="Leave meeting"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}

