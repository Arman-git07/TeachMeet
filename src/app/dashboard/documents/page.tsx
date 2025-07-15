
'use client';
import { DocumentsClientUI } from '@/components/dashboard/DocumentsClientUI';
import { useAuth } from '@/hooks/useAuth';


export default function DocumentsPage() {
  const { user, documents } = useAuth();
  // The data fetching is now handled inside the useAuth hook to centralize listeners
  // and prevent re-initialization errors.
  return <DocumentsClientUI initialDocuments={documents} currentUserId={user?.uid || null} />;
}
