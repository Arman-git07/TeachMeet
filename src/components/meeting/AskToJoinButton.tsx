
"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AskToJoinButtonProps {
  meetingId: string;
  disabled: boolean;
  onSuccess: () => void; // Callback to notify parent component
}

export default function AskToJoinButton({ meetingId, disabled, onSuccess }: AskToJoinButtonProps) {
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending">("idle");
  const { toast } = useToast();

  const handleAskToJoin = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in and have a valid meeting ID." });
      return;
    }

    setRequestStatus("sending");

    try {
      // CRITICAL: Verify the meeting document exists before sending a request.
      const meetingRef = doc(db, "meetings", meetingId);
      const meetingSnap = await getDoc(meetingRef);
      if (!meetingSnap.exists()) {
        toast({ variant: "destructive", title: "Meeting Not Found", description: "Please check the meeting code/link."});
        setRequestStatus("idle");
        return;
      }

      // Write the join request document to the correct path.
      const reqRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);
      await setDoc(reqRef, {
        userId: user.uid,
        displayName: user.displayName || "Guest",
        photoURL: user.photoURL || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      
      toast({ title: "Request Sent!", description: "The host has been notified. Please wait for approval." });
      onSuccess(); // Notify parent that the request was sent successfully

    } catch (err) {
      console.error("Ask to join failed:", err);
      toast({ variant: "destructive", title: "Request Failed", description: "Failed to send join request. Please check permissions and try again." });
      setRequestStatus("idle");
    }
  };

  const renderButtonContent = () => {
    switch (requestStatus) {
      case "sending":
        return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Request...</>;
      default:
        return "Ask to Join";
    }
  };

  return (
    <Button 
      onClick={handleAskToJoin} 
      disabled={disabled || requestStatus === 'sending'} 
      className={cn("w-full py-3 text-lg font-semibold rounded-xl", {
        "bg-green-900/50 text-green-100/70 cursor-not-allowed": disabled,
        "btn-gel": !disabled && requestStatus === 'idle',
      })}
    >
      {renderButtonContent()}
    </Button>
  );
}
