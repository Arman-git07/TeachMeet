
'use server';
/**
 * @fileOverview An AI agent for recognizing and refining user drawings on a whiteboard.
 *
 * - recognizeShape - A function that takes a rough drawing and returns a refined version.
 * - RecognizeShapeInput - The input type for the function.
 * - RecognizeShapeOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import { z } from 'zod';
import { GenerateContentRequest, GoogleGenerativeAI } from '@google/generative-ai';

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

// Helper function to convert Data URI to a format the Google AI SDK expects
function dataUriToGoogleGenerativeAIContent(uri: string) {
  const [fileInfo, base64] = uri.split(',');
  const mimeType = fileInfo.split(':')[1].split(';')[0];
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}


export async function recognizeShape(input: RecognizeShapeInput): Promise<RecognizeShapeOutput> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });

  // Base prompt instructions
  let textPrompt = `You are a sophisticated graphic design assistant. Your task is to transform a user's rough drawing into a professional, clean, and high-quality graphic.

  **Instructions:**
  1.  Analyze the provided image and the user's text prompt.
  2.  If the user prompt is a letter, word, or number (e.g., "A", "Hello", "123"), generate that text in a creative, stylized, artistic font. The text should be black.
  3.  If the user prompt is a description (e.g., "a bird", "a house", "peacock"), generate a clean, iconic representation of that object, inspired by the user's drawing.
  4.  The final output MUST be a black line drawing on a fully transparent background. It should resemble a polished vector icon with smooth, clean lines.
  5.  Do NOT add color, shading, or any background fill. The background must be transparent.
  
  **User's Prompt:** "${input.prompt || 'No hint provided. Interpret the drawing.'}"
  `;

  const imagePart = dataUriToGoogleGenerativeAIContent(input.drawingDataUri);

  const request: GenerateContentRequest = {
    contents: [{ role: 'user', parts: [imagePart, { text: textPrompt }] }],
    generationConfig: {
      responseMimeType: "image/png",
    },
  };

  const result = await model.generateContent(request);
  const response = result.response;
  
  if (!response.candidates?.length || !response.candidates[0].content.parts.length) {
    throw new Error('Image generation failed to produce an output.');
  }

  const imagePartFromResponse = response.candidates[0].content.parts.find(part => part.inlineData);

  if (!imagePartFromResponse || !imagePartFromResponse.inlineData) {
    throw new Error('No image data found in the AI response.');
  }
  
  const base64Data = imagePartFromResponse.inlineData.data;
  const mimeType = imagePartFromResponse.inlineData.mimeType;
  
  return {
    refinedImageUri: `data:${mimeType};base64,${base64Data}`,
  };
}

