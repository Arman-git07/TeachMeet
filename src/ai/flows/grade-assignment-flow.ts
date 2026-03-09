'use server';
/**
 * @fileOverview An AI agent for grading student assignments against a teacher's answer key.
 *
 * - gradeAssignment - A function that takes teacher and student files and returns a grade and feedback.
 * - GradeAssignmentInput - The input type for the function.
 * - GradeAssignmentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import { z } from 'zod';

const GradeAssignmentInputSchema = z.object({
  teacherAssignmentDataUri: z
    .string()
    .describe(
      "The teacher's assignment or answer key, as a data URI that must include a MIME type and use Base64 encoding."
    ),
  studentSubmissionDataUri: z
    .string()
    .describe(
      "The student's submitted answer sheet, as a data URI that must include a MIME type and use Base64 encoding."
    ),
});
export type GradeAssignmentInput = z.infer<typeof GradeAssignmentInputSchema>;

const GradeAssignmentOutputSchema = z.object({
  score: z.number().min(0).max(100).describe("The numerical score from 0 to 100."),
  feedback: z.string().describe("Detailed, constructive feedback for the student, explaining the score and suggesting improvements."),
});
export type GradeAssignmentOutput = z.infer<typeof GradeAssignmentOutputSchema>;

const gradeAssignmentPrompt = ai.definePrompt({
  name: 'gradeAssignmentPrompt',
  input: { schema: GradeAssignmentInputSchema },
  output: { schema: GradeAssignmentOutputSchema },
  prompt: `You are an expert teaching assistant responsible for grading student assignments.

Your task is to analyze the student's submission by comparing it against the teacher's provided assignment or answer key.

1.  **Analyze Content:** Carefully review both documents. The student's submission may be handwritten or typed.
2.  **Determine Score:** Based on correctness, completeness, and accuracy, determine a fair score out of 100.
3.  **Provide Feedback:** Write clear, constructive, and encouraging feedback for the student. Explain what they did well, where they made mistakes, and how they can improve. The feedback should directly justify the score you've given.

Teacher's Assignment/Key:
{{media url=teacherAssignmentDataUri}}

Student's Submission:
{{media url=studentSubmissionDataUri}}`,
});

const gradeAssignmentFlow = ai.defineFlow(
  {
    name: 'gradeAssignmentFlow',
    inputSchema: GradeAssignmentInputSchema,
    outputSchema: GradeAssignmentOutputSchema,
  },
  async (input: any) => {
    const response = await gradeAssignmentPrompt(input);
    return response.output!;
  }
);

export async function gradeAssignment(input: GradeAssignmentInput): Promise<GradeAssignmentOutput> {
  return gradeAssignmentFlow(input);
}
