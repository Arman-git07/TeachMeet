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
  onSent,
  disabled,
}: {
  meetingId: string;
  onSent?: () => void;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleAskToJoin = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert("Please sign in to request to join.");
        setLoading(false);
        return;
      }
      if (!meetingId) {
        alert("Missing meeting ID.");
        setLoading(false);
        return;
      }

      const id = meetingId.trim();
      if (!id) {
        alert("Invalid meeting ID.");
        setLoading(false);
        return;
      }

      // confirm meeting exists
      const meetingRef = doc(db, "meetings", id);
      const meetingSnap = await getDoc(meetingRef);
      if (!meetingSnap.exists()) {
        alert("Meeting not found. Please check the code or link.");
        setLoading(false);
        return;
      }

      // write the join request at exact path host listens to
      const reqRef = doc(db, "meetings", id, "joinRequests", user.uid);
      await setDoc(
        reqRef,
        {
          userId: user.uid,
          displayName: user.displayName || "Guest",
          photoURL: user.photoURL || "",
          status: "pending",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // notify parent (prejoin page) to mount the watcher UI
      onSent?.();
    } catch (err) {
      console.error("Ask to join failed:", err);
      alert("Failed to send join request. Check console for details.");
    } finally {
      setLoading(false);
    }
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
      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Ask to Join"}
    </Button>
  );
}
