# medical-voice-scribe

音声による医療問診をSOAPカルテ形式に変換するデモアプリケーション。Next.js 16、React、
TypeScript、Tailwind CSS v4。

## UIを触る前に読む

`docs/design-tokens.md`。色は意味を持つ名前だけで書き、Tailwindの数字付きパレットは使わない。

一覧と実際の色はStorybookの「デザイン / デザイントークン」で見られる。

```
pnpm storybook
```

## 色の書き方

```tsx
// こう書く
<button className="bg-brand text-white hover:bg-brand-strong">保存</button>
<span className="bg-warning-soft text-warning-fg border border-warning-line">未処理</span>

// こう書かない
<button className="bg-teal-500 text-white hover:bg-teal-600">保存</button>
<span className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">未処理</span>
```

役割は `brand` `danger` `warning` `info` `success` の5つ。段は
`{role}` `-strong` `-fg` `-soft` `-soft-strong` `-line` の6つ。
無彩色は `surface` `surface-raised` `ink` `ink-muted` `ink-faint` `line`。

トークンは両テーマの値を持つので、**`dark:` はほとんど書かなくてよい**。

## 守る決まり

- フォントサイズは12px未満を使わない。`text-[10px]` や `text-[11px]` は書かない
- アクセシビリティの達成基準はレベルA。コントラスト比は必須要件ではないが、
  文字色のトークンは4.5:1を満たす値にしてある(`docs/design-tokens.md`)
- オーバーレイとpopupは半透明80-90%に `backdrop-filter: blur()` を当てる
- 日本語と英数字の間に半角スペースを入れない。新規に書く行だけが対象で、既存行は触らない
- `any` と `@ts-ignore` を使わない
- テストのフィクスチャには架空の名前を使う。実在の人名や組織名を書かない

## 検査

```
pnpm test        # 生パレット、12px未満、コントラスト、トークンの一致を含む
pnpm check:tokens
pnpm exec tsc --noEmit
pnpm build
pnpm vrt         # 見た目の回帰検査(本番ビルドに対して撮る)
pnpm e2e         # 動作のe2e
```

検査はファイルを列挙せず `src/app` 配下を走査するので、新しく足したファイルも対象に入る。
除外は `src/remotion` と `opengraph-image` だけ。

## 環境変数とモデル

`OPENAI_API_KEY` か `GEMINI_API_KEY` のどちらかを `.env.local` に置く。両方あると
モデルセレクタに両方が出る。キーが無いプロバイダーのモデルは選択肢に出さない。

未設定でもビルドと起動はでき、APIは503と設定を促すメッセージを返す。
クライアントは呼び出し時に生成するので、モジュール読み込み時に落ちることはない。

プロバイダーの追加は `src/lib/llm/providers.ts` の1エントリで済む。
GeminiはOpenAI互換エンドポイントを使うので、呼び出し側の書き換えは要らない。
価格は `src/lib/llm/pricing.ts` に隔離してある。コードに散らさない。

**モデルIDは公式ドキュメントで確認したものだけを登録する。** 集計サイトのIDは
存在しないことがある。登録したら疎通を確認する。

Geminiのモデル一覧は `docs/models` の日本語版が遅れることがある。最新の有無は
`docs/latest-model` と公式ブログでも確かめる。1ページだけ見て判断しない。

Geminiの無料枠は**1日20回で、モデルごとに別勘定**。複数世代を登録してあるのは、
片方を使い切った日にもう片方が残るため。アプリ側の日次上限もこれに合わせてある。

```
curl -X POST localhost:3000/api/test-connection -H 'content-type: application/json' -d '{}'
```

医療辞書のセマンティック検索は `text-embedding-3-small` の256次元で事前生成した
ベクトルを使うので、**埋め込みはOpenAIに固定**する。別プロバイダーの埋め込みは
空間が違い、検索が意味のない結果を返す。`OPENAI_API_KEY` が無い場合、辞書検索は無効になる。

## 注意

`src/app/globals.css` を編集してもTurbopackが古いCSSを配信し続けることがある。
効いていないと感じたら配信中のCSSを確認し、`.next/dev` を消して開発サーバーを再起動する。
CSSチャンクは複数返るので、最初の1つだけを見て判断しない。
