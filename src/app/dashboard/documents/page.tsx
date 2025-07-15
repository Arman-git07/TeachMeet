
'use client';
import { DocumentsClientUI } from '@/components/dashboard/DocumentsClientUI';
import { useAuth } from '@/hooks/useAuth';


export default function DocumentsPage() {
  const { user } = useAuth();
  // The data fetching is now handled inside DocumentsClientUI via a real-time listener,
  // which simplifies this page and aligns with client-side authentication.
  return <DocumentsClientUI initialDocuments={[]} currentUserId={user?.uid || null} />;
}
