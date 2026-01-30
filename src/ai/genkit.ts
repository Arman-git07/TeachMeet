'use server';

import {genkit, type Genkit} from 'genkit';
import {googleAI as genkitGoogleAI} from '@genkit-ai/google-genai';


// NOTE: The API key check was moved inside functions that use AI,
// to prevent build-time errors when the key is not set in the build environment.
// The app will now build successfully, and a warning will be shown at runtime
// if an AI feature is used without the key.

// Export the plugin so it can be used to reference models safely.
export const googleAI = genkitGoogleAI;

// Create a single, global instance of the Genkit AI object.
// This is the recommended approach to avoid re-initialization issues
// and ensure a single point of configuration for Genkit.
export const ai: Genkit = genkit({
    plugins: [googleAI()], // Pass the plugin object directly
});
