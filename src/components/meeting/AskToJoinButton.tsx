// src/components/meeting/AskToJoinButton.tsx
"use client";

import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";


export default function AskToJoinButton({
  meetingId,
  onSent, // optional callback to notify parent that request created
  disabled,
}: {
  meetingId: string;
  onSent?: () => void;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleAskToJoin = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) {
      alert("Please sign in and provide a valid meeting link.");
      return;
    }

    setLoading(true);
    try {
      // Ensure meeting exists
      const meetingRef = doc(db, "meetings", meetingId);
      const meetingSnap = await getDoc(meetingRef);
      if (!meetingSnap.exists()) {
        alert("Meeting not found. Please check the code or link.");
        setLoading(false);
        return;
      }

      // Write join request exactly where host listener expects
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
      await setDoc(reqRef, {
        userId: user.uid,
        displayName: user.displayName || "Guest",
        photoURL: user.photoURL || "",
        status: "pending",
        createdAt: serverTimestamp(),
      }, { merge: true });

      if (onSent) onSent();
    } catch (err) {
      console.error("Ask to join failed", err);
      alert("Failed to send join request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleAskToJoin}
      disabled={disabled || loading}
      className={cn("w-full py-3 text-lg font-semibold rounded-xl", {
        "bg-green-900/50 text-green-100/70 cursor-not-allowed": disabled,
        "btn-gel": !disabled,
      })}
    >
      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Ask to Join"}
    </Button>
  );
}
