
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where, doc, writeBatch, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  meetingId?: string;
}

export default function HostJoinRequestNotification({ meetingId }: { meetingId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const { toast } = useToast();
  const playedSoundRef = useRef<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const hostId = user?.uid;
  const [canAutoplay, setCanAutoplay] = useState(false);

  useEffect(() => {
    // Preload the audio element for faster playback
    audioRef.current = new Audio("/sounds/join-request.mp3");
    audioRef.current.volume = 0.75;
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setCanAutoplay(true);
      }).catch(error => {
        console.warn("Audio playback failed. This can happen if the user hasn't interacted with the page yet.", error);
        setCanAutoplay(false); // Explicitly set to false on failure
      });
    }
  }, []);


  useEffect(() => {
    if (!meetingId) return;
    const q = query(collection(db, "meetings", meetingId, "joinRequests"), where("status", "==", "pending"));

    const unsub = onSnapshot(q, (snap) => {
      const pendingReqs = snap.docs.map((d) => ({ id: d.id, ...d.data(), userId: d.id } as JoinRequest));
      
      const newRequests = pendingReqs.filter(req => !requests.some(r => r.id === req.id));

      if (newRequests.length > 0) {
        setRequests(prev => [...prev, ...newRequests].slice(-3)); // Keep it from getting too long
        
        newRequests.forEach((req) => {
          if (!playedSoundRef.current[req.id]) {
            if (canAutoplay) {
              playSound();
            }
            playedSoundRef.current[req.id] = true;
          }
        });
      } else {
        // This handles removals (when requests are approved/denied)
        setRequests(pendingReqs);
      }
    });

    return () => unsub();
  }, [meetingId, canAutoplay, playSound, requests]);

  const handleRequest = async (req: JoinRequest, action: 'approve' | 'deny') => {
    const isApprove = action === 'approve';
    try {
      const joinRequestRef = doc(db, "meetings", meetingId, "joinRequests", req.userId);
  
      if (isApprove) {
        const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);
        const batch = writeBatch(db);
        batch.set(participantRef, {
          name: req.userName || "Guest",
          photoURL: req.userPhotoURL || "",
          joinedAt: serverTimestamp(),
          isHost: false,
        });
        batch.delete(joinRequestRef);
        await batch.commit();
        toast({ title: "Request Approved", description: `${req.userName} can now join the meeting.` });
      } else {
        await updateDoc(joinRequestRef, { status: "denied" });
        toast({ variant: "destructive", title: "Request Denied", description: `${req.userName} was denied access.` });
      }
  
      // Remove from local state immediately for faster UI feedback
      setRequests(prev => prev.filter(r => r.id !== req.id));
  
    } catch (error) {
      console.error(`❌ handle ${action} failed:`, error);
      toast({ variant: "destructive", title: "Action Failed", description: `Could not ${action} the request.` });
    }
  };


  if (!requests.length) return null;

  return (
    <>
      {requests.map((req) => (
        <div
          key={req.id}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-background/80 text-foreground backdrop-blur-sm rounded-2xl shadow-2xl border border-primary/30 px-6 py-4 flex items-center justify-between w-[90%] max-w-lg animate-slideDown"
        >
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/50">
              <AvatarImage src={req.userPhotoURL} alt={req.userName} data-ai-hint="avatar user"/>
              <AvatarFallback>{req.userName?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-lg font-semibold">Join Request</span>
              <span className="text-sm text-muted-foreground">{req.userName || "A participant"} wants to join.</span>
            </div>
          </div>
          <div className="flex gap-3 items-center">
             {!canAutoplay && requests.length > 0 && (
              <button onClick={playSound} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                  <Volume2 size={18} /> Play Sound
              </button>
            )}
            <button
              onClick={() => handleRequest(req, 'approve')}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2"
            >
              <Check size={18} /> Approve
            </button>
            <button
              onClick={() => handleRequest(req, 'deny')}
              className="bg-destructive hover:bg-destructive/90 text-white px-4 py-2 rounded-xl flex items-center gap-2"
            >
              <X size={18} /> Decline
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
