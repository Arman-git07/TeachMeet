"use client";

import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AskToJoinButtonProps {
  meetingId: string;
  onSent: () => void;
  disabled?: boolean;
}

export default function AskToJoinButton({ meetingId, onSent, disabled }: AskToJoinButtonProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAskToJoin = async () => {
    if (!user) {
      setError("You must be signed in to join a meeting.");
      toast({ variant: "destructive", title: "Not Signed In", description: "Please sign in to request to join."});
      return;
    }

    if (!meetingId) {
      setError("Meeting ID is missing.");
      toast({ variant: "destructive", title: "Error", description: "No meeting ID was provided."});
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const meetingRef = doc(db, "meetings", meetingId);
      const meetingSnap = await getDoc(meetingRef);

      if (!meetingSnap.exists()) {
        setError("Meeting does not exist. Check the code or link.");
        toast({ variant: "destructive", title: "Meeting Not Found", description: "The meeting you are trying to join does not exist."});
        setLoading(false);
        return;
      }

      // CORRECTED PATH: Use the sub-collection under the specific meeting document.
      const joinReqRef = doc(db, `meetings/${meetingId}/joinRequests`, user.uid);
      await setDoc(joinReqRef, {
        userId: user.uid,
        userName: user.displayName || "Guest",
        userPhotoURL: user.photoURL || "",
        status: "pending",
        requestedAt: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
      });

      setLoading(false);
      onSent();
    } catch (err) {
      console.error("Error sending join request:", err);
      setError("Failed to send join request. Please try again.");
      toast({ variant: "destructive", title: "Request Failed", description: "Could not send join request. Check permissions and network."});
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button
        onClick={handleAskToJoin}
        disabled={loading || disabled}
        className={cn("w-full py-3 text-lg font-semibold rounded-xl", !disabled && "btn-gel")}
      >
        {loading ? "Sending Request..." : "Ask to Join"}
      </Button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
