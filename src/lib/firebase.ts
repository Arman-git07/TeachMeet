import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';
import { getDatabase } from 'firebase/database';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
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

// Auth
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence);
}

// Firestore
const db = getFirestore(app);

// Enable offline persistence
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db)
      .then(() => console.log("Firestore persistence enabled."))
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("Firestore persistence failed. Multiple tabs open?");
        } else if (err.code === 'unimplemented') {
          console.warn("Firestore persistence not supported in this browser.");
        }
      });
  } catch (err) {
    console.error("Error enabling firestore persistence", err);
  }
}

const storage = getStorage(app);
const rtdb = getDatabase(app);

let messaging: Messaging | null = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch {
    console.warn("Firebase Messaging not supported.");
    messaging = null;
  }
}

export { app, storage, db, messaging, rtdb };
