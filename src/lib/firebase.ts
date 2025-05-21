
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; // Import getStorage

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey) {
  console.warn(
    `\n\n⚠️ WARNING: NEXT_PUBLIC_FIREBASE_API_KEY is not set in your environment variables. ⚠️\n` +
    `Firebase authentication and other Firebase services will likely fail.\n` +
    `To resolve this:\n` +
    `1. Ensure you have a .env file in the root of your project.\n` +
    `2. Add your Firebase configuration to the .env file. For example:\n` +
    `   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyYourActualApiKey\n` +
    `   (and other NEXT_PUBLIC_FIREBASE_... variables)\n` +
    `3. Restart your development server (e.g., 'npm run dev').\n\n`
  );
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app); // Initialize Firebase Storage
// const db = getFirestore(app);


export { app, auth, storage /*, db */ };
