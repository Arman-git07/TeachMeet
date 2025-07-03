// This is an AI-powered chat assistant that can answer common questions about using TeachMeet, helping users resolve issues and learn how to use the app effectively.

'use server';

import {ai, googleAI} from '@/ai/genkit';
import {z} from 'genkit';

const AiHelpAssistantInputSchema = z.object({
  question: z.string().describe('The user question about TeachMeet.'),
});
export type AiHelpAssistantInput = z.infer<typeof AiHelpAssistantInputSchema>;

const AiHelpAssistantOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question.'),
});
export type AiHelpAssistantOutput = z.infer<typeof AiHelpAssistantOutputSchema>;

export async function aiHelpAssistant(input: AiHelpAssistantInput): Promise<AiHelpAssistantOutput> {
  return aiHelpAssistantFlow(input);
}

const faqData = `
{
  "faqs": [
    {
      "question": "How do I start a new meeting?",
      "answer": "To start a new meeting, click the 'Start New Meeting' button on the main screen or in the left sidebar. If you are not logged in, you will be redirected to the sign-in page."
    },
    {
      "question": "How do I join a meeting?",
      "answer": "To join a meeting, click the 'Join Meeting' button and enter the meeting code or link. If you are not logged in, you will be redirected to the sign-in page."
    },
    {
      "question": "How do I change my camera or microphone settings?",
      "answer": "Before joining a meeting, you can adjust your camera and microphone settings in the waiting area. Once in the meeting, you can find these settings in the meeting controls at the bottom of the screen."
    },
    {
      "question": "How do I share my screen?",
      "answer": "During a meeting, click the screen share icon located in the top right corner of the screen. Select the screen or application window you want to share."
    },
    {
      "question": "How do I access the whiteboard?",
      "answer": "The whiteboard option is located in the top right corner during the meeting. Click the whiteboard icon to open a collaborative whiteboard."
    },
    {
      "question": "How do I customize the whiteboard?",
      "answer": "You can customize the whiteboard colors and tools in the settings menu, accessible from the top right corner during the meeting."
    },
    {
      "question": "How do I raise my hand?",
      "answer": "Click the raise hand button at the bottom of the screen during a meeting to signal that you have a question or comment."
    },
    {
      "question": "Where can I find help and settings?",
      "answer": "You can access the help section and settings by clicking the corresponding buttons in the left sidebar or the icons located in the top right corner during the meeting."
    },
    {
      "question": "How do I sign up for TeachMeet?",
      "answer": "Click the 'Sign Up' button in the left sidebar to create a new account. You will need to provide your email, password, and confirm your password."
    },
    {
      "question": "How do I reset my password?",
      "answer": "If you forgot your password, click the 'Forgot Password' link on the sign-in page. Follow the instructions sent to your email to reset your password."
    }
  ]
}
`;

const aiHelpAssistantPrompt = ai.definePrompt({
  name: 'aiHelpAssistantPrompt',
  input: {schema: AiHelpAssistantInputSchema},
  output: {schema: AiHelpAssistantOutputSchema},
  prompt: `You are a chat assistant for TeachMeet, a 3D meeting app, and your goal is to answer user questions accurately.

  Here are some frequently asked questions and answers. Use these as a reference, and be concise.

  {{{faqData}}}

  Question: {{{question}}}
  Answer:`, 
  config: {
    model: googleAI.model('gemini-1.5-flash-latest'),
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const aiHelpAssistantFlow = ai.defineFlow(
  {
    name: 'aiHelpAssistantFlow',
    inputSchema: AiHelpAssistantInputSchema,
    outputSchema: AiHelpAssistantOutputSchema,
  },
  async input => {
    const {output} = await aiHelpAssistantPrompt({
      ...input,
      faqData,
    });
    return output!;
  }
);
