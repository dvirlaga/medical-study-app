import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';
import { StudyPlan } from '@/lib/types';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const START_DATE = '2026-04-05';
const END_DATE = '2026-05-21';
const TOTAL_DAYS = 47;

function buildDateList() {
  const list: string[] = [];
  const start = new Date(START_DATE + 'T00:00:00Z');
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    list.push(d.toISOString().split('T')[0]);
  }
  return list;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File | null;

    if (!pdfFile) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    // Convert PDF to base64 for direct sending to Claude
    const fileBytes = await pdfFile.arrayBuffer();
    const base64Pdf = Buffer.from(fileBytes).toString('base64');

    const dates = buildDateList();
    const dateMap = dates.map((date, i) => `Day ${i + 1}: ${date}`).join('\n');

    // Generate study plan using Claude with PDF sent as base64 document
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16000,
      system: `You are a medical study assistant. Analyze the provided PDF and create a ${TOTAL_DAYS}-day study plan.

Return ONLY a valid JSON object — no markdown, no explanation, just JSON:
{
  "subject": "Name of the subject",
  "days": [
    {
      "day": 1,
      "date": "2026-04-05",
      "topics": ["Specific Topic 1", "Specific Topic 2"],
      "summary": "2-3 sentence description of today's material",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],
      "osmosisTerms": ["english medical term 1", "english medical term 2"]
    }
  ]
}

Rules:
- osmosisTerms MUST be in English (used to search on Osmosis medical video platform)
- topics, summary, keyPoints should match the document's language (Hebrew if document is Hebrew)
- Distribute ALL content evenly across ${TOTAL_DAYS} days
- Days 45, 46, 47 must be comprehensive review days covering all material
- topics should be specific chapter/section names from the document`,

      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            } as any,
            {
              type: 'text',
              text: `Create a ${TOTAL_DAYS}-day study plan for these dates:\n${dateMap}\n\nReturn ONLY valid JSON, nothing else.`,
            },
          ],
        },
      ],
    });

    // Extract text response
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON (handle potential markdown code fences)
    let jsonText = textBlock.text.trim();
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonText = fenceMatch[1].trim();
    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objMatch) jsonText = objMatch[0];

    const planData = JSON.parse(jsonText);

    const studyPlan: StudyPlan = {
      subject: planData.subject ?? 'Medical Studies',
      startDate: START_DATE,
      endDate: END_DATE,
      totalDays: TOTAL_DAYS,
      generatedAt: new Date().toISOString(),
      days: planData.days,
    };

    // Store in Upstash Redis
    await kv.set('study-plan', JSON.stringify(studyPlan));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: error.message ?? 'Failed to generate study plan' },
      { status: 500 }
    );
  }
}
