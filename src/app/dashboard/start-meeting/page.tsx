
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Users, XCircle, Video } from "lucide-react";
import Link from "next/link";

export default function StartMeetingPage() {
  const meetingLink = "https://teachmeet.example.com/join/xyz123"; // Placeholder

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
              <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(meetingLink)} aria-label="Copy link">
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="rounded-lg py-6 text-base">
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
