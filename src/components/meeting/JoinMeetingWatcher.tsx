
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!user || !meetingId) return;

    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
    const unsub = onSnapshot(reqRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data) return;
      
      const topic = searchParams.get('topic');
      const meetingUrl = `/dashboard/meeting/${meetingId}${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`;

      if (data.status === "approved") {
        router.push(meetingUrl);
      } else if (data.status === "declined") {
        toast({
          variant: "destructive",
          title: "Request Denied",
          description: "The host has declined your request to join.",
        });
      } else if (data.status === "expired") {
        toast({
          variant: "destructive",
          title: "Request Expired",
          description: "Your join request expired. Please try again.",
        });
      }
    });

    return () => unsub();
  }, [meetingId, user, router, toast, searchParams]);

  return null;
}
