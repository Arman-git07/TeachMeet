// src/components/meeting/HostJoinRequestNotification.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Check, X } from "lucide-react";

/**
 * Host notification component — listen to meetings/{meetingId}/joinRequests
 * Shows a top banner for each pending request, plays a single sound once per request,
 * auto-dismisses after 2 minutes, and lets host Approve / Deny.
 *
 * Drop-in: <HostJoinRequestNotification meetingId={meetingId} />
 * (render only for the host)
 */
export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  // track which request ids we've played sound for
  const playedSoundRef = useRef<Record<string, boolean>>({});
  // track timers so we can clear them on unmount/handled
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!meetingId) return;

    const requestsRef = collection(db, "meetings", meetingId, "joinRequests");

    const unsub = onSnapshot(requestsRef, (snapshot) => {
      const pending = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: any) => r.status === "pending");

      setRequests(pending);

      // play sound once per-request id
      pending.forEach((req: any) => {
        if (!playedSoundRef.current[req.id]) {
          const audio = new Audio("/sounds/join-request.mp3");
          audio.volume = 0.45;
          audio.play().catch(() => {});
          playedSoundRef.current[req.id] = true;
        }

        // ensure a 2-minute auto-dismiss timer exists for this request
        if (!timersRef.current[req.id]) {
          const timeoutId = window.setTimeout(async () => {
            try {
              const reqRef = doc(db, `meetings/${meetingId}/joinRequests/${req.id}`);
              // mark expired so participants can be notified
              await updateDoc(reqRef, { status: "expired" });
              // remove it from UI
              setRequests((prev) => prev.filter((x) => x.id !== req.id));
            } catch (e) {
              // ignore
            } finally {
              delete timersRef.current[req.id];
            }
          }, 2 * 60 * 1000); // 2 minutes
          timersRef.current[req.id] = timeoutId;
        }
      });

      // cleanup timers for requests that disappeared
      const pendingIds = new Set(pending.map((r: any) => r.id));
      Object.keys(timersRef.current).forEach((id) => {
        if (!pendingIds.has(id)) {
          clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
      });
    });

    return () => {
      // clear timers
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
      playedSoundRef.current = {};
      unsub();
    };
  }, [meetingId]);

  const handleApprove = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);

    try {
      // ✅ CORRECTED: Add participant with name and photoURL so their video tile renders correctly.
      await setDoc(participantRef, {
        name: req.displayName || "Guest",
        photoURL: req.photoURL || "",
        isHost: false, // Ensure they are not a host
        joinedAt: serverTimestamp(),
      });

      // Mark request as approved so the participant's watcher redirects them.
      await updateDoc(reqRef, { status: "approved" });
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      // remove from host UI and cleanup timer
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (timersRef.current[req.id]) {
        clearTimeout(timersRef.current[req.id]);
        delete timersRef.current[req.id];
      }
      // ✅ FIXED: Do not delete the request doc immediately. Let the watcher see the 'approved' status.
      // The watcher will handle the eventual deletion if needed, or it can be cleaned up via a script.
    }
  };

  const handleDeny = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "declined" });
    } catch (err) {
      console.error("Deny failed:", err);
    } finally {
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (timersRef.current[req.id]) {
        clearTimeout(timersRef.current[req.id]);
        delete timersRef.current[req.id];
      }
    }
  };

  if (!requests.length) return null;

  return (
    <>
      {requests.map((req) => (
        <div
          key={req.id}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999]
                     bg-[#1b1e23] text-white rounded-2xl shadow-2xl border border-gray-700
                     px-6 py-4 flex items-center justify-between w-[90%] max-w-xl animate-slideDown"
        >
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Join Request</span>
            <span className="text-sm text-gray-300">
              {req.displayName || "A participant"} wants to join the meeting.
            </span>
            <span className="text-xs text-gray-500 mt-1 italic">
              Auto-dismisses in 2 minutes
            </span>
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={() => handleApprove(req)}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700
                         text-white px-4 py-1.5 rounded-lg font-medium transition-all"
            >
              <Check size={16} /> Approve
            </button>

            <button
              onClick={() => handleDeny(req)}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700
                         text-white px-4 py-1.5 rounded-lg font-medium transition-all"
            >
              <X size={16} /> Deny
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
