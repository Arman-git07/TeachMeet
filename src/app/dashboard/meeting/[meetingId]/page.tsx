
"use client";

import { useParams, useSearchParams } from "next/navigation";

export default function MeetingPage() {
  const { meetingId } = useParams();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "Untitled Meeting";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Meeting Room</h1>
      <p className="text-lg mb-2">Topic: {topic}</p>
      <p className="text-sm text-gray-400">Meeting ID: {meetingId}</p>

      <div className="mt-6 p-6 bg-gray-800 rounded-xl shadow-lg">
        <p>🎥 Meeting content goes here (video, chat, etc.)</p>
      </div>
    </div>
  );
}
