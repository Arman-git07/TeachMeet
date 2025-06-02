
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
      if (error.message && (error.message.includes('SERVICE_DISABLED') || error.message.includes('Generative Language API has not been used'))) {
        return {
          confirmationMessage: "Error: The Generative Language API needs to be enabled in your Google Cloud project. Please visit the Google Cloud Console, find your project, and ensure the 'Generative Language API' (generativelanguage.googleapis.com) is enabled. It may take a few minutes for changes to apply."
        };
      }
      return { 
        confirmationMessage: `Error: Could not process text for speech. ${error.message || 'An unknown error occurred.'}` 
      };
    }
  }
);

