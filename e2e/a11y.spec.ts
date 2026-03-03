import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── Contrast helpers ────────────────────────────────────────────────────────

/** Convert sRGB channel (0-255) to linear luminance component */
function toLinear(c: number): number {
  const n = c / 255;
  return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/** Relative luminance of an RGB color */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two luminance values */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Parse computed color "rgb(r, g, b)" or "rgba(r, g, b, a)" → RGB values */
function parseRgb(css: string): { r: number; g: number; b: number } | null {
  const m = css.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

/** Walk up the DOM to find the first non-transparent background color */
function resolvedBg(el: Element): string {
  let node: Element | null = el;
  while (node) {
    const bg = window.getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    node = node.parentElement;
  }
  return 'rgb(255, 255, 255)';
}

// ── Shared helper: open help modal ─────────────────────────────────────────

async function openHelpModal(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('button[aria-label="ヘルプを表示"]', { state: 'visible' });
  await page.locator('button[aria-label="ヘルプを表示"]').first().click();
  await page.waitForSelector('[data-testid="help-modal-header"]', { state: 'visible' });
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('アクセシビリティ – axe 自動スキャン', () => {
  test('トップページ – WCAG 2.0 AA critical/serious 違反がないこと', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header', { state: 'visible' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules([
        'audio-caption', // マイク/音声認識はブラウザ環境で動作しないため除外
      ])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    if (critical.length > 0) {
      console.log(
        'a11y violations:\n',
        critical
          .map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  → ${v.nodes.map((n) => n.html).join('\n  → ')}`)
          .join('\n')
      );
    }
    expect(critical, 'WCAG AA critical/serious violations').toHaveLength(0);
  });

  test('ヘルプモーダル – WCAG 2.0 AA critical/serious 違反がないこと', async ({ page }) => {
    await openHelpModal(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    if (critical.length > 0) {
      console.log(
        'Help modal a11y violations:\n',
        critical.map((v) => `[${v.impact}] ${v.id}: ${v.description}`).join('\n')
      );
    }
    expect(critical, 'Help modal WCAG AA violations').toHaveLength(0);
  });
});

test.describe('コントラスト – Modal Header', () => {
  test.beforeEach(openHelpModal);

  test('ヘッダータイトル – WCAG AA 大テキスト 3:1 以上', async ({ page }) => {
    const title  = page.locator('#help-modal-title');
    const header = page.locator('[data-testid="help-modal-header"]');

    const [fgCss, bgCss] = await Promise.all([
      title.evaluate((el) => window.getComputedStyle(el).color),
      header.evaluate((el) => window.getComputedStyle(el).backgroundColor),
    ]);

    const fg = parseRgb(fgCss);
    const bg = parseRgb(bgCss);

    test.skip(!fg || !bg, 'computedStyle が取得できない環境（透明背景）');
    if (!fg || !bg) return;

    const ratio = contrastRatio(luminance(fg.r, fg.g, fg.b), luminance(bg.r, bg.g, bg.b));
    console.log(`Title contrast: ${ratio.toFixed(2)}:1  fg=${fgCss} bg=${bgCss}`);

    // 大テキスト (text-xl bold = 20px bold ≥ 18.66px) → WCAG AA 3:1
    expect(ratio, `Title contrast must be ≥3.0:1, got ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3.0);
  });

  test('非アクティブタブテキスト – WCAG AA 3:1 以上', async ({ page }) => {
    // 医療カルテタブがデフォルトでアクティブなので、他の2つは非アクティブ
    const inactiveTabs = page.locator('[data-testid="help-modal-header"] ~ div button[class*="border-transparent"]');
    const count = await inactiveTabs.count();

    test.skip(count === 0, '非アクティブタブが見つからない');
    if (count === 0) return;

    const inactiveTab = inactiveTabs.first();

    const [fgCss, bgCss] = await Promise.all([
      inactiveTab.evaluate((el) => window.getComputedStyle(el).color),
      inactiveTab.evaluate(resolvedBg),
    ]);

    const fg = parseRgb(fgCss);
    const bg = parseRgb(bgCss);

    test.skip(!fg || !bg, 'computedStyle が取得できない環境');
    if (!fg || !bg) return;

    const ratio = contrastRatio(luminance(fg.r, fg.g, fg.b), luminance(bg.r, bg.g, bg.b));
    console.log(`Inactive tab contrast: ${ratio.toFixed(2)}:1  fg=${fgCss} bg=${bgCss}`);

    expect(ratio, `Inactive tab contrast must be ≥3.0:1, got ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3.0);
  });
});

test.describe('Modal – キーボード & ARIA', () => {
  test('ヘルプモーダルが Escape で閉じること', async ({ page }) => {
    await openHelpModal(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="help-modal-header"]')).toBeHidden({ timeout: 2000 });
  });

  test('モーダルに role="dialog" と aria-modal="true" が設定されていること', async ({ page }) => {
    await openHelpModal(page);
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();
  });

  test('閉じるボタンに aria-label があること', async ({ page }) => {
    await openHelpModal(page);
    await expect(page.locator('button[aria-label="ヘルプを閉じる"]')).toBeVisible();
  });

  test('モーダルタイトルに aria-labelledby が対応していること', async ({ page }) => {
    await openHelpModal(page);
    const dialog = page.locator('[role="dialog"]');
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    // labelledby が指すタイトル要素が存在すること
    const titleEl = page.locator(`#${labelledBy}`);
    await expect(titleEl).toBeVisible();
  });

  // フォーカストラップは現時点未実装 → WCAG 2.1 AA への対応 TODO
  test.fixme('ヘルプモーダル内でフォーカスがトラップされること', async ({ page }) => {
    await openHelpModal(page);

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
    }

    const isInsideModal = await page.evaluate(() => {
      let node: Element | null = document.activeElement;
      while (node) {
        if (node.getAttribute('role') === 'dialog') return true;
        node = node.parentElement;
      }
      return false;
    });

    expect(isInsideModal, 'Focus should stay inside the dialog').toBe(true);
  });
});

test.describe('Clock Mode – ポモドーロ UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header', { state: 'visible' });
    // ヘッダーの「時計」タブをクリック
    await page.getByRole('button', { name: '時計', exact: true }).click();
    // ポモドーロボタンが表示されるまで待つ
    await expect(page.getByRole('button', { name: 'ポモドーロ', exact: true })).toBeVisible();
  });

  test('ポモドーロタブ – 表示と操作', async ({ page }) => {
    await page.getByRole('button', { name: 'ポモドーロ', exact: true }).click();
    await expect(page.getByText('作業中')).toBeVisible();

    const startBtn = page.getByRole('button', { name: 'スタート', exact: true });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });

  test('設定パネル – 作業時間プリセット変更', async ({ page }) => {
    await page.getByRole('button', { name: 'ポモドーロ', exact: true }).click();

    // 設定パネルを開く（title属性で特定）
    await page.locator('button[title="設定"]').click();
    await expect(page.getByText('時間設定')).toBeVisible();

    // 作業時間プリセット「30」をクリック（設定パネル内に限定）
    await page.getByRole('button', { name: '30', exact: true }).first().click();
    await expect(page.getByText('30分集中')).toBeVisible();
  });
});
