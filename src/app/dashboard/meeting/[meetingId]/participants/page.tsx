
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is now deprecated. The functionality has been moved into a bottom sheet
// on the main meeting page for a more integrated experience.
// This component now just redirects back to the main meeting page.
export default function DeprecatedMeetingParticipantsPage({ params }: { params: { meetingId: string } }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/meeting/${params.meetingId}`);
  }, [router, params.meetingId]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
        <p>Redirecting back to the meeting...</p>
    </div>
  );
}
