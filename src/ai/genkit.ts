
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
  console.warn(
    '\n\n⚠️ WARNING: GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY is not set in the environment. ⚠️\n' +
    'AI features, such as the Help Assistant and Text-to-Speech, will likely fail.\n' +
    'To resolve this:\n' +
    '1. Create a file named .env in the root of your project (if it doesn\'t exist).\n' +
    '2. Add your Google AI API key to the .env file. For example:\n' +
    '   GOOGLE_API_KEY=your_actual_api_key_here\n' +
    '3. Ensure the "Generative Language API" is enabled for your project in the Google Cloud Console.\n' +
    '   You can usually find this by searching for "Generative Language API" in the API Library or using a link like:\n' +
    '   https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=YOUR_PROJECT_ID (replace YOUR_PROJECT_ID)\n' +
    '4. Restart your development server.\n\n'
  );
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

