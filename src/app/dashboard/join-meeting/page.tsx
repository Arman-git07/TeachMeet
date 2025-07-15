
import { JoinMeetingClient } from "@/components/meeting/JoinMeetingClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkIcon, Hash, LogIn, XCircle } from "lucide-react";
import Link from "next/link";

export default function JoinMeetingPage() {
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Join a Meeting</CardTitle>
          <CardDescription>Enter the meeting code or link to join.</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinMeetingClient />
        </CardContent>
         <CardFooter className="flex justify-between border-t pt-4">
            <Button asChild variant="ghost" className="text-muted-foreground hover:text-destructive rounded-lg">
                <Link href="/dashboard">
                    <XCircle className="mr-2 h-5 w-5" />
                    Cancel
                </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
