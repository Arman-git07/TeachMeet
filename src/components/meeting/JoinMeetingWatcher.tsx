
"use client";

import { useEffect, useRef } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

/**
 * Robust JoinMeetingWatcher
 * - Mount on the participant pre-join page (after request is sent).
 * - Redirects the participant to the meeting page immediately after host approval.
 *
 * Usage (already used by you): <JoinMeetingWatcher meetingId={meetingId} />
 *
 * NOTE: This only performs the redirect behavior — it does not modify any UI or buttons.
 */
export default function JoinMeetingWatcher({ meetingId }: { meetingId:string }) {
  const router = useRouter();
  const unsubRefs = useRef<{ req?: () => void; part?: () => void } | null>(null);
  const didRedirect = useRef(false);
  const fallbackInterval = useRef<number | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    let mounted = true;
    const auth = getAuth();

    // Helper redirect once
    const redirectToMeeting = () => {
      if (didRedirect.current) return;
      didRedirect.current = true;
      console.log("REDIRECTING NOW to /dashboard/meeting/" + meetingId);
      // Replace so back button doesn't go back to waiting screen
      router.replace(`/dashboard/meeting/${meetingId}`);
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
      if (!mounted) return;

      if (!user) {
        // Not signed in — nothing to watch. The app's auth flow should handle sign-in.
        return;
      }

      const userId = (user as User).uid;
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", userId);
      const partRef = doc(db, "meetings", meetingId, "participants", userId);

      // 1) One-time fast check (maybe approval already happened)
      try {
        console.log("JoinMeetingWatcher: Performing initial one-time check.");
        const [partSnap, reqSnap] = await Promise.all([getDoc(partRef), getDoc(reqRef)]);
        if (partSnap.exists()) {
          console.log("JoinMeetingWatcher (fast check): Participant doc exists. Redirecting.");
          redirectToMeeting();
          // we can stop now
          cleanup();
          stopAuthListener();
          return;
        }
        if (reqSnap.exists() && (reqSnap.data() as any).status === "approved") {
          console.log("JoinMeetingWatcher (fast check): Join request status is 'approved'. Redirecting.");
          redirectToMeeting();
          cleanup();
          stopAuthListener();
          return;
        }
      } catch (e) {
        // harmless; we'll still set listeners
        console.warn("JoinMeetingWatcher quick-check failed", e);
      }

      // 2) Real-time listener on joinRequests/{userId}
      try {
        const unsubReq = onSnapshot(reqRef, (snap) => {
          // DEBUGGING LINE
          console.log("req-snap", snap.id, snap.exists() ? snap.data() : 'DOES NOT EXIST');
          if (!snap.exists()) return;
          const data = snap.data() as any;
          // If host set approved status
          if (data?.status === "approved") {
            redirectToMeeting();
          } else if (data?.status === "denied" || data?.status === "rejected") {
            // optional: notify the user — do not redirect
            try { alert("Host denied your request to join."); } catch (e) {}
          }
        });
        unsubRefs.current = { ...unsubRefs.current, req: unsubReq };
      } catch (e) {
        console.error("JoinMeetingWatcher: failed to attach req listener", e);
      }

      // 3) Real-time listener on participants/{userId} (host might create participant doc first)
      try {
        const unsubPart = onSnapshot(partRef, (snap) => {
          // DEBUGGING LINE
          console.log("part-snap exists", snap.exists());
          if (snap.exists()) {
            redirectToMeeting();
          }
        });
        unsubRefs.current = { ...unsubRefs.current, part: unsubPart };
      } catch (e) {
        console.error("JoinMeetingWatcher: failed to attach participant listener", e);
      }

      // 4) Fallback polling: in case host deletes the request immediately after approval
      //    we poll participants doc every 1s for up to 10s (only if not redirected).
      let polls = 0;
      fallbackInterval.current = window.setInterval(async () => {
        if (didRedirect.current) {
          if (fallbackInterval.current) {
            clearInterval(fallbackInterval.current);
            fallbackInterval.current = null;
          }
          return;
        }
        polls++;
        try {
          const partSnap = await getDoc(partRef);
          if (partSnap.exists()) {
            console.log("JoinMeetingWatcher (polling): Found participant doc. Redirecting.");
            redirectToMeeting();
            cleanup();
            return;
          }
          // also check request doc status just in case
          const reqSnap = await getDoc(reqRef);
          if (reqSnap.exists() && (reqSnap.data() as any).status === "approved") {
            console.log("JoinMeetingWatcher (polling): Found approved request. Redirecting.");
            redirectToMeeting();
            cleanup();
            return;
          }
        } catch (e) {
          // ignore transient errors
        }
        if (polls >= 10) {
          // stop fallback after 10 attempts (~10s)
          if (fallbackInterval.current) {
            clearInterval(fallbackInterval.current);
            fallbackInterval.current = null;
          }
        }
      }, 1000);

      // We no longer need the onAuthStateChanged listener once set up
      stopAuthListener();
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, [meetingId, router]);

  return null;
}
