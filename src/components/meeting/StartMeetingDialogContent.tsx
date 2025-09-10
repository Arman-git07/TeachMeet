
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartMeeting = async () => {
    if (!topic.trim()) {
      toast({
        variant: "destructive",
        title: "Topic Required",
        description: "Please enter a topic for the meeting.",
      });
      return;
    }
    setLoading(true);
    // In a real app, you'd create a meeting on the backend and get an ID
    // For this prototype, we'll simulate it and redirect to a pre-join page
    // The pre-join page will handle the actual meeting "creation" for now
    const prejoinPath = `/dashboard/meeting/prejoin?topic=${encodeURIComponent(topic.trim())}`;
    router.push(prejoinPath);
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
