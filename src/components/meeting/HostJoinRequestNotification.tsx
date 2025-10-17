
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

type JoinRequest = {
  id: string;
  userId: string;
  displayName: string;
  status: "pending" | "approved" | "denied";
};

export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!meetingId) return;
    const q = collection(db, "meetings", meetingId, "joinRequests");
    const unsub = onSnapshot(q, (snap) => {
      const pendingRequests = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as JoinRequest))
        .filter((req) => req.status === "pending");

      if (pendingRequests.length > requests.length) {
         const audio = new Audio("/sounds/join-request.mp3");
         audio.play().catch(() => {});
      }
      setRequests(pendingRequests);
    });

    return () => unsub();
  }, [meetingId]); // Corrected Dependency Array

  const handleDecision = async (req: JoinRequest, decision: "approved" | "denied") => {
    const ref = doc(db, "meetings", meetingId, "joinRequests", req.id);
    
    if (decision === "approved") {
        await setDoc(doc(db, "meetings", meetingId, "participants", req.userId), {
            name: req.displayName,
            photoURL: req.photoURL || '',
            isHost: false,
            joinedAt: serverTimestamp(),
        });
    }

    await updateDoc(ref, { status: decision });
    
    toast({
        title: `Request ${decision}`,
        description: `${req.displayName} has been ${decision}.`
    });

    // Remove the notification from the UI immediately after decision
    setRequests(currentRequests => currentRequests.filter(r => r.id !== req.id));

    // Optional: Clean up the doc from Firestore after a delay
    setTimeout(() => deleteDoc(ref).catch(console.error), 5000);
  };

  return (
    <AnimatePresence>
      {requests.map((req) => (
        <motion.div
          key={req.id}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md bg-card dark:bg-neutral-900 shadow-2xl rounded-2xl border border-border dark:border-neutral-700 p-4"
        >
          <div className="flex items-center justify-between gap-4">
              <div className="flex-grow">
                <p className="font-semibold text-foreground">Join Request</p>
                <p className="text-sm text-muted-foreground">
                  {req.displayName} wants to join the meeting.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => handleDecision(req, "denied")}>
                  <X className="h-4 w-4 mr-1"/> Deny
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDecision(req, "approved")}>
                  <Check className="h-4 w-4 mr-1"/> Approve
                </Button>
              </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
