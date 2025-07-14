
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, messaging, db } from '@/lib/firebase';
import { useToast } from './use-toast';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    // onAuthStateChanged is the recommended way to listen for auth state changes.
    // It will fire on initial page load and whenever the user signs in or out.
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser && messaging) {
        // User is signed in, try to get/refresh FCM token
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
            if (fcmToken) {
              // Save the token to Firestore for this user
              const tokenRef = doc(db, 'fcmTokens', currentUser.uid);
              await setDoc(tokenRef, { 
                token: fcmToken, 
                userId: currentUser.uid,
                updatedAt: serverTimestamp() 
              }, { merge: true });
              console.log('FCM token saved for user:', currentUser.uid);
            }
          }
        } catch (error) {
          console.error('An error occurred while retrieving token. ', error);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount.

  const signOut = async () => {
    try {
      // Future enhancement: before signing out, delete the FCM token from Firestore.
      await firebaseSignOut(auth);
      // The onAuthStateChanged listener above will automatically handle setting user to null.
      toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
      // Redirect to home or sign-in page after sign out
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
    <AuthContext.Provider value={{ user, loading, isAuthenticated, signOut }}>
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
