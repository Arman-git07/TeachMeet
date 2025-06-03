
'use server';
/**
 * @fileOverview A Genkit flow for translating text and synthesizing it into speech.
 *
 * - translateAndSpeakFlow - Translates text and generates spoken audio.
 * - TranslateAndSpeakInput - Input schema for the flow.
 * - TranslateAndSpeakOutput - Output schema for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {TextToSpeechClient} from '@google-cloud/text-to-speech';

const TranslateAndSpeakInputSchema = z.object({
  textToTranslate: z.string().describe('The text to be translated and spoken.'),
  sourceLanguageCode: z.string().describe('The BCP-47 language code of the input text (e.g., "en-US", "hi-IN").'),
  targetLanguageCode: z.string().describe('The BCP-47 language code for the translation and speech output (e.g., "en-US", "es-ES").'),
  voiceGender: z.enum(['male', 'female', 'neutral']).describe('The preferred gender for the synthesized voice.'),
});
export type TranslateAndSpeakInput = z.infer<typeof TranslateAndSpeakInputSchema>;

const TranslateAndSpeakOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
  audioDataUri: z.string().describe("The synthesized audio as a Base64-encoded data URI. Format: 'data:audio/wav;base64,<encoded_data>'."),
  confirmationMessage: z.string().describe('A message confirming the operation and voices used.'),
});
export type TranslateAndSpeakOutput = z.infer<typeof TranslateAndSpeakOutputSchema>;

const translationPrompt = ai.definePrompt({
    name: 'translationPromptForSpeakFlow',
    input: { schema: z.object({ textToTranslate: z.string(), sourceLanguageCode: z.string(), targetLanguageCode: z.string() }) },
    output: { schema: z.object({ translatedText: z.string() }) },
    prompt: `Translate the following text from {{sourceLanguageCode}} to {{targetLanguageCode}}: {{{textToTranslate}}}

    Provide only the translated text, without any introductory phrases or explanations.`,
});

const ttsClient = new TextToSpeechClient();

async function synthesizeSpeech(text: string, languageCode: string, ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL'): Promise<string> {
  let voiceName;
  // Basic voice selection, can be expanded with more specific Wavenet voices
  switch (languageCode.substring(0, 2)) {
    case 'en':
      voiceName = ssmlGender === 'MALE' ? 'en-US-Wavenet-D' : ssmlGender === 'FEMALE' ? 'en-US-Wavenet-F' : 'en-US-Wavenet-A';
      break;
    case 'es':
      voiceName = ssmlGender === 'MALE' ? 'es-ES-Wavenet-B' : ssmlGender === 'FEMALE' ? 'es-ES-Wavenet-C' : 'es-ES-Wavenet-A';
      break;
    case 'hi':
      voiceName = ssmlGender === 'MALE' ? 'hi-IN-Wavenet-B' : ssmlGender === 'FEMALE' ? 'hi-IN-Wavenet-A' : 'hi-IN-Wavenet-D';
      break;
    case 'fr':
      voiceName = ssmlGender === 'MALE' ? 'fr-FR-Wavenet-B' : ssmlGender === 'FEMALE' ? 'fr-FR-Wavenet-A' : 'fr-FR-Wavenet-E';
      break;
    case 'de':
      voiceName = ssmlGender === 'MALE' ? 'de-DE-Wavenet-B' : ssmlGender === 'FEMALE' ? 'de-DE-Wavenet-A' : 'de-DE-Wavenet-F';
      break;
    default: // Fallback to English if language not specifically handled
      voiceName = ssmlGender === 'MALE' ? 'en-US-Wavenet-D' : ssmlGender === 'FEMALE' ? 'en-US-Wavenet-F' : 'en-US-Wavenet-A';
  }

  const request = {
    input: { text: text },
    voice: { languageCode: languageCode, name: voiceName, ssmlGender: ssmlGender },
    audioConfig: { audioEncoding: 'LINEAR16' as const, sampleRateHertz: 24000 }, // WAV format
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    if (response.audioContent instanceof Uint8Array) {
      const audioBase64 = Buffer.from(response.audioContent).toString('base64');
      return `data:audio/wav;base64,${audioBase64}`;
    }
    throw new Error('Audio content is not Uint8Array');
  } catch (error: any) {
    console.error('Google Cloud TTS API Error:', error);
    const defaultSilentWav = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQIAAAD//w=="; // Short silent WAV
    
    let detail = `Failed to synthesize speech. Please ensure the Text-to-Speech API is enabled, billing is configured, and authentication (ADC) is set up for your project.`;
    if (error.code === 5) { // NOT_FOUND, often for invalid voice or language
      detail = `TTS Error: Voice for language '${languageCode}' with gender '${ssmlGender}' might be unavailable or language code is invalid. Original error: ${error.message}`;
    } else if (error.code === 7) { // PERMISSION_DENIED
        detail = `TTS Error: Permission denied. Check API key, ADC, and ensure Text-to-Speech API is enabled and billing is active. Original error: ${error.message}`;
    } else if (error.code === 3) { // INVALID_ARGUMENT
        detail = `TTS Error: Invalid argument. This might be due to unsupported text characters or an issue with the voice configuration. Original error: ${error.message}`;
    } else if (error.details) {
        detail += ` Details: ${error.details}`;
    }

    throw new Error(detail); // Re-throw a more informative error
  }
}

export const translateAndSpeakFlow = ai.defineFlow(
  {
    name: 'translateAndSpeakFlow',
    inputSchema: TranslateAndSpeakInputSchema,
    outputSchema: TranslateAndSpeakOutputSchema,
  },
  async (input) => {
    let translatedText = '';
    let audioDataUri = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQIAAAD//w=="; // Default silent WAV
    let confirmationMessage = '';

    try {
      // Step 1: Translate text
      const translationResponse = await translationPrompt({
        textToTranslate: input.textToTranslate,
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: input.targetLanguageCode,
      });
      
      if (!translationResponse.output?.translatedText) {
        throw new Error('Translation failed or returned empty text.');
      }
      translatedText = translationResponse.output.translatedText;

      // Step 2: Synthesize translated text to speech
      const ssmlGender = input.voiceGender.toUpperCase() as 'MALE' | 'FEMALE' | 'NEUTRAL';
      audioDataUri = await synthesizeSpeech(translatedText, input.targetLanguageCode, ssmlGender);
      
      confirmationMessage = `Successfully translated to ${input.targetLanguageCode} and synthesized with ${input.voiceGender} voice.`;

      return {
        translatedText,
        audioDataUri,
        confirmationMessage,
      };

    } catch (error: any) {
      console.error('[translateAndSpeakFlow] Error:', error);
      // Construct a user-friendly error message. The detailed error is logged above.
      let userError = `Failed to process your request.`;
      if (error.message.includes("Translation failed")) {
          userError = `Translation step failed. Please check the input text and languages. Original error: ${error.message}`;
      } else if (error.message.includes("TTS Error") || error.message.includes("synthesize speech")) {
          userError = `Speech synthesis failed. ${error.message}`; // Use the more informative error from synthesizeSpeech
      } else {
          userError = `An unexpected error occurred: ${error.message}`;
      }
      
      // Return a structured error in the output schema format, or rethrow if preferred
      // For now, we'll provide a fallback response with the error in the confirmation.
      return {
        translatedText: translatedText || "(Translation failed)",
        audioDataUri: audioDataUri, // Return silent WAV on error
        confirmationMessage: `Error: ${userError}`,
      };
    }
  }
);

export async function translateAndSpeak(input: TranslateAndSpeakInput): Promise<TranslateAndSpeakOutput> {
  return translateAndSpeakFlow(input);
}
