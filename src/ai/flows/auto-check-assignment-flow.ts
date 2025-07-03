
'use server';
/**
 * @fileOverview An AI flow for automatically checking student assignments against a teacher's rubric.
 *
 * - autoCheckAssignment - A function that handles the assignment checking process.
 * - AutoCheckAssignmentInput - The input type for the autoCheckAssignment function.
 * - AutoCheckAssignmentOutput - The return type for the autoCheckAssignment function.
 */

import {ai, googleAI} from '@/ai/genkit';
import {z} from 'genkit';

export const AutoCheckAssignmentInputSchema = z.object({
  studentAssignmentText: z.string().describe("The full text of the student's submitted assignment."),
  teacherRubricText: z.string().describe("The teacher's rubric or model answer against which the student's assignment should be checked."),
  assignmentKeywords: z.string().optional().describe("Optional keywords related to the assignment, provided by the teacher."),
  assignmentTitle: z.string().describe("The title of the assignment."),
});
export type AutoCheckAssignmentInput = z.infer<typeof AutoCheckAssignmentInputSchema>;

export const AutoCheckAssignmentOutputSchema = z.object({
  overallFeedback: z.string().describe("General feedback on the student's assignment based on the rubric."),
  similarityScore: z.number().min(0).max(100).optional().describe("An optional numerical score (0-100) indicating similarity to the model answer or adherence to the rubric."),
  specificPoints: z.array(z.object({
    point: z.string().describe("A specific point from the rubric or a key aspect of the assignment."),
    assessment: z.string().describe("Assessment of how well the student addressed this point."),
    studentExtract: z.string().optional().describe("A relevant short extract from the student's assignment related to this point."),
  })).describe("Detailed feedback on specific points or criteria from the rubric."),
  isPlagiarized: z.boolean().optional().describe("An optional flag indicating if the assignment shows signs of plagiarism (conceptual)."),
});
export type AutoCheckAssignmentOutput = z.infer<typeof AutoCheckAssignmentOutputSchema>;

export async function autoCheckAssignment(input: AutoCheckAssignmentInput): Promise<AutoCheckAssignmentOutput> {
  // Call the actual Genkit flow
  return autoCheckAssignmentFlow(input);
}

const autoCheckAssignmentPrompt = ai.definePrompt({
  name: 'autoCheckAssignmentPrompt',
  input: { schema: AutoCheckAssignmentInputSchema },
  output: { schema: AutoCheckAssignmentOutputSchema },
  prompt: `You are an AI Teaching Assistant. Your task is to evaluate a student's assignment based on the provided teacher's rubric and assignment title. Optional keywords may also be provided for context.

Assignment Title: {{{assignmentTitle}}}
{{#if assignmentKeywords}}
Assignment Keywords: {{{assignmentKeywords}}}
{{/if}}

Teacher's Rubric/Model Answer:
---
{{{teacherRubricText}}}
---

Student's Assignment:
---
{{{studentAssignmentText}}}
---

Please provide:
1.  **Overall Feedback**: A summary of the student's performance.
2.  **Similarity Score** (Optional, 0-100): If applicable, estimate how similar the student's work is to a model answer or how well it meets the rubric's core requirements.
3.  **Specific Points**: Break down the feedback based on key criteria from the rubric or important aspects of the assignment. For each point:
    *   Clearly state the point/criterion.
    *   Assess how well the student addressed it.
    *   Optionally, include a short, relevant extract from the student's assignment.
4.  **Plagiarism Check** (Optional): Conceptually, indicate if there are signs of plagiarism. For this exercise, you can make a random assessment or base it on very obvious copying if detectable from text alone.

Focus on constructive and actionable feedback.
Be fair and objective.
Ensure your output matches the specified JSON schema.
`,
  config: {
    model: googleAI.model('gemini-pro'),
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }
});

const autoCheckAssignmentFlow = ai.defineFlow(
  {
    name: 'autoCheckAssignmentFlow',
    inputSchema: AutoCheckAssignmentInputSchema,
    outputSchema: AutoCheckAssignmentOutputSchema,
  },
  async (input) => {
    // In a real scenario, you might pre-process texts, or call other tools/services
    // For example, if the assignment or rubric are very long, you might need a strategy
    // to handle context window limits (e.g., summarization, chunking, RAG).

    const { output } = await autoCheckAssignmentPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output for assignment checking.");
    }
    return output;
  }
);
