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
    // This effect hook is the core of the authentication state management.
    // It now explicitly sets persistence before subscribing to auth changes
    // to prevent a race condition where the app might decide the user is logged out
    // before Firebase has had a chance to load the persisted session.

    let unsubscribe: (() => void) | undefined;

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        // This block runs ONLY after persistence has been successfully set.
        // We now set up the listener that will give us the user's current state.
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false); // We are now confident about the auth state.
        });
      })
      .catch((error) => {
        // This block runs if setting persistence fails.
        console.error("[AuthProvider] Error setting auth persistence:", error);
        toast({
            variant: "destructive",
            title: "Login Session Cannot Be Saved",
            description: "Your login will not be remembered for next time. This may be due to your browser's privacy settings.",
            duration: 8000,
        });
        // Even if persistence fails, we still need to check the current session's auth state.
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      });

    // The cleanup function for the effect. This will be called when the component unmounts.
    return () => {
      if (unsubscribe) {
        console.log("[AuthProvider] Cleaning up auth state listener.");
        unsubscribe();
      }
    };
  }, [toast]); // Dependency array is stable and ensures this effect runs only once on mount.

  const signOut = async () => {
    try {
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
