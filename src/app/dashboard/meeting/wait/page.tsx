'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import AskToJoinButton from '@/components/meeting/AskToJoinButton';
import JoinMeetingWatcher from '@/components/meeting/JoinMeetingWatcher';

function WaitPageContent() {
  const searchParams = useSearchParams();
  const meetingId = searchParams.get("meetingId");
  const topic = searchParams.get("topic") || "TeachMeet Meeting";
  const [requestSent, setRequestSent] = useState(false);

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
            {requestSent ? 'Request Sent' : `Ready to join "${topic}"?`}
          </CardTitle>
          <CardDescription>
            {requestSent ? 'Waiting for the host to let you in...' : 'Your camera and mic will be off by default.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 flex flex-col items-center justify-center text-center">
            {!requestSent ? (
              <AskToJoinButton meetingId={meetingId} onSent={() => setRequestSent(true)} />
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4"/>
                <p className="text-sm text-muted-foreground">You will be admitted automatically.</p>
                <JoinMeetingWatcher meetingId={meetingId} />
              </>
            )}
        </CardContent>
         <CardFooter className="flex justify-center text-xs text-muted-foreground">
            Meeting ID: {meetingId}
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
