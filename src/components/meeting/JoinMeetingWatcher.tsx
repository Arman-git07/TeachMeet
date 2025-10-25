
"use client";

import { useEffect, useRef } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didRedirect = useRef(false);
  const cleanupRef = useRef<() => void>(() => {});

  const topic = searchParams.get("topic") || "";
  const cam = searchParams.get("cam") || "true";
  const mic = searchParams.get("mic") || "true";

  useEffect(() => {
    if (!meetingId) return;
    let mounted = true;

    const redirectToMeeting = () => {
      if (!mounted || didRedirect.current) return;
      didRedirect.current = true;
      cleanupRef.current(); // Stop all listeners and timers
      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(
        topic
      )}&cam=${cam}&mic=${mic}`;
      router.replace(destination);
    };

    const startWatcher = async (user: User) => {
      if (!mounted) return;
      const userId = user.uid;

      const participantRef = doc(db, "meetings", meetingId, "participants", userId);
      const requestRef = doc(db, "meetings", meetingId, "joinRequests", userId);

      // 1. Initial Fast Check
      try {
        const participantSnap = await getDoc(participantRef);
        if (participantSnap.exists()) {
          redirectToMeeting();
          return;
        }
      } catch (e) {
        console.error("JoinMeetingWatcher: Initial check failed", e);
      }

      // 2. Real-time Listeners
      const unsubParticipant = onSnapshot(participantRef, (snap) => {
        if (snap.exists()) {
          redirectToMeeting();
        }
      });

      const unsubRequest = onSnapshot(requestRef, (snap) => {
        if (snap.exists() && snap.data()?.status === "approved") {
          redirectToMeeting();
        }
      });
      
      // 3. Fallback Polling
      const fallbackInterval = setInterval(async () => {
        if (!mounted || didRedirect.current) {
          clearInterval(fallbackInterval);
          return;
        }
        try {
          const pSnap = await getDoc(participantRef);
          if (pSnap.exists()) {
            redirectToMeeting();
          }
        } catch {}
      }, 3000); // Check every 3 seconds

      // Aggregate cleanup function
      cleanupRef.current = () => {
        unsubParticipant();
        unsubRequest();
        clearInterval(fallbackInterval);
      };
    };

    // Main entry point: wait for auth state
    const auth = getAuth();
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        startWatcher(user);
      }
    });

    // Final cleanup on component unmount
    return () => {
      mounted = false;
      authUnsubscribe();
      cleanupRef.current();
    };
  }, [meetingId, router, topic, cam, mic]);

  return null; // This component renders nothing
}
