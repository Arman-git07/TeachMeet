"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A self-contained button that handles the logic for a participant asking to join a meeting.
 * It checks if the meeting exists before sending a request.
 * It also manages its own loading/disabled state.
 */
export default function AskToJoinButton({ meetingId, disabled }: { meetingId: string; disabled: boolean }) {
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending" | "sent">("idle");
  const { toast } = useToast();

  const handleAskToJoin = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in to join a meeting." });
      return;
    }

    setRequestStatus("sending");

    try {
      // Ensure meeting exists (prevents accidental creation by participants)
      const meetingRef = doc(db, "meetings", meetingId);
      const meetingSnap = await getDoc(meetingRef);
      if (!meetingSnap.exists()) {
        toast({ variant: "destructive", title: "Meeting Not Found", description: "Please check the meeting code/link."});
        setRequestStatus("idle");
        return;
      }

      // Write join request with the fields host listener expects
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
      await setDoc(reqRef, {
        userId: user.uid,
        displayName: user.displayName || "Guest",
        photoURL: user.photoURL || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      
      setRequestStatus("sent");
      toast({ title: "Request Sent!", description: "The host has been notified. Please wait for approval." });

    } catch (err) {
      console.error("Ask to join failed:", err);
      toast({ variant: "destructive", title: "Request Failed", description: "Failed to send join request. Please try again." });
      setRequestStatus("idle");
    }
  };

  const renderButtonContent = () => {
    switch (requestStatus) {
      case "sending":
        return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>;
      case "sent":
        return <>Waiting for Host...</>;
      default:
        return "Ask to Join";
    }
  };

  return (
    <Button 
      onClick={handleAskToJoin} 
      disabled={disabled || requestStatus !== 'idle'} 
      className={cn("w-full py-3 text-lg font-semibold rounded-xl", {
        "bg-green-900/50 text-green-100/70 cursor-not-allowed": disabled,
        "btn-gel": !disabled && requestStatus === 'idle',
        "bg-yellow-600 hover:bg-yellow-700 cursor-wait": requestStatus === 'sent'
      })}
    >
      {renderButtonContent()}
    </Button>
  );
}
