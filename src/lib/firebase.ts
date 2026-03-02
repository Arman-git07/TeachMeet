
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, getAuth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';
import { getDatabase } from 'firebase/database';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId
) {
  console.warn(
    'WARNING: Firebase config is missing or incomplete in your .env file. Firebase services will not work.'
  );
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 🔥 FINAL FIX — AUTH INITIALIZED ONLY ONCE WITH FULL PERSISTENCE
// This single instance is exported and used throughout the app.
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});

const db = getFirestore(app);

// Enable offline persistence for Firestore.
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db)
      .then(() => console.log("Firestore persistence enabled."))
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Firestore persistence failed. Multiple tabs open?");
        } else if (err.code == 'unimplemented') {
          console.warn("Firestore persistence not available in this browser.");
        }
      });
  } catch (err) {
      console.error("Error enabling firestore persistence", err)
  }
}

const storage = getStorage(app);
const rtdb = getDatabase(app);
let messaging: Messaging | null = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.warn("Could not initialize Firebase Messaging. This may be due to an unsupported environment (e.g., non-HTTPS).");
        messaging = null;
    }
}

export { app, storage, db, messaging, rtdb };
