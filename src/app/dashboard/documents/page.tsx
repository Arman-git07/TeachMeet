
import { collection, query, where, onSnapshot, doc, or, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DocumentsClientUI, type Document } from '@/components/dashboard/DocumentsClientUI';
import { getAuthenticatedAppForUser } from '@/lib/firebase-ssr';
import { unstable_noStore as noStore } from 'next/cache';


export default async function DocumentsPage() {
  noStore();
  const { currentUser } = await getAuthenticatedAppForUser();
  
  if (!currentUser) {
    // This should ideally not be reached due to layout protection,
    // but serves as a fallback.
    return <DocumentsClientUI initialDocuments={[]} currentUserId={null} />;
  }

  const docsRef = collection(db, "documents");
  const q = query(docsRef, 
    or(
      where("isPrivate", "==", false),
      where("uploaderId", "==", currentUser.uid)
    ),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));

  return <DocumentsClientUI initialDocuments={docs} currentUserId={currentUser.uid} />;
}
