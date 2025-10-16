
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const { toast } = useToast();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !meetingId) return;

    const reqRef = doc(db, `meetings/${meetingId}/joinRequests/${user.uid}`);
    const unsub = onSnapshot(reqRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "approved") {
          toast({
            title: "Approved!",
            description: "Host accepted your request. Joining meeting...",
          });
          const meetingPath = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
          router.push(meetingPath);
        } else if (data.status === "declined") {
          toast({
            variant: "destructive",
            title: "Request Declined",
            description: "The host has declined your request to join.",
          });
          // Optional: redirect user away or show a permanent "declined" state
          // For now, we just show a toast and they can try again or leave.
        }
      }
    });

    return () => unsub();
  }, [meetingId, router, toast, topic]);

  return null;
}
