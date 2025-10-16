
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X } from "lucide-react";

export default function JoinRequestListener({ meetingId, hostId }: { meetingId: string, hostId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!hostId) return;

    // ✅ Host only receives requests where they are the meeting host
    const q = query(collection(db, "joinRequests"), where("hostId", "==", hostId), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    });

    return () => unsub();
  }, [hostId]);


  const handleApprove = async (req: any) => {
    try {
      // ✅ add participant
      await setDoc(doc(db, "meetings", req.meetingId, "participants", req.userId), {
        userId: req.userId,
        name: req.displayName,
        photoURL: req.photoURL,
        joinedAt: serverTimestamp(),
      });

      // ✅ remove request after approval
      await deleteDoc(doc(db, "joinRequests", req.id));

      toast({
        title: "Participant Approved",
        description: `${req.displayName} has been allowed to join the meeting.`,
      });
    } catch (err: any) {
      console.error("Failed to approve request:", err);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: "Please try again.",
      });
    }
  };
  
  const handleDeny = async (req: any) => {
    try {
        await deleteDoc(doc(db, "joinRequests", req.id));
        toast({
            variant: "destructive",
            title: "Request Denied",
            description: `${req.displayName} has been denied entry.`
        });
    } catch (err) {
        console.error("Failed to deny request:", err);
        toast({
            variant: "destructive",
            title: "Action Failed",
            description: "Could not deny the request."
        });
    }
  }

  const currentRequest = requests.length > 0 ? requests[0] : null;

  if (!currentRequest) {
    return null;
  }

  return (
    <div
      key={currentRequest.id}
      className="fixed top-20 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-xl shadow-2xl p-4 z-50 w-full max-w-md border border-border"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentRequest.photoURL} alt={currentRequest.displayName} data-ai-hint="avatar user"/>
            <AvatarFallback>
              {currentRequest.displayName?.charAt(0) || "G"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-foreground">Join Request</h4>
            <p className="text-sm text-muted-foreground">
              {currentRequest.displayName} wants to join the meeting.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleApprove(currentRequest)}
            className="px-4 h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <Check className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDeny(currentRequest)}
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
