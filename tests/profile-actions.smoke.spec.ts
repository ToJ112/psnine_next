import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../dist/psnine_next.user.js', import.meta.url), 'utf8');

// Synthetic fixture synthesizing native PSNINE styles (including legacy button/.btn blue background)
// and site v2 design tokens (--c-*)
const FIXTURE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* PSNINE v2 site design tokens (aligned with View/v2/css/style.css) */
    :root {
      --c-brand: #1E5AE6;
      --c-brand-deep: #0F2C5C;
      --c-brand-soft: #E8EFFE;
      --c-bg: #F4F6FA;
      --c-card: #FFFFFF;
      --c-line: #E5E8EF;
      --c-text: #1F2937;
      --c-text-2: #6B7280;
      --r-sm: 4px;
      --r-md: 8px;
    }
    :root[data-theme="dark"], html[data-theme="dark"] {
      color-scheme: dark;
      --c-brand: #79aaff;
      --c-brand-deep: #dce7f7;
      --c-brand-soft: #1d2b3e;
      --c-bg: #10151d;
      --c-card: #1a222d;
      --c-line: #303b49;
      --c-line-2: #27313e;
      --c-text: #e6ebf2;
      --c-text-2: #a8b3c2;
      --c-text-3: #7f8b9b;
    }
    /* Native legacy button style that previously caused blue-on-blue text defects */
    button, .btn {
      background-color: #3890ff;
      color: white;
      padding: 8px 12px;
      outline: none;
      cursor: pointer;
    }
    a.btn {
      display: block;
      text-align: center;
      color: white;
    }
    body {
      margin: 0;
      background: var(--c-bg);
      color: var(--c-text);
      font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .psnzz { background: #222; color: #fff; padding: 12px; }
    .psnzz .inner { max-width: 1200px; margin: 0 auto; }
    .psninfo { padding: 8px 0; }
    .box { padding: 12px; background: var(--c-card); }
    .inav { padding: 10px; background: var(--c-card); display: flex; list-style: none; margin: 0; }
  </style>
</head>
<body class="bg">
  <div class="site-nav">
    <div class="nav-user">
      <button class="auth-user" type="button"><span class="name">test_gamer</span></button>
      <div class="dropdown">
        <ul class="user-menu-list">
          <li><a href="/psnid/test_gamer">我的主页</a></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Profile Area -->
  <div class="psnzz">
    <div class="inner">
      <div class="psninfo">
        <a href="/psnid/test_gamer">test_gamer</a>
        <table class="list"><tbody>
          <tr id="game-row-100">
            <td class="pd15"><a href="/psngame/99999">Finished Game</a></td>
            <td><div class="progress"><div style="width:100%">100%</div></div></td>
          </tr>
          <tr id="game-row-38">
            <td class="pd15"><a href="/psngame/46507">Balatro</a></td>
            <td><div class="progress"><div style="width:38%">38%</div></div></td>
          </tr>
        </tbody></table>
      </div>
    </div>
  </div>

  <!-- Game / Trophy Area -->
  <div class="main">
    <div class="box pd10">
      <ul class="inav">
        <li class="current"><a href="/psngame/46507">奖杯</a></li>
      </ul>
      <div class="side">
        <a href="/game/46507">元数据主页</a>
      </div>
    </div>
  </div>
</body>
</html>`;

function parseRgb(colorStr: string): [number, number, number] {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(val => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function calculateContrast(fgStr: string, bgStr: string): number {
  const fgRgb = parseRgb(fgStr);
  const bgRgb = parseRgb(bgStr);
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test.describe('Profile & Game Action Controls Smoke Tests (390px Viewport)', () => {
  test.beforeEach(async ({ page }) => {
    // Strict 390px viewport simulation
    await page.setViewportSize({ width: 390, height: 844 });

    // Mock HTML fixture and variant game metadata document
    await page.route('**/*', async (route) => {
      const reqUrl = route.request().url();
      if (reqUrl.includes('/game/46507')) {
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html><body><div class="min-inner"><ul class="darklist"><li><span class="r">PS4</span><a href="/psngame/42152">Balatro PS4</a></li></ul></div></body></html>`
        });
      } else {
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: FIXTURE_HTML
        });
      }
    });

    // Inject self-contained userscript bundle without external calls
    await page.addInitScript({ content: bundle });
  });

  test('1. profile sync buttons: height >= 44px, computedStyle contrast >= 4.5, and theme light/dark follows media', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('https://psnine.com/psnid/test_gamer');

    const syncGroup = page.locator('#psnine-sync-psn-btn-group');
    await expect(syncGroup).toBeVisible();

    const syncLinks = syncGroup.locator('a.psnine-sync-btn');
    await expect(syncLinks).toHaveCount(2);

    for (const link of await syncLinks.all()) {
      // 1. Touch target >= 44px
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // 2. Light mode computedStyle verification (dynamically calculated)
      const lightStyles = await link.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { color: cs.color, backgroundColor: cs.backgroundColor };
      });
      // Verifies background is NOT overridden by native .btn { background-color: #3890ff }
      expect(lightStyles.backgroundColor).not.toBe('rgb(56, 144, 255)');
      const lightContrast = calculateContrast(lightStyles.color, lightStyles.backgroundColor);
      expect(lightContrast).toBeGreaterThanOrEqual(4.5);

      // 3. Dark mode theme switch via emulateMedia, assert html gets data-theme=dark
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      await link.evaluate(async el => {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
      });
      const darkStyles = await link.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { color: cs.color, backgroundColor: cs.backgroundColor };
      });

      // Verify computedStyle actually changes between light and dark
      expect(darkStyles.backgroundColor).not.toBe(lightStyles.backgroundColor);
      expect(darkStyles.color).not.toBe(lightStyles.color);

      // Dark mode contrast >= 4.5
      const darkContrast = calculateContrast(darkStyles.color, darkStyles.backgroundColor);
      expect(darkContrast).toBeGreaterThanOrEqual(4.5);

      // Restore to light mode
      await page.emulateMedia({ colorScheme: 'light' });
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
      await link.evaluate(async el => {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
      });
    }
  });

  test('2. trophy to-mine entry: height >= 44px, computedStyle contrast >= 4.5, and theme light/dark follows media', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('https://psnine.com/psngame/46507?psnid=test_gamer');

    const toMineBtn = page.locator('#psnine-to-mine-trophy-btn');
    await expect(toMineBtn).toBeVisible();

    // 1. Touch target >= 44px
    const box = await toMineBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // 2. Light mode computedStyle verification
    const lightStyles = await toMineBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, backgroundColor: cs.backgroundColor };
    });
    expect(lightStyles.backgroundColor).not.toBe('rgb(56, 144, 255)');
    const lightContrast = calculateContrast(lightStyles.color, lightStyles.backgroundColor);
    expect(lightContrast).toBeGreaterThanOrEqual(4.5);

    // 3. Dark mode switch via emulateMedia, assert html data-theme=dark
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await toMineBtn.evaluate(async el => {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
      });
      const darkStyles = await toMineBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
            return { color: cs.color, backgroundColor: cs.backgroundColor };
    });

    // Verify computedStyle color/background actually changes across themes
    expect(darkStyles.backgroundColor).not.toBe(lightStyles.backgroundColor);
    expect(darkStyles.color).not.toBe(lightStyles.color);

    const darkContrast = calculateContrast(darkStyles.color, darkStyles.backgroundColor);
    expect(darkContrast).toBeGreaterThanOrEqual(4.5);
  });

  test('3. game variants button: height >= 44px, computedStyle contrast >= 4.5, and theme light/dark follows media', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('https://psnine.com/psngame/46507');

    const variantsSection = page.locator('#psnine-game-variants-section');
    await expect(variantsSection).toBeVisible();

    const variantBtn = variantsSection.locator('.psnine-variant-btn').first();
    await expect(variantBtn).toBeVisible();

    // 1. Touch target >= 44px
    const box = await variantBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // 2. Light mode computedStyle contrast
    const lightStyles = await variantBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, backgroundColor: cs.backgroundColor };
    });
    const lightContrast = calculateContrast(lightStyles.color, lightStyles.backgroundColor);
    expect(lightContrast).toBeGreaterThanOrEqual(4.5);

    // 3. Dark mode switch via emulateMedia, assert html data-theme=dark
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await variantBtn.evaluate(async el => {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
      });
      const darkStyles = await variantBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, backgroundColor: cs.backgroundColor };
    });

    // Verify computedStyle color/background actually changes across themes
    expect(darkStyles.backgroundColor).not.toBe(lightStyles.backgroundColor);
    expect(darkStyles.color).not.toBe(lightStyles.color);

    const darkContrast = calculateContrast(darkStyles.color, darkStyles.backgroundColor);
    expect(darkContrast).toBeGreaterThanOrEqual(4.5);
  });

  test("4. profile game progress filter: compact segmented control dimensions, computedStyle contrast >= 4.5, theme follow, and row filtering", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("https://psnine.com/psnid/test_gamer");

    const filterGroup = page.locator("#psnine-game-progress-filter");
    await expect(filterGroup).toBeVisible();

    const buttons = filterGroup.locator("button.psnine-progress-filter-btn");
    await expect(buttons).toHaveCount(3);

    const btnAll = filterGroup.locator("button[data-filter='all']");
    const btnNon100 = filterGroup.locator("button[data-filter='non-100']");
    const btn100 = filterGroup.locator("button[data-filter='100']");

    const row100 = page.locator("#game-row-100");
    const row38 = page.locator("#game-row-38");

    // 1. Compact segmented capsule container and button dimensions
    const containerBox = await filterGroup.boundingBox();
    expect(containerBox).not.toBeNull();

    for (const btn of await buttons.all()) {
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(26);
      expect(box!.height).toBeLessThanOrEqual(30);

      const btnStyles = await btn.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          fontSize: cs.fontSize,
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          borderRadius: cs.borderRadius,
          borderStyle: cs.borderStyle
        };
      });
      expect(btnStyles.fontSize).toBe("12px");
      expect(btnStyles.paddingLeft).toBe("12px");
      expect(btnStyles.paddingRight).toBe("12px");
      expect(btnStyles.borderRadius).toBe("14px");
      expect(btnStyles.borderStyle).toBe("none");
    }

    // 2. Active button computedStyle contrast >= 4.5 across light and dark
    const lightActiveStyles = await btnAll.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, backgroundColor: cs.backgroundColor };
    });
    const lightContrast = calculateContrast(lightActiveStyles.color, lightActiveStyles.backgroundColor);
    expect(lightContrast).toBeGreaterThanOrEqual(4.5);

    // Inactive button has transparent background
    const lightInactiveStyles = await btnNon100.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, backgroundColor: cs.backgroundColor };
    });
    expect(lightInactiveStyles.backgroundColor).toBe("rgba(0, 0, 0, 0)");

    // Dark mode switch via emulateMedia
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await btnAll.evaluate(async el => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
    });
    const darkActiveStyles = await btnAll.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, backgroundColor: cs.backgroundColor };
    });

    // Computed style background changes between themes
    expect(darkActiveStyles.backgroundColor).not.toBe(lightActiveStyles.backgroundColor);

    // Dark mode contrast >= 4.5
    const darkContrast = calculateContrast(darkActiveStyles.color, darkActiveStyles.backgroundColor);
    expect(darkContrast).toBeGreaterThanOrEqual(4.5);

    // Restore to light mode
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    await btnAll.evaluate(async el => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await Promise.allSettled(el.getAnimations().map(animation => animation.finished));
    });

    // 3. Initial state: "全部" active -> all rows visible
    await expect(btnAll).toHaveAttribute("aria-pressed", "true");
    await expect(row100).toBeVisible();
    await expect(row38).toBeVisible();

    // 4. Click "非 100%" -> 100% row hidden, 38% row visible
    await btnNon100.click();
    await expect(btnNon100).toHaveAttribute("aria-pressed", "true");
    await expect(btnAll).toHaveAttribute("aria-pressed", "false");
    await expect(row100).toBeHidden();
    await expect(row38).toBeVisible();

    // 5. Click "100%" -> 100% row visible, 38% row hidden
    await btn100.click();
    await expect(btn100).toHaveAttribute("aria-pressed", "true");
    await expect(btnNon100).toHaveAttribute("aria-pressed", "false");
    await expect(row100).toBeVisible();
    await expect(row38).toBeHidden();

    // 6. Click "全部" -> all rows visible
    await btnAll.click();
    await expect(btnAll).toHaveAttribute("aria-pressed", "true");
    await expect(btn100).toHaveAttribute("aria-pressed", "false");
    await expect(row100).toBeVisible();
    await expect(row38).toBeVisible();
  });

  test("5. profile native sync: preserves native sync buttons and does not inject plugin buttons", async ({ page }) => {
    await page.route("**/psnid/native_sync_user", async (route) => {
      const htmlWithNative = FIXTURE_HTML.replace(
        '<div class="psninfo">',
        '<div class="psnbtnright"><a href="/psnid/native_sync_user/upbase">等级同步</a><a href="/psnid/native_sync_user/upgame">游戏同步</a></div><div class="psninfo">'
      );
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: htmlWithNative
      });
    });

    await page.goto("https://psnine.com/psnid/native_sync_user");

    // Plugin sync group must NOT exist
    const syncGroup = page.locator("#psnine-sync-psn-btn-group");
    await expect(syncGroup).toHaveCount(0);

    // Native sync links must be preserved
    const nativeLinks = page.locator(".psnbtnright a");
    await expect(nativeLinks).toHaveCount(2);
    await expect(nativeLinks.nth(0)).toHaveText("等级同步");
    await expect(nativeLinks.nth(1)).toHaveText("游戏同步");
  });
});
