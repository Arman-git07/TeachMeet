
'use server';

import {genkit, type Genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Check if the required API key is set in the environment variables.
if (!process.env.GOOGLE_API_KEY) {
  console.warn(
    '\n\n⚠️  WARNING: The GOOGLE_API_KEY environment variable is not set. ⚠️\n' +
    'The AI features of this application will not work without it.\n\n' +
    'To fix this, please do the following:\n' +
    '1. Create a file named ".env" in the root directory of your project.\n' +
    '2. Add your Google AI API key to the .env file like this:\n' +
    '   GOOGLE_API_KEY=your_actual_api_key_here\n' +
    '3. Ensure the "Generative Language API" is enabled for your project in the Google Cloud Console.\n' +
    '4. Restart your development server for the changes to take effect.\n\n'
  );
}

// Create a single, global instance of the Genkit AI object.
// This is the recommended approach to avoid re-initialization issues
// and ensure a single point of configuration for Genkit.
export const ai: Genkit = genkit({
    plugins: [googleAI], // Correct: Pass the plugin object directly
});
