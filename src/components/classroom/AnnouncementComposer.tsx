"use client";

import React from "react";
import { db, storage, auth } from "@/lib/firebase"; // <-- keep your existing exports
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mic, StopCircle, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Restores the announcement posting controls:
 * - text input
 * - voice record (mic) -> uploads audio/webm to Storage
 * - optional vanish date/time
 * - Post button -> writes to /classrooms/{classId}/announcements
 *
 * Props:
 *   classId: the classroom id (required)
 *   canPost: whether the composer is enabled (owner/teacher). If omitted, it's enabled.
 */
export default function AnnouncementComposer({
  classId,
  canPost = true,
}: {
  classId: string;
  canPost?: boolean;
}) {
  const [text, setText] = React.useState("");
  const [vanishAt, setVanishAt] = React.useState<string>(""); // HTML datetime-local string
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  // Voice recorder
  const [recording, setRecording] = React.useState(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  // Start recording from mic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic permission / recording error:", err);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone permissions in your browser settings.",
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    setRecording(false);
  };

  // Remove recorded audio (if user re-records)
  const clearAudio = () => setAudioBlob(null);

  const handlePost = async () => {
    if (!canPost) return;

    const user = auth?.currentUser;
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Signed In",
        description: "Please sign in to post announcements.",
      });
      return;
    }

    // Require at least text OR audio
    if (!text.trim() && !audioBlob) {
      toast({
        variant: "destructive",
        title: "Empty Announcement",
        description: "Please type a message or record a voice note to post.",
      });
      return;
    }

    setLoading(true);
    try {
      let audioUrl: string | null = null;

      if (audioBlob) {
        const path = `announcements/${classId}/${user.uid}/${Date.now()}.webm`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, audioBlob, { contentType: "audio/webm" });
        audioUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "classrooms", classId, "announcements"), {
        text: text.trim() || null,
        audioUrl,
        type: audioUrl ? 'audio' : 'text',
        vanishAt: vanishAt ? new Date(vanishAt) : null,
        creatorName: user.displayName || "Teacher",
        creatorId: user.uid,
        authorId: user.uid, // for security rules
        createdAt: serverTimestamp(),
      });

      // reset ui
      setText("");
      setVanishAt("");
      setAudioBlob(null);
      toast({ title: "Announcement posted!" });
    } catch (err) {
      console.error("Failed to post announcement:", err);
      toast({
        variant: "destructive",
        title: "Failed to Post Announcement",
        description: "Check your permissions (Firestore rules) and console for details.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canPost) return null;

  return (
    <div className="rounded-xl border bg-muted/30 p-4 shadow-sm space-y-3">
      <Textarea
        value={text}
        disabled={!canPost || loading}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your announcement here..."
        className="w-full resize-none rounded-lg bg-background p-3 placeholder-muted-foreground ring-1 ring-border focus:ring-2 focus:ring-primary"
        rows={4}
      />
      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPost || loading}
            onClick={startRecording}
            className="inline-flex items-center gap-2 rounded-lg"
            title="Record voice note"
          >
            <Mic className="h-4 w-4" /> Record
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-lg"
            title="Stop recording"
          >
            <StopCircle className="h-4 w-4" /> Stop
          </Button>
        )}
        {audioBlob && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm text-primary ring-1 ring-border">
            Voice note ready ({Math.ceil(audioBlob.size / 1024)} KB)
            <Button
              variant="ghost"
              size="icon"
              onClick={clearAudio}
              className="ml-2 rounded-full h-6 w-6 text-destructive/70 hover:text-destructive"
              title="Remove voice note"
            >
              <Trash2 className="h-4 w-4"/>
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Label htmlFor="vanishDate" className="text-sm text-muted-foreground sr-only">Vanish Date</Label>
          <Input
            id="vanishDate"
            type="datetime-local"
            value={vanishAt}
            disabled={!canPost || loading}
            onChange={(e) => setVanishAt(e.target.value)}
            className="rounded-lg bg-background p-2 ring-1 ring-border w-auto"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={!canPost || loading || (!text.trim() && !audioBlob)}
          onClick={handlePost}
          className="rounded-lg btn-gel"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
          {loading ? "Posting..." : "Post Announcement"}
        </Button>
      </div>
    </div>
  );
}
