"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

   return (
     <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1c] text-white px-4">
       <h1 className="text-4xl font-bold text-green-400 mb-10">TeachMeet</h1>

       <Card className="w-full max-w-md bg-[#101726] border border-[#1f2a40] shadow-lg">
         <CardContent className="p-6 text-center">
           <div className="flex flex-col items-center gap-3">
             <Clock className="text-green-400 w-10 h-10" />
             <h2 className="text-xl font-semibold text-green-400">Latest Activity</h2>
             <p className="text-gray-400 text-sm">
               No recent activity. Start a new meeting to get started!
             </p>
           </div>
         </CardContent>
       </Card>

       <div className="fixed bottom-6 w-full max-w-md px-4">
         <Button
           onClick={() => router.push("/dashboard/meeting/prejoin")}
           className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-6 rounded-xl shadow-lg"
         >
           + Start New Meeting
         </Button>
       </div>
     </div>
   );
}