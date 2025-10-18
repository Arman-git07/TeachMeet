// src/components/meeting/HostJoinRequestNotification.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X } from "lucide-react";

/**
 * Renders a top banner for pending join-requests for a meeting.
 * Use: <HostJoinRequestNotification meetingId={meetingId} />
 * Render only for host.
 */
export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const playedSoundRef = useRef<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!meetingId) return;

    const colRef = collection(db, "meetings", meetingId, "joinRequests");
    const unsub = onSnapshot(colRef, (snap) => {
      const pending = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: any) => r.status === "pending");

      setRequests(pending);

      pending.forEach((r: any) => {
        if (!playedSoundRef.current[r.id]) {
          try {
            const audio = new Audio("/sounds/join-request.mp3");
            audio.volume = 0.45;
            audio.play().catch(() => {});
          } catch (e) {
            console.warn("Sound playback failed:", e);
          }
          playedSoundRef.current[r.id] = true;
        }

        // auto-expire timer per request
        if (!timersRef.current[r.id]) {
          const t = window.setTimeout(async () => {
            try {
              const reqRef = doc(db, "meetings", meetingId, "joinRequests", r.id);
              await updateDoc(reqRef, { status: "expired" });
              setRequests((prev) => prev.filter((x) => x.id !== r.id));
            } catch (e) {
              // ignore
            } finally {
              delete timersRef.current[r.id];
            }
          }, 2 * 60 * 1000);
          timersRef.current[r.id] = t;
        }
      });

      // clean timers for removed requests
      const pendingIds = new Set(pending.map((p) => p.id));
      Object.keys(timersRef.current).forEach((id) => {
        if (!pendingIds.has(id)) {
          clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
      });
    });

    return () => {
      unsub();
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
      playedSoundRef.current = {};
    };
  }, [meetingId]); // only meetingId

  const handleApprove = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);

    try {
      // write participant metadata so meeting UI shows a proper tile
      await setDoc(participantRef, {
        userId: req.userId,
        name: req.displayName || "Guest",
        photoURL: req.photoURL || "",
        joinedAt: new Date().toISOString(),
      });

      await updateDoc(reqRef, { status: "approved" });
    } catch (err) {
      console.error("approve failed", err);
      return;
    }

    setRequests((prev) => prev.filter((p) => p.id !== req.id));

    // keep request doc for a short time so participant watcher can pick up approved status
    const timer = window.setTimeout(() => {
      deleteDoc(reqRef).catch(() => {});
      delete timersRef.current[req.id];
    }, 3000);
    timersRef.current[req.id] = timer;
  };

  const handleDecline = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "declined" });
    } catch (err) {
      console.error("decline failed", err);
    } finally {
      setRequests((prev) => prev.filter((p) => p.id !== req.id));
      const t = window.setTimeout(() => {
        deleteDoc(reqRef).catch(() => {});
        delete timersRef.current[req.id];
      }, 3000);
      timersRef.current[req.id] = t;
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
            <span className="text-lg font-semibold">Join Request</span>
            <span className="text-sm text-gray-300">{req.displayName || "A participant"} wants to join</span>
            <span className="text-xs text-gray-500 mt-1">Auto-dismisses in 2 minutes</span>
          </div>

          <div className="flex gap-3 items-center">
            <button onClick={() => handleApprove(req)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all">
                <Check size={16}/>Approve
            </button>
            <button onClick={() => handleDecline(req)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all">
                <X size={16}/>Decline
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
