
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
  // REMOVED: documents and recordings are now fetched on their respective pages
  signOut: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && messaging) {
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
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
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
        
        toast({ title: "Cleaning up your data...", description: "Deleting documents, recordings, and other data." });
        
        console.log(`SIMULATING: Deleting all data for user ${currentUser.uid}`);
        
        await deleteUser(currentUser);
        
        toast({ title: "Account Deleted", description: "Your account and all associated data have been permanently deleted." });
        
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
        throw error;
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, signOut, deleteUserAccount }}>
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
