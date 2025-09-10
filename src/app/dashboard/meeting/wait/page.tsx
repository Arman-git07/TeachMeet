
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth'; 
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';


type JoinRequestStatus = 'idle' | 'pending' | 'denied' | 'approved';

// DEPRECATED: This page is no longer the primary entry point for hosts.
// It remains as the waiting room for guests who join via a link.
// The new /dashboard/meeting/prejoin page handles the host's setup flow.
export default function WaitingAreaPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 
  const [joinStatus, setJoinStatus] = useState<JoinRequestStatus>('idle');
  const { toast } = useToast();

  // This page is now only for guests. Hosts go to /prejoin.
  const isHost = searchParams.get("host") === "true";
  
  // Effect 1: Redirect hosts and handle guests
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
        const intendedUrl = `/dashboard/meeting/${meetingId}/wait?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
        return;
    }

    if (isHost) {
        // Hosts should use the new pre-join flow. Redirect them there.
        const prejoinPath = `/dashboard/meeting/prejoin?topic=${encodeURIComponent(topic)}`;
        router.replace(prejoinPath);
        return;
    }

    // If we are here, we are a guest. For simplicity, we'll now redirect guests to the meeting page directly
    // and let the meeting page handle the join request logic. This simplifies the flow and removes
    // the need for complex state management on this now-deprecated page.
    const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
    router.replace(meetingPath);

  }, [meetingId, user, authLoading, isHost, router, searchParams, topic]);


  // Fallback UI while redirecting
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Redirecting to Meeting...
          </CardTitle>
          <CardDescription>Please wait while we prepare the meeting room.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
        </CardContent>
         <CardFooter>
            <Button variant="link" asChild className="text-muted-foreground">
                <Link href="/"><LinkIcon className="mr-2 h-4 w-4"/> Go to Homepage</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
