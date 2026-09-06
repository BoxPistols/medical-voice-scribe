# デザイントークン

このアプリの色は、意味を持つ名前(トークン)だけで書く。Tailwindの数字付きパレット
(`bg-red-50`、`text-teal-600`など)はコンポーネントに書かない。

なぜそうするかというと、数字付きのパレットには「どの場面で使う色か」が入っていないため、
書く人ごとに選び方が変わるからである。実際にこのリポジトリでは、同じ「注意」を表すのに
amber、yellow、orangeの3系統が混在し、無彩色もgray、zinc、slateの3系統が同じ画面に並んでいた。
暗色時の指定を1箇所ずつ書き足す必要もあり、書き漏らすと明色の文字が暗い面に乗った。

## どこに何があるか

| 対象 | 場所 |
| --- | --- |
| 色の実値 | `src/app/globals.css`のCSS変数 |
| 役割と段の構造 | `src/lib/designTokens.ts` |
| 一覧と使用例 | Storybookの「デザイン / デザイントークン」 |
| 規約(この文書) | `docs/design-tokens.md` |

構造と実値がずれていないことは `src/app/__tests__/design-tokens.test.ts` が双方向に検査する。
片側だけ足すと落ちる。

## 役割色

用途が重ならないよう5つに絞っている。

| 役割 | 使う場面 |
| --- | --- |
| `brand` | 主操作、選択状態、フォーカス |
| `danger` | 削除、エラー、録音の停止 |
| `warning` | 注意、未処理 |
| `info` | 補助情報、AIの提案 |
| `success` | 完了、処理済み |

各役割が6段を持つ。段の意味はどの役割でも同じなので、`brand`の使い方を覚えれば
`danger`も同じ形で書ける。

| 段 | 用途 | 例 |
| --- | --- | --- |
| `{role}` | 塗り。上に載せる文字は白 | `bg-brand text-white` |
| `{role}-strong` | 塗りのhover | `hover:bg-brand-strong` |
| `{role}-fg` | 面の上に置く文字とアイコン | `text-danger-fg` |
| `{role}-soft` | 薄い面。札やバナーの背景 | `bg-warning-soft` |
| `{role}-soft-strong` | 薄い面のhover | `hover:bg-warning-soft-strong` |
| `{role}-line` | 枠線 | `border-info-line` |

よく使う組み合わせは次の2つ。

```tsx
// 塗りのボタン
<button className="bg-brand text-white hover:bg-brand-strong">保存</button>

// 薄い面の札
<span className="bg-warning-soft text-warning-fg border border-warning-line">未処理</span>
```

## 土台

色みを持たない面と文字と罫線。

| トークン | 用途 |
| --- | --- |
| `surface` | 画面の地 |
| `surface-raised` | 地より一段持ち上げた面 |
| `ink` | 本文 |
| `ink-muted` | 補足 |
| `ink-faint` | 時刻やヒントなど、読めれば足りる文字 |
| `line` | 罫線 |

文字の3段はいずれも白地で4.5:1を満たす。これより明るい灰色を使いたくなったときは、
文字ではなく罫線か図形に使う。

## SOAP

医療記録の4区分(`soap-s` `soap-o` `soap-a` `soap-p`)は、記録の構造そのものなので
役割色とは別に持つ。他の用途には使わない。

## 明色と暗色

`dark:`はビューポートのOS設定ではなく、アプリのテーマ切替(`data-theme`)に接続してある。

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

トークンは両テーマの値を持つので、**ほとんどの場合 `dark:` を書く必要はない**。
`bg-warning-soft`と書けば、暗色では暗色用の薄い面になる。

`dark:`を書くのは、テーマによって構造そのものを変えるときだけにする。

## 守っている決まり

| 決まり | 検査 |
| --- | --- |
| 数字付きの生パレットを使わない | `src/app/__tests__/no-raw-palette.test.ts` |
| フォントサイズは12px未満を使わない | `src/app/__tests__/min-font-size.test.ts` |
| 文字色は面に対して4.5:1以上 | `src/app/__tests__/color-contrast.test.ts` |
| 定義と実値が一致している | `src/app/__tests__/design-tokens.test.ts` |

検査はファイルを列挙せず、`src/app`配下を走査する。新しく足したファイルも最初から対象に入る。

除外するのは`src/remotion`(動画のレンダリング。ブラウザのテーマと無関係)と
`opengraph-image`(静的画像)だけである。

## 見た目の回帰検査

ヘッダーは幅で構成が変わるので、しきい値の前後をテーマごとに撮っている。

```
pnpm vrt          # 比較する
pnpm vrt:update   # baselineを撮り直す
```

開発サーバーではなく本番ビルドに対して撮る。開発サーバーはglobals.cssを変えても
古いCSSを配信し続けることがあり、色を変えたのに差分ゼロで通る状態が実際に起きた。

baselineはフォント描画が環境に依存するので、同じマシンで撮り直したものだけを信じる。
CIに載せるなら描画環境を固定したコンテナが要る。

画像で捉えられないもの、または差が小さくて閾値に埋もれるものは値で確かめている。
役割色30個が解決できること、ページが横に溢れないこと、バッジが折り返さないこと。

閾値を変えたときは、退行を検出できることを確かめてから信じる。導入時は3種類の退行を
仕込んで、それぞれ5件、6件、8件が落ちることを確認した。

## トークンを増やすとき

1. `src/app/globals.css` の `:root` に値を足す
2. 暗色で見え方が変わるなら `[data-theme="dark"]` にも足す
3. `@theme inline` に `--color-<名前>: var(--<名前>);` を足してTailwindのクラスにする
4. `src/lib/designTokens.ts` の一覧に名前を足す
5. `pnpm test` を通す

4を忘れると「使えるのに一覧に無い」状態になり、テストが落ちる。

役割そのものを増やすのは慎重にする。5つで表せない場面が本当にあるかを先に確かめる。
既存の役割の段を増やすほうが、たいていは筋がよい。

## アクセシビリティの達成基準

**レベルAを達成基準とする。** レベルAにcontrast minimum(1.4.3)の達成基準は無いので、
コントラスト比は必須要件ではない。

そのうえで、**文字色のトークンは4.5:1を満たす値にしてある**。読めない文字を置く理由が
無いためで、`src/app/__tests__/color-contrast.test.ts` が固定している。

塗りの上に白文字を置く箇所は4.5に届かない。ブランド色の選択に属する判断として許容している。

| 対象 | 白文字とのコントラスト |
| --- | --- |
| 主ボタン(`btn-primary`) | 3.03 |
| 録音ボタン(`btn-record`) | 2.43 |
| 選択中のモード(`bg-brand`) | 2.49 |
| モーダルヘッダー | 2.49から3.31 |

AAに上げる場合は`--brand`をteal-700程度まで暗くすることになり、見た目が変わる。
