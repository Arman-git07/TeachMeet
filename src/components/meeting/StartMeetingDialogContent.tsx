
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Loader2, Video } from "lucide-react";

export function StartMeetingDialogContent() {
  const router = useRouter();
  const { user } = useAuth(); // Use `user` from your auth hook
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartMeeting = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "You must be signed in to start a meeting.",
      });
      return;
    }
    if (!topic.trim()) {
      toast({
        variant: "destructive",
        title: "Topic Required",
        description: "Please enter a topic for the meeting.",
      });
      return;
    }
    try {
      setLoading(true);

      // Generate a unique meeting ID
      const meetingId = "meeting-" + crypto.randomUUID().slice(0,11);
      const meetingRef = doc(db, "meetings", meetingId);

      // Create the Firestore meeting document
      await setDoc(meetingRef, {
        hostId: user.uid,
        topic: topic.trim() || "Untitled Meeting",
        createdAt: serverTimestamp(),
      });

      // Redirect to the prejoin page, passing the new meetingId and topic
      router.push(
        `/dashboard/meeting/prejoin?meetingId=${meetingId}&topic=${encodeURIComponent(
          topic.trim() || "Untitled Meeting"
        )}`
      );
    } catch (err) {
      console.error("Failed to create meeting:", err);
      toast({
        variant: "destructive",
        title: "Failed to Create Meeting",
        description: "Please check your Firestore rules and try again.",
      });
      setLoading(false);
    }
  };

  return (
     <>
        <DialogHeader>
          <DialogTitle>
            <Video className="mr-2 h-6 w-6 text-primary inline-block" />
            Start a New Meeting
          </DialogTitle>
          <DialogDescription>
            Enter a topic for your meeting, then proceed to set up your devices before joining.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <Label htmlFor="meetingTopicDialog" className="sr-only">
              Meeting Topic
            </Label>
            <Input
                id="meetingTopicDialog"
                placeholder="Enter meeting topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-md border p-2"
                disabled={loading}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                    e.preventDefault();
                    handleStartMeeting();
                    }
                }}
            />
        </div>
        <DialogFooter>
             <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-lg" disabled={loading}>
                Cancel
                </Button>
            </DialogClose>
            <Button onClick={handleStartMeeting} disabled={loading || !topic.trim()} className="btn-gel rounded-lg">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</> : "Start Meeting"}
            </Button>
        </DialogFooter>
    </>
  );
}
