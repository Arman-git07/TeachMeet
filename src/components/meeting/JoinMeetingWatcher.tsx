
"use client";
import { useEffect, useRef } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didRedirect = useRef(false);
  const unsubRefs = useRef<{ req?: () => void; part?: () => void }>({});
  const fallbackInterval = useRef<NodeJS.Timeout | null>(null);

  const topic = searchParams.get("topic") || "";
  const cam = searchParams.get("cam") || "true";
  const mic = searchParams.get("mic") || "true";

  useEffect(() => {
    if (!meetingId) return;
    let mounted = true;

    const redirectToMeeting = () => {
      if (!mounted || didRedirect.current) return;
      didRedirect.current = true;

      // Clean up all listeners and intervals immediately upon redirect
      try {
        unsubRefs.current.req?.();
        unsubRefs.current.part?.();
        if (fallbackInterval.current) {
          clearInterval(fallbackInterval.current);
          fallbackInterval.current = null;
        }
      } catch (e) {
        console.warn("Error during watcher cleanup:", e);
      }

      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(
        topic
      )}&cam=${cam}&mic=${mic}`;
      router.replace(destination);
    };

    const auth = getAuth();

    // The main auth listener. This is the entry point.
    const stopAuthListener = onAuthStateChanged(auth, async (user) => {
      // Only proceed if we are mounted and have a valid user
      if (!mounted || !user) return;
      
      const userId = user.uid;

      // Correctly reference the subcollections within the specific meeting document
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", userId);
      const partRef = doc(db, "meetings", meetingId, "participants", userId);

      // 🔹 Initial Fast Check: Check for approval right away.
      // This catches cases where approval happened before this listener was ready.
      try {
        const [reqSnap, partSnap] = await Promise.all([getDoc(reqRef), getDoc(partRef)]);
        if (partSnap.exists() || (reqSnap.exists() && reqSnap.data()?.status === "approved")) {
          redirectToMeeting();
          return; // Stop further processing if we already have approval
        }
      } catch (e) {
        console.error("Initial join check failed", e);
      }

      // 🔹 Real-time Listener for the participant document itself.
      // This is the most reliable and fastest way to detect approval.
      unsubRefs.current.part = onSnapshot(partRef, (snap) => {
        if (snap.exists() && mounted) {
          redirectToMeeting();
        }
      }, (error) => {
        console.error("Participant listener error:", error);
      });

      // 🔹 Real-time Listener for the join request document status.
      // This is a good secondary check.
      unsubRefs.current.req = onSnapshot(reqRef, (snap) => {
        const data = snap.data();
        if (snap.exists() && data?.status === "approved" && mounted) {
          redirectToMeeting();
        }
      }, (error) => {
          console.error("Join request listener error:", error);
      });

      // 🔹 Fallback Poller: A safety net in case snapshot events are missed.
      if (fallbackInterval.current) clearInterval(fallbackInterval.current); // Clear any old interval
      fallbackInterval.current = setInterval(async () => {
        if (!mounted || didRedirect.current) {
          if (fallbackInterval.current) clearInterval(fallbackInterval.current);
          return;
        }
        try {
          const partSnap = await getDoc(partRef);
          if (partSnap.exists()) {
            redirectToMeeting();
          }
        } catch (e) {
            // This is just a fallback, so we don't need to show errors.
        }
      }, 3000); // Check every 3 seconds

    });

    // Cleanup function for when the component unmounts
    return () => {
      mounted = false;
      stopAuthListener(); // Detach the auth state listener
      unsubRefs.current.req?.();
      unsubRefs.current.part?.();
      if (fallbackInterval.current) {
        clearInterval(fallbackInterval.current);
      }
    };
  }, [meetingId, router, topic, cam, mic]);

  return null; // This component renders nothing
}
