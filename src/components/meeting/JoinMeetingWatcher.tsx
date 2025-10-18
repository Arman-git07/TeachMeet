// src/components/meeting/JoinMeetingWatcher.tsx
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) return;

    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);

    const unsub = onSnapshot(reqRef, (snap) => {
      // If the document gets deleted (e.g., by host UI), do nothing.
      if (!snap.exists()) return;
      
      const data = snap.data();
      if (!data) return;

      if (data.status === "approved") {
        const topic = searchParams.get('topic') || 'TeachMeet Meeting';
        const cam = searchParams.get('cam');
        const mic = searchParams.get('mic');
        
        let meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
        if (cam) meetingPath += `&cam=${cam}`;
        if (mic) meetingPath += `&mic=${mic}`;

        toast({ title: "Request Approved!", description: "You are now joining the meeting." });
        router.push(meetingPath);
      } else if (data.status === "denied") {
        toast({ variant: "destructive", title: "Request Denied", description: "The host has denied your request to join." });
        // Optional: Redirect back or reset the UI state after a delay
        setTimeout(() => router.push('/dashboard'), 3000);
      } else if (data.status === "expired") {
        toast({ variant: "destructive", title: "Request Expired", description: "Your join request timed out. Please try again." });
        // Optional: Redirect or reset UI state
      }
    });

    return () => unsub();
  }, [meetingId, router, toast, searchParams]);

  return null; // This component does not render anything
}
