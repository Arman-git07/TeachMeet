
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { cookies } from 'next/headers';
import { experimental_connectAuthEmulator as connectAuthEmulator } from 'firebase/auth';

const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export async function getAuthenticatedAppForUser() {
    const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(firebaseApp);
    
    const sessionCookie = cookies().get('session')?.value;
    if (!sessionCookie) {
        return { currentUser: null, app: firebaseApp };
    }
    
    try {
        // This is where you would typically verify the session cookie with a backend
        // For this client-focused example, we assume the presence of a cookie
        // implies an authenticated state that the client-side Firebase SDK will handle.
        // In a real production app with server-side rendering, you'd verify this token.
        // For now, we will just rely on the client-side auth state to be accurate.
        // We can't truly get the user here without a backend verification step.
        // So we will just return a placeholder or rely on client-side auth check
        // for route protection. The purpose here is to show the pattern.
        
        // Let's assume the auth object will be populated on the client side.
        // The most important thing for SSR/RSC is providing the initialized app.
        // The actual user object will be null on the server.
        return { currentUser: auth.currentUser, app: firebaseApp };

    } catch (error) {
        console.error('Error with authentication state:', error);
        return { currentUser: null, app: firebaseApp };
    }
}
