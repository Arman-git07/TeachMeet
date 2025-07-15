
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, messaging, db } from '@/lib/firebase';
import { useToast } from './use-toast';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, collection, query, where, onSnapshot, or, orderBy, Unsubscribe } from 'firebase/firestore';


export interface Document {
  id: string;
  name: string;
  lastModified: string;
  size: string;
  uploaderId: string;
  isPrivate: boolean;
  downloadURL: string;
  storagePath: string;
  createdAt?: any;
}

export interface Recording {
  id: string;
  name: string;
  date: string;
  duration: string;
  size: string;
  thumbnailUrl?: string;
  downloadURL: string;
  storagePath: string;
  uploaderId: string;
  isPrivate: boolean;
  createdAt?: any;
}

export interface Teaching {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  isPublic: boolean;
  members: string[]; // List of user IDs
  pendingRequests: string[]; // List of user IDs
  createdAt?: any;
}


interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  documents: Document[];
  recordings: Recording[];
  teachings: Teaching[];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [teachings, setTeachings] = useState<Teaching[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribers: Unsubscribe[] = [];

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Clear previous listeners to prevent duplicates on auth state change
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];
      
      setUser(currentUser);
      
      if (currentUser) {
        // User is signed in, fetch their data and listen for updates
        
        // Documents listener
        const docsRef = collection(db, "documents");
        const docsQuery = query(docsRef, or(where("isPrivate", "==", false), where("uploaderId", "==", currentUser.uid)), orderBy("createdAt", "desc"));
        const docsUnsubscribe = onSnapshot(docsQuery, 
          (snapshot) => setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document))),
          (error) => console.error("Error fetching documents:", error)
        );
        unsubscribers.push(docsUnsubscribe);

        // Recordings listener
        const recordingsRef = collection(db, "recordings");
        const recordingsQuery = query(recordingsRef, or(where("isPrivate", "==", false), where("uploaderId", "==", currentUser.uid)), orderBy("createdAt", "desc"));
        const recordingsUnsubscribe = onSnapshot(recordingsQuery, 
          (snapshot) => setRecordings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording))),
          (error) => console.error("Error fetching recordings:", error)
        );
        unsubscribers.push(recordingsUnsubscribe);

        // Teachings listener - listen for public teachings OR teachings where user is a member
        const teachingsRef = collection(db, "teachings");
        const teachingsQuery = query(teachingsRef, or(
            where("isPublic", "==", true),
            where("members", "array-contains", currentUser.uid)
        ));
        const teachingsUnsubscribe = onSnapshot(teachingsQuery,
          (snapshot) => setTeachings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching))),
          (error) => console.error("Error fetching teachings:", error)
        );
        unsubscribers.push(teachingsUnsubscribe);

        // FCM Token
        if (messaging) {
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
              if (fcmToken) {
                const tokenRef = doc(db, 'fcmTokens', currentUser.uid);
                await setDoc(tokenRef, { token: fcmToken, userId: currentUser.uid, updatedAt: serverTimestamp() }, { merge: true });
                console.log('FCM token saved for user:', currentUser.uid);
              }
            }
          } catch (error) {
            console.error('An error occurred while retrieving FCM token.', error);
          }
        }
      } else {
        // User is signed out, clear data
        setDocuments([]);
        setRecordings([]);
        setTeachings([]);
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
      if (pathname.startsWith('/dashboard')) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error signing out: ', error);
      toast({ variant: 'destructive', title: 'Sign Out Error', description: 'Could not sign you out. Please try again.' });
    }
  };
  
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, documents, recordings, teachings, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
