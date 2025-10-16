
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HostJoinRequestsListener({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!meetingId) return;

    const reqRef = collection(db, "meetings", meetingId, "joinRequests");
    const q = query(reqRef, where("status", "==", "pending"));

    const unsub = onSnapshot(q, (snap) => {
      const newReqs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRequests(newReqs);
    });

    return () => unsub();
  }, [meetingId]);

  const handleAccept = async (id: string) => {
    try {
        await updateDoc(doc(db, "meetings", meetingId, "joinRequests", id), {
            status: "approved",
        });
        const req = requests.find(r => r.id === id);
        if (req) {
            toast({title: "Request Approved", description: `${req.participantName} will now join the meeting.`});
        }
    } catch (error) {
        console.error("Failed to approve request", error);
        toast({variant: "destructive", title: "Error", description: "Could not approve the request."});
    }
  };

  const handleDecline = async (id: string) => {
    try {
        await updateDoc(doc(db, "meetings", meetingId, "joinRequests", id), {
            status: "declined",
        });
        const req = requests.find(r => r.id === id);
        if (req) {
            toast({variant: "destructive", title: "Request Declined", description: `${req.participantName} was denied entry.`});
        }
    } catch (error) {
        console.error("Failed to decline request", error);
        toast({variant: "destructive", title: "Error", description: "Could not decline the request."});
    }
  };

  if (requests.length === 0) return null;

  const currentRequest = requests[0]; // Show one at a time

  return (
    <div
      key={currentRequest.id}
      className="fixed top-20 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-xl shadow-2xl p-4 z-50 w-full max-w-md border border-border animate-in fade-in-0 slide-in-from-top-5 duration-300"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentRequest.userPhotoURL} alt={currentRequest.participantName} data-ai-hint="avatar user"/>
            <AvatarFallback>
              {currentRequest.participantName?.charAt(0) || "G"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-foreground">Join Request</h4>
            <p className="text-sm text-muted-foreground">
              {currentRequest.participantName} wants to join.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleAccept(currentRequest.id)}
            className="px-4 h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <Check className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDecline(currentRequest.id)}
            className="px-4 h-9 rounded-lg"
          >
            <X className="mr-1.5 h-4 w-4" />
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}
