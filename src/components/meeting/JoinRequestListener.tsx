
"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const playJoinRequestSound = () => {
  const audio = new Audio("/sounds/request-tone.mp3");
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

export default function JoinRequestListener({ meetingId, userId }: { meetingId: string; userId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const { toast } = useToast();
  const playedRequestIds = useRef(new Set<string>());

  useEffect(() => {
    if (!meetingId || !userId) return;
    
    const q = query(collection(db, "meetings", meetingId, "joinRequests"), where("status", "==", "pending"));

    const unsub = onSnapshot(q, (snap) => {
      const newRequests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      const hasNewUnplayed = newRequests.some(req => !playedRequestIds.current.has(req.id));
      if (hasNewUnplayed) {
        playJoinRequestSound();
        newRequests.forEach(req => playedRequestIds.current.add(req.id));
      }
      
      setRequests(newRequests);
    });

    return () => unsub();
  }, [meetingId, userId]);

  const handleAccept = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const partRef = doc(db, "meetings", meetingId, "participants", req.userId); // Use req.userId
    
    try {
      // First, add the user to the participants subcollection
      await setDoc(partRef, {
        name: req.userName,
        photoURL: req.userPhotoURL,
        userId: req.userId,
        isHost: false, // Explicitly set as not host
        joinedAt: serverTimestamp(),
      });

      // Then, update the request status to 'approved' to notify the user
      await updateDoc(reqRef, { status: "approved" });
      
      toast({ title: "Request Approved", description: `${req.userName} has joined the meeting.` });
      // Clean up the request document after a delay
      setTimeout(() => deleteDoc(reqRef), 10000);
    } catch (error) {
      console.error("Error approving request:", error);
      toast({ variant: "destructive", title: "Action Failed", description: "Could not approve the request." });
    }
  };

  const handleDecline = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "denied" });
      toast({ variant: "destructive", title: "Request Denied" });
      setTimeout(() => deleteDoc(reqRef), 5000);
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not deny the request." });
    }
  };

  useEffect(() => {
    const timers = requests.map((req) =>
      setTimeout(() => handleDecline(req), 120000)
    );
    return () => timers.forEach(clearTimeout);
  }, [requests]);

  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-28 right-6 bg-background dark:bg-gray-800 rounded-2xl shadow-2xl p-4 z-50 w-80 border border-border">
      <h3 className="font-semibold mb-3 text-foreground">
        Join Requests ({requests.length})
      </h3>
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <Avatar className="h-8 w-8">
                <AvatarImage src={req.userPhotoURL} alt={req.userName} data-ai-hint="avatar user"/>
                <AvatarFallback>{req.userName?.charAt(0) || 'G'}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-foreground" title={req.userName}>
                {req.userName}
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAccept(req)} className="px-3 h-8">
                Admit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDecline(req)} className="px-3 h-8">
                Deny
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
