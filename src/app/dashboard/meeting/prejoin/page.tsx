"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy, Share2, VideoOff, MicOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PreJoinPage() {
  const [agreed, setAgreed] = useState(false);
  const [title, setTitle] = useState("Untitled Meeting");
  const [advanced, setAdvanced] = useState(false);
  const router = useRouter();

   return (
     <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1c] text-white px-4">
       <Card className="w-full max-w-md bg-[#101726] border border-[#1f2a40] shadow-lg">
         <CardContent className="p-6">
           {/* Title */}
           <h2 className="text-2xl font-semibold text-center mb-6 text-green-400">
             Ready to Join?
           </h2>
           <p className="text-center text-sm text-gray-400 mb-6">
             Check your camera and mic before joining.
           </p>

           {/* Camera & Mic Preview */}
           <div className="w-full h-40 bg-[#0d1422] rounded-lg flex items-center justify-center mb-6">
             <div className="flex flex-col items-center text-red-500">
               <VideoOff className="w-8 h-8 mb-2" />
               <MicOff className="w-8 h-8 mb-2" />
               <p className="text-sm text-center">
                 Permissions Denied <br />
                 Enable camera & mic in browser settings
               </p>
             </div>
           </div>

           {/* Meeting Title */}
           <Input
             value={title}
             onChange={(e) => setTitle(e.target.value)}
             className="bg-[#0d1422] border border-[#1f2a40] text-white mb-6"
             placeholder="Meeting Title"
           />

           {/* Advanced Settings */}
           <div className="flex items-center justify-between mb-6">
             <span className="text-sm text-gray-300">Advanced Settings</span>
             <Switch checked={advanced} onCheckedChange={setAdvanced} />
           </div>

           {/* Invite Section */}
           <div className="space-y-4 mb-6">
             <div className="flex items-center justify-between bg-[#0d1422] p-2 rounded-lg">
               <span className="text-gray-400 text-sm">Meeting ID</span>
               <Button variant="ghost" size="icon">
                 <Copy className="w-4 h-4 text-green-400" />
               </Button>
             </div>
             <div className="flex items-center justify-between bg-[#0d1422] p-2 rounded-lg">
               <span className="text-gray-400 text-sm">Invite Link</span>
               <Button variant="ghost" size="icon">
                 <Share2 className="w-4 h-4 text-green-400" />
               </Button>
             </div>
           </div>

           {/* Terms of Service */}
           <div className="flex items-center gap-2 mb-6">
             <input
               type="checkbox"
               id="tos"
               checked={agreed}
               onChange={(e) => setAgreed(e.target.checked)}
               className="w-4 h-4 accent-green-500"
             />
             <label htmlFor="tos" className="text-sm text-gray-300">
               I agree to the{" "}
               <span className="text-green-400">Terms of Service</span> and{" "}
               <span className="text-green-400">Community Guidelines</span>.
             </label>
           </div>

           {/* Join Button */}
           <Button
             disabled={!agreed}
             className={`w-full py-6 rounded-xl font-semibold shadow-lg transition-colors ${
               agreed
                 ? "bg-green-500 hover:bg-green-600 text-white"
                 : "bg-green-800 text-green-300 cursor-not-allowed"
             }`}
           >
             Join Now as Host
           </Button>

           {/* Cancel */}
            <button 
              onClick={() => router.push('/')}
              className="mt-4 w-full text-gray-400 text-sm hover:underline">
             Cancel and go to Homepage
           </button>
         </CardContent>
       </Card>
     </div>
   );
}