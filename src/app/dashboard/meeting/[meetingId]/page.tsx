
"use client";
import MeetingClient from "./MeetingClient";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function MeetingPage({ params }: { params: { meetingId: string } }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
        <div className="flex flex-col h-full bg-background items-center justify-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">
                Authenticating...
            </h2>
            <p className="text-muted-foreground">Please wait a moment.</p>
        </div>
    );
  }

  if (!user) {
    // This part will likely not be seen as the layout redirects, but it's good practice.
    return (
        <div className="flex flex-col h-full bg-background items-center justify-center p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
                Authentication Required
            </h2>
            <p className="text-muted-foreground">You must be signed in to join a meeting.</p>
        </div>
    );
  }

  return <MeetingClient meetingId={params.meetingId} userId={user.uid} />;
}
