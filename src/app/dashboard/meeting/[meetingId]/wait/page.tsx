
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

// This page is now deprecated. The functionality has been moved into the main
// meeting page (`/dashboard/meeting/[meetingId]/page.tsx`) which now handles
// the entire join flow, from asking to join to entering the meeting.
// This component now just redirects to that main page.
export default function DeprecatedWaitingAreaPage({ params }: { params: { meetingId: string } }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/meeting/${params.meetingId}`);
  }, [router, params.meetingId]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
        <p>Redirecting to the meeting...</p>
    </div>
  );
}
