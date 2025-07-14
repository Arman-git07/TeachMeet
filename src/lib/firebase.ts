
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence, getAuth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';

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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
});

// HMR-safe initialization for Firestore, Storage, and Messaging
let db: Firestore;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;

if (typeof window !== 'undefined') {
  if (!(global as any)._firebaseFirestore) {
    (global as any)._firebaseFirestore = getFirestore(app);
  }
  db = (global as any)._firebaseFirestore;

  if (!(global as any)._firebaseStorage) {
    (global as any)._firebaseStorage = getStorage(app);
  }
  storage = (global as any)._firebaseStorage;

  if (!(global as any)._firebaseMessaging) {
    (global as any)._firebaseMessaging = getMessaging(app);
  }
  messaging = (global as any)._firebaseMessaging;

} else {
  // For server-side rendering (if needed in the future)
  db = getFirestore(app);
  storage = getStorage(app);
  // Messaging is not available on the server
}


export { app, auth, storage, db, messaging };
