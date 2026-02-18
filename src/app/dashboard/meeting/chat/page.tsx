'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from "lucide-react";

export default function MeetingChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Feature has been removed. Redirecting to dashboard.
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
