
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) return;

    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
    const unsub = onSnapshot(reqRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data) return;

      const topicParam = new URLSearchParams(window.location.search).get('topic');
      const meetingPath = `/dashboard/meeting/${meetingId}${topicParam ? `?topic=${encodeURIComponent(topicParam)}` : ''}`;

      if (data.status === "approved") {
        // navigate to the meeting page
        router.push(meetingPath);
      } else if (data.status === "declined") {
        toast({
            variant: "destructive",
            title: "Request Denied",
            description: "The host has declined your request to join."
        });
      } else if (data.status === "expired") {
        toast({
            variant: "destructive",
            title: "Request Expired",
            description: "Your join request expired. Please try again."
        });
      }
    });

    return () => unsub();
  }, [meetingId, router, toast]);

  return null;
}
