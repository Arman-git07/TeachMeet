// src/components/meeting/HostJoinRequestNotification.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    const batch = writeBatch(db);
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);

    try {
      // Create the participant document
      batch.set(participantRef, {
        name: req.userName,
        photoURL: req.userPhotoURL || "",
        isHost: false, // Explicitly not the host
        joinedAt: serverTimestamp(),
      });

      // Update the request status to signal the client
      batch.update(reqRef, { status: "approved" });
      
      await batch.commit();

      toast({ title: "Participant Approved", description: `${req.userName} has joined.`});

      // Clean up the request after a short delay to ensure listener fires
      setTimeout(() => deleteDoc(reqRef).catch(() => {}), 5000);
    } catch (err) {
      console.error("Approve failed:", err);
      toast({ variant: "destructive", title: "Approval Failed"});
    }
  };

  const handleDeny = async (req: JoinRequest) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      // Update status to 'denied' to notify the user
      await updateDoc(reqRef, { status: "denied" });
      toast({ variant: "destructive", title: "Request Denied", description: `${req.userName} was denied entry.`});
      // Clean up the request after a short delay
      setTimeout(() => deleteDoc(reqRef).catch(() => {}), 5000);
    } catch (err) {
      console.error("Decline failed:", err);
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
                     bg-background/80 text-foreground backdrop-blur-sm rounded-2xl shadow-2xl border border-border
                     px-6 py-4 flex items-center justify-between w-[90%] max-w-lg animate-slideDown"
        >
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/50">
              <AvatarImage src={req.userPhotoURL} alt={req.userName} data-ai-hint="avatar user"/>
              <AvatarFallback>{req.userName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-lg font-semibold">Join Request</span>
              <span className="text-sm text-muted-foreground">{req.userName || "A participant"} wants to join</span>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <button onClick={() => handleApprove(req)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-primary/40">
                <Check size={18}/>Approve
            </button>
            <button onClick={() => handleDeny(req)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-destructive/40">
                <X size={18}/>Decline
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
