import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  try {
    const raw = await kv.get<string>('study-plan');
    if (!raw) return NextResponse.json({ plan: null });
    const plan = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ plan: null });
  }
}
