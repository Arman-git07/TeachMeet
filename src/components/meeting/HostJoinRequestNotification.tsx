
// src/components/meeting/HostJoinRequestNotification.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
}

export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const { toast } = useToast();
  const playedSoundRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!meetingId) return;

    const colRef = collection(db, "meetings", meetingId, "joinRequests");
    const q = query(colRef, where("status", "==", "pending"));

    const unsub = onSnapshot(q, (snap) => {
      const pendingReqs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as JoinRequest));

      pendingReqs.forEach((req) => {
        if (!playedSoundRef.current[req.id]) {
          try {
            const audio = new Audio("/sounds/join-request.mp3");
            audio.volume = 0.45;
            audio.play().catch(() => {});
          } catch (e) {
            console.warn("Sound playback failed:", e);
          }
          playedSoundRef.current[req.id] = true;
        }
      });
      
      setRequests(pendingReqs);
    });

    return () => unsub();
  }, [meetingId]);

  const handleApprove = async (req: JoinRequest) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);

    try {
      await setDoc(participantRef, {
        name: req.userName,
        photoURL: req.userPhotoURL || "",
        joinedAt: serverTimestamp(),
      });

      await updateDoc(reqRef, { status: "approved" });
      toast({ title: "Participant Approved", description: `${req.userName} has joined.`});

      setTimeout(() => deleteDoc(reqRef).catch(() => {}), 3000);
    } catch (err) {
      console.error("approve failed", err);
      toast({ variant: "destructive", title: "Approval Failed"});
    }
  };

  const handleDecline = async (req: JoinRequest) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "denied" });
      toast({ variant: "destructive", title: "Request Denied", description: `${req.userName} was denied entry.`});
      setTimeout(() => deleteDoc(reqRef).catch(() => {}), 3000);
    } catch (err) {
      console.error("decline failed", err);
      toast({ variant: "destructive", title: "Action Failed"});
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
            <span className="text-sm text-gray-300">{req.userName || "A participant"} wants to join</span>
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
