import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 文字に使うトークンが、置かれる面に対してWCAG AAの4.5:1を満たすかを、
// globals.cssの定義値から計算して確かめる。
// 対象は「文字色」のトークンだけ。塗り(bg-brand等)の上に白文字を置く組み合わせは
// ブランド色の選択そのものなので、ここでは判定しない。
const CSS = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const i = CSS.indexOf(selector + " {");
  if (i < 0) throw new Error(`${selector} が見つからない`);
  const body = CSS.slice(i, CSS.indexOf("\n}", i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim();
  return out;
}

type RGB = [number, number, number, number];

function parse(v: string): RGB {
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = v.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const p = rgba[1].split(",").map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`色として読めない: ${v}`);
}

function over(fg: RGB, bg: RGB): RGB {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance(c: RGB): number {
  const f = (x: number) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

function contrast(fg: RGB, bg: RGB): number {
  const a = luminance(over(fg, bg));
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const ROLES = ["brand", "danger", "warning", "info", "success"] as const;
const AA = 4.5;

describe.each([
  ["light", ":root"],
  ["dark", '[data-theme="dark"]'],
])("配色: %s の文字色がAAを満たす", (_name, selector) => {
  const light = block(":root");
  const vars = { ...light, ...(selector === ":root" ? {} : block(selector)) };
  const surfaces: [string, RGB][] = [
    ["面", parse(vars["--bg-primary"])],
    ["カード", parse(vars["--bg-secondary"])],
  ];

  it.each(["--text-primary", "--text-secondary", "--text-tertiary", "--text-muted"])(
    "%s",
    (token) => {
      for (const [label, bg] of surfaces) {
        const r = contrast(parse(vars[token]), bg);
        expect(r, `${token} on ${label} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
      }
    },
  );

  it.each(ROLES)("%s-fg", (role) => {
    const fg = parse(vars[`--${role}-fg`]);
    const soft = over(parse(vars[`--${role}-soft`]), parse(vars["--bg-primary"]));
    for (const [label, bg] of [...surfaces, [`${role}-soft`, soft] as [string, RGB]]) {
      const r = contrast(fg, bg);
      expect(r, `${role}-fg on ${label} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
    }
  });
});
