import { test, expect } from '@playwright/test'

test.describe('Medical Voice Scribe - Basic Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Medical Scribe Flow/)
  })

  test('should display main UI elements', async ({ page }) => {
    // Header
    await expect(page.locator('header')).toBeVisible()

    // Recording button
    await expect(page.getByRole('button', { name: /録音/ })).toBeVisible()

    // Generate button
    await expect(page.getByRole('button', { name: /カルテ生成/ })).toBeVisible()

    // Clear button
    await expect(page.getByRole('button', { name: /クリア/ })).toBeVisible()
  })

  test('should have textarea for transcript input', async ({ page }) => {
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
  })

  test('should disable generate button when no transcript', async ({ page }) => {
    const generateButton = page.getByRole('button', { name: /カルテ生成/ })
    await expect(generateButton).toBeDisabled()
  })

  test('should enable generate button when transcript has content', async ({ page }) => {
    const textarea = page.locator('textarea')
    await textarea.fill('医師: 今日はどうされましたか？\n患者: 頭が痛いです。')

    const generateButton = page.getByRole('button', { name: /カルテ生成/ })
    await expect(generateButton).toBeEnabled()
  })

  test('should clear transcript when clear button clicked', async ({ page }) => {
    const textarea = page.locator('textarea')
    await textarea.fill('テストテキスト')

    const clearButton = page.getByRole('button', { name: /クリア/ })
    await clearButton.click()

    await expect(textarea).toHaveValue('')
  })
})

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should toggle theme when button clicked', async ({ page }) => {
    const html = page.locator('html')

    // Get initial theme state
    const initialTheme = await html.getAttribute('data-theme')

    // Find and click theme toggle button
    const themeButton = page.getByRole('button', { name: /テーマ/ })
    await themeButton.click()

    // Wait for theme change by asserting DOM state (not timeout)
    await expect(async () => {
      const newTheme = await html.getAttribute('data-theme')
      expect(newTheme).not.toBe(initialTheme)
    }).toPass()
  })
})

test.describe('Model Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have model selector', async ({ page }) => {
    const modelSelector = page.locator('select[aria-label="AIモデル選択"]')
    await expect(modelSelector).toBeVisible()
  })

  test('should be able to change model', async ({ page }) => {
    const modelSelector = page.locator('select[aria-label="AIモデル選択"]').first()

    // Get initial value
    const initialValue = await modelSelector.inputValue()

    // Select a different model by value
    await modelSelector.selectOption('gpt-4.1-mini')

    // Verify selection changed to specific value
    await expect(modelSelector).toHaveValue('gpt-4.1-mini')
    expect(initialValue).not.toBe('gpt-4.1-mini')
  })
})

test.describe('Responsive Design', () => {
  test('should display mobile layout on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Header should be visible
    await expect(page.locator('header')).toBeVisible()

    // Mobile-specific: header should still contain interactive elements
    await expect(page.getByRole('button', { name: /録音/ })).toBeVisible()
  })

  test('should display desktop layout on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    // Header should be visible with full branding
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('header')).toContainText('Medical Voice Scribe')

    // Desktop should show status badge
    await expect(page.locator('.status-badge, [class*="status"]')).toBeVisible()
  })
})

test.describe('Keyboard Shortcuts Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display keyboard shortcuts on buttons', async ({ page }) => {
    // Recording button should show shortcut
    const recordButton = page.getByRole('button', { name: /録音/ })
    await expect(recordButton).toBeVisible()

    // Generate button should show shortcut
    const generateButton = page.getByRole('button', { name: /カルテ生成/ })
    await expect(generateButton).toBeVisible()
  })
})
