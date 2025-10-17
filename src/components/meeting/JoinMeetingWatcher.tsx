
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "TeachMeet Meeting";


  useEffect(() => {
    if (!meetingId || !user) return;

    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
    const unsub = onSnapshot(reqRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "approved") {
          toast({
            title: "Approved!",
            description: "Host accepted your request. Joining the meeting now...",
          });
          const meetingUrl = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`;
          router.push(meetingUrl);
        } else if (data.status === "declined") {
          toast({
            variant: "destructive",
            title: "Request Declined",
            description: "The host has declined your request to join.",
          });
        } else if (data.status === "expired") {
            toast({
              variant: "destructive",
              title: "Request Expired",
              description: "Your join request was not answered in time. Please try again if the meeting is still active.",
            });
        }
      }
    });

    return () => unsub();
  }, [meetingId, user, router, toast, topic]);

  return null;
}
