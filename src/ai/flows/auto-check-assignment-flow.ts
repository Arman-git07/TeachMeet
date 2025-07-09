
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
  submissionDataUri: z
    .string()
    .describe(
      "The student's submission as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. This can be a PDF, DOCX, or TXT file."
    ),
  teacherAssignmentDataUri: z.string().optional().describe("The teacher's original assignment document as a data URI. Use this as the primary source of truth for the assignment's requirements, if provided."),
  gradingRubric: z.string().optional().describe("An optional rubric or criteria for grading."),
});
export type AutoCheckAssignmentInput = z.infer<typeof AutoCheckAssignmentInputSchema>;

export const AutoCheckAssignmentOutputSchema = z.object({
  isCorrect: z.boolean().describe("Whether the student's submission is considered correct or satisfactory based on the rubric."),
  feedback: z.string().describe("Constructive, helpful, and encouraging feedback for the student on their submission."),
  suggestedScore: z.number().min(0).max(100).describe("A suggested score between 0 and 100, based on the rubric and correctness."),
});
export type AutoCheckAssignmentOutput = z.infer<typeof AutoCheckAssignmentOutputSchema>;

export async function autoCheckAssignment(input: AutoCheckAssignmentInput): Promise<AutoCheckAssignmentOutput> {
  return autoCheckAssignmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoCheckAssignmentPrompt',
  input: {schema: AutoCheckAssignmentInputSchema},
  output: {schema: AutoCheckAssignmentOutputSchema},
  prompt: `You are an expert and friendly AI teaching assistant. Your task is to evaluate a student's submission based on the assignment question, an optional full assignment document, and an optional grading rubric.

  The student's submission is provided as a document. First, extract all the text from this document. Then, evaluate the extracted text.
  
  If a full assignment document is provided, use it as the primary source of truth for the questions and requirements. The "Assignment Question" field is just a summary.

  Your feedback should be encouraging and constructive. Explain what the student did well and where they can improve.
  
  Based on the grading rubric (if provided) and the correctness of the answer, determine if the submission is satisfactory and provide a score from 0 to 100.

  ## Assignment Details
  - **Question Summary**: {{{assignmentQuestion}}}
  {{#if teacherAssignmentDataUri}}
  - **Full Assignment Document**:
  {{media url=teacherAssignmentDataUri}}
  {{/if}}
  {{#if gradingRubric}}
  - **Grading Rubric**: {{{gradingRubric}}}
  {{/if}}

  ## Student's Submission Document
  {{media url=submissionDataUri}}
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
