"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import MeetingClient from "./MeetingClient";
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';


// --------------------------- Meeting Page ---------------------------
export default function MeetingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setHeaderContent } = useDynamicHeader();
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
  
  useEffect(() => {
    setHeaderContent(<span className="text-sm font-medium truncate">{topic}</span>);
    return () => setHeaderContent(null);
  }, [topic, setHeaderContent]);

  const handleLeave = async () => {
    if (user && meetingId) await deleteDoc(doc(db, "meetings", meetingId, "participants", user.uid)).catch(console.error);
    router.push("/");
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white flex flex-col">
      {meetingId && user?.uid && (
        <MeetingClient
          meetingId={meetingId}
          userId={user.uid}
          initialCamOn={params.get('cam') !== 'false'}
          initialMicOn={params.get('mic') !== 'false'}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
