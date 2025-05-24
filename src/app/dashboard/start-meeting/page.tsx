
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, XCircle, Video, Hash } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; 

export default function StartMeetingPage() {
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingCode, setMeetingCode] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("My TeachMeet Meeting"); 
  const { toast } = useToast();
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const randomString = (length: number) => Math.random().toString(36).substring(2, 2 + length);
    
    const newMeetingId = randomString(8);
    setMeetingId(newMeetingId);

    setMeetingLink(`https://teachmeet.example.com/join/${newMeetingId}`);
    
    const codePart1 = randomString(3);
    const codePart2 = randomString(3);
    const codePart3 = randomString(3);
    setMeetingCode(`${codePart1}-${codePart2}-${codePart3}`);
  }, []);

  const copyToClipboard = (textToCopy: string, type: "Link" | "Code") => {
    if (!textToCopy) {
        toast({ variant: "destructive", title: "Nothing to Copy", description: `${type} has not been generated yet.` });
        return;
    }
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast({ title: `${type} Copied!`, description: `Meeting ${type.toLowerCase()} copied to clipboard.` });
      })
      .catch(err => {
        console.error(`Failed to copy ${type.toLowerCase()}: `, err);
        toast({ variant: "destructive", title: "Copy Failed", description: `Could not copy the meeting ${type.toLowerCase()}.` });
      });
  };

  const handleShareInvite = () => {
    if (!meetingLink || !meetingCode) {
      toast({ variant: "destructive", title: "Cannot Share", description: "Meeting details are not yet generated." });
      return;
    }
    setIsSharePanelOpen(true);
  };

  return (
    <>
      <div className="container mx-auto py-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-lg shadow-xl rounded-xl border-border/50">
          <CardHeader className="text-center">
            <Video className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-2xl">Start a New Meeting</CardTitle>
            <CardDescription>Set a topic and share the invite to begin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="meetingTopic" className="block text-sm font-medium text-muted-foreground mb-1">
                Meeting Topic / Purpose
              </Label>
              <Input
                id="meetingTopic"
                placeholder="e.g., Weekly Sync, Project Brainstorm..."
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="rounded-lg text-base"
              />
            </div>

            <div>
              <Label htmlFor="meetingLink" className="block text-sm font-medium text-muted-foreground mb-1">
                Meeting Link
              </Label>
              <div className="flex items-center space-x-2">
                <input
                  id="meetingLink"
                  type="text"
                  readOnly
                  value={meetingLink || "Generating..."}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingLink, "Link")} aria-label="Copy link" disabled={!meetingLink}>
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="meetingCodeDisplay" className="block text-sm font-medium text-muted-foreground mb-1">
                Meeting Code
              </Label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-grow">
                  <Hash className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="meetingCodeDisplay"
                    type="text"
                    readOnly
                    value={meetingCode || "Generating..."}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingCode, "Code")} aria-label="Copy code" disabled={!meetingCode}>
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Button variant="outline" className="rounded-lg py-6 text-base" onClick={handleShareInvite} disabled={!meetingLink || !meetingCode}>
                <Share2 className="mr-2 h-5 w-5" />
                Share Invite
              </Button>
            </div>
            
            <Link href={meetingId ? `/dashboard/meeting/${meetingId}/wait` : "#"} passHref legacyBehavior>
               <Button className="w-full btn-gel text-lg py-3 rounded-lg" disabled={!meetingId}>
                  {meetingId ? "Join Meeting Now" : "Generating ID..."}
               </Button>
            </Link>

          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
              <Link href="/dashboard" passHref legacyBehavior>
                  <Button variant="ghost" className="text-muted-foreground hover:text-destructive rounded-lg">
                      <XCircle className="mr-2 h-5 w-5" />
                      Cancel
                  </Button>
              </Link>
          </CardFooter>
        </Card>
      </div>
      <ShareOptionsPanel
        isOpen={isSharePanelOpen}
        onClose={() => setIsSharePanelOpen(false)}
        meetingLink={meetingLink}
        meetingCode={meetingCode}
        meetingTitle={meetingTitle} 
      />
    </>
  );
}
