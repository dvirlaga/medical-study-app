import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
import { StudyPlan } from '@/lib/types';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

    // Upload PDF to Anthropic Files API
    const fileBytes = await pdfFile.arrayBuffer();
    const uploadedFile = await client.beta.files.upload({
      file: new File([fileBytes], pdfFile.name, { type: 'application/pdf' }),
    });

    const dates = buildDateList();
    const dateMap = dates
      .map((date, i) => `Day ${i + 1}: ${date}`)
      .join('\n');

    // Generate study plan
    const message = await client.beta.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      betas: ['files-api-2025-04-14'],
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
              source: { type: 'file', file_id: uploadedFile.id },
            } as any,
            {
              type: 'text',
              text: `Create a ${TOTAL_DAYS}-day study plan for these dates:\n${dateMap}\n\nReturn ONLY valid JSON, nothing else.`,
            },
          ],
        },
      ],
    });

    // Extract text response (skip thinking blocks)
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

    // Store in Vercel KV
    await kv.set('study-plan', JSON.stringify(studyPlan));

    // Clean up file from Anthropic (non-critical)
    client.beta.files.delete(uploadedFile.id).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: error.message ?? 'Failed to generate study plan' },
      { status: 500 }
    );
  }
}
