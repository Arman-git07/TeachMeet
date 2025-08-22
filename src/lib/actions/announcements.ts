// src/lib/actions/announcements.ts
'use server';

import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type PostAnnouncementArgs = {
  classId: string;
  text?: string;
  audioUrl?: string;
  vanishAt?: Date | null;
  creatorId: string;
  creatorName: string;
};

export async function postAnnouncement({ classId, text, audioUrl, vanishAt, creatorId, creatorName }: PostAnnouncementArgs) {
  if (!creatorId) throw new Error("Not signed in.");

  const payload: any = {
    creatorId: creatorId,
    creatorName: creatorName,
    createdAt: serverTimestamp(),
  };

  if (text && text.trim()) {
    payload.text = text.trim();
    payload.type = 'text';
  } else if (audioUrl) {
    payload.audioUrl = audioUrl;
    payload.type = 'audio';
  } else {
    throw new Error("Announcement content is empty.");
  }

  if (vanishAt) {
    payload.vanishAt = Timestamp.fromDate(vanishAt);
  }

  await addDoc(collection(db, "classrooms", classId, "announcements"), payload);
}
