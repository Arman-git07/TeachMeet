
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
import { Check, X } from "lucide-react";

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

  const handleApprove = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    const partRef = doc(db, "meetings", meetingId, "participants", req.userId);
    
    try {
      await setDoc(partRef, {
        name: req.userName,
        photoURL: req.userPhotoURL,
        userId: req.userId,
        isHost: false,
        joinedAt: serverTimestamp(),
      });
      await updateDoc(reqRef, { status: "approved" });
      toast({ title: "Request Approved", description: `${req.userName} has joined the meeting.` });
      // Clean up the request document after a delay
      setTimeout(() => deleteDoc(reqRef).catch(()=>{}), 10000);
    } catch (error) {
      console.error("Error approving request:", error);
      toast({ variant: "destructive", title: "Action Failed", description: "Could not approve the request." });
    }
  };

  const handleDeny = async (req: any) => {
    const reqRef = doc(db, "meetings", meetingId, "joinRequests", req.id);
    try {
      await updateDoc(reqRef, { status: "denied" });
      toast({ variant: "destructive", title: "Request Denied" });
      setTimeout(() => deleteDoc(reqRef).catch(()=>{}), 5000);
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not deny the request." });
    }
  };

  if (requests.length === 0) return null;

  // Show one request at a time
  const currentRequest = requests[0];

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-xl shadow-2xl p-4 z-50 w-full max-w-md border border-border">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={currentRequest.userPhotoURL} alt={currentRequest.userName} data-ai-hint="avatar user"/>
                    <AvatarFallback>{currentRequest.userName?.charAt(0) || 'G'}</AvatarFallback>
                </Avatar>
                <div>
                    <h4 className="font-semibold text-foreground">Join Request</h4>
                    <p className="text-sm text-muted-foreground">{currentRequest.userName} wants to join the meeting.</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(currentRequest)} className="px-4 h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                    <Check className="mr-1.5 h-4 w-4" />
                    Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeny(currentRequest)} className="px-4 h-9 rounded-lg">
                    <X className="mr-1.5 h-4 w-4" />
                    Deny
                </Button>
            </div>
        </div>
    </div>
  );
}
