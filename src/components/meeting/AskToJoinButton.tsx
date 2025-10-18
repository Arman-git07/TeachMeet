"use client";

import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface AskToJoinButtonProps {
  meetingId: string;
  onSent: () => void;
  disabled?: boolean;
}

export default function AskToJoinButton({ meetingId, onSent, disabled }: AskToJoinButtonProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAskToJoin = async () => {
    if (!user) {
      setError("You must be signed in to join a meeting.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const meetingRef = doc(db, "meetings", meetingId.trim());
      const meetingSnap = await getDoc(meetingRef);

      if (!meetingSnap.exists()) {
        setError("Meeting does not exist. Check the code or link.");
        setLoading(false);
        return;
      }

      const joinReqRef = doc(db, `meetings/${meetingId.trim()}/joinRequests`, user.uid);
      await setDoc(joinReqRef, {
        userId: user.uid,
        displayName: user.displayName || "Guest",
        photoURL: user.photoURL || "",
        status: "pending",
        createdAt: new Date(),
      });

      setLoading(false);
      onSent();
    } catch (err) {
      console.error("Error sending join request:", err);
      setError("Failed to send join request. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={handleAskToJoin}
        disabled={loading || disabled}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? "Sending Request..." : "Ask to Join"}
      </Button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}