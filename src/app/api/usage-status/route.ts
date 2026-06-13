import { NextResponse } from 'next/server';
import { getUsageStatus } from '@/lib/rateLimiter';
import { AVAILABLE_MODELS } from '../analyze/types';

export async function GET() {
  const status = AVAILABLE_MODELS.map((m) => {
    const { count, limit } = getUsageStatus(m.id);
    return {
      modelId: m.id,
      name: m.name,
      count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  });

  return NextResponse.json(status);
}
