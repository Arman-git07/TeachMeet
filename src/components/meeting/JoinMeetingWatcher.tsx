"use client";

import { useEffect, useRef } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

/**
 * Robust JoinMeetingWatcher:
 * - Mount this after participant sends the join request.
 * - Listens to both:
 *     - meetings/{meetingId}/joinRequests/{userUid}  (status -> "approved")
 *     - meetings/{meetingId}/participants/{userUid}  (host may create this first)
 * - Does a fast one-time check and a short polling fallback to avoid race conditions.
 * - Redirects to /dashboard/meeting/{meetingId} via router.replace
 */
export default function JoinMeetingWatcher({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const unsubRef = useRef<{ req?: () => void; part?: () => void } | null>(null);
  const redirected = useRef(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    let mounted = true;

    const auth = getAuth();

    const stop = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      if (!user) {
        // Not authenticated — watcher can't work.
        return;
      }
      const userId = user.uid;
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", userId);
      const participantRef = doc(db, "meetings", meetingId, "participants", userId);

      const doRedirect = () => {
        if (redirected.current) return;
        redirected.current = true;
        // Use replace so Back button doesn't return to prejoin
        router.replace(`/dashboard/meeting/${meetingId}`);
      };

      // Fast one-time check in case approval has already happened
      try {
        const [partSnap, reqSnap] = await Promise.all([getDoc(participantRef), getDoc(reqRef)]);
        if (partSnap.exists()) {
          doRedirect();
          return;
        }
        if (reqSnap.exists() && (reqSnap.data() as any).status === "approved") {
          doRedirect();
          return;
        }
      } catch (e) {
        // ignore and continue to attach listeners
      }

      // Real-time listener on join request doc
      try {
        const unsubReq = onSnapshot(reqRef, (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as any;
          if (!data) return;
          const status = data.status;
          if (status === "approved") {
            doRedirect();
          } else if (status === "denied" || status === "rejected") {
            // Optionally notify participant here (do not redirect)
            try { alert("Host denied your join request."); } catch {}
          }
        });
        unsubRef.current = { ...(unsubRef.current || {}), req: unsubReq };
      } catch (e) {
        console.error("Failed to attach joinRequest listener", e);
      }

      // Real-time listener on participant doc (host sometimes writes this first)
      try {
        const unsubPart = onSnapshot(participantRef, (snap) => {
          if (snap.exists()) {
            doRedirect();
          }
        });
        unsubRef.current = { ...(unsubRef.current || {}), part: unsubPart };
      } catch (e) {
        console.error("Failed to attach participant listener", e);
      }

      // Short polling fallback (every 1s up to ~8s) — catches the race when host deletes request immediately
      let tries = 0;
      pollRef.current = window.setInterval(async () => {
        if (redirected.current) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          return;
        }
        tries++;
        try {
          const p = await getDoc(participantRef);
          if (p.exists()) {
            doRedirect();
            return;
          }
          const r = await getDoc(reqRef);
          if (r.exists() && (r.data() as any).status === "approved") {
            doRedirect();
            return;
          }
        } catch (err) {
          // ignore transient read errors
        }
        if (tries >= 8) {
          // stop after ~8s
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 1000);

      // Stop listening to auth state after we set up watchers
      stop();
    });

    return () => {
      mounted = false;
      // cleanup listeners
      if (unsubRef.current?.req) {
        try { unsubRef.current.req(); } catch {}
      }
      if (unsubRef.current?.part) {
        try { unsubRef.current.part(); } catch {}
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [meetingId, router]);

  return null;
}