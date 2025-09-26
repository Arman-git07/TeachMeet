
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-6">TeachMeet</h1>

      {/* Latest Activity Card */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md mb-6 text-center">
        <h2 className="text-green-400 text-lg font-semibold mb-2">
          Latest Activity
        </h2>
        <p className="text-gray-400">No recent activity.</p>
        <p className="text-gray-400">Start a new meeting to get started!</p>
      </div>

      {/* Start New Meeting Button */}
      <Button
        onClick={() => router.push("/dashboard/meeting/prejoin")}
        className="w-full max-w-md bg-green-500 hover:bg-green-600 text-white font-semibold py-6 rounded-xl shadow-lg transition duration-200"
      >
        + Start New Meeting
      </Button>
    </div>
  );
}
