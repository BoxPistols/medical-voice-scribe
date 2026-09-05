import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 色は src/app/globals.css の意味トークン(brand/danger/warning/info/success, surface/ink/line)で書く。
// 生パレット(bg-red-50, text-teal-600, dark:bg-gray-900 ...)が混入していないか、src/app 配下の全 tsx を走査する。
// 列挙式にしない: 新しく増えたファイルも最初から対象に入る。
// 例外は remotion(動画レンダリング。ブラウザのテーマと無関係) と opengraph-image(静的画像) のみ。
const ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set(["remotion", "__tests__"]);
const SKIP_FILES = /(\.stories\.tsx|opengraph-image\.tsx)$/;
const FAMILIES =
  "teal|emerald|green|cyan|sky|blue|indigo|violet|purple|fuchsia|amber|yellow|orange|red|rose|pink|slate|gray|zinc|neutral|stone|lime";
const RAW = new RegExp(
  `(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|from|to|via|fill|stroke|accent|shadow|placeholder|divide)-(?:${FAMILIES})-\\d+(?:/\\d+)?(?![\\w-])`,
  "g",
);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, out);
    } else if (name.endsWith(".tsx") && !SKIP_FILES.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("配色: 生パレットのクラスを使わない", () => {
  const files = walk(ROOT);

  it("走査対象が存在する（走査自体が空回りしていない）", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f.replace(ROOT + "/", "")]))("%s", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const hits = src
      .split("\n")
      .flatMap((line, i) => (line.match(RAW) ?? []).map((tok) => `L${i + 1}: ${tok}`));
    expect(hits, "意味トークンに置き換える").toEqual([]);
  });
});
