
'use client';
import { DocumentsClientUI } from '@/components/dashboard/DocumentsClientUI';

export default function DocumentsPage() {
  // This page now directly uses the Client UI component,
  // which will handle its own data fetching.
  return <DocumentsClientUI />;
}
