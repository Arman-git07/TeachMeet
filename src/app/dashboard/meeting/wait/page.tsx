
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

// DEPRECATED: This page is no longer the primary entry point for hosts or guests.
// It remains as a simple redirector to the main meeting page to handle old links.
// The new /dashboard/meeting/prejoin page handles the host's setup flow.
// The /dashboard/meeting/[meetingId] page handles guest join requests and waiting rooms.
export default function WaitingAreaPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const router = useRouter();

  const { user, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
        const intendedUrl = `/dashboard/meeting/${meetingId}?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
        return;
    }
    
    // Redirect all users (hosts and guests) to the main meeting page.
    // The meeting page now contains all the logic for waiting rooms, join requests, etc.
    const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
    router.replace(meetingPath);

  }, [meetingId, user, authLoading, router, searchParams, topic]);


  // Fallback UI while redirecting
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Redirecting to Meeting...
          </CardTitle>
          <CardDescription>{topic}</CardDescription>
        </CardHeader>
        <CardContent className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
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
