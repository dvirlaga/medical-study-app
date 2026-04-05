import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

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
