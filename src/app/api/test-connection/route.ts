import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS } from '../analyze/types';
import {
  clientForModel,
  PROVIDERS,
  providerOf,
  isProviderConfigured,
  ProviderConfigError,
} from '@/lib/llm/providers';

export const runtime = 'nodejs';

// モデルIDが実際に叩けるかを確かめる。
// 集計サイト由来のモデルIDが本番で404になった例があるため、
// 登録したIDは必ずここで疎通を確認してから信用する。

interface Result {
  model: string;
  provider: string;
  configured: boolean;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
}

async function probe(modelId: string): Promise<Result> {
  const provider = providerOf(modelId);
  if (!provider) {
    return { model: modelId, provider: 'unknown', configured: false, status: 'error', message: '未知のモデルID' };
  }
  if (!isProviderConfigured(provider)) {
    return {
      model: modelId,
      provider,
      configured: false,
      status: 'skipped',
      message: `${PROVIDERS[provider].envKey}が未設定`,
    };
  }
  try {
    await clientForModel(modelId).chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: 'ping' }],
      // 1だと一部モデルがlengthで終了して扱いが分かれるので余裕を持たせる
      max_completion_tokens: 8,
    });
    return { model: modelId, provider, configured: true, status: 'ok' };
  } catch (error) {
    const message =
      error instanceof ProviderConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : '不明なエラー';
    return { model: modelId, provider, configured: true, status: 'error', message };
  }
}

export async function POST(req: Request) {
  let modelIds = AVAILABLE_MODELS.map((m) => m.id);
  try {
    const body = (await req.json()) as { model?: unknown };
    if (typeof body?.model === 'string') modelIds = [body.model];
  } catch {
    // ボディ無しは全モデルを対象にする
  }

  const results = await Promise.all(modelIds.map(probe));
  const failed = results.filter((r) => r.status === 'error');

  return NextResponse.json(
    { results, ok: failed.length === 0 },
    { status: failed.length === 0 ? 200 : 502 },
  );
}
