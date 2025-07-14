
import { collection, query, where, or, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RecordingsClientUI, type Recording } from '@/components/dashboard/RecordingsClientUI';
import { getAuthenticatedAppForUser } from '@/lib/firebase-ssr';
import { unstable_noStore as noStore } from 'next/cache';

export default async function RecordingsPage() {
  noStore();
  const { currentUser } = await getAuthenticatedAppForUser();

  if (!currentUser) {
    return <RecordingsClientUI initialRecordings={[]} currentUserId={null} />;
  }

  const recordingsRef = collection(db, "recordings");
  const q = query(recordingsRef, 
    or(
      where("isPrivate", "==", false),
      where("uploaderId", "==", currentUser.uid)
    ),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  const recordings = snapshot.docs.map(doc => JSON.parse(JSON.stringify({ id: doc.id, ...doc.data() })) as Recording);

  return <RecordingsClientUI initialRecordings={recordings} currentUserId={currentUser.uid} />;
}
