import { NextResponse } from 'next/server';
import { getUsageStatus } from '@/lib/rateLimiter';
import { AVAILABLE_MODELS } from '../analyze/types';
import { isProviderConfigured } from '@/lib/llm/providers';

export async function GET() {
  const status = AVAILABLE_MODELS.map((m) => {
    const { count, limit } = getUsageStatus(m.id);
    return {
      modelId: m.id,
      name: m.name,
      provider: m.provider,
      // サーバーにそのプロバイダーのキーが無いモデルは選んでも503になるだけなので、
      // 選択肢から外せるようにクライアントへ伝える
      configured: isProviderConfigured(m.provider),
      count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  });

  return NextResponse.json(status);
}
