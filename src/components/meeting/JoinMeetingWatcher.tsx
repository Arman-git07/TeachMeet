
"use client";

import { useEffect, useRef } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Robust JoinMeetingWatcher
 * - Mount on the participant pre-join page (after request is sent).
 * - Redirects the participant to the meeting page immediately after host approval.
 *
 * Usage (already used by you): <JoinMeetingWatcher meetingId={meetingId} />
 *
 * NOTE: This only performs the redirect behavior — it does not modify any UI or buttons.
 */
export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unsubRefs = useRef<{ req?: () => void; part?: () => void } | null>(null);
  const didRedirect = useRef(false);
  const fallbackInterval = useRef<number | null>(null);
  
  const topic = searchParams.get('topic') || "";
  const cam = searchParams.get('cam') === 'false' ? 'false' : 'true';
  const mic = searchParams.get('mic') === 'false' ? 'false' : 'true';

  useEffect(() => {
    if (!meetingId) return;

    let mounted = true;
    const auth = getAuth();

    // Helper redirect once
    const redirectToMeeting = () => {
      if (didRedirect.current) return;
      didRedirect.current = true;
      const destination = `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}&cam=${cam}&mic=${mic}`;
      router.replace(destination);
    };

    // Cleanup helper
    const cleanup = () => {
      if (unsubRefs.current?.req) {
        try { unsubRefs.current.req(); } catch {}
      }
      if (unsubRefs.current?.part) {
        try { unsubRefs.current.part(); } catch {}
      }
      if (fallbackInterval.current) {
        clearInterval(fallbackInterval.current);
        fallbackInterval.current = null;
      }
    };

    // Wait for auth to be ready (handles the currentUser null race)
    const stopAuthListener = onAuthStateChanged(auth, async (user) => {
      if (!mounted || !user) {
        return;
      }

      const userId = (user as User).uid;
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", userId);
      const partRef = doc(db, "meetings", meetingId, "participants", userId);

      // 1) One-time fast check (maybe approval already happened)
      try {
        console.log("Watcher: Performing fast-check...");
        const [partSnap, reqSnap] = await Promise.all([getDoc(partRef), getDoc(reqRef)]);
        if (partSnap.exists()) {
          console.log("Watcher: Fast-check found participant document. Redirecting.");
          redirectToMeeting();
          cleanup();
          stopAuthListener();
          return;
        }
        if (reqSnap.exists() && (reqSnap.data() as any).status === "approved") {
          console.log("Watcher: Fast-check found 'approved' status. Redirecting.");
          redirectToMeeting();
          cleanup();
          stopAuthListener();
          return;
        }
      } catch (e) {
        console.warn("Watcher: Fast-check failed (this is non-critical).", e);
      }

      // 2) Real-time listener on joinRequests/{userId}
      try {
        const unsubReq = onSnapshot(reqRef, (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as any;
          console.log("Watcher: JoinRequest update received:", data);
          if (data?.status === "approved") {
            redirectToMeeting();
          } else if (data?.status === "denied") {
            // Future improvement: show a toast/alert that request was denied.
          }
        });
        unsubRefs.current = { ...unsubRefs.current, req: unsubReq };
      } catch (e) {
        console.error("Watcher: Failed to attach joinRequest listener.", e);
      }

      // 3) Real-time listener on participants/{userId}
      try {
        const unsubPart = onSnapshot(partRef, (snap) => {
          console.log("Watcher: Participant document update received. Exists:", snap.exists());
          if (snap.exists()) {
            redirectToMeeting();
          }
        });
        unsubRefs.current = { ...unsubRefs.current, part: unsubPart };
      } catch (e) {
        console.error("Watcher: Failed to attach participant listener.", e);
      }

      // 4) Fallback polling
      let polls = 0;
      fallbackInterval.current = window.setInterval(async () => {
        if (didRedirect.current || polls >= 10) {
          if (fallbackInterval.current) clearInterval(fallbackInterval.current);
          return;
        }
        polls++;
        try {
          const partSnap = await getDoc(partRef);
          if (partSnap.exists()) {
            redirectToMeeting();
          }
        } catch (e) {}
      }, 1000);

      // Stop listening to auth state changes after setup
      stopAuthListener();
    });

    return () => {
      mounted = false;
      cleanup();
      stopAuthListener();
    };
  }, [meetingId, router, topic, cam, mic]);

  return null;
}
