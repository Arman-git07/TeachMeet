
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Users, XCircle, Video } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast"; 

export default function StartMeetingPage() {
  const meetingLink = "https://teachmeet.example.com/join/xyz123"; // Placeholder
  const { toast } = useToast(); 

  const handleShareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join My TeachMeet Meeting',
          text: `You're invited to join my TeachMeet meeting. Meeting Link: ${meetingLink}`,
          url: meetingLink,
        });
        toast({ title: "Invite Shared", description: "The meeting invite has been shared." });
      } catch (error: any) {
        console.error('Error sharing invite:', error);
        // Check if the error is due to user cancellation, which is common
        if ((error as DOMException)?.name === 'AbortError') {
          toast({ variant: "default", title: "Sharing Cancelled", description: "You cancelled the share dialog."});
        } else if ((error as DOMException)?.name === 'NotAllowedError' || (error as DOMException)?.message.toLowerCase().includes('permission denied')) {
          toast({ 
            variant: "destructive", 
            title: "Sharing Failed", 
            description: "Could not share the invite. Permission was denied or the feature is blocked in this context (e.g., not HTTPS, or in an iframe). Link copied to clipboard as fallback." 
          });
          copyToClipboard();
        } else {
          toast({ variant: "destructive", title: "Sharing Failed", description: "Could not share the invite using the native share dialog. Link copied to clipboard as fallback." });
          copyToClipboard();
        }
      }
    } else {
      toast({ title: "Native Sharing Not Supported", description: "Your browser doesn't support native sharing. Link copied to clipboard instead." });
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingLink)
      .then(() => {
        toast({ title: "Link Copied!", description: "Meeting link copied to clipboard. You can now paste it to share." });
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the meeting link automatically." });
      });
  };

  return (
    <div className="container mx-auto py-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-lg shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <Video className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Start a New Meeting</CardTitle>
          <CardDescription>Your meeting is ready. Share the link to invite others.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="meetingLink" className="block text-sm font-medium text-muted-foreground mb-1">
              Meeting Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                id="meetingLink"
                type="text"
                readOnly
                value={meetingLink}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Copy link">
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="rounded-lg py-6 text-base" onClick={handleShareInvite}>
              <Share2 className="mr-2 h-5 w-5" />
              Share Invite
            </Button>
            <Button variant="outline" className="rounded-lg py-6 text-base">
              <Users className="mr-2 h-5 w-5" />
              Manage Participants
            </Button>
          </div>
          
          <Link href="/dashboard/meeting/new-meeting-id/wait" passHref legacyBehavior>
             <Button className="w-full btn-gel text-lg py-3 rounded-lg">
                Join Meeting Now
             </Button>
          </Link>

        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
            <Link href="/dashboard" passHref legacyBehavior>
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive rounded-lg">
                    <XCircle className="mr-2 h-5 w-5" />
                    Dismiss
                </Button>
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
