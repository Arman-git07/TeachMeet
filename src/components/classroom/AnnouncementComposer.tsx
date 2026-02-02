
"use client";

import React from "react";
import { db, storage, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
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
    
    if (!vanishAt) {
        toast({
            variant: "destructive",
            title: "Vanish Date Required",
            description: "Please select a date and time for the announcement to disappear.",
        });
        return;
    }

    setLoading(true);
    const toastHandle = toast({ id: `announcement-post-${Date.now()}`, title: "Posting Announcement...", duration: Infinity });
    
    try {
      let audioUrl: string | null = null;
      let storagePath: string | null = null; 

      if (audioBlob) {
        const path = `announcements/${classId}/${user.uid}/${Date.now()}.webm`;
        const audioStorageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(audioStorageRef, audioBlob, { contentType: "audio/webm" });

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
             if (toastHandle.update) {
                toastHandle.update({ description: `Uploading audio... ${Math.round(progress)}%` });
            }
          },
          (error) => {
            // This is the error handler for the upload task itself
            throw error; // Re-throw to be caught by the outer try-catch
          }
        );

        await uploadTask;
        audioUrl = await getDownloadURL(audioStorageRef);
        storagePath = path;
      }

      await addDoc(collection(db, "classrooms", classId, "announcements"), {
        text: text.trim() || null,
        audioUrl,
        storagePath,
        type: audioUrl ? 'audio' : 'text',
        vanishAt: new Date(vanishAt),
        creatorName: user.displayName || "Teacher",
        creatorId: user.uid,
        authorId: user.uid, // for security rules
        createdAt: serverTimestamp(),
      });

      // reset ui
      setText("");
      setVanishAt("");
      setAudioBlob(null);
       if (toastHandle.update) {
        toastHandle.update({ title: "Announcement posted!", description: "" });
      }
    } catch (error: any) {
      console.error("Failed to post announcement:", error);
      let title = "Failed to Post Announcement";
      let description = "An unknown error occurred. Please try again.";

      if (error.code) {
        if (error.code.startsWith('auth/requests-to-this-api')) {
            title = "API Key Configuration Error";
            description = "Could not connect to Firebase services. This is likely an API key configuration issue.";
        } else if (error.code === 'storage/unauthorized') {
            title = "Storage Permission Denied";
            description = "You do not have permission to upload files. Please check your Storage security rules.";
        } else if (error.code === 'permission-denied') {
            title = "Permission Denied";
            description = "You do not have permission to post an announcement. Check Firestore security rules."
        }
      }

       if (toastHandle.update) {
        toastHandle.update({
          variant: "destructive",
          title: title,
          description: description,
          duration: 9000,
        });
      }
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
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between mt-2">
        <div className="flex items-center gap-2 w-full sm:flex-1 sm:min-w-0">
          <Label htmlFor="vanishDate" className="text-sm text-muted-foreground">Vanish Date*</Label>
          <Input
            id="vanishDate"
            type="datetime-local"
            value={vanishAt}
            disabled={!canPost || loading}
            onChange={(e) => setVanishAt(e.target.value)}
            className="rounded-lg bg-background p-2 ring-1 ring-border flex-1 min-w-0"
            required
          />
        </div>
         <Button
          type="button"
          disabled={!canPost || loading || ((!text.trim() && !audioBlob) || !vanishAt)}
          onClick={handlePost}
          className="rounded-lg btn-gel w-full sm:w-auto sm:flex-shrink-0"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
          {loading ? "Posting..." : "Post Announcement"}
        </Button>
      </div>
    </div>
  );
}
