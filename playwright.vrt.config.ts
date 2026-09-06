import { defineConfig, devices } from "@playwright/test";

// 見た目の回帰検査は、開発サーバーではなく本番ビルドに対して撮る。
//
// 開発サーバー(Turbopack)はglobals.cssを変えても古いCSSを配信し続けることがある。
// その状態でVRTを回すと、色を変えたのに差分ゼロで通る。実際にそうなった。
// 毎回ビルドするぶん遅いが、撮った画像が何に対応するかが曖昧にならない。
//
// baselineはフォント描画が環境に依存するので、同じマシンで撮り直したものだけを信じる。
// CIに載せるなら、描画環境を固定したコンテナで撮り直す必要がある。

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /vrt\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  // 撮影対象が1件も無いまま緑になるのを防ぐ
  failOnFlakyTests: true,

  expect: {
    toHaveScreenshot: {
      // フォントのアンチエイリアス程度は許し、色や配置の変化は落とす幅。
      // thresholdは画素ごとの色差の許容量。既定の0.2では、暗色の薄い面どうしの
      // 違い(alpha 0.14の役割色)が埋もれて検出できなかったので下げている
      maxDiffPixelRatio: 0.0005,
      threshold: 0.03,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: "light",
  },

  projects: [{ name: "vrt" }],

  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // 使い回すと前回のビルドを撮ってしまう。毎回建て直す
    reuseExistingServer: false,
    timeout: 300 * 1000,
  },
});
