"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where, doc, writeBatch, serverTimestamp, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X, Volume2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
  const [audioBlocked, setAudioBlocked] = useState(false);
  
  useEffect(() => {
    audioRef.current = new Audio("/sounds/join-request.mp3");
    audioRef.current.volume = 0.75;
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setAudioBlocked(false);
        }).catch(error => {
          if (error.name === 'NotAllowedError') {
            setAudioBlocked(true);
          }
        });
      }
    }
  }, []);
  
  const handleManualPlaySound = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound();
  };

  useEffect(() => {
    if (!meetingId) return;
    const q = query(collection(db, "meetings", meetingId, "joinRequests"), where("status", "==", "pending"));

    const unsub = onSnapshot(q, (snap) => {
      const pendingReqs = snap.docs.map((d) => ({ id: d.id, ...d.data(), userId: d.id } as JoinRequest));
      
      const newRequests = pendingReqs.filter(req => !playedSoundRef.current[req.id]);

      if (newRequests.length > 0) {
        setRequests(prev => {
            const next = [...prev];
            newRequests.forEach(nr => {
                if (!next.find(r => r.id === nr.id)) next.push(nr);
            });
            return next.slice(-3); // Keep only latest 3 to prevent clutter
        });
        
        newRequests.forEach((req) => {
          if (!playedSoundRef.current[req.id]) {
            playSound();
            playedSoundRef.current[req.id] = true;
          }
        });
      } else {
        const currentRequestIds = new Set(pendingReqs.map(r => r.id));
        setRequests(prev => prev.filter(r => currentRequestIds.has(r.id)));
      }
    });

    return () => unsub();
  }, [meetingId, playSound]);

  const handleRequest = async (req: JoinRequest, action: 'approve' | 'deny') => {
    const isApprove = action === 'approve';
    try {
      const joinRequestRef = doc(db, "meetings", meetingId, "joinRequests", req.userId);
  
      if (isApprove) {
        // FRESH VALIDATION: Ensure the participant is still connected and waiting
        const snap = await getDoc(joinRequestRef);
        if (!snap.exists()) {
          toast({ variant: "destructive", title: "Request Gone", description: "This request is no longer valid." });
          setRequests(prev => prev.filter(r => r.id !== req.id));
          return;
        }

        const data = snap.data();
        const now = Date.now();
        const lastBeat = data.lastHeartbeat?.toMillis() || 0;

        // Verify status is still pending and heartbeat is recent (within 12 seconds)
        if (data.status !== 'pending' || (now - lastBeat > 12000)) {
          await updateDoc(joinRequestRef, { status: "cancelled" });
          toast({ variant: "destructive", title: "Participant Left", description: "The user is no longer in the waiting area." });
          setRequests(prev => prev.filter(r => r.id !== req.id));
          return;
        }

        const participantRef = doc(db, "meetings", meetingId, "participants", req.userId);
        const batch = writeBatch(db);
        batch.set(participantRef, {
          name: req.userName || "Guest",
          photoURL: req.userPhotoURL || "",
          joinedAt: serverTimestamp(),
          isHost: false,
          isCameraOn: false,
          isMicOn: false,
        });
        batch.delete(joinRequestRef);
        await batch.commit();
        toast({ title: "Request Accepted", description: `${req.userName} has joined the meeting.` });
      } else {
        await updateDoc(joinRequestRef, { status: "denied" });
        toast({ variant: "destructive", title: "Request Denied", description: `${req.userName} was denied access.` });
      }
  
      setRequests(prev => prev.filter(r => r.id !== req.id));
  
    } catch (error) {
      console.error(`handle ${action} failed:`, error);
      toast({ variant: "destructive", title: "Action Failed" });
    }
  };

  if (!requests.length) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-md flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {requests.map((req) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="pointer-events-auto bg-background/90 text-foreground backdrop-blur-md rounded-2xl shadow-2xl border border-primary/20 p-4 flex flex-col sm:flex-row items-center gap-4 overflow-hidden"
          >
            <div className="flex items-center gap-3 w-full sm:flex-1">
              <div className="relative shrink-0">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={req.userPhotoURL} alt={req.userName} data-ai-hint="avatar user"/>
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{req.userName?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full border-2 border-background">
                    <UserPlus size={10} />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold truncate leading-tight">Join Request</span>
                <span className="text-xs text-muted-foreground truncate">{req.userName || "A user"} wants to join</span>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              {audioBlocked && (
                  <Button
                      size="sm"
                      variant="outline"
                      onClick={handleManualPlaySound}
                      className="h-9 px-3 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                      <Volume2 size={16} />
                  </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleRequest(req, 'deny')}
                className="h-9 px-4 sm:px-5 rounded-xl flex items-center gap-2 flex-1 sm:flex-none font-bold"
              >
                <X size={16} /> <span className="sm:hidden">Decline</span>
              </Button>
              <Button
                size="sm"
                onClick={() => handleRequest(req, 'approve')}
                className="btn-gel h-9 px-4 sm:px-5 rounded-xl flex items-center gap-2 flex-1 sm:flex-none font-bold"
              >
                <Check size={16} /> <span className="sm:hidden">Accept</span>
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
