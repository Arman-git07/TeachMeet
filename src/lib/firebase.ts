
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
  console.error(
    `\n\n============================================================\n` +
    `  ⚠️ CRITICAL WARNING: MISSING FIREBASE CONFIGURATION ⚠️\n` +
    `------------------------------------------------------------\n` +
    `  Firebase services will NOT work.\n` +
    `  Please ensure all required NEXT_PUBLIC_FIREBASE_* variables\n`+
    `  are set in your .env file. You are missing one or more of:\n` +
    `    - NEXT_PUBLIC_FIREBASE_API_KEY\n` +
    `    - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n` +
    `    - NEXT_PUBLIC_FIREBASE_PROJECT_ID\n` +
    `============================================================\n\n`
  );
} else {
  console.log('✅ Firebase configuration variables found in environment.');
  appInitialized = true;
}

if (appInitialized) {
   console.info(
    `\n\n====================================================================\n` +
    `  💡 FIREBASE & FIRESTORE: TROUBLESHOOTING GUIDE 💡\n` +
    `--------------------------------------------------------------------\n` +
    `  If you see "Could not reach Cloud Firestore backend" or\n` +
    `  "Missing or insufficient permissions" errors, please verify:\n\n` +
    `  1. ✅ Firestore Database is CREATED:\n` +
    `     Go to your Firebase Console -> Firestore Database, and click\n` +
    `     "Create database". You MUST create it and choose a region.\n\n` +
    `  2. ✅ Firestore API is ENABLED:\n` +
    `     Go to this link for your project and ensure the API is enabled:\n` +
    `     https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${firebaseConfig.projectId}\n\n` +
    `  3. ✅ Correct Project ID:\n` +
    `     The Project ID in your .env file must be exactly:\n` +
    `     '${firebaseConfig.projectId}'\n\n` +
     `  4. ✅ Security Rules are Deployed:\n` +
    `     Ensure your 'firestore.rules' and 'storage.rules' files have been\n`+
    `     deployed to Firebase. For development, they should be permissive:\n` +
    `     // firestore.rules\n` +
    `     rules_version = '2';\n` +
    `     service cloud.firestore {\n` +
    `       match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } }\n` +
    `     }\n` +
    `====================================================================\n\n`
  );
}


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, storage, db };
