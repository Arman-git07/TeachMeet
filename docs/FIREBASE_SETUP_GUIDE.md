# Firebase Backend Setup Guide

To enable uploading features (Documents, Recordings, Classroom Materials) and real-time meeting data, you must configure your Firebase project.

## 1. Enable Cloud Firestore (Database)
Firestore stores the metadata for your files and classroom data.
1. Go to **Build > Firestore Database** in the console.
2. Click **Create database**.
3. Choose a location. **Selection Tip:** Choose a region like `us-central1` if you are on the free Spark plan to ensure you can also use the free Storage bucket.
4. Select **Start in production mode**.
5. Click **Enable**.

## 2. Enable Cloud Storage (File Uploads)
This is where your actual files are saved.
1. Go to **Build > Storage** in the console.
2. Click **Get Started**.
3. Follow the wizard. If you see an **"Unknown Error"**, it is likely because your project region doesn't support the free tier default bucket.
   - **Fix:** Either upgrade to the **Blaze (Pay-as-you-go) Plan** (you still get the same free limits!) or create a new project in a US region.

## 3. Enable Authentication
1. Go to **Build > Authentication**.
2. Enable **Email/Password** and **Anonymous** (for guests) sign-in methods.

## 4. Get Your Configuration
1. Go to **Project Settings > General**.
2. Under **Your apps**, find your Web App configuration object.
3. Add these keys to your `.env` file in the workspace to test in the studio.
