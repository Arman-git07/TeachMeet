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
  authorId: string; // Required for security rules
  isAudio?: boolean;
};

export async function postAnnouncement({ classId, text, audioUrl, vanishAt, creatorId, creatorName, authorId, isAudio }: PostAnnouncementArgs) {
  if (!creatorId) throw new Error("Not signed in.");

  const payload: any = {
    creatorId: creatorId,
    creatorName: creatorName,
    createdAt: serverTimestamp(),
    authorId: authorId,
  };

  if (isAudio && audioUrl) {
    payload.audioUrl = audioUrl;
    payload.type = 'audio';
    payload.text = text; // Can still contain the transcript or title
  } else if (text && text.trim()) {
    payload.text = text.trim();
    payload.type = 'text';
  } else {
    throw new Error("Announcement content is empty.");
  }

  if (vanishAt) {
    payload.vanishAt = Timestamp.fromDate(vanishAt);
  }

  await addDoc(collection(db, "classrooms", classId, "announcements"), payload);
}
