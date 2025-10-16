
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { doc, setDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AskToJoinButton({ disabled }: { disabled: boolean }) {
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending" | "sent" | "approved" | "declined" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const meetingId = params.get("meetingId");
  const topic = params.get("topic") || "TeachMeet Meeting";
  const { toast } = useToast();

  const handleAskToJoin = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !meetingId) {
        toast({variant: "destructive", title: "Error", description: "Missing user or meeting ID."});
        return;
    };

    setRequestStatus("sending");
    setStatusMessage("Sending request...");

    const requestRef = doc(db, "meetings", meetingId, "joinRequests", user.uid);

    try {
        // Send join request
        await setDoc(requestRef, {
            participantId: user.uid,
            participantName: user.displayName || "Guest",
            userPhotoURL: user.photoURL || "",
            status: "pending",
            requestedAt: new Date(),
        });

        setRequestStatus("sent");
        setStatusMessage("Request sent to host. Waiting for approval...");
        toast({title: "Request Sent", description: "The host has been notified."});

        // Listen for approval
        const unsub = onSnapshot(requestRef, (snap) => {
        const data = snap.data();
        if (!data) { // Document was deleted (e.g., by host UI cleanup)
            unsub();
            if(requestStatus !== 'approved') {
                setRequestStatus("idle");
                setStatusMessage("Your request was cancelled or the meeting ended.");
            }
            return;
        }

        if (data.status === "approved") {
            setRequestStatus("approved");
            setStatusMessage("Host approved. Joining meeting...");
            toast({title: "Approved!", description: "You are now joining the meeting."});
            unsub();
            // Clean up the request doc after approval
            deleteDoc(requestRef).catch(console.error);
            router.push(`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`);
        } else if (data.status === "declined") {
            setRequestStatus("declined");
            setStatusMessage("Host declined your request. You can ask to join again.");
            toast({variant: "destructive", title: "Request Declined", description: "The host has declined your request to join."});
            unsub();
             // Clean up the request doc after decline
            deleteDoc(requestRef).catch(console.error);
        }
        });
    } catch (error: any) {
        console.error("Failed to send join request:", error);
        setRequestStatus("error");
        setStatusMessage("Failed to send request. Please try again.");
        toast({variant: "destructive", title: "Request Failed", description: error.message});
    }
  };

  const renderButton = () => {
    switch (requestStatus) {
        case "sending":
        case "sent":
            return (
                <Button disabled className="w-full py-3 text-lg font-semibold rounded-xl bg-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                    Request Sent, Waiting...
                </Button>
            );
        case "approved":
             return (
                <Button disabled className="w-full py-3 text-lg font-semibold rounded-xl bg-green-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                    Joining...
                </Button>
            );
        case "declined":
        case "error":
             return (
                <Button onClick={handleAskToJoin} disabled={disabled} className={cn("w-full py-3 text-lg font-semibold rounded-xl", disabled ? "bg-green-900/50 text-green-100/70 cursor-not-allowed" : "btn-gel")}>
                    Ask to Join Again
                </Button>
            );
        case "idle":
        default:
             return (
                <Button onClick={handleAskToJoin} disabled={disabled} className={cn("w-full py-3 text-lg font-semibold rounded-xl", disabled ? "bg-green-900/50 text-green-100/70 cursor-not-allowed" : "btn-gel")}>
                    Ask to Join
                </Button>
            );
    }
  }


  return (
    <div className="flex flex-col items-center gap-3 w-full">
        {renderButton()}
        {statusMessage && <p className="text-sm text-muted-foreground mt-2">{statusMessage}</p>}
    </div>
  );
}
