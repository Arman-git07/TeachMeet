'use server';
/**
 * @fileOverview An AI agent for verifying payment screenshots.
 *
 * - verifyPayment - A function that takes a screenshot and expected payment details.
 * - VerifyPaymentInput - The input type for the verifyPayment function.
 * - VerifyPaymentOutput - The return type for the verifyPayment function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const VerifyPaymentInputSchema = z.object({
  screenshotDataUri: z
    .string()
    .describe(
      "The payment screenshot as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  expectedAmount: z.number().describe("The expected numerical amount paid."),
  expectedCurrency: z.string().describe("The expected currency code (e.g., 'INR', 'USD')."),
});
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentInputSchema>;

const VerifyPaymentOutputSchema = z.object({
  isValid: z.boolean().describe("True if the payment is verified as successful and matches the expected amount and currency."),
  reason: z.string().optional().describe("A clear explanation of why the verification failed, if applicable."),
  detectedAmount: z.number().optional().describe("The numerical amount detected in the screenshot."),
  detectedCurrency: z.string().optional().describe("The currency code detected in the screenshot."),
  detectedDate: z.string().optional().describe("The date of the transaction detected in the screenshot."),
});
export type VerifyPaymentOutput = z.infer<typeof VerifyPaymentOutputSchema>;

const verifyPaymentPrompt = ai.definePrompt({
  name: 'verifyPaymentPrompt',
  input: { schema: VerifyPaymentInputSchema },
  output: { schema: VerifyPaymentOutputSchema },
  prompt: `You are a meticulous financial verification assistant for TeachMeet. Your task is to analyze a payment screenshot and confirm its validity.

**Verification Criteria:**
1. **Status**: The payment must show as "Success", "Completed", "Paid", or similar.
2. **Amount**: The detected amount must match {{expectedAmount}}.
3. **Currency**: The detected currency must match {{expectedCurrency}}.
4. **Date**: The transaction date should be very recent (ideally today).

**Screenshot Evidence:**
{{media url=screenshotDataUri}}

Compare the evidence against the requirements. If all criteria are met, set isValid to true. Otherwise, set it to false and explain why in the reason field.`,
});

const verifyPaymentFlow = ai.defineFlow(
  {
    name: 'verifyPaymentFlow',
    inputSchema: VerifyPaymentInputSchema,
    outputSchema: VerifyPaymentOutputSchema,
  },
  async input => {
    const response = await verifyPaymentPrompt(input);
    return response.output!;
  }
);

export async function verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentOutput> {
  return verifyPaymentFlow(input);
}
