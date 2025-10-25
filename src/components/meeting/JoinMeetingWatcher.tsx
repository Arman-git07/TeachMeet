"use client";

import { useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didRedirect = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const topic = searchParams.get("topic") || "";
  const cam = searchParams.get("cam") || "true";
  const mic = searchParams.get("mic") || "true";

  useEffect(() => {
    if (!meetingId) return;
    let mounted = true;

    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const redirectToMeeting = () => {
      if (!mounted || didRedirect.current) return;
      didRedirect.current = true;
      cleanup();
      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(
        topic
      )}&cam=${cam}&mic=${mic}`;
      router.replace(destination);
    };

    const startWatcher = async (user: User) => {
      if (!mounted) return;

      const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);

      // 1. Initial immediate check
      try {
        const initialSnap = await getDoc(participantRef);
        if (initialSnap.exists()) {
          redirectToMeeting();
          return;
        }
      } catch (e) {
        console.error("JoinMeetingWatcher: Initial check failed", e);
      }

      // 2. Aggressive polling as a robust fallback
      cleanup(); // Ensure no previous interval is running
      intervalRef.current = setInterval(async () => {
        if (!mounted || didRedirect.current) {
          cleanup();
          return;
        }
        try {
          const pollSnap = await getDoc(participantRef);
          if (pollSnap.exists()) {
            redirectToMeeting();
          }
        } catch (e) {
          // Don't log errors here as it's a fallback and can be noisy.
          // The main failure would be the redirect not happening.
        }
      }, 2000); // Check every 2 seconds
    };

    const auth = getAuth();
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        startWatcher(user);
      } else {
        // If user logs out while waiting, stop everything.
        cleanup();
      }
    });

    // Cleanup on component unmount
    return () => {
      mounted = false;
      authUnsubscribe();
      cleanup();
    };
  }, [meetingId, router, topic, cam, mic]);

  return null; // This component renders nothing
}
