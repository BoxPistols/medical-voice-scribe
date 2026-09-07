#!/usr/bin/env node
// 書いた直後に、デザイントークンの決まりを外れた記述を止める。
//
// 使い方:
//   node scripts/check-design-tokens.mjs <ファイル...>   # 指定したファイルだけ見る
//   cat <PostToolUseのJSON> | node scripts/check-design-tokens.mjs --hook
//
// テスト (src/app/__tests__/) は全体を走査して落とす役目。
// このスクリプトは、書いた直後にその1ファイルだけを見て気づかせる役目を持つ。

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const FAMILIES =
  "teal|emerald|green|cyan|sky|blue|indigo|violet|purple|fuchsia|amber|yellow|orange|red|rose|pink|slate|gray|zinc|neutral|stone|lime";

const RAW_PALETTE = new RegExp(
  `(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|from|to|via|fill|stroke|accent|shadow|placeholder|divide)(?:-(?:[xytrbles]|gradient-[a-z]+|offset))?-(?:${FAMILIES})-\\d+(?:/\\d+)?(?![\\w-])`,
  "g",
);
const SMALL_FONT = /(?:text-\[|font-size:\s*|fontSize:\s*['"]?)(\d+(?:\.\d+)?)(px|rem|em)?/g;
const DARK_VARIANT = /(?<![\w-])dark:(?:bg|text|border|ring|from|to|via)-[\w-]+/g;

// 動画のレンダリングと静的画像はブラウザのテーマと無関係なので対象外。
// 検査そのもの (__tests__ と scripts) は、禁止する記述を例として書くので対象外
const SKIP =
  /(^|\/)(remotion|__tests__|scripts)\/|\.stories\.tsx$|opengraph-image|(^|\/)icon[^/]*\.tsx$|apple-icon/;

const MIN_FONT_PX = 12;

/**
 * コメントを空白に置き換える。行番号を保つため改行は残す。
 * 規約の説明そのものが禁止する記述を例に挙げるので、コメントは対象外にする。
 */
function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank) // ブロックコメント
    .replace(/^[ \t]*\/\/.*$/gm, blank) // 行頭からの行コメント
    .replace(/^[ \t]*\*.*$/gm, blank); // JSDocの続き行
}

/** 1ファイルを検査して、見つかった問題の一覧を返す */
export function checkFile(path) {
  const rel = relative(process.cwd(), resolve(path));
  if (SKIP.test(rel)) return [];
  if (!/\.(tsx|ts|css)$/.test(rel)) return [];

  let src;
  try {
    src = readFileSync(path, "utf8");
  } catch {
    return [];
  }

  const problems = [];
  stripComments(src)
    .split("\n")
    .forEach((line, i) => {
      const at = `${rel}:${i + 1}`;

      for (const m of line.matchAll(RAW_PALETTE)) {
        problems.push(
          `${at} 生パレット ${m[0]} → 役割トークン (brand/danger/warning/info/success) に置き換える`,
        );
      }

      for (const m of line.matchAll(SMALL_FONT)) {
        if (m[2] === "em") continue; // emは親に依存するので判定しない
        const px = m[2] === "rem" ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
        if (px < MIN_FONT_PX) {
          problems.push(`${at} ${m[0]} は${MIN_FONT_PX}px未満 → text-xs 以上にする`);
        }
      }

      for (const m of line.matchAll(DARK_VARIANT)) {
        problems.push(`${at} ${m[0]} → トークンが両テーマの値を持つので dark: は不要`);
      }
    });

  return problems;
}

/**
 * ディレクトリを渡されたら再帰的に辿る。
 * 黙って0件で終わると検査したつもりになるので、対象が1件も無ければ落とす。
 */
function expand(paths) {
  const out = [];
  const visit = (p) => {
    let st;
    try {
      st = statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        visit(join(p, name));
      }
    } else if (/\.(tsx|ts|css)$/.test(p)) {
      out.push(p);
    }
  };
  paths.forEach(visit);
  return out;
}

function fromHookInput(raw) {
  try {
    const data = JSON.parse(raw);
    const p = data?.tool_input?.file_path ?? data?.tool_input?.filePath;
    return p ? [p] : [];
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  let files;

  if (args[0] === "--hook") {
    const raw = await new Promise((r) => {
      let buf = "";
      process.stdin.on("data", (c) => (buf += c));
      process.stdin.on("end", () => r(buf));
    });
    files = fromHookInput(raw);
  } else {
    files = args;
  }

  const targets = expand(files);
  if (args[0] !== "--hook" && targets.length === 0) {
    console.error("検査対象のファイルが1件も見つかりません。引数のパスを確認してください。");
    process.exit(2);
  }

  const problems = targets.flatMap(checkFile);
  if (problems.length === 0) return;

  // PostToolUse は終了コード2で「書いた側に伝える」扱いになる
  console.error(
    `デザイントークンの決まりを外れた記述が${problems.length}件あります。docs/design-tokens.md を参照。\n` +
      problems.map((p) => `- ${p}`).join("\n"),
  );
  process.exit(2);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`;
if (invokedDirectly) main();
