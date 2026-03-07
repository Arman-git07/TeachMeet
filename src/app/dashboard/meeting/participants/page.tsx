
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from "lucide-react";

/**
 * This page was causing a build conflict. 
 * The actual participants list is now located at /dashboard/meeting/[meetingId]/participants.
 * This file redirects users back to the dashboard to satisfy Next.js build requirements.
 */
export default function LegacyParticipantsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Redirecting...</p>
      </div>
    </div>
  );
}
