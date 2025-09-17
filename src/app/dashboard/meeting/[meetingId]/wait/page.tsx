
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Link as LinkIcon, LogIn, XCircle } from "lucide-react";
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
        const intendedUrl = `/dashboard/meeting/${meetingId}?${searchParams.toString()}`;
        router.push(`/auth/signin?redirect=${encodeURIComponent(intendedUrl)}`);
        return;
    }
    
    // Redirect all users (hosts and guests) to the main meeting page.
    const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
    router.replace(meetingPath);

  }, [meetingId, user, authLoading, isHost, router, searchParams, topic]);


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
