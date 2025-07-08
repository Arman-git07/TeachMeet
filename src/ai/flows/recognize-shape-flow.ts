
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

const RecognizeShapeInputSchema = z.object({
  drawingDataUri: z
    .string()
    .describe(
      "A rough drawing from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().optional().describe("An optional user prompt to guide the recognition."),
});
export type RecognizeShapeInput = z.infer<typeof RecognizeShapeInputSchema>;

const RecognizeShapeOutputSchema = z.object({
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
        { text: `The output MUST be a PNG image with a fully transparent background. Transform the user's rough drawing into a professional, high-quality, black line graphic. The final image should look like a polished vector icon with smooth, clean lines. Do not add color, shading, or background fill. Accurately interpret the object, letter, or word from the user's drawing, using their optional hint to improve accuracy. User hint: "${input.prompt || 'No hint provided.'}"` },
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
