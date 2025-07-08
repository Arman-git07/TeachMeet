
'use server';
/**
 * @fileOverview An AI agent for checking student assignments.
 *
 * - autoCheckAssignment - A function that handles assignment checking.
 * - AutoCheckAssignmentInput - The input type for the function.
 * - AutoCheckAssignmentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const AutoCheckAssignmentInputSchema = z.object({
  assignmentQuestion: z.string().describe("The question or prompt for the assignment."),
  studentSubmission: z.string().describe("The student's submitted text answer."),
  gradingRubric: z.string().optional().describe("An optional rubric or criteria for grading."),
});
export type AutoCheckAssignmentInput = z.infer<typeof AutoCheckAssignmentInputSchema>;

export const AutoCheckAssignmentOutputSchema = z.object({
  isCorrect: z.boolean().describe("Whether the student's submission is considered correct or satisfactory."),
  feedback: z.string().describe("Constructive feedback for the student on their submission."),
  suggestedScore: z.number().min(0).max(100).describe("A suggested score between 0 and 100."),
});
export type AutoCheckAssignmentOutput = z.infer<typeof AutoCheckAssignmentOutputSchema>;

export async function autoCheckAssignment(input: AutoCheckAssignmentInput): Promise<AutoCheckAssignmentOutput> {
  return autoCheckAssignmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoCheckAssignmentPrompt',
  input: {schema: AutoCheckAssignmentInputSchema},
  output: {schema: AutoCheckAssignmentOutputSchema},
  prompt: `You are an AI teaching assistant. Your task is to evaluate a student's submission based on the assignment question and an optional grading rubric.

  Provide clear, constructive feedback. Determine if the answer is correct and suggest a score from 0 to 100.

  ## Assignment Details
  - **Question**: {{{assignmentQuestion}}}
  {{#if gradingRubric}}- **Rubric**: {{{gradingRubric}}}{{/if}}

  ## Student Submission
  {{{studentSubmission}}}
  `,
});

const autoCheckAssignmentFlow = ai.defineFlow(
  {
    name: 'autoCheckAssignmentFlow',
    inputSchema: AutoCheckAssignmentInputSchema,
    outputSchema: AutoCheckAssignmentOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
