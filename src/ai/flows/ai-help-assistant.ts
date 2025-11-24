
'use server';
/**
 * @fileOverview An AI Help Assistant flow.
 *
 * This file defines a Genkit flow that uses the Gemini model to answer
 * user questions. It is designed to be called from the app's API routes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AiHelpAssistantInputSchema = z.object({
  question: z.string().describe('The user question for the AI assistant.'),
});
export type AiHelpAssistantInput = z.infer<typeof AiHelpAssistantInputSchema>;


const AiHelpAssistantOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer.'),
});
export type AiHelpAssistantOutput = z.infer<typeof AiHelpAssistantOutputSchema>;


export async function aiHelpAssistantFlow(
  input: AiHelpAssistantInput
): Promise<AiHelpAssistantOutput> {
  const llmResponse = await ai().generate({
    prompt: input.question,
    model: 'googleai/gemini-pro',
    config: {
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      ],
    },
  });

  return { answer: llmResponse.text };
}
