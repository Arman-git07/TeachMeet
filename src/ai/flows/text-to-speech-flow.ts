
'use server';
/**
 * @fileOverview A Text-to-Speech (TTS) AI flow.
 * This flow takes text and a desired voice.
 * It currently returns a silent audio placeholder and a confirmation message.
 * To enable actual audio generation, you need to:
 * 1. Ensure the '@google-cloud/text-to-speech' package is installed.
 * 2. Enable the "Text-to-Speech API" in your Google Cloud project.
 * 3. Set up authentication (Application Default Credentials or a service account key).
 * 4. Uncomment and adapt the 'ttsClient.synthesizeSpeech' call below.
 *
 * - textToSpeech - A function that handles text processing for speech.
 * - TextToSpeechInput - The input type for the textToSpeech function.
 * - TextToSpeechOutput - The return type for the textToSpeech function, including audio data URI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// To enable actual TTS, ensure @google-cloud/text-to-speech is installed and you've configured authentication.
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

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
const PLACEHOLDER_SILENT_AUDIO_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // Minimal valid WAV header for silence

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  return textToSpeechFlow(input);
}

const ttsClient = new TextToSpeechClient(); // Instantiate the client. Authentication (ADC or service account) is needed for this to work.

const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async (input: TextToSpeechInput): Promise<TextToSpeechOutput> => {
    const { textToSpeak, voice = 'neutral' } = input;
    let simulationMessage = "(Simulated audio playback. Real audio requires Google Cloud Text-to-Speech API setup.)";
    let confirmationMessage: string;
    let selectedVoiceName = 'en-US-Wavenet-C'; // Default for neutral (Female)
    let ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL' = 'FEMALE';

    switch (voice) {
      case 'boy':
        selectedVoiceName = 'en-US-Wavenet-D'; // Example Wavenet Male voice
        ssmlGender = 'MALE';
        confirmationMessage = `Attempting to play audio for "${textToSpeak}" in a boy's voice. ${simulationMessage}`;
        break;
      case 'girl':
        selectedVoiceName = 'en-US-Wavenet-F'; // Example Wavenet Female voice
        ssmlGender = 'FEMALE';
        confirmationMessage = `Attempting to play audio for "${textToSpeak}" in a girl's voice. ${simulationMessage}`;
        break;
      default: // neutral
        selectedVoiceName = 'en-US-Standard-C'; // Example Standard Female voice for neutral
        ssmlGender = 'FEMALE';
        confirmationMessage = `Attempting to play audio for "${textToSpeak}" in a neutral voice. ${simulationMessage}`;
        break;
    }
    console.log(`[TextToSpeechFlow] Selected voice preset: ${voice}, Google Voice Name: ${selectedVoiceName}, SSML Gender: ${ssmlGender}`);

    try {
      // === IMPORTANT: Real Google Cloud TTS API call (Requires setup) ===
      // To enable actual audio, uncomment the following block and ensure:
      // 1. Google Cloud Text-to-Speech API is enabled for your project.
      // 2. Billing is enabled for your project.
      // 3. Authentication is configured (e.g., `gcloud auth application-default login` or service account).
      /*
      console.log(`[TextToSpeechFlow] Sending request to Google Cloud TTS API for: "${textToSpeak}"`);
      const ttsRequest = {
        input: { text: textToSpeak },
        voice: { languageCode: 'en-US', name: selectedVoiceName, ssmlGender: ssmlGender },
        audioConfig: { audioEncoding: 'MP3' as const }, // Or 'LINEAR16' for WAV
      };
      const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
      if (!ttsResponse.audioContent) {
        throw new Error('TTS API did not return audio content.');
      }
      const audioBase64 = Buffer.from(ttsResponse.audioContent).toString('base64');
      // const audioDataUri = `data:audio/mp3;base64,${audioBase64}`; // For MP3
      const audioDataUri = `data:audio/wav;base64,${audioBase64}`; // If using LINEAR16 and want WAV
      
      // Update confirmation message for real audio
      confirmationMessage = `Playing synthesized audio for "${textToSpeak}" with ${voice} voice.`;
      console.log(`[TextToSpeechFlow] Successfully received audio from TTS API.`);
      return { audioDataUri, confirmationMessage };
      */
      // =====================================================================

      // For now, return placeholder silent audio and the simulation confirmation message.
      const audioDataUri = `data:audio/wav;base64,${PLACEHOLDER_SILENT_AUDIO_WAV_BASE64}`;
      
      // To test error states without actual API calls, you can uncomment this:
      // if (textToSpeak.toLowerCase().includes("error test")) {
      //    throw new Error("Simulated TTS API error for testing.");
      // }

      return { audioDataUri, confirmationMessage };

    } catch (error: any) {
      console.error("[TextToSpeechFlow] Error during TTS processing:", error);
      let userFriendlyMessage = `Error: Could not process text for speech. (Simulated Error Handling if API call is commented out)`;
      
      // Check for common API key issues (more relevant if using Genkit for core LLM,
      // TTS client often uses ADC or Service Accounts)
      const noGenkitApiKeyConfigured = !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY;

      if (error.message) {
         if (error.message.includes("Could not load the default credentials") || error.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
            userFriendlyMessage = "Error: Google Cloud credentials for Text-to-Speech are not configured. Please set up Application Default Credentials (e.g., run `gcloud auth application-default login` in your terminal) or provide service account credentials via environment variables.";
        } else if (error.message.toLowerCase().includes("text-to-speech api has not been used") || error.message.toLowerCase().includes("service_disabled")) {
            const projectIdMatch = error.message.match(/project(?:_id:|\s+is:|\s+)(\s*\S+?)[\s|,|\.]/i) || error.message.match(/project\/(\d+)/);
            const projectId = projectIdMatch ? (projectIdMatch[1] || projectIdMatch[2] || 'YOUR_PROJECT_ID').trim() : 'YOUR_PROJECT_ID';
            userFriendlyMessage = `Error: The Google Cloud Text-to-Speech API needs to be enabled for your project (${projectId}). Please visit the Google Cloud Console, enable the API, and wait a few minutes. Billing may also need to be enabled.`;
        } else if (noGenkitApiKeyConfigured && !error.message.includes("GOOGLE_APPLICATION_CREDENTIALS")) {
          // This error is less likely for TTS client but good for general AI service check
          userFriendlyMessage = "Error: An AI Service API Key (like GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY for Genkit LLMs) might be missing or relevant Google Cloud credentials for Text-to-Speech are not set up. Please check your environment configuration.";
        } else if (error.message.toLowerCase().includes("billing account") || error.message.toLowerCase().includes("enable billing")) {
           userFriendlyMessage = "Error: Your Google Cloud project may require a billing account to use the Text-to-Speech API. Please check its billing status in the Google Cloud Console.";
        } else if (error.message.toLowerCase().includes("permission denied") || error.message.toLowerCase().includes("forbidden")) {
            userFriendlyMessage = `Error: Permission denied for Text-to-Speech. Check credentials/API key permissions and ensure the API is enabled. Original: ${error.message}`;
        } else if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("resource_exhausted")) {
            userFriendlyMessage = `Error: Text-to-Speech API quota exceeded or resource exhausted. Check usage limits. Original: ${error.message}`;
        } else if (error.message.toLowerCase().includes("api key not valid") || error.message.toLowerCase().includes("invalid api key")) {
            userFriendlyMessage = "Error: The API Key used (if any) for Google Cloud Text-to-Speech is invalid or lacks permissions for the service. Please verify your key/credentials and its restrictions in the Google Cloud Console.";
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
