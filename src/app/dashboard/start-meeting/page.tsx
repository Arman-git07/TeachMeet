
'use client';

// This page is deprecated as the "Start New Meeting" functionality
// has been moved into a dialog accessible from the homepage and sidebar.
// This component redirects users to the homepage.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function DeprecatedStartMeetingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/'); 
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 p-4 md:p-8">
      <p className="text-muted-foreground text-lg mb-4">Redirecting...</p>
      <Skeleton className="h-40 w-full max-w-lg rounded-xl" />
    </div>
  );
}
