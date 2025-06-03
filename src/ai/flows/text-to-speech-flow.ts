
'use server';
/**
 * @fileOverview A Text-to-Speech (TTS) AI flow.
 * This flow takes text and a desired voice, and (currently simulates) returning audio data.
 * For actual audio, the Google Cloud Text-to-Speech client library should be used here.
 *
 * - textToSpeech - A function that handles text processing for speech.
 * - TextToSpeechInput - The input type for the textToSpeech function.
 * - TextToSpeechOutput - The return type for the textToSpeech function, including audio data URI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// To enable actual TTS, uncomment the next line and ensure @google-cloud/text-to-speech is installed.
// import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const TextToSpeechInputSchema = z.object({
  textToSpeak: z.string().describe('The text to be converted to audio.'),
  voice: z.enum(['neutral', 'boy', 'girl']).optional().describe('The desired voice for the speech. Defaults to neutral if not specified.'),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe('The audio data as a Data URI (e.g., data:audio/mp3;base64,...). Currently a placeholder for silent audio.'),
  confirmationMessage: z.string().optional().describe('A message confirming the text was processed for speech, or an error message.'),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

// Placeholder for a tiny, silent WAV file as a base64 data URI.
// Replace this with actual audio data from the TTS API in a real implementation.
const PLACEHOLDER_SILENT_AUDIO_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // Minimal valid WAV header for silence

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  return textToSpeechFlow(input);
}

// const ttsClient = new TextToSpeechClient(); // Instantiate the client if using actual Google Cloud TTS

const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async (input: TextToSpeechInput): Promise<TextToSpeechOutput> => {
    const { textToSpeak, voice = 'neutral' } = input;
    let confirmationMessage: string;
    let selectedVoiceName = 'en-US-Wavenet-C'; // Default for neutral (Female)
    let ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL' = 'FEMALE';

    switch (voice) {
      case 'boy':
        selectedVoiceName = 'en-US-Wavenet-D'; // Example Male voice
        ssmlGender = 'MALE';
        confirmationMessage = `Audio for "${textToSpeak}" in a boy's voice would play now. (Audio playback simulated)`;
        break;
      case 'girl':
        selectedVoiceName = 'en-US-Wavenet-F'; // Example Female voice
        ssmlGender = 'FEMALE';
        confirmationMessage = `Audio for "${textToSpeak}" in a girl's voice would play now. (Audio playback simulated)`;
        break;
      default: // neutral
        confirmationMessage = `Audio for "${textToSpeak}" in a neutral voice would play now. (Audio playback simulated)`;
        break;
    }

    try {
      // === Real Google Cloud TTS API call (to be implemented by user) ===
      // const ttsRequest = {
      //   input: { text: textToSpeak },
      //   voice: { languageCode: 'en-US', name: selectedVoiceName, ssmlGender: ssmlGender },
      //   audioConfig: { audioEncoding: 'MP3' as const },
      // };
      // const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
      // if (!ttsResponse.audioContent) {
      //   throw new Error('TTS API did not return audio content.');
      // }
      // const audioBase64 = Buffer.from(ttsResponse.audioContent).toString('base64');
      // const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
      // =====================================================================

      // For now, return placeholder silent audio and the confirmation message.
      const audioDataUri = `data:audio/wav;base64,${PLACEHOLDER_SILENT_AUDIO_WAV_BASE64}`;
      
      // Update confirmation message to reflect actual audio attempt
      if (voice === 'boy') confirmationMessage = `Playing audio for "${textToSpeak}" in a boy's voice. (Audio playback simulated)`;
      else if (voice === 'girl') confirmationMessage = `Playing audio for "${textToSpeak}" in a girl's voice. (Audio playback simulated)`;
      else confirmationMessage = `Playing audio for "${textToSpeak}" in a neutral voice. (Audio playback simulated)`;
      
      // To test error states without actual API calls
      // if (textToSpeak.toLowerCase().includes("error test")) {
      //    throw new Error("Simulated TTS API error for testing.");
      // }

      return { audioDataUri, confirmationMessage };

    } catch (error: any) {
      console.error("[TextToSpeechFlow] Error during TTS processing:", error);
      let userFriendlyMessage = `Error: Could not process text for speech. (Simulated Error Handling)`;
      
      const noApiKeyConfigured = !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY;

      // This error handler is more relevant if you are using the Google Cloud Client library
      // which often uses Application Default Credentials or Service Accounts.
      if (noApiKeyConfigured && !(error.message && error.message.includes("GOOGLE_APPLICATION_CREDENTIALS"))) {
        userFriendlyMessage = "Error: AI Service API Key (GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY) is not configured in .env, OR Google Cloud Application Default Credentials are not set up for Text-to-Speech. Please check your environment configuration.";
      } else if (error.message) {
         if (error.message.includes("Could not load the default credentials") || error.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
            userFriendlyMessage = "Error: Google Cloud credentials for Text-to-Speech are not configured. Please set up Application Default Credentials (e.g., via `gcloud auth application-default login`) or provide service account credentials.";
        } else if (error.message.toLowerCase().includes("text-to-speech api has not been used") || error.message.toLowerCase().includes("service_disabled")) {
            const projectIdMatch = error.message.match(/project(?:_id:|\s+is:|\s+)(\s*\S+?)[\s|,|\.]/i) || error.message.match(/project\/(\d+)/);
            const projectId = projectIdMatch ? (projectIdMatch[1] || projectIdMatch[2] || 'YOUR_PROJECT_ID').trim() : 'YOUR_PROJECT_ID';
            userFriendlyMessage = `Error: The Google Cloud Text-to-Speech API needs to be enabled for your project (${projectId}). Please visit the Google Cloud Console, enable the API, and wait a few minutes.`;
        } else if (error.message.toLowerCase().includes("billing account") || error.message.toLowerCase().includes("enable billing")) {
           userFriendlyMessage = "Error: Your Google Cloud project may require a billing account to use the Text-to-Speech API. Please check its billing status in the Google Cloud Console.";
        } else if (error.message.toLowerCase().includes("permission denied") || error.message.toLowerCase().includes("forbidden")) {
            userFriendlyMessage = `Error: Permission denied for Text-to-Speech. Check API key/credentials permissions and ensure the API is enabled. Original: ${error.message}`;
        } else if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("resource_exhausted")) {
            userFriendlyMessage = `Error: Text-to-Speech API quota exceeded or resource exhausted. Check usage limits. Original: ${error.message}`;
        } else if (error.message.toLowerCase().includes("api key not valid") || error.message.toLowerCase().includes("invalid api key")) {
            userFriendlyMessage = "Error: The API Key for Google Cloud Text-to-Speech is invalid or lacks permissions for the service. Please verify your key and its restrictions in the Google Cloud Console.";
        } else {
            userFriendlyMessage = `Error processing speech. Details: ${error.message}`;
        }
      }
      // Return placeholder audio even on error, but with error message for toast
      return { 
        audioDataUri: `data:audio/wav;base64,${PLACEHOLDER_SILENT_AUDIO_WAV_BASE64}`, 
        confirmationMessage: userFriendlyMessage
      };
    }
  }
);
