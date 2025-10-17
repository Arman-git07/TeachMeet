
"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X } from "lucide-react";

/**
 * Host notification: listens at /meetings/{meetingId}/joinRequests
 * - Plays sound once per request id (won't tear down the listener)
 * - Approve writes participant doc with displayName/photoURL and sets request.status = "approved"
 * - Does NOT delete request immediately — allows participant watcher to see "approved"
 * - Deletes request after a short delay (3s) once approved/declined
 */
export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const playedSoundRef = useRef<Record<string, boolean>>({});
  const cleanupTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!meetingId) return;

    const reqCol = collection(db, "meetings", meetingId, "joinRequests");
    const unsub = onSnapshot(reqCol, (snap) => {
      const pending = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: any) => r.status === "pending");

      setRequests(pending);

      // play sound once per request id
      pending.forEach((r: any) => {
        if (!playedSoundRef.current[r.id]) {
          const audio = new Audio("/sounds/join-request.mp3");
          audio.volume = 0.45;
          audio.play().catch(() => {});
          playedSoundRef.current[r.id] = true;
        }
      });

      // cleanup for requests that disappeared or changed
      const pendingIds = new Set(pending.map((p) => p.id));
      Object.keys(cleanupTimers.current).forEach((id) => {
        if (!pendingIds.has(id)) {
          clearTimeout(cleanupTimers.current[id]);
          delete cleanupTimers.current[id];
        }
      });
    });

    return () => {
      unsub();
      // clear any remaining timers
      Object.values(cleanupTimers.current).forEach((t) => clearTimeout(t));
      cleanupTimers.current = {};
      playedSoundRef.current = {};
    };
  }, [meetingId]); // <- only meetingId

  const handleApprove = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);

    try {
      // write participant with required UI fields so MeetingClient can render tile
      await setDoc(participantRef, {
        userId: req.userId,
        name: req.displayName || "Guest",
        photoURL: req.photoURL || "",
        isHost: false, // Ensure they are not a host
        joinedAt: serverTimestamp(),
      });

      // update join request so participant watcher sees approved
      await updateDoc(reqRef, { status: "approved" });
    } catch (err) {
      console.error("Approve failed:", err);
      return;
    }

    // remove notification from host UI immediately
    setRequests((prev) => prev.filter((p) => p.id !== req.id));

    // keep the request doc for a short period so participant watcher can detect status,
    // then delete it to keep collection clean
    const timer = window.setTimeout(() => {
      deleteDoc(reqRef).catch(() => {});
      delete cleanupTimers.current[req.id];
    }, 3000); // 3s gives participant time to react
    cleanupTimers.current[req.id] = timer;
  };

  const handleDecline = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "declined" });
    } catch (err) {
      console.error("Decline failed:", err);
    } finally {
      setRequests((prev) => prev.filter((p) => p.id !== req.id));
      const timer = window.setTimeout(() => {
        deleteDoc(reqRef).catch(() => {});
        delete cleanupTimers.current[req.id];
      }, 3000);
      cleanupTimers.current[req.id] = timer;
    }
  };

  if (!requests.length) return null;

  return (
    <>
      {requests.map((req) => (
        <div
          key={req.id}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999]
                     bg-[#111827] text-white rounded-2xl shadow-2xl border border-gray-700
                     px-6 py-4 flex items-center justify-between w-[90%] max-w-xl animate-slideDown"
        >
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Join request</span>
            <span className="text-sm text-gray-300">
              {req.displayName || "A participant"} wants to join the meeting.
            </span>
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={() => handleApprove(req)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all"
            >
              <Check size={16} /> Approve
            </button>
            <button
              onClick={() => handleDecline(req)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all"
            >
              <X size={16} /> Decline
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
