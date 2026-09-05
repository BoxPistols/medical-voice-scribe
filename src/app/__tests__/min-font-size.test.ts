import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// UIの絶対ルール: フォントサイズは12px未満を使わない。
// src/app 配下の tsx と css を列挙せずに走査する（remotion は動画レンダリング用なので対象外）。
const ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set(["remotion", "__tests__"]);
const SKIP_FILES = /(\.stories\.tsx|opengraph-image\.tsx|icon.*\.tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, out);
    } else if (/\.(tsx|css)$/.test(name) && !SKIP_FILES.test(name)) out.push(p);
  }
  return out;
}

// em は親に依存するので判定しない（下限が要る箇所は max(Nem, 0.75rem) で固定する）
const PX = /(?:text-\[|font-size:\s*|fontSize:\s*['"]?)(\d+(?:\.\d+)?)(px|rem|em)?/g;

function violations(src: string): string[] {
  const hits: string[] = [];
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(PX)) {
      if (m[2] === "em") continue;
      const v = parseFloat(m[1]);
      const px = m[2] === "rem" ? v * 16 : v;
      // 単位なしの fontSize: 数値は px 扱い（Reactのインラインスタイル）
      if (px < 12) hits.push(`L${i + 1}: ${m[0]}`);
    }
  });
  return hits;
}

describe("フォントサイズ: 12px未満を使わない", () => {
  const files = walk(ROOT);
  it("走査対象が存在する", () => expect(files.length).toBeGreaterThan(10));
  it.each(files.map((f) => [f.replace(ROOT + "/", "")]))("%s", (rel) => {
    expect(violations(readFileSync(join(ROOT, rel), "utf8"))).toEqual([]);
  });
});
