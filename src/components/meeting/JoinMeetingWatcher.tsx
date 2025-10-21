
"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface Props {
  meetingId: string;
}

export default function JoinMeetingWatcher({ meetingId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !meetingId) return;

    // This is the corrected path. It now correctly points to the subcollection
    // within the specific meeting document, which is where the host approves the request.
    const ref = doc(db, `meetings/${meetingId}/joinRequests`, user.uid);
    
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "approved") {
          toast({ title: "Approved!", description: "The host has let you in." });
          // Redirect to the actual meeting page
          router.push(`/dashboard/meeting/${meetingId}`);
        } else if (data.status === "denied") {
          toast({ variant: "destructive", title: "Request Denied", description: "The host has denied your request to join."});
          // Redirect back to the main dashboard after a delay
          setTimeout(() => router.push('/dashboard'), 3000);
        }
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsub();
  }, [user, meetingId, router, toast]);

  // This component does not render anything in the UI
  return null;
}
