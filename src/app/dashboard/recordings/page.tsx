
'use client';

import { RecordingsClientUI } from '@/components/dashboard/RecordingsClientUI';
import { useAuth } from '@/hooks/useAuth';

export default function RecordingsPage() {
  const { user, recordings } = useAuth();
  // The data fetching is now handled inside the useAuth hook to centralize listeners
  // and prevent re-initialization errors.
  return <RecordingsClientUI initialRecordings={recordings} currentUserId={user?.uid || null} />;
}
