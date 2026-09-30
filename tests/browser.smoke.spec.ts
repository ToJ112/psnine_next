import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userScriptPath = path.resolve(__dirname, '../dist/psnine_next.user.js');
const userScriptCode = fs.readFileSync(userScriptPath, 'utf-8');

// Realistic mock PSNINE HTML fixture with explicit UTF-8 meta in <head>
const MOCK_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>PSN中文网 - 游戏讨论与白金攻略</title>
</head>
<body class="bg">
  <div class="site-nav">
    <div class="nav-user">
      <button class="auth-user" type="button"><span class="name">test_gamer</span></button>
      <a class="yuan float-btn sign" href="/signin">签到</a>
      <div class="dropdown">
        <ul class="user-menu-list">
          <li><a href="/psnid/test_gamer">我的主页</a></li>
        </ul>
      </div>
    </div>
  </div>

  <div class="main">
    <div class="title2">【白金攻略】战神：诸神黄昏 详细图文指引</div>

    <div class="post" id="post-1">
      <div class="ml64">
        <div class="meta">
          <a class="psnnode" href="/psnid/guide_master">guide_master</a>
          <span class="r"><a class="r" href="#reply">回复</a></span>
        </div>
        <div class="content pb10">
          欢迎查阅本攻略！注意以下剧情剧透：<span class="mark">诸神黄昏的最终敌人是<strong>奥丁</strong><em>（剧透）</em><a href="/topic/54321" style="color:red">详情</a></span>。
        </div>
      </div>
    </div>

    <div class="post" id="post-2">
      <div class="ml64">
        <div class="meta">
          <a class="psnnode" href="/psnid/mechille">mechille</a>
          <span class="r"><a class="r" href="#reply">回复</a></span>
        </div>
        <div class="content pb10">
          写得非常好，支持！<a href="/psnid/guide_master">@guide_master</a> 期待更新！
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

test.describe('psnine_next Browser Smoke & DOM Stability Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept requests to mock PSNINE host with explicit UTF-8 charset
    await page.route('https://psnine.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: MOCK_HTML,
      });
    });

    // Inject UserScript at document-start before any page script loads
    await page.addInitScript({ content: userScriptCode });
  });

  test('injects exactly one core stylesheet at document-start and resists duplicate injection', async ({ page }) => {
    await page.goto('https://psnine.com/topic/12345');

    // 1. Verify exactly one psnineCoreStyles style tag exists
    const coreStylesCount = await page.locator('#psnineCoreStyles').count();
    expect(coreStylesCount).toBe(1);

    // 2. Simulate duplicate script execution (e.g. extension reinjection or iframe)
    await page.evaluate((code) => {
      const script = document.createElement('script');
      script.textContent = code;
      document.body.appendChild(script);
    }, userScriptCode);

    // Assert stylesheet is still exactly 1 (singleton guarantee)
    const afterDuplicateCount = await page.locator('#psnineCoreStyles').count();
    expect(afterDuplicateCount).toBe(1);
  });

  test('mounts settings UI, verifies layout, accessible button contrast, and closes on Escape', async ({ page }) => {
    await page.goto('https://psnine.com/topic/12345');

    const gearBtn = page.locator('#psnine-settings-gear');
    await expect(gearBtn).toBeVisible();

    await gearBtn.click();
    const dialog = page.locator('.psnine-settings-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('PSNINE 设置');

    // Verify button contrast
    const saveBtn = dialog.locator('button:has-text("保存配置")');
    await expect(saveBtn).toBeVisible();
    const saveBg = await saveBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const saveColor = await saveBtn.evaluate((el) => window.getComputedStyle(el).color);
    expect(saveBg).not.toBe(saveColor);

    // Escape closes modal
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('verifies G04 spoiler computedStyle masking and revealing in light and dark modes', async ({ page }) => {
    await page.goto('https://psnine.com/topic/12345');

    const mark = page.locator('.mark').first();
    await expect(mark).toBeVisible();
    const expectNestedColor = async (color: string) => {
      const nestedColors = await mark.locator('strong, em, a').evaluateAll(els => els.map(el => getComputedStyle(el).color));
      expect(nestedColors).toEqual([color, color, color]);
    };

    // In light theme: masked text color matches background color (invisible)
    const lightBg = await mark.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const lightColor = await mark.evaluate((el) => window.getComputedStyle(el).color);
    expect(lightColor).toBe(lightBg);
    await expectNestedColor(lightBg);

    // Unmask via click/tap: text becomes white (#ffffff)
    await mark.click({ position: { x: 2, y: 2 } });
    await expect(mark).toHaveClass(/unmasked/);
    const unmaskedColor = await mark.evaluate((el) => window.getComputedStyle(el).color);
    expect(unmaskedColor).toBe('rgb(255, 255, 255)');
    await expectNestedColor(unmaskedColor);

    // Toggle back to masked
    await mark.click({ position: { x: 2, y: 2 } });
    await expect(mark).not.toHaveClass(/unmasked/);

    // Exercise the shipped theme handler, not a test-supplied replacement stylesheet.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const darkBg = await mark.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const darkColor = await mark.evaluate((el) => window.getComputedStyle(el).color);
    expect(darkColor).toBe(darkBg);
    await expectNestedColor(darkBg);

    // Unmask in dark mode
    await mark.click({ position: { x: 2, y: 2 } });
    await expect(mark).toHaveClass(/unmasked/);
    const darkUnmaskedColor = await mark.evaluate((el) => window.getComputedStyle(el).color);
    expect(darkUnmaskedColor).toBe('rgb(255, 255, 255)');
    await expectNestedColor(darkUnmaskedColor);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('#nightModeStyle')).toHaveCount(0);
    await mark.click({ position: { x: 2, y: 2 } });
    const restoredBg = await mark.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const restoredColor = await mark.evaluate((el) => window.getComputedStyle(el).color);
    expect(restoredColor).toBe(restoredBg);
    await expectNestedColor(restoredBg);
  });

  test('lifecycle test: BFCache persisted navigation preserves state without duplicate listeners', async ({ page }) => {
    await page.goto('https://psnine.com/topic/12345');

    // Simulate page entering BFCache (persisted: true)
    await page.evaluate(() => {
      const event = new PageTransitionEvent('pagehide', { persisted: true });
      window.dispatchEvent(event);
    });

    // Check that script remains mounted during BFCache freeze
    const isMounted = await page.evaluate(() => (window as any).__psnine_next_mounted__);
    expect(isMounted).toBe(true);

    // Simulate pageshow restoring from BFCache (persisted: true)
    await page.evaluate(() => {
      const event = new PageTransitionEvent('pageshow', { persisted: true });
      window.dispatchEvent(event);
    });

    // Still exactly 1 gear button and 1 stylesheet
    expect(await page.locator('#psnine-settings-gear').count()).toBe(1);
    expect(await page.locator('#psnineCoreStyles').count()).toBe(1);
  });

  test('DOM stability check: MutationObserver settles after initial render without infinite loops', async ({ page }) => {
    await page.goto('https://psnine.com/topic/12345');

    await page.evaluate(() => {
      (window as any).__mutation_count__ = 0;
      const observer = new MutationObserver(() => {
        (window as any).__mutation_count__++;
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });

    await page.waitForTimeout(800);

    const mutationCount = await page.evaluate(() => (window as any).__mutation_count__);
    expect(mutationCount).toBeLessThan(10);
  });
});
