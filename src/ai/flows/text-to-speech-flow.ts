
'use server';
/**
 * @fileOverview A Text-to-Speech (TTS) AI flow (simulated).
 *
 * - textToSpeech - A function that handles text processing for simulated speech.
 * - TextToSpeechInput - The input type for the textToSpeech function.
 * - TextToSpeechOutput - The return type for the textToSpeech function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TextToSpeechInputSchema = z.object({
  textToSpeak: z.string().describe('The text to be converted to audio.'),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  confirmationMessage: z.string().describe('A message confirming the text was processed for speech and would be played, or an error message.'),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  return textToSpeechFlow(input);
}

const ttsPrompt = ai.definePrompt({
  name: 'textToSpeechPrompt',
  input: {schema: TextToSpeechInputSchema},
  output: {schema: TextToSpeechOutputSchema},
  prompt: `You are a helpful assistant in a meeting app. The user wants to convert the following text to speech:
Text: "{{{textToSpeak}}}"

Confirm that this text would now be played as audio in the meeting. Keep the confirmation concise. Example: "Playing audio for: [User's Text]"`,
});

const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async input => {
    try {
      const {output} = await ttsPrompt(input);
      if (!output || !output.confirmationMessage) {
          return { confirmationMessage: `Audio for: "${input.textToSpeak}" would be played now (simulated).` };
      }
      return output;
    } catch (error: any) {
      console.error("[TextToSpeechFlow] Error during TTS prompt:", error);
      let userFriendlyMessage = "Error: Could not process text for speech.";

      if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
        userFriendlyMessage = "Error: AI Service API Key is not configured. Please ensure GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY is set in your .env file and the application is restarted.";
      } else if (error && typeof error.message === 'string') {
        const errMsg = error.message.toLowerCase();
        if (errMsg.includes('service_disabled') || errMsg.includes('generative language api has not been used')) {
          // Provide a general link if project ID isn't easily extractable or for privacy.
          userFriendlyMessage = "Error: The Generative Language API needs to be enabled for your Google Cloud project. Please visit https://console.developers.google.com/apis/library/generativelanguage.googleapis.com, select your project, and enable the API. It may take a few minutes for this change to apply.";
        } else if (errMsg.includes('api key not valid') || errMsg.includes('invalid api key') || errMsg.includes('api_key_not_valid')) {
          userFriendlyMessage = "Error: The AI Service API Key is invalid or has restrictions. Please check your GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY in the .env file and ensure it has permissions for the Generative Language API.";
        } else if (errMsg.includes('billing account') || errMsg.includes('enable billing')) {
          userFriendlyMessage = "Error: Your Google Cloud project may require a billing account to use the Generative Language API. Please check its billing status in the Google Cloud Console.";
        } else if (errMsg.includes('permission denied') || errMsg.includes('forbidden')) {
            userFriendlyMessage = `Error: Permission denied. This could be due to API key restrictions, the API not being enabled, or network/firewall issues. Please verify API settings and permissions. Original message: ${error.message}`;
        } else if (errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
            userFriendlyMessage = `Error: API quota exceeded or resource exhausted. Please check your usage limits in the Google Cloud Console. Original message: ${error.message}`;
        } else {
          userFriendlyMessage += ` Details: ${error.message}`;
        }
      } else if (error && typeof error.toString === 'function') {
        userFriendlyMessage += ` Details: ${error.toString()}`;
      } else {
        userFriendlyMessage += " An unknown error occurred.";
      }
      
      return { confirmationMessage: userFriendlyMessage };
    }
  }
);

