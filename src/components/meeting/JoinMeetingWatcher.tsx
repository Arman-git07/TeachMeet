// src/components/meeting/JoinMeetingWatcher.tsx
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) return;

    const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
    const unsub = onSnapshot(reqRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data) return;

      if (data.status === "approved") {
        router.push(`/dashboard/meeting/${meetingId}`);
      } else if (data.status === "declined") {
        alert("Host declined your request.");
      } else if (data.status === "expired") {
        alert("Join request expired. Please try again.");
      }
    });

    return () => unsub();
  }, [meetingId, router]);

  return null;
}
