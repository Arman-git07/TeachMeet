'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase'; // Adjust path as needed
import { useToast } from './use-toast';

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
    // This function sets up persistence and then subscribes to auth changes.
    // It returns the unsubscribe function for cleanup.
    const subscribeToAuth = async () => {
      try {
        // This is the key change: we set persistence first.
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        // Log an error if persistence fails, but continue without it.
        // This would result in session-only login.
        console.error("Firebase Auth: Could not set persistence.", error);
        toast({
          variant: "destructive",
          title: "Login Not Persisted",
          description: "Your login will not be remembered after you close the browser. This may be due to your browser's privacy settings.",
          duration: 10000,
        });
      }

      // onAuthStateChanged returns the unsubscribe function.
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });

      return unsubscribe;
    };

    // We call the async function and store the promise for the unsubscribe function.
    const unsubscribePromise = subscribeToAuth();

    // The cleanup function for useEffect will wait for the promise to resolve
    // and then call the returned unsubscribe function.
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, [toast]);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
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
