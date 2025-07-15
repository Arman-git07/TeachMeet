
'use client';

import { RecordingsClientUI } from '@/components/dashboard/RecordingsClientUI';
import { useAuth } from '@/hooks/useAuth';

export default function RecordingsPage() {
  const { user } = useAuth();
  // The data fetching is now handled inside RecordingsClientUI via a real-time listener,
  // which simplifies this page and aligns with client-side authentication.
  return <RecordingsClientUI initialRecordings={[]} currentUserId={user?.uid || null} />;
}
