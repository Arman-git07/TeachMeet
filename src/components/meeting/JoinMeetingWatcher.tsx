"use client";
import { useEffect, useRef } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unsubRefs = useRef<{ req?: () => void; part?: () => void }>({});
  const didRedirect = useRef(false);
  const fallbackInterval = useRef<number | null>(null);

  const topic = searchParams.get("topic") || "";
  const cam = searchParams.get("cam") || "true";
  const mic = searchParams.get("mic") || "true";

  useEffect(() => {
    if (!meetingId) return;
    let mounted = true;
    const auth = getAuth();

    const redirectToMeeting = () => {
      if (didRedirect.current) return;
      didRedirect.current = true;
      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}&cam=${cam}&mic=${mic}`;
      router.replace(destination);
    };

    const cleanup = () => {
      try {
        unsubRefs.current.req?.();
        unsubRefs.current.part?.();
      } catch {}
      if (fallbackInterval.current) clearInterval(fallbackInterval.current);
    };

    const stopAuthListener = onAuthStateChanged(auth, async (user) => {
      if (!mounted || !user) return;
      const userId = user.uid;

      // Corrected the path to query the subcollection
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", userId);
      const partRef = doc(db, "meetings", meetingId, "participants", userId);

      // 🔹 Fast-check in case approval already exists
      try {
        const [partSnap, reqSnap] = await Promise.all([getDoc(partRef), getDoc(reqRef)]);
        if (partSnap.exists() || (reqSnap.exists() && reqSnap.data().status === "approved")) {
          redirectToMeeting();
          cleanup();
          stopAuthListener();
          return;
        }
      } catch (e) {
        console.warn("Watcher fast-check failed", e);
      }

      // 🔹 Real-time listeners
      unsubRefs.current.req = onSnapshot(reqRef, (snap) => {
        if (snap.exists() && snap.data().status === "approved") {
          redirectToMeeting();
        }
      });

      unsubRefs.current.part = onSnapshot(partRef, (snap) => {
        if (snap.exists()) redirectToMeeting();
      });

      // 🔹 Fallback polling (max 10s)
      let polls = 0;
      fallbackInterval.current = window.setInterval(async () => {
        if (didRedirect.current || polls >= 10) {
          if (fallbackInterval.current) clearInterval(fallbackInterval.current);
          return;
        }
        polls++;
        const partSnap = await getDoc(partRef);
        if (partSnap.exists()) redirectToMeeting();
      }, 1000);
    });

    return () => {
      mounted = false;
      cleanup();
      stopAuthListener();
    };
  }, [meetingId, router, topic, cam, mic]);

  return null;
}
