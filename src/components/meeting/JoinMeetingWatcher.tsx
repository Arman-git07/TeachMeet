"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface Props {
  meetingId: string;
}

export default function JoinMeetingWatcher({ meetingId }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !meetingId) return;

    const ref = doc(db, `meetings/${meetingId}/joinRequests`, user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "approved") {
          router.push(`/dashboard/meeting/${meetingId}`);
        } else if (data.status === "rejected") {
          alert("Your join request was rejected by the host.");
        }
      }
    });

    return () => unsub();
  }, [user, meetingId, router]);

  return null;
}