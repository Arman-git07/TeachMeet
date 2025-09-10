
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogIn, XCircle } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth'; 
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';


type JoinRequestStatus = 'loading' | 'requesting' | 'denied' | 'admitted';

export default function WaitingAreaPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 
  const [joinStatus, setJoinStatus] = useState<JoinRequestStatus>('loading');
  const { toast } = useToast();

  const isHost = searchParams.get("host") === "true";
  
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
        const intendedUrl = `/dashboard/meeting/${meetingId}/wait?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
        return;
    }
    
    if (isHost) {
        // Hosts go directly to the meeting page to manage it
        const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
        router.replace(meetingPath);
        return;
    }

    // --- Guest Logic ---
    const requestRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);

    // Create the join request
    setDoc(requestRef, {
        name: user.displayName || "Guest",
        photoURL: user.photoURL || null,
        status: 'pending',
        requestedAt: serverTimestamp()
    }).then(() => {
        setJoinStatus('requesting');
    }).catch(err => {
        console.error("Failed to create join request:", err);
        toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send join request.' });
        router.push('/dashboard');
    });

    // Listen for changes to the join request
    const unsubscribe = onSnapshot(requestRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'accepted') {
                setJoinStatus('admitted');
                unsubscribe();
                deleteDoc(requestRef); // Clean up the request document
                const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
                router.replace(meetingPath);
            } else if (data.status === 'rejected') {
                setJoinStatus('denied');
                unsubscribe();
                // Optionally clean up the denied request after a delay
                setTimeout(() => deleteDoc(requestRef), 5000);
            }
        } else {
            // If the document is deleted, it's equivalent to being denied
             if (joinStatus === 'requesting') {
                setJoinStatus('denied');
                unsubscribe();
            }
        }
    });

    return () => unsubscribe();
  }, [meetingId, user, authLoading, isHost, router, searchParams, topic, toast, joinStatus]);

  // UI for different states
  const renderContent = () => {
    switch (joinStatus) {
      case 'loading':
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            <p>Connecting...</p>
          </div>
        );
      case 'requesting':
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            <p>Waiting for the host to let you in...</p>
          </div>
        );
      case 'denied':
         return (
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle className="h-10 w-10 text-destructive"/>
            <p className="font-semibold">Your request to join was denied.</p>
            <p className="text-sm text-muted-foreground">You can close this window or return to the dashboard.</p>
          </div>
        );
      case 'admitted':
         return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            <p>You've been admitted! Redirecting...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Waiting to Join
          </CardTitle>
          <CardDescription>{topic}</CardDescription>
        </CardHeader>
        <CardContent className="py-8 flex justify-center">
          {renderContent()}
        </CardContent>
         <CardFooter className="flex justify-center">
            <Button variant="link" asChild className="text-muted-foreground">
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
