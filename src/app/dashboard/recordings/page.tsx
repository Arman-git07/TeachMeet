'use client';

import { RecordingsClientUI } from '@/components/dashboard/RecordingsClientUI';

export default function RecordingsPage() {
  // This page now directly uses the Client UI component,
  // which will handle its own data fetching.
  return <RecordingsClientUI />;
}
