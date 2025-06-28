
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
  console.warn(
    `\n\n⚠️ WARNING: Missing Firebase configuration. ⚠️\n` +
    `Please ensure all required NEXT_PUBLIC_FIREBASE_* variables are set in your .env file:\n` +
    ` - NEXT_PUBLIC_FIREBASE_API_KEY\n` +
    ` - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n` +
    ` - NEXT_PUBLIC_FIREBASE_PROJECT_ID\n` +
    `Firebase services will not work without these.\n\n`
  );
} else {
  console.log('✅ Firebase configuration variables found in environment.');
  appInitialized = true;
}

if (appInitialized) {
   console.info(
    '\n\n💡 Firebase Tip: If you see "Could not reach Cloud Firestore backend" or permission errors, check the following:\n\n' +
    '1. ✅ Firestore Database is CREATED:\n' +
    '   Go to your Firebase Console -> Firestore Database -> Click "Create database".\n' +
    '   You must create the database and choose a region (e.g., us-central) for it to be accessible.\n\n' +
    '2. ✅ Firestore API is ENABLED:\n' +
    `   Go to Google Cloud Console for project "${firebaseConfig.projectId}" or use this link:\n` +
    `   https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${firebaseConfig.projectId}\n` +
    '   Ensure the "Cloud Firestore API" is enabled.\n\n' +
    '3. ✅ Correct Security Rules:\n' +
    `   For development, ensure your 'firestore.rules' file allows reads/writes. A common dev rule is:\n` +
    '   rules_version = "2";\n' +
    '   service cloud.firestore {\n' +
    '     match /databases/{database}/documents {\n' +
    '       match /{document=**} {\n' +
    '         allow read, write: if request.auth != null;\n' +
    '       }\n' +
    '     }\n' +
    '   }\n\n' +
    '4. ✅ Correct Project ID:\n' +
    `   The Project ID in your .env file ('${firebaseConfig.projectId}') must exactly match your Firebase project's ID.\n`
  );
}


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, storage, db };
