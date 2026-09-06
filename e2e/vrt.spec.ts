import { test, expect, type Page } from "@playwright/test";
import { ROLES, STEPS } from "../src/lib/designTokens";

// 見た目の回帰検査。ヘッダーは幅で構成が変わるので、幅ごとに撮る。
//
// baselineはフォント描画が環境に依存するため、同じマシンで撮り直したものだけを信じる。
// 撮り直しは `pnpm vrt:update`。CIに載せるなら描画環境を固定する必要がある。
//
// 撮れないものは画像ではなく計算値で確かめる。実際、トークンの値が変わっても
// 画像だけ見ていると小さな差は閾値に埋もれる。

/** 時計と録音タイマーが毎秒動くので、時刻を固定する */
const FIXED_TIME = new Date("2026-09-06T09:00:00");

/** ヘッダーの構成が変わる幅。実装のしきい値(md=768, lg=1024, @container=1360)の前後を取る */
const WIDTHS = [390, 768, 1024, 1280, 1359, 1360, 1600] as const;

const THEMES = ["light", "dark"] as const;

async function prepare(page: Page, theme: (typeof THEMES)[number]) {
  await page.clock.install({ time: FIXED_TIME });

  await page.addInitScript((t) => {
    // 初回のデモ動画モーダルを出さない。出ると全画面を覆って何も撮れない
    localStorage.setItem("medical-scribe-onboarding-seen", "true");
    localStorage.setItem("medical-scribe-theme", t);
    localStorage.setItem("medical-scribe-app-mode", "medical");
    localStorage.setItem("medical-scribe-show-clock", "true");
    localStorage.setItem("medical-scribe-model", "gpt-5.6-luna");
    // セッションはサンプルの初期状態から始める
    localStorage.removeItem("medical-scribe-records");
  }, theme);

  await page.goto("/");

  // アニメーションと遷移を止める。止めないと撮影ごとに中間状態が写る
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }`,
  });

  await expect(page.locator("header")).toBeVisible();

  // 配信されたCSSが古いと、トークンが解決できないまま素通りする。
  // 実際にdevサーバーが古いCSSを返し、色を変えても画像差分が出ない状態が起きた。
  // 撮る前に、トークンが実際に効いていることを確かめる
  const brand = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
  );
  expect(brand, "デザイントークンが読み込まれていない。配信中のCSSが古い可能性がある").not.toBe("");
  await page.waitForFunction(
    (t) =>
      (document.documentElement.getAttribute("data-theme") ?? "light") === t,
    theme,
  );
  // フォントが載る前に撮ると字形が変わる
  await page.evaluate(() => document.fonts.ready);
}

test.describe("ヘッダーの見た目", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`${theme} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await prepare(page, theme);

        const header = page.locator("header");
        await expect(header).toHaveScreenshot(`header-${theme}-${width}.png`);
      });
    }
  }
});

test.describe("主要な画面", () => {
  for (const theme of THEMES) {
    test(`医療カルテ ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await prepare(page, theme);
      await expect(page).toHaveScreenshot(`medical-${theme}.png`, {
        fullPage: false,
      });
    });

    test(`セッション一覧 ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await prepare(page, theme);
      await page
        .locator('header button[aria-label="セッション管理"][data-tooltip-bottom]')
        .click();
      const drawer = page.locator('aside[role="dialog"]');
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveScreenshot(`session-drawer-${theme}.png`);
    });
  }
});

// 画像に写らない、あるいは差が小さすぎて閾値に埋もれるものは値で確かめる。
test.describe("画像では捉えられない値", () => {
  test("役割色のトークンが両テーマで解決できる", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare(page, "dark");

    const resolved = await page.evaluate(
      ({ roles, steps }) => {
        const cs = getComputedStyle(document.documentElement);
        const out: Record<string, string> = {};
        for (const r of roles) {
          for (const s of steps) {
            out[`${r}${s}`] = cs.getPropertyValue(`--${r}${s}`).trim();
          }
        }
        return out;
      },
      { roles: [...ROLES], steps: [...STEPS] },
    );

    const empty = Object.entries(resolved)
      .filter(([, v]) => v === "")
      .map(([k]) => k);
    expect(empty, "解決できないトークンがある").toEqual([]);
    expect(Object.keys(resolved).length).toBe(ROLES.length * STEPS.length);
  });

  test("ヘッダーは横に溢れず、1行に収まる", async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await prepare(page, "dark");

      const box = await page.evaluate(() => {
        const header = document.querySelector("header")!;
        const row = header.querySelector<HTMLElement>('[class*="@container/header"]')!;
        return {
          headerHeight: Math.round(header.getBoundingClientRect().height),
          rowWidth: Math.round(row.getBoundingClientRect().width),
          scrollWidth: row.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
        };
      });

      // 幅が足りないときは横スクロール領域に収める設計なので、
      // ページ全体が横に溢れないことを見る
      expect(box.bodyScrollWidth, `${width}px で body が横に溢れている`).toBeLessThanOrEqual(
        box.bodyClientWidth,
      );
      // 2行に折れるとヘッダーの高さが跳ねる
      expect(box.headerHeight, `${width}px でヘッダーが高い`).toBeLessThanOrEqual(80);
    }
  });

  test("待機中バッジは折り返さない", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page, "dark");
    const badge = page.locator(".status-badge");
    await expect(badge).toBeVisible();
    const lines = await badge.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        height: Math.round(el.getBoundingClientRect().height),
        lineHeight: cs.lineHeight,
        whiteSpace: cs.whiteSpace,
      };
    });
    expect(lines.whiteSpace).toBe("nowrap");
    expect(lines.height).toBeLessThanOrEqual(40);
  });
});
