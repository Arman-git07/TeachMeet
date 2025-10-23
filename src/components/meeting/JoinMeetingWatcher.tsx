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
      if (didRedirect.current) return;
      didRedirect.current = true;

      // clean up listeners immediately on redirect
      try {
        unsubRefs.current.req?.();
        unsubRefs.current.part?.();
        if (fallbackInterval.current) clearInterval(fallbackInterval.current);
      } catch {}

      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(
        topic
      )}&cam=${cam}&mic=${mic}`;
      router.replace(destination);
    };

    const auth = getAuth();
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || !mounted) return;
      const userId = user.uid;

      const reqRef = doc(db, "meetings", meetingId, "joinRequests", userId);
      const partRef = doc(db, "meetings", meetingId, "participants", userId);

      // 🔹 Initial fast check: maybe host already approved before watcher started
      try {
        const [reqSnap, partSnap] = await Promise.all([getDoc(reqRef), getDoc(partRef)]);
        if (partSnap.exists() || (reqSnap.exists() && reqSnap.data().status === "approved")) {
          redirectToMeeting();
          return;
        }
      } catch (e) {
        console.error("Initial join check failed", e);
      }

      // 🔹 Real-time listeners (stay active)
      unsubRefs.current.req = onSnapshot(reqRef, (snap) => {
        if (!mounted || didRedirect.current) return;
        const data = snap.data();
        if (snap.exists() && data?.status === "approved") {
          redirectToMeeting();
        }
      });

      unsubRefs.current.part = onSnapshot(partRef, (snap) => {
        if (!mounted || didRedirect.current) return;
        if (snap.exists()) {
          redirectToMeeting();
        }
      });

      // 🔹 Fallback poller (in case snapshots fail)
      fallbackInterval.current = setInterval(async () => {
        if (!mounted || didRedirect.current) return;
        try {
          const [r, p] = await Promise.all([getDoc(reqRef), getDoc(partRef)]);
          if (p.exists() || (r.exists() && r.data()?.status === "approved")) {
            redirectToMeeting();
          }
        } catch {}
      }, 4000);
    });

    return () => {
      mounted = false;
      stopAuth();
      unsubRefs.current.req?.();
      unsubRefs.current.part?.();
      if (fallbackInterval.current) clearInterval(fallbackInterval.current);
    };
  }, [meetingId, router, topic, cam, mic]);

  return null;
}
