
// src/components/meeting/HostJoinRequestNotification.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();
  const hostId = user?.uid;

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
    if (!meetingId) {
      console.error("handleApprove: missing meetingId");
      return;
    }
    const participantId = req.userId;
    const participantDocRef = doc(db, "meetings", meetingId, "participants", participantId);
    const joinReqRef = doc(db, "meetings", meetingId, "joinRequests", participantId);
  
    try {
      const batch = writeBatch(db);
  
      batch.set(participantDocRef, {
        userId: participantId,
        name: req.userName || "Guest",
        photoURL: req.userPhotoURL || "",
        joinedAt: serverTimestamp(),
      }, { merge: true });
  
      batch.update(joinReqRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: hostId || null,
      });
  
      await batch.commit();

      toast({ title: "Request Approved", description: `${req.userName} will now join the meeting.` });
  
      setTimeout(async () => {
        try {
          await deleteDoc(joinReqRef);
        } catch (e) {
          // ignore if already deleted
        }
      }, 3000);
  
    } catch (err) {
      console.error("Failed to approve join request:", err);
      toast({ variant: "destructive", title: "Action Failed", description: "Could not approve the request."});
    }
  };

  const handleDeny = async (req: JoinRequest) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "denied" });
      toast({ variant: "destructive", title: "Request Denied", description: `${req.userName} was denied entry.`});
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
