import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DayPlan } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { dayPlan } = (await request.json()) as { dayPlan: DayPlan };

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      system: `You are a medical exam question generator. Generate exactly 5 study questions.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "type": "multiple_choice",
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Why this answer is correct"
  },
  {
    "type": "short_answer",
    "question": "Open question?",
    "modelAnswer": "Expected model answer"
  }
]

Generate 3 multiple_choice and 2 short_answer questions.
Use the SAME language as the topics provided (Hebrew if topics are in Hebrew).
Base questions strictly on the provided material.`,

      messages: [
        {
          role: 'user',
          content: `Generate 5 questions for Day ${dayPlan.day}:

Topics: ${dayPlan.topics.join(', ')}
Summary: ${dayPlan.summary}
Key Points:
${dayPlan.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Return ONLY valid JSON array.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No response from Claude');
    }

    let jsonText = textBlock.text.trim();
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();
    const arrMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrMatch) jsonText = arrMatch[0];

    const questions = JSON.parse(jsonText);
    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
