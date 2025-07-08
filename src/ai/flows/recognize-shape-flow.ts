
'use server';
/**
 * @fileOverview An AI agent for recognizing and refining user drawings on a whiteboard.
 *
 * - recognizeShape - A function that takes a rough drawing and returns a refined version.
 * - RecognizeShapeInput - The input type for the function.
 * - RecognizeShapeOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const RecognizeShapeInputSchema = z.object({
  drawingDataUri: z
    .string()
    .describe(
      "A rough drawing from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().optional().describe("An optional user prompt to guide the recognition."),
});
export type RecognizeShapeInput = z.infer<typeof RecognizeShapeInputSchema>;

export const RecognizeShapeOutputSchema = z.object({
  refinedImageUri: z.string().describe("The data URI of the refined, generated image with a transparent background."),
});
export type RecognizeShapeOutput = z.infer<typeof RecognizeShapeOutputSchema>;

export async function recognizeShape(input: RecognizeShapeInput): Promise<RecognizeShapeOutput> {
  return recognizeShapeFlow(input);
}

const recognizeShapeFlow = ai.defineFlow(
  {
    name: 'recognizeShapeFlow',
    inputSchema: RecognizeShapeInputSchema,
    outputSchema: RecognizeShapeOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        { media: { url: input.drawingDataUri } },
        { text: `You are a helpful design assistant on a digital whiteboard app. A user has provided a rough drawing. Your task is to interpret the drawing and generate a clean, simple, black and white line drawing of the object. The background of the generated image MUST be transparent. The lines should be solid black. Do not add any color, shading, or complex details. The style should be minimalist and clear, like an icon. ${input.prompt || ''}` },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
      throw new Error('Image generation failed to produce an output.');
    }
    
    return {
      refinedImageUri: media.url,
    };
  }
);
