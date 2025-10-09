
import { NextResponse } from 'next/server';
import { aiHelpAssistantFlow } from '@/ai/flows/ai-help-assistant';

export async function POST(request: Request) {
  try {
    const { question } = await request.json();

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const aiResponse = await aiHelpAssistantFlow({ question });

    return NextResponse.json({ answer: aiResponse.answer });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `An error occurred while processing your request: ${errorMessage}` }, { status: 500 });
  }
}
