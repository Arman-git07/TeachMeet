
'use server';

import {genkit, type Genkit} from 'genkit';
import {googleAI as genkitGoogleAI} from '@genkit-ai/googleai';

let apiKeyFound = false;
if (process.env.GOOGLE_API_KEY) {
  console.log("Found GOOGLE_API_KEY in environment variables.");
  apiKeyFound = true;
} else if (process.env.GOOGLE_GENAI_API_KEY) {
  console.log("Found GOOGLE_GENAI_API_KEY in environment variables.");
  apiKeyFound = true;
}

if (!apiKeyFound) {
  console.warn(
    '\n\n⚠️ WARNING: GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY is not set in the environment. ⚠️\n' +
    'AI features, such as the Help Assistant and Text-to-Speech, will likely fail.\n' +
    'To resolve this:\n' +
    '1. Create a file named .env in the root of your project (if it doesn\'t exist).\n' +
    '2. Add your Google AI API key to the .env file. For example:\n' +
    '   GOOGLE_API_KEY=your_actual_api_key_here\n' +
    '   OR\n' +
    '   GOOGLE_GENAI_API_KEY=your_actual_api_key_here\n' +
    '3. Ensure the "Generative Language API" is enabled for your project in the Google Cloud Console.\n' +
    '   You can usually find this by searching for "Generative Language API" in the API Library or using a link like:\n' +
    '   https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=YOUR_PROJECT_ID (replace YOUR_PROJECT_ID)\n' +
    '4. IMPORTANT: Restart your development server after creating or modifying the .env file.\n\n'
  );
} else {
    console.log(
    '\n💡 AI Service Tip: If AI features are not working, ensure:\n' +
    '1. The correct API key is in your .env file (GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY).\n' +
    '2. The "Generative Language API" is ENABLED for your project in the Google Cloud Console.\n' +
    '   (e.g., https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=YOUR_PROJECT_ID)\n' +
    '3. Your Google Cloud project has BILLING ENABLED if required by the API.\n' +
    '4. You have RESTARTED your development server after any .env file changes.\n\n'
    );
}

// Create an instance of the Google AI plugin.
export const googleAI = genkitGoogleAI;

// Create a single, global instance of the Genkit AI object.
// This is the correct approach to avoid re-initialization issues.
export const ai: Genkit = genkit({
    plugins: [googleAI()],
});

