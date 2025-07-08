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
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        // Ensure persistence is set to 'local' before subscribing to auth state changes.
        // This is crucial for remembering the user across browser sessions.
        await setPersistence(auth, browserLocalPersistence);
        console.log("[AuthProvider] Firebase persistence has been set to 'local'.");
      } catch (error) {
        console.error("[AuthProvider] Failed to set Firebase persistence:", error);
        toast({
            variant: "destructive",
            title: "Could Not Save Session",
            description: "Your login will not be remembered for the next session. This may be due to your browser's privacy settings.",
            duration: 10000,
        });
      }

      // Now, subscribe to auth state changes.
      // onAuthStateChanged returns the unsubscribe function.
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        console.log("[AuthProvider] Auth state changed. User:", currentUser ? currentUser.uid : 'null');
        setUser(currentUser);
        setLoading(false);
      });
    };

    initializeAuth();

    // The cleanup function for the effect.
    return () => {
      if (unsubscribe) {
        console.log("[AuthProvider] Cleaning up auth state listener.");
        unsubscribe();
      }
    };
  // Adding toast to dependency array as a best practice, though it's stable.
  }, [toast]);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // The onAuthStateChanged listener will handle setting user to null.
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
