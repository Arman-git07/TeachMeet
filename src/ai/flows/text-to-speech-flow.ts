'use server';
/**
 * @fileOverview A Text-to-Speech (TTS) AI flow.
 * This flow takes text and a desired voice.
 * It attempts to generate real audio using the Google Cloud Text-to-Speech API.
 *
 * Prerequisites for real audio:
 * 1. Ensure the '@google-cloud/text-to-speech' package is installed (already in package.json).
 * 2. Enable the "Text-to-Speech API" in your Google Cloud project.
 * 3. Ensure Billing is enabled for your Google Cloud project.
 * 4. Set up authentication for the Text-to-Speech client library. This typically means:
 *    - For local development: Run `gcloud auth application-default login` in your terminal.
 *    - For deployment: Use a service account with appropriate permissions.
 *
 * - textToSpeech - A function that handles text processing for speech.
 * - TextToSpeechInput - The input type for the textToSpeech function.
 * - TextToSpeechOutput - The return type for the textToSpeech function, including audio data URI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const TextToSpeechInputSchema = z.object({
  textToSpeak: z.string().describe('The text to be converted to audio. Can be a regular phrase or a special command like "PLAY_MALE_EXAMPLE".'),
  voice: z.enum(['neutral', 'boy', 'girl']).optional().describe('The desired voice for the speech. Defaults to neutral if not specified.'),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe('The audio data as a Data URI (e.g., data:audio/mp3;base64,...).'),
  confirmationMessage: z.string().optional().describe('A message confirming the text was processed for speech, or an error message.'),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

// Placeholder for a tiny, silent WAV file as a base64 data URI, used if API call fails catastrophically before returning.
const FALLBACK_SILENT_AUDIO_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const ttsClient = new TextToSpeechClient(); // Instantiate the client. ADC or service account needed.

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  return textToSpeechFlow(input);
}

const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async (input: TextToSpeechInput): Promise<TextToSpeechOutput> => {
    const { textToSpeak: rawTextToSpeak, voice = 'neutral' } = input;
    let confirmationMessage: string;
    let textToSynthesize: string = rawTextToSpeak;

    // Define Google Cloud TTS voice names and SSML gender
    // Wavenet voices generally offer higher quality.
    let selectedVoiceName: string;
    let ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';

    // Handle example playback requests
    const isExamplePlayback = rawTextToSpeak.startsWith("PLAY_") && rawTextToSpeech.endsWith("_EXAMPLE");

    switch (voice) {
      case 'boy':
        selectedVoiceName = 'en-US-Wavenet-D'; // Standard Wavenet Male voice
        ssmlGender = 'MALE';
        if (isExamplePlayback && rawTextToSpeak === "PLAY_MALE_EXAMPLE") {
          textToSynthesize = "Hi, this is a male voice.";
          confirmationMessage = `Playing example: "${textToSynthesize}" (Boy's voice).`;
        } else if (isExamplePlayback) { // Mismatched example request
            textToSynthesize = "Voice example mismatch.";
            confirmationMessage = `Requested ${voice} voice example, but command was ${rawTextToSpeak}. Playing default example for ${voice}.`;
        } else {
          confirmationMessage = `Generating audio for "${textToSynthesize}" in a boy's voice.`;
        }
        break;
      case 'girl':
        selectedVoiceName = 'en-US-Wavenet-F'; // Standard Wavenet Female voice
        ssmlGender = 'FEMALE';
         if (isExamplePlayback && rawTextToSpeak === "PLAY_FEMALE_EXAMPLE") {
          textToSynthesize = "Hi, this is a female voice.";
          confirmationMessage = `Playing example: "${textToSynthesize}" (Girl's voice).`;
        } else if (isExamplePlayback) {
            textToSynthesize = "Voice example mismatch.";
            confirmationMessage = `Requested ${voice} voice example, but command was ${rawTextToSpeak}. Playing default example for ${voice}.`;
        } else {
          confirmationMessage = `Generating audio for "${textToSynthesize}" in a girl's voice.`;
        }
        break;
      default: // neutral
        selectedVoiceName = 'en-US-Wavenet-C'; // Standard Wavenet Female voice for neutral
        ssmlGender = 'FEMALE';
        if (isExamplePlayback && rawTextToSpeak === "PLAY_NEUTRAL_EXAMPLE") {
          textToSynthesize = "Hi, this is a neutral voice.";
          confirmationMessage = `Playing example: "${textToSynthesize}" (Neutral voice).`;
        } else if (isExamplePlayback) {
            textToSynthesize = "Voice example mismatch.";
            confirmationMessage = `Requested ${voice} voice example, but command was ${rawTextToSpeak}. Playing default example for ${voice}.`;
        } else {
          confirmationMessage = `Generating audio for "${textToSynthesize}" in a neutral voice.`;
        }
        break;
    }
    console.log(`[TextToSpeechFlow] Input text: "${rawTextToSpeak}", Voice preset: ${voice}, Synthesizing: "${textToSynthesize}", Google Voice Name: ${selectedVoiceName}, SSML Gender: ${ssmlGender}`);

    try {
      console.log(`[TextToSpeechFlow] Sending request to Google Cloud TTS API for: "${textToSynthesize}"`);
      const ttsRequest = {
        input: { text: textToSynthesize },
        voice: { languageCode: 'en-US', name: selectedVoiceName, ssmlGender: ssmlGender },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);

      if (!ttsResponse.audioContent) {
        throw new Error('TTS API did not return audio content.');
      }

      const audioBase64 = Buffer.from(ttsResponse.audioContent).toString('base64');
      const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
      
      // Update confirmation message for real audio if it wasn't an example
      if (!isExamplePlayback) {
          confirmationMessage = `Playing synthesized audio for "${textToSynthesize}" with ${voice} voice.`;
      } // For examples, confirmationMessage is already set.

      console.log(`[TextToSpeechFlow] Successfully received audio from TTS API.`);
      return { audioDataUri, confirmationMessage };

    } catch (error: any) {
      console.error("[TextToSpeechFlow] Error during TTS processing:", error);
      let userFriendlyMessage = `Error: Could not process text for speech.`;
      
      const noGenkitApiKeyConfigured = !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY;

      if (error.message) {
         if (error.message.includes("Could not load the default credentials") || error.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
            userFriendlyMessage = "Error: Google Cloud credentials for Text-to-Speech are not configured. Please set up Application Default Credentials (e.g., run `gcloud auth application-default login` in your terminal) or provide service account credentials via environment variables.";
        } else if (error.message.toLowerCase().includes("text-to-speech api has not been used") || error.message.toLowerCase().includes("service_disabled") || error.message.toLowerCase().includes("api not enabled") ) {
            const projectIdMatch = error.message.match(/project(?:_id:|\s+is:|\s+)(\s*\S+?)[\s|,|\.]/i) || error.message.match(/project\/(\d+)/);
            const projectId = projectIdMatch ? (projectIdMatch[1] || projectIdMatch[2] || 'YOUR_PROJECT_ID').trim() : 'YOUR_PROJECT_ID';
            userFriendlyMessage = `Error: The Google Cloud Text-to-Speech API needs to be enabled for your project (${projectId}). Please visit the Google Cloud Console, enable the API, and wait a few minutes. Billing may also need to be enabled.`;
        } else if (noGenkitApiKeyConfigured && !error.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
          userFriendlyMessage = "Error: An AI Service API Key (like GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY for Genkit LLMs) might be missing or relevant Google Cloud credentials for Text-to-Speech are not set up. Please check your environment configuration. Ensure ADC is set up for TTS (`gcloud auth application-default login`).";
        } else if (error.message.toLowerCase().includes("billing account") || error.message.toLowerCase().includes("enable billing")) {
           userFriendlyMessage = "Error: Your Google Cloud project may require a billing account to use the Text-to-Speech API. Please check its billing status in the Google Cloud Console.";
        } else if (error.message.toLowerCase().includes("permission denied") || error.message.toLowerCase().includes("forbidden")) {
            userFriendlyMessage = `Error: Permission denied for Text-to-Speech. Check credentials/API key permissions and ensure the API is enabled. Original: ${error.message}`;
        } else if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("resource_exhausted")) {
            userFriendlyMessage = `Error: Text-to-Speech API quota exceeded or resource exhausted. Check usage limits. Original: ${error.message}`;
        } else if (error.message.toLowerCase().includes("api key not valid") || error.message.toLowerCase().includes("invalid api key")) {
            // This is less common for TTS client library but good to catch
            userFriendlyMessage = "Error: The API Key used (if any) for Google Cloud Text-to-Speech is invalid or lacks permissions for the service. Please verify your key/credentials and its restrictions in the Google Cloud Console. TTS client often uses ADC.";
        } else if (error.message.includes('TTS API did not return audio content.')) {
            userFriendlyMessage = "Error: The Text-to-Speech API call was successful but returned no audio data. This might be due to an issue with the input text or selected voice configuration on the API side."
        }
         else {
            userFriendlyMessage = `Error processing speech. Details: ${error.message}`;
        }
      }
      // Return placeholder audio even on error, but with error message for toast
      return { 
        audioDataUri: `data:audio/wav;base64,${FALLBACK_SILENT_AUDIO_WAV_BASE64}`, 
        confirmationMessage: userFriendlyMessage
      };
    }
  }
);
