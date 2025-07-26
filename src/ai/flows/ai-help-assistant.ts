import { generate } from '@genkit-ai/ai';
// Removed configureGenkit import
import { defineFlow, runFlow } from '@genkit-ai/flow';
import { googleAI } from '@genkit-ai/googleai';
import * as z from 'zod';

// Removed configureGenkit call

export const aiHelpAssistantFlow = defineFlow(
  {
    name: 'aiHelpAssistantFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (prompt) => {
    const result = await generate(
      googleAI.model('gemini-pro'), // Model as the first argument
      {
        prompt: prompt, // Prompt within the input object
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
        ],
      }
    );

    return result.text();
  }
);