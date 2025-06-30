
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore'; // Import getFirestore

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let appInitialized = false;

// Check if all necessary Firebase config keys are present
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId
) {
  // Use console.warn to avoid Next.js error overlay for a config issue
  console.warn(
    `\n\n============================================================\n` +
    `  ⚠️  WARNING: INCOMPLETE FIREBASE CONFIGURATION ⚠️\n` +
    `------------------------------------------------------------\n` +
    `  Your .env file is missing required Firebase variables.\n` +
    `  Firebase services will NOT work until you provide:\n` +
    `    - NEXT_PUBLIC_FIREBASE_API_KEY\n` +
    `    - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n` +
    `    - NEXT_PUBLIC_FIREBASE_PROJECT_ID\n\n` +
    `  You can find these in your Firebase project settings.\n` +
    `============================================================\n\n`
  );
} else {
  console.log('✅ Firebase configuration variables found in .env file.');
  appInitialized = true;
}

if (appInitialized) {
   console.info(
    `\n\n=====================================================================================\n` +
    `  🚨 READ THIS IF YOU SEE "Missing or insufficient permissions" 🚨\n` +
    `-------------------------------------------------------------------------------------\n` +
    `  The app's security rules are wide open for development. This error is almost always\n` +
    `  caused by your Firebase project's setup, not the code.\n\n` +
    `  👉 PLEASE VERIFY THE FOLLOWING IN YOUR FIREBASE/GOOGLE CLOUD CONSOLE:\n\n` +
    `  1. SECURITY RULES ARE PUBLISHED (Most likely fix):\n` +
    `     - Go to the Firestore Rules tab in your Firebase console:\n` +
    `       https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules\n` +
    `     - Replace the existing rules with:\n` +
    `         rules_version = '2';\n` +
    `         service cloud.firestore {\n` +
    `           match /databases/{database}/documents {\n` +
    `             match /{document=**} { allow read, write: if true; }\n` +
    `           }\n` +
    `         }\n` +
    `     - Click "Publish".\n\n` +
    `  2. Cloud Firestore API is ENABLED:\n` +
    `     - The API must be enabled for your project. Check here:\n` +
    `       https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${firebaseConfig.projectId}\n\n` +
    `  3. Firestore Database is CREATED:\n` +
    `     - In the Firebase Console, go to Firestore Database. If you see a "Create database"\n` +
    `       button, you must click it and complete the setup.\n\n` +
    `  After making changes, restart the development server.\n` +
    `=====================================================================================\n\n`
  );
}


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, storage, db };
