
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function JoinMeetingWatcher({
  meetingId,
}: {
  meetingId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!meetingId || !user?.uid) return;

    const ref = doc(db, "meetings", meetingId, "joinRequests", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data?.status === "approved") {
        const topic = searchParams.get('topic') || 'TeachMeet Meeting';
        router.push(`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`);
      } else if (data?.status === "denied") {
        toast({
            variant: "destructive",
            title: "Request Denied",
            description: "The host has declined your request to join."
        })
      }
    });

    return () => unsub();
  }, [meetingId, user?.uid, router, toast, searchParams]);

  return null;
}
