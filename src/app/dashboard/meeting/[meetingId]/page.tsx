
'use client';
import MeetingClient from './MeetingClient';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, MessageSquare, MonitorUp, Brush, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import React, { useEffect, useState } from 'react';

export default function MeetingPage({ params }: { params: { meetingId: string } }) {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  
  const topic = searchParams.get('topic') || "Untitled Meeting";
  
  // Local state for media controls for UI feedback
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  
  useEffect(() => {
    setHeaderContent(
      <div className="flex items-center gap-3">
        <Video className="h-7 w-7 text-primary" />
        <h1 className="text-xl font-semibold truncate" title={topic}>
          {topic}
        </h1>
      </div>
    );
    
    setHeaderAction(
       <div className="flex items-center gap-1 md:gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href={`/dashboard/meeting/${params.meetingId}/participants?topic=${encodeURIComponent(topic)}`}>
                    <Users className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Participants</span>
                </Link>
            </Button>
             <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href={`/dashboard/meeting/${params.meetingId}/chat?topic=${encodeURIComponent(topic)}`}>
                    <MessageSquare className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Chat</span>
                </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg">
              <MonitorUp className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Share Screen</span>
            </Button>
        </div>
    );

    return () => {
      setHeaderContent(null);
      setHeaderAction(null);
    }
  }, [setHeaderContent, setHeaderAction, topic, params.meetingId]);


  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Authenticating...</h2>
        <p className="text-muted-foreground">Please wait a moment.</p>
      </div>
    );
  }

  if (!user) {
    // This part will likely not be seen as the layout redirects, but it's good practice.
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Authentication Required</h2>
        <p className="text-muted-foreground">You must be signed in to join a meeting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
        {/* Main Content Area */}
        <div className="flex-grow bg-muted/20 p-2 md:p-4">
            <MeetingClient meetingId={params.meetingId} userId={user.uid} onMicToggle={setIsMicOn} onCamToggle={setIsCamOn} />
        </div>
        
        {/* Bottom Control Bar */}
        <div className="flex-none bg-background/80 backdrop-blur-md border-t p-3 md:p-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Meeting ID: {params.meetingId}
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <Button variant={isMicOn ? "outline" : "destructive"} size="icon" className="rounded-full h-12 w-12" onClick={() => document.getElementById('meeting-client-mic-toggle')?.click()}>
                        {isMicOn ? <Mic className="h-6 w-6"/> : <MicOff className="h-6 w-6"/>}
                    </Button>
                    <Button variant={isCamOn ? "outline" : "destructive"} size="icon" className="rounded-full h-12 w-12" onClick={() => document.getElementById('meeting-client-cam-toggle')?.click()}>
                        {isCamOn ? <Video className="h-6 w-6"/> : <VideoOff className="h-6 w-6"/>}
                    </Button>
                     <Button asChild variant="outline" size="icon" className="rounded-full h-12 w-12">
                        <Link href={`/dashboard/meeting/${params.meetingId}/whiteboard?topic=${encodeURIComponent(topic)}`}>
                            <Brush className="h-6 w-6" />
                        </Link>
                    </Button>
                </div>
                <div>
                     <Button variant="destructive" className="rounded-lg h-12 px-6" onClick={() => router.push('/dashboard')}>
                        <PhoneOff className="h-6 w-6" />
                        <span className="hidden md:inline ml-2">Leave</span>
                    </Button>
                </div>
            </div>
        </div>
    </div>
  );
}
