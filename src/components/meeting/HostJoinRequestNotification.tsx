
"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";

export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [playedSounds, setPlayedSounds] = useState<{ [key: string]: boolean }>({});
  const [timers, setTimers] = useState<{ [key: string]: NodeJS.Timeout }>({});

  // Listen for incoming join requests
  useEffect(() => {
    if (!meetingId) return;

    const requestsRef = collection(db, "meetings", meetingId, "joinRequests");
    const unsub = onSnapshot(requestsRef, (snapshot) => {
      const pending = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: any) => r.status === "pending");
      
      setRequests(pending);

      pending.forEach(req => {
        if (!playedSounds[req.id]) {
            const audio = new Audio("/sounds/join-request.mp3");
            audio.play().catch(() => {});
            setPlayedSounds(prev => ({ ...prev, [req.id]: true }));
        }
      });
      
      // Set 2-minute auto-dismiss timers
      pending.forEach((req) => {
        if (!timers[req.id]) {
          const timeout = setTimeout(async () => {
            const reqRef = doc(db, `meetings/${meetingId}/joinRequests/${req.id}`);
            await updateDoc(reqRef, { status: "expired" });
            setRequests((prev) => prev.filter((r) => r.id !== req.id));
          }, 2 * 60 * 1000);
          setTimers((prev) => ({ ...prev, [req.id]: timeout }));
        }
      });
    });

    return () => {
        unsub();
        // Clean up timers on component unmount
        Object.values(timers).forEach(clearTimeout);
    };
  }, [meetingId, playedSounds, timers]);

  const handleResponse = async (req: any, action: "approve" | "deny") => {
    const reqRef = doc(db, `meetings/${meetingId}/joinRequests`, req.id);
    const participantRef = doc(db, `meetings/${meetingId}/participants`, req.userId);

    // Clear the auto-dismiss timer for this request
    if (timers[req.id]) {
        clearTimeout(timers[req.id]);
        setTimers(prev => {
            const newTimers = { ...prev };
            delete newTimers[req.id];
            return newTimers;
        });
    }

    try {
      if (action === "approve") {
        await setDoc(participantRef, {
            name: req.displayName || 'Participant',
            photoURL: req.photoURL || '',
            isHost: false, // Explicitly not host
            joinedAt: serverTimestamp(),
            userId: req.userId,
        });
        await updateDoc(reqRef, { status: "approved" });
      } else {
        await updateDoc(reqRef, { status: "declined" });
      }
      // Remove the request from the UI immediately
      setRequests(prev => prev.filter(r => r.id !== req.id));
      // Optionally delete the doc from Firestore after a delay
      setTimeout(() => deleteDoc(reqRef), 5000);
    } catch(err) {
      console.error("Error handling join request:", err);
    }
  };

  if (requests.length === 0) return null;

  // We'll show one request at a time to keep the UI clean
  const currentRequest = requests[0];

  return (
    <div
      key={currentRequest.id}
      className="fixed top-20 sm:top-6 left-1/2 -translate-x-1/2 z-[9999] 
                 bg-[#1c1f23]/90 text-white rounded-2xl shadow-2xl border border-gray-700/50
                 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between w-[90%] max-w-xl 
                 animate-slideDown backdrop-blur-md"
    >
      <div className="flex flex-col">
        <span className="text-lg font-semibold">Join Request</span>
        <span className="text-sm text-gray-300">
          {currentRequest.displayName || "A participant"} wants to join this meeting.
        </span>
         <span className="text-xs text-gray-500 mt-1 italic">
              Auto-dismisses in 2 minutes
        </span>
      </div>

      <div className="flex gap-2 sm:gap-3 items-center">
        <Button
          onClick={() => handleResponse(currentRequest, "approve")}
          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 
                     text-white px-3 py-1.5 sm:px-4 sm:py-2 h-auto rounded-lg font-medium transition-all"
        >
          <Check size={16} /> Approve
        </Button>

        <Button
          onClick={() => handleResponse(currentRequest, "deny")}
          className="flex items-center gap-1 bg-red-600 hover:bg-red-700 
                     text-white px-3 py-1.5 sm:px-4 sm:py-2 h-auto rounded-lg font-medium transition-all"
        >
          <X size={16} /> Deny
        </Button>
      </div>
    </div>
  );
}
