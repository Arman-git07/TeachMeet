
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Hand, Users, PhoneOff, ScreenShare, ScreenShareOff, MoreVertical, Brush, MessageSquare, PanelLeftOpen, Settings, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import MeetingClient from "./MeetingClient";
import { doc, onSnapshot, updateDoc, writeBatch, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';


// --------------------------- Meeting Page ---------------------------
export default function MeetingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setHeaderContent } = useDynamicHeader();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [meetingId, setMeetingId] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.indexOf('meeting') + 1];
      setMeetingId(id);
    }
  }, []);

  const topic = params.get('topic') || "TeachMeet Meeting";

  const handleLeave = async () => {
    if (user && meetingId) await deleteDoc(doc(db, "meetings", meetingId, "participants", user.uid)).catch(console.error);
    router.push("/");
  };
  
  useEffect(() => {
    setHeaderContent(<span className="text-sm font-medium truncate">{topic}</span>);
    return () => setHeaderContent(null);
  }, [topic, setHeaderContent]);

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
      <div className="relative flex-grow min-h-0">
        <MeetingClient
          meetingId={meetingId}
          userId={user?.uid || ''}
          initialCamOn={params.get('cam') === 'true'}
          initialMicOn={params.get('mic') !== 'false'}
          onLeave={handleLeave}
        />
      </div>
    </div>
  );
}
