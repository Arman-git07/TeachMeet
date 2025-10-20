'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import JoinMeetingWatcher from '@/components/meeting/JoinMeetingWatcher';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function WaitPageContent() {
  const searchParams = useSearchParams();
  const meetingId = searchParams.get("meetingId");
  const topic = searchParams.get("topic") || "TeachMeet Meeting";

  if (!meetingId) {
    return (
       <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl rounded-xl border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-destructive">
              Invalid Meeting Link
            </CardTitle>
            <CardDescription>No meeting ID was provided. Please go back and use a valid link.</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/dashboard/join-meeting">Go to Join Page</Link>
              </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Request Sent
          </CardTitle>
          <CardDescription>You've asked to join: <strong>{topic}</strong></CardDescription>
        </CardHeader>
        <CardContent className="py-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4"/>
            <p className="text-sm text-muted-foreground">Waiting for the host to let you in...</p>
            {/* This component listens for the host's approval and redirects */}
            <JoinMeetingWatcher meetingId={meetingId} />
        </CardContent>
         <CardFooter className="flex justify-center text-xs text-muted-foreground">
            You will be admitted automatically.
        </CardFooter>
      </Card>
    </div>
  );
}

// This is the main component for the page, wrapping the logic in Suspense
// to handle the reading of search parameters.
export default function WaitingAreaPage() {
    return (
      <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
        <WaitPageContent />
      </Suspense>
    );
}
