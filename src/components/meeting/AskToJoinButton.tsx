
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const requestRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);

    try {
      // This is the critical write operation.
      // It creates a document with status: "pending" at the correct path.
      await setDoc(requestRef, {
        userId: user.uid,
        displayName: user.displayName || "Guest User",
        photoURL: user.photoURL || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setRequestStatus("sent");
      toast({ title: "Request Sent!", description: "The host has been notified. Please wait for approval." });

    } catch (error: any) {
      console.error("Failed to send join request:", error);
      setRequestStatus("idle"); // Reset button on error
      toast({ variant: "destructive", title: "Request Failed", description: "Could not send join request. Please check console for details." });
    }
  };

  const renderButtonContent = () => {
    switch (requestStatus) {
      case "sending":
        return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>;
      case "sent":
        return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Waiting for Host...</>;
      default:
        return "Ask to Join";
    }
  };

  return (
    <Button 
      onClick={handleAskToJoin} 
      disabled={disabled || requestStatus !== 'idle'} 
      className={cn("w-full py-3 text-lg font-semibold rounded-xl", disabled ? "bg-green-900/50 text-green-100/70 cursor-not-allowed" : "btn-gel")}
    >
      {renderButtonContent()}
    </Button>
  );
}
