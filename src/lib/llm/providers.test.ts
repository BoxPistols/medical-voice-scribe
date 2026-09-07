import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pricedModelIds } from "./pricing";

// テスト環境はjsdomで、openai SDKは「ブラウザからの利用」として生成を拒否する。
// ここで見たいのはキーの扱いなので、SDK本体はクラスの殻に置き換える
vi.mock("openai", () => ({
  default: class OpenAI {
    constructor(public opts: { apiKey: string; baseURL?: string }) {}
  },
}));

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

  // ai-api:allow-superseded-start 旧IDを「登録しない」ことの確認なので、IDが残るのが正しい
  it("旧世代で割高なgemini-3.5-flashは登録しない", async () => {
    const m = await load();
    const all = m.PROVIDER_ORDER.flatMap((p) => m.PROVIDERS[p].models);
    expect(all).not.toContain("gemini-3.5-flash");
  });
  // ai-api:allow-superseded-end
});

describe("APIキーの検証", () => {
  const ORIG = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (ORIG) process.env.GEMINI_API_KEY = ORIG;
    else delete process.env.GEMINI_API_KEY;
  });

  it("前後の空白と改行は落とす", async () => {
    process.env.GEMINI_API_KEY = "  test-key\n";
    const m = await load();
    expect(() => m.clientFor("gemini")).not.toThrow();
  });

  it("非ASCIIが混ざっていたら理由つきで止める", async () => {
    // 全角スペースは貼り付けで混ざりやすい代表例
    process.env.GEMINI_API_KEY = "test　key";
    const m = await load();
    expect(() => m.clientFor("gemini")).toThrow(m.ProviderConfigError);
    try {
      m.clientFor("gemini");
    } catch (e) {
      expect((e as Error).message).toContain("使えない文字");
      expect((e as Error).message).toContain("U+3000");
    }
  });
});

describe("キーの形の診断", () => {
  const ORIG = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (ORIG) process.env.GEMINI_API_KEY = ORIG;
    else delete process.env.GEMINI_API_KEY;
  });

  it("値そのものは返さない", async () => {
    process.env.GEMINI_API_KEY = "AIzaSecretValue1234567890";
    const m = await load();
    const d = m.describeKey("gemini");
    expect(JSON.stringify(d)).not.toContain("SecretValue");
    expect(d.prefix).toBe("AIza");
    expect(d.length).toBe(25);
  });

  it("使えない文字の位置を返す", async () => {
    process.env.GEMINI_API_KEY = "AIzaXY以下のキー";
    const m = await load();
    const d = m.describeKey("gemini");
    expect(d.invalidAt).toBe(6);
    expect(d.invalidChar).toBe("U+4EE5");
  });

  it("正常なキーは位置を返さない", async () => {
    process.env.GEMINI_API_KEY = "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q";
    const m = await load();
    const d = m.describeKey("gemini");
    expect(d.invalidAt).toBeNull();
    expect(d.length).toBe(39);
  });

  it("未設定ならpresentがfalse", async () => {
    delete process.env.GEMINI_API_KEY;
    const m = await load();
    expect(m.describeKey("gemini").present).toBe(false);
  });
});
