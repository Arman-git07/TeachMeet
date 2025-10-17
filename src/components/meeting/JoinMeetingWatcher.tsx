
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from "firebase/auth";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string; }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) return;

    console.log(`[JoinMeetingWatcher] Mounting listener for user ${user.uid} on meeting ${meetingId}`);

    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);

    const unsub = onSnapshot(reqRef, (snap) => {
      // if the document is deleted after processing, we don't want to do anything
      if (!snap.exists()) {
        console.log("[JoinMeetingWatcher] Request document does not exist or was deleted.");
        return;
      }
      const data = snap.data();
      if (!data) return;

      console.log("[JoinMeetingWatcher] Received status update:", data.status);

      const topic = searchParams.get('topic');
      const cam = searchParams.get('cam');
      const mic = searchParams.get('mic');
      let meetingUrl = `/dashboard/meeting/${meetingId}`;
      const query = new URLSearchParams();
      if(topic) query.append('topic', topic);
      if(cam) query.append('cam', cam);
      if(mic) query.append('mic', mic);
      if (query.toString()) meetingUrl += `?${query.toString()}`;

      if (data.status === "approved") {
        console.log("[JoinMeetingWatcher] Request approved! Redirecting...");
        toast({title: "Request Approved!", description: "You are now joining the meeting."});
        router.push(meetingUrl);
      } else if (data.status === "declined") {
        toast({
          variant: "destructive",
          title: "Request Denied",
          description: "The host has declined your request to join.",
        });
        // Optionally, redirect to dashboard or home after a delay
        setTimeout(() => router.push('/dashboard'), 3000);
      } else if (data.status === "expired") {
        toast({
          variant: "destructive",
          title: "Request Expired",
          description: "Your join request expired. Please try again.",
        });
      }
    }, (error) => {
      console.error("[JoinMeetingWatcher] Firestore listener error:", error);
    });

    return () => {
      console.log(`[JoinMeetingWatcher] Unmounting listener for user ${user.uid}`);
      unsub();
    };
  }, [meetingId, router, toast, searchParams]);

  return null;
}
