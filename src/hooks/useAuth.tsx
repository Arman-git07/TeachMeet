'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
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
    // This function sets up auth persistence and then subscribes to auth state changes.
    // It returns the unsubscribe function for cleanup.
    const subscribeToAuthChanges = async () => {
      try {
        // Explicitly setting persistence to 'local'.
        // This ensures the user remains signed in even after closing the browser.
        // This is the default for web, but being explicit helps avoid issues.
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        // This can happen if the browser has privacy settings that block local storage.
        console.error("Firebase Auth: Could not set persistence.", error);
        toast({
          variant: "destructive",
          title: "Login Not Remembered",
          description: "Your login will not be saved for the next session. This might be due to your browser's privacy settings.",
          duration: 10000,
        });
      }

      // onAuthStateChanged returns an unsubscribe function. We attach the listener
      // after attempting to set persistence.
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      
      return unsubscribe;
    };

    // Call the setup function and store the returned unsubscribe promise.
    const unsubscribePromise = subscribeToAuthChanges();

    // The cleanup function for this effect will run when the component unmounts.
    // We wait for the promise to resolve and then call the actual unsubscribe function.
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  // The dependency array is empty, so this effect runs only once when the provider mounts.
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // After a successful sign out, the onAuthStateChanged listener will automatically
      // update the user state to null, triggering the necessary UI updates.
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
