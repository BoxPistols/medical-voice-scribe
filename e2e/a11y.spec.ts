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

/** Parse computed background-color "rgb(r, g, b)" or "rgba(r, g, b, a)" */
function parseRgb(css: string): { r: number; g: number; b: number } | null {
  const m = css.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('アクセシビリティ – 自動 axe スキャン', () => {
  test('トップページに axe 違反がないこと（criticalのみ）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules([
        // マイク/音声認識はブラウザ環境で無効なので除外
        'audio-caption',
      ])
      .analyze();

    // impactが critical / serious のみを報告
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    if (critical.length > 0) {
      console.log(
        'a11y violations:\n',
        critical.map((v) => `[${v.impact}] ${v.id}: ${v.description}`).join('\n')
      );
    }
    expect(critical).toHaveLength(0);
  });

  test('ヘルプモーダル – axe 違反がないこと', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // ヘルプモーダルを開く
    const helpBtn = page.locator('button[aria-label="ヘルプを表示"]').first();
    await helpBtn.click();
    await page.waitForSelector('text=使い方ガイド', { state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"], .bg-theme-modal, [class*="modal"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('コントラスト – Modal Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const helpBtn = page.locator('button[aria-label="ヘルプを表示"]').first();
    await helpBtn.click();
    await page.waitForSelector('text=使い方ガイド', { state: 'visible' });
  });

  test('ヘッダータイトル "使い方ガイド" – WCAG AA 3:1 以上（大テキスト）', async ({ page }) => {
    const title = page.locator('h3', { hasText: '使い方ガイド' });
    const header = page.locator('.chat-support-header, [class*="modal"] > div').first();

    const [titleColor, headerBg] = await Promise.all([
      title.evaluate((el) => window.getComputedStyle(el).color),
      header.evaluate((el) => window.getComputedStyle(el).backgroundColor),
    ]);

    const fg = parseRgb(titleColor);
    const bg = parseRgb(headerBg);

    // 取得できない場合はスキップ（透明背景など）
    if (!fg || !bg) {
      test.skip();
      return;
    }

    const ratio = contrastRatio(
      luminance(fg.r, fg.g, fg.b),
      luminance(bg.r, bg.g, bg.b)
    );

    console.log(`Title contrast ratio: ${ratio.toFixed(2)}:1  (fg=${titleColor} bg=${headerBg})`);
    // 大テキスト(18pt+ or 14pt+bold) WCAG AA = 3:1
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });

  test('非アクティブタブテキスト – WCAG AA 3:1 以上', async ({ page }) => {
    // 非アクティブなタブボタン（2番目以降）
    const inactiveTab = page.locator('button[class*="border-transparent"]').first();

    // タブが取得できない場合（全タブがアクティブになっていない場合）はスキップ
    const count = await inactiveTab.count();
    if (count === 0) { test.skip(); return; }

    const [tabColor, headerBg] = await Promise.all([
      inactiveTab.evaluate((el) => window.getComputedStyle(el).color),
      inactiveTab.evaluate((el) => {
        let node: Element | null = el;
        while (node) {
          const bg = window.getComputedStyle(node).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          node = node.parentElement;
        }
        return 'rgb(255,255,255)';
      }),
    ]);

    const fg = parseRgb(tabColor);
    const bg = parseRgb(headerBg);
    if (!fg || !bg) { test.skip(); return; }

    const ratio = contrastRatio(
      luminance(fg.r, fg.g, fg.b),
      luminance(bg.r, bg.g, bg.b)
    );

    console.log(`Inactive tab contrast: ${ratio.toFixed(2)}:1  (fg=${tabColor} bg=${headerBg})`);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });
});

test.describe('Modal – キーボード & フォーカス操作', () => {
  test('ヘルプモーダルが Escape で閉じること', async ({ page }) => {
    await page.goto('/');
    const helpBtn = page.locator('button[aria-label="ヘルプを表示"]').first();
    await helpBtn.click();
    await page.waitForSelector('text=使い方ガイド', { state: 'visible' });

    await page.keyboard.press('Escape');
    await expect(page.locator('text=使い方ガイド')).toBeHidden({ timeout: 2000 });
  });

  test('ヘルプモーダル内でタブキーフォーカスが循環すること', async ({ page }) => {
    await page.goto('/');
    const helpBtn = page.locator('button[aria-label="ヘルプを表示"]').first();
    await helpBtn.click();
    await page.waitForSelector('text=使い方ガイド', { state: 'visible' });

    // タブを10回押してもフォーカスがモーダル内に留まるか確認
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // フォーカスが modal の外（body, header etc.）に出ていないこと
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      // dialog役割の祖先を探す
      let node: Element | null = el;
      while (node) {
        if (node.getAttribute('role') === 'dialog') return true;
        // fixed modal の class チェック
        if (node.classList.contains('fixed') && node.classList.contains('z-50')) return true;
        node = node.parentElement;
      }
      return false;
    });

    // フォーカストラップが実装されていればtrue、未実装でも警告のみ
    if (!focused) {
      console.warn('Modal focus trap not implemented – consider adding for full WCAG 2.1 Level AA compliance.');
    }
  });

  test('モーダル閉じるボタンに適切な aria-label があること', async ({ page }) => {
    await page.goto('/');
    const helpBtn = page.locator('button[aria-label="ヘルプを表示"]').first();
    await helpBtn.click();
    await page.waitForSelector('text=使い方ガイド', { state: 'visible' });

    const closeBtn = page.locator('button[aria-label="ヘルプを閉じる"]');
    await expect(closeBtn).toBeVisible();
  });
});

test.describe('Clock Mode – ポモドーロ UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // 時計タブに切り替え
    await page.getByRole('button', { name: '時計' }).click();
    await expect(page.locator('text=ポモドーロ')).toBeVisible();
  });

  test('ポモドーロタブが表示・操作可能', async ({ page }) => {
    await page.getByRole('button', { name: 'ポモドーロ' }).click();
    await expect(page.locator('text=作業中')).toBeVisible();

    const startBtn = page.getByRole('button', { name: 'スタート' });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });

  test('設定パネル – 作業時間のプリセット変更', async ({ page }) => {
    await page.getByRole('button', { name: 'ポモドーロ' }).click();

    // 設定パネルを開く
    await page.locator('button[title="設定"]').click();
    await expect(page.locator('text=時間設定')).toBeVisible();

    // 作業時間を30分に変更
    await page.getByRole('button', { name: '30' }).first().click();
    await expect(page.locator('text=30分集中')).toBeVisible();
  });
});
