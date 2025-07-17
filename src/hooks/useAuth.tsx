
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
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

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  documents: Document[];
  recordings: Recording[];
  signOut: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);

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
  
  const deleteUserAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be signed in to delete your account." });
        return;
    }

    const password = prompt("For your security, please re-enter your password to delete your account:");
    if (!password) {
        toast({ title: "Deletion Canceled", description: "You did not enter a password." });
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email!, password);
        await reauthenticateWithCredential(currentUser, credential);
        
        // At this point, the user is re-authenticated.
        // In a real production app, you would now call a Firebase Cloud Function
        // to delete the user's data from Firestore and Storage before deleting the user.
        // For this prototype, we'll simulate this cleanup and then delete the user.

        toast({ title: "Cleaning up your data...", description: "Deleting documents, recordings, and other data." });
        
        // --- Simulated Data Cleanup ---
        // This is where you would call your backend function:
        // const deleteUserData = httpsCallable(functions, 'deleteUserData');
        // await deleteUserData();
        console.log(`SIMULATING: Deleting all data for user ${currentUser.uid}`);
        
        await deleteUser(currentUser);
        
        toast({ title: "Account Deleted", description: "Your account and all associated data have been permanently deleted." });
        // The onAuthStateChanged listener will automatically handle redirecting the user.
        
    } catch (error: any) {
        let title = "Deletion Failed";
        let description = "An unexpected error occurred. Please try again.";

        if (error.code === 'auth/wrong-password') {
            title = "Incorrect Password";
            description = "The password you entered was incorrect. Account deletion canceled.";
        } else if (error.code === 'auth/too-many-requests') {
            title = "Too Many Attempts";
            description = "You've tried to sign in too many times. Please try again later.";
        } else if (error.code === 'auth/network-request-failed') {
            title = "Network Error";
            description = "Could not connect to the server. Please check your internet connection.";
        }
        
        console.error("Account deletion error:", error);
        toast({ variant: "destructive", title, description });
        // Rethrow the error so the calling component knows it failed
        throw error;
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, documents, recordings, signOut, deleteUserAccount }}>
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
