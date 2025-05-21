
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
  console.warn(
    '\n\n⚠️ WARNING: GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY is not set in the environment. ⚠️\n' +
    'AI features, such as the Help Assistant, will likely fail.\n' +
    'To resolve this:\n' +
    '1. Create a file named .env in the root of your project (if it doesn\'t exist).\n' +
    '2. Add your Google AI API key to the .env file. For example:\n' +
    '   GOOGLE_API_KEY=your_actual_api_key_here\n' +
    '3. Restart your development server.\n\n'
  );
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
