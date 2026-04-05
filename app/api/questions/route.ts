import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DayPlan } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { dayPlan, previousQuestions } = (await request.json()) as {
      dayPlan: DayPlan;
      previousQuestions?: string[];
    };

    const avoidClause =
      previousQuestions && previousQuestions.length > 0
        ? `\n\nDo NOT repeat these questions that were already asked:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        : '';

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      system: `You are a medical exam question generator. Generate exactly 5 multiple choice questions.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "type": "multiple_choice",
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Why this answer is correct"
  }
]

Rules:
- ALL 5 questions must be multiple_choice with exactly 4 options
- Use the SAME language as the topics (Hebrew if topics are in Hebrew)
- Base questions strictly on the provided material
- Vary the difficulty: 2 easy, 2 medium, 1 hard`,

      messages: [
        {
          role: 'user',
          content: `Generate 5 NEW multiple choice questions for Day ${dayPlan.day}:

Topics: ${dayPlan.topics.join(', ')}
Summary: ${dayPlan.summary}
Key Points:
${dayPlan.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}${avoidClause}

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
