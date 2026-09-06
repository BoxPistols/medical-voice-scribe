import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pricedModelIds } from "./pricing";

// 環境変数を差し替えるので、都度モジュールを読み直す
async function load() {
  vi.resetModules();
  return import("./providers");
}

const ORIG = { openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY };

describe("プロバイダーレジストリ", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    if (ORIG.openai) process.env.OPENAI_API_KEY = ORIG.openai;
    else delete process.env.OPENAI_API_KEY;
    if (ORIG.gemini) process.env.GEMINI_API_KEY = ORIG.gemini;
    else delete process.env.GEMINI_API_KEY;
  });

  it("モデルIDからプロバイダーを引ける", async () => {
    const m = await load();
    expect(m.providerOf("gpt-5.6-luna")).toBe("openai");
    expect(m.providerOf("gemini-3.6-flash")).toBe("gemini");
    expect(m.providerOf("存在しないモデル")).toBeNull();
  });

  it("キーが無いプロバイダーのモデルは選択肢に出ない", async () => {
    const m = await load();
    expect(m.availableModelIds()).toEqual([]);

    process.env.GEMINI_API_KEY = "test-key";
    const m2 = await load();
    expect(m2.availableModelIds()).toEqual(m2.PROVIDERS.gemini.models);
  });

  it("キー未設定でclientForを呼ぶとProviderConfigError", async () => {
    const m = await load();
    expect(() => m.clientFor("gemini")).toThrow(m.ProviderConfigError);
    // 文言に設定すべき環境変数名が含まれていること
    try {
      m.clientFor("gemini");
    } catch (e) {
      expect((e as Error).message).toContain("GEMINI_API_KEY");
    }
  });

  it("import自体はキーが無くても成功する", async () => {
    await expect(load()).resolves.toBeDefined();
  });

  it("GeminiはOpenAI互換エンドポイントを指す", async () => {
    const m = await load();
    expect(m.PROVIDERS.gemini.baseURL).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
    // OpenAI本体は既定のURLを使うのでbaseURLを持たない
    expect(m.PROVIDERS.openai.baseURL).toBeUndefined();
  });

  it("登録した全モデルに価格がある", async () => {
    const m = await load();
    const all = m.PROVIDER_ORDER.flatMap((p) => m.PROVIDERS[p].models);
    const priced = new Set(pricedModelIds());
    const missing = all.filter((id) => !priced.has(id));
    expect(missing, "pricing.tsに価格が無いと費用を表示できない").toEqual([]);
  });

  it("旧世代で割高なgemini-3.5-flashは登録しない", async () => {
    const m = await load();
    const all = m.PROVIDER_ORDER.flatMap((p) => m.PROVIDERS[p].models);
    expect(all).not.toContain("gemini-3.5-flash");
  });
});
