import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROLES,
  STEPS,
  NEUTRALS,
  SOAP_KEYS,
  allColorTokens,
} from "@/lib/designTokens";

// designTokens.ts と globals.css がずれていないことを双方向に検査する。
// 片側だけ足すと「宣言したのに使えない」「使えるのに文書に無い」が起きるので、
// 足りない側と余っている側の両方を落とす。
const CSS = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

function block(selector: string): string {
  const i = CSS.indexOf(selector + " {");
  if (i < 0) throw new Error(`${selector} が globals.css に無い`);
  return CSS.slice(i, CSS.indexOf("\n}", i));
}

function vars(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block(selector).matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const root = vars(":root");
const dark = vars('[data-theme="dark"]');
const themeMap = Object.fromEntries(
  [...block("@theme inline").matchAll(/^\s*(--color-[\w-]+):\s*var\((--[\w-]+)\);/gm)].map(
    (m) => [m[1], m[2]],
  ),
);

describe("デザイントークン: 定義とCSSが一致する", () => {
  it.each(ROLES.flatMap((r) => STEPS.map((s) => [`${r}${s}`])))(
    "%s が :root に定義されている",
    (token) => {
      expect(root[`--${token}`], `--${token} が :root に無い`).toBeDefined();
    },
  );

  it.each(allColorTokens().map((t) => [t]))(
    "%s が Tailwind クラスとして公開されている",
    (token) => {
      expect(themeMap[`--color-${token}`], `--color-${token} が @theme inline に無い`).toBeDefined();
    },
  );

  it("@theme が参照する変数はすべて実在する", () => {
    const missing = Object.entries(themeMap)
      .filter(([, ref]) => root[ref] === undefined)
      .map(([name, ref]) => `${name} → ${ref}`);
    expect(missing, "参照先の変数が定義されていない").toEqual([]);
  });

  it("@theme に、designTokens.ts が知らないトークンを増やしていない", () => {
    const known = new Set(allColorTokens());
    const extra = Object.keys(themeMap)
      .map((n) => n.replace("--color-", ""))
      .filter((n) => !known.has(n));
    expect(extra, "designTokens.ts に追記するか、@theme から外す").toEqual([]);
  });

  it("役割色は暗色側でも文字と面が上書きされている", () => {
    // 塗り(接尾辞なし)と -strong は両テーマ共通でよいが、文字と薄い面は上書きが要る
    const needDark = ROLES.flatMap((r) => [`--${r}-fg`, `--${r}-soft`, `--${r}-soft-strong`, `--${r}-line`]);
    const missing = needDark.filter((v) => dark[v] === undefined);
    expect(missing, "暗色で上書きされていない").toEqual([]);
  });

  it("SOAPの4区分がすべて揃っている", () => {
    for (const k of SOAP_KEYS) {
      expect(root[`--${k}`], `--${k}`).toBeDefined();
      expect(root[`--${k}-subtle`], `--${k}-subtle`).toBeDefined();
    }
  });

  it("土台の面と文字が @theme 経由で参照できる", () => {
    for (const n of NEUTRALS) {
      const ref = themeMap[`--color-${n}`];
      expect(ref, `--color-${n}`).toBeDefined();
      expect(root[ref], `${ref} の実体`).toBeDefined();
    }
  });
});
