// src/components/meeting/AskToJoinButton.tsx
"use client";

import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";


export default function AskToJoinButton({
  meetingId,
  onSent, // required callback to notify parent that request created
  disabled,
}: {
  meetingId: string;
  onSent: () => void;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAskToJoin = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in and provide a valid meeting ID." });
      return;
    }

    setLoading(true);
    try {
      // Ensure meeting exists before sending a request
      const meetingRef = doc(db, "meetings", meetingId);
      const meetingSnap = await getDoc(meetingRef);
      if (!meetingSnap.exists()) {
        toast({ variant: "destructive", title: "Meeting Not Found", description: "Please check the meeting code or link and try again."});
        setLoading(false);
        return;
      }

      // Write join request to the path the host is listening on
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
      await setDoc(reqRef, {
        userId: user.uid,
        displayName: user.displayName || "Guest",
        photoURL: user.photoURL || "",
        status: "pending",
        createdAt: serverTimestamp(),
      }, { merge: true });

      // Notify parent component to update UI (e.g., show "Waiting...")
      if (onSent) onSent();

    } catch (err: any) {
      console.error("Ask to join failed", err);
      toast({ variant: "destructive", title: "Request Failed", description: err.message || "Failed to send join request. Please try again." });
      setLoading(false);
    }
    // Note: setLoading(false) is not called on success, because the parent will
    // unmount this component and show the "Waiting..." state.
  };

  return (
    <Button
      onClick={handleAskToJoin}
      disabled={disabled || loading}
      className={cn("w-full py-3 text-lg font-semibold rounded-xl", {
        "bg-gray-400/50 text-gray-100/70 cursor-not-allowed": disabled,
        "btn-gel": !disabled,
      })}
    >
      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Request...</> : "Ask to Join"}
    </Button>
  );
}
