import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// テスト環境は jsdom で、openai SDK は「ブラウザからの利用」として生成を拒否する。
// ここで見たいのは生成のタイミングと単一性なので、SDK 本体はクラスの殻に置き換える
vi.mock("openai", () => ({ default: class OpenAI { chat = {}; constructor(public opts: unknown) {} } }));

// クライアント生成はモジュール読み込み時ではなく呼び出し時に行われること。
// 読み込み時に投げると、キー未設定の環境でAPIルートがHTMLの500になる（実際に起きた）
describe("lib/openai", () => {
  const orig = process.env.OPENAI_API_KEY;
  beforeEach(() => { vi.resetModules(); delete process.env.OPENAI_API_KEY; });
  afterEach(() => { if (orig) process.env.OPENAI_API_KEY = orig; });

  it("キー未設定でも import 自体は成功する", async () => {
    await expect(import("./openai")).resolves.toBeDefined();
  });

  it("キー未設定でgetOpenAI() を呼ぶとProviderConfigError", async () => {
    const m = await import("./openai");
    expect(() => m.getOpenAI()).toThrow(m.ProviderConfigError);
  });

  it("互換用 openai はプロパティに触れた時点で同じエラーを投げる", async () => {
    const m = await import("./openai");
    expect(() => m.openai.chat).toThrow(m.ProviderConfigError);
  });

  it("エラー文言に設定すべき環境変数名が入る", async () => {
    const m = await import("./openai");
    try {
      m.getOpenAI();
      throw new Error("投げられなかった");
    } catch (e) {
      expect((e as Error).message).toContain("OPENAI_API_KEY");
    }
  });

  it("キーがあれば生成でき、同じインスタンスを返す", async () => {
    process.env.OPENAI_API_KEY = "test-key-not-real";
    const m = await import("./openai");
    expect(m.getOpenAI()).toBe(m.getOpenAI());
  });
});
