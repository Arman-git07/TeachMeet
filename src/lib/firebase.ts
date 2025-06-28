
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
    `  ⛔️ CRITICAL ERROR: MISSING FIREBASE CONFIGURATION ⛔️\n` +
    `------------------------------------------------------------\n` +
    `  Your .env file is missing required Firebase variables.\n` +
    `  Firebase services will NOT work. Please ensure you have:\n` +
    `    - NEXT_PUBLIC_FIREBASE_API_KEY\n` +
    `    - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n` +
    `    - NEXT_PUBLIC_FIREBASE_PROJECT_ID\n` +
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
    `  The app's security rules are wide open for development. If you see this\n` +
    `  error, the cause is your Firebase project's setup, not the code.\n\n` +
    `  👉 PLEASE VERIFY THE FOLLOWING IN YOUR GOOGLE CLOUD/FIREBASE CONSOLE:\n\n` +
    `  1. Firestore Database is CREATED:\n` +
    `     - Go to your Firebase Console -> Firestore Database.\n` +
    `     - If you see a "Create database" button, CLICK IT and create the database.\n` +
    `     - This is the MOST COMMON cause of the error.\n\n` +
    `  2. Cloud Firestore API is ENABLED:\n` +
    `     - Go to this link and ensure the API is enabled for your project:\n` +
    `       https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${firebaseConfig.projectId}\n\n` +
    `  3. Correct Project ID in .env:\n` +
    `     - Your NEXT_PUBLIC_FIREBASE_PROJECT_ID MUST be exactly:\n` +
    `       '${firebaseConfig.projectId}'\n\n` +
    `  This check runs every time you start the server. If the error persists,\n` +
    `  one of these three steps has been missed.\n` +
    `=====================================================================================\n\n`
  );
}


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, storage, db };
