
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function PreJoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const meetingId = searchParams.get("meetingId");
  const [topic, setTopic] = useState(searchParams.get("topic") || "Untitled Meeting");

  const [agreed, setAgreed] = useState(false);

  const handleJoinNow = () => {
    if (!meetingId) return;
    router.push(`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-6">
      <h2 className="text-2xl font-bold mb-6">Ready to Join?</h2>

      <div className="bg-gray-800 rounded-xl p-6 shadow-lg w-full max-w-md">
        <p className="mb-2">Meeting Topic</p>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full p-2 mb-4 rounded-md bg-gray-700 text-white"
        />

        <p className="mb-2">Meeting ID</p>
        <input
          type="text"
          value={meetingId || ""}
          disabled
          className="w-full p-2 mb-4 rounded-md bg-gray-700 text-white"
        />

        <label className="flex items-center space-x-2 mb-6">
          <input
            type="checkbox"
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
          />
          <span>I agree to the Terms of Service and Community Guidelines</span>
        </label>

        <Button
          onClick={handleJoinNow}
          disabled={!agreed}
          className={`w-full py-3 text-lg font-semibold rounded-xl ${
            agreed ? "bg-green-500 hover:bg-green-600" : "bg-green-900 opacity-50"
          }`}
        >
          Join Now
        </Button>
      </div>
    </div>
  );
}
