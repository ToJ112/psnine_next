import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../dist/psnine_next.user.js', import.meta.url), 'utf8');

function fixture(personal: boolean) {
  const query = personal ? 'psnid=fixture_user&' : '';
  const row = (id: number, type: number, rarity: number) => `
    <tr class="trophy" id="cup-${id}">
      <td class="t${type}"><a href="/trophy/1234500${id}">图标</a></td>
      <td><p><a href="/trophy/1234500${id}">奖杯 ${id}</a></p><div class="text-strong">说明</div></td>
      <td class="twoge">${rarity}%</td><td></td>
    </tr>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; font: 14px sans-serif; }
      .box { padding: 10px; } a { color: #3673a8; text-decoration: none; }
      .dropmenu, .dropmenu ul { margin: 0; padding: 0; list-style: none; }
      .dropmenu { display: block; height: 36px; line-height: 36px; }
      .dropmenu li { position: relative; float: left; }
      .dropmenu li.hover { background-color: #333645; }
      .dropmenu a { display: block; color: #666; }
      .dropdown.hover ul { display: block; }
      .dropdown a.arr-down { padding: 0 20px 0 10px; }
      .dropdown ul { position: absolute; left: 0; display: none; z-index: 999; background-color: #333645; padding-bottom: 10px; }
      .dropdown ul li { margin: 0; float: none; white-space: nowrap; }
      .dropdown ul li a { color: #6b7989; line-height: 36px; font-size: 14px; padding: 0 16px; }
      .dropdown ul li a.current { background-color: rgba(0,0,0,0.3); color: #b2bfc9; }
      table { width: 100%; } td { padding: 6px; }
    </style></head><body><main class="min-inner"><div class="box">
    <ul class="dropmenu"><li><em>排序</em></li><li class="dropdown">
      <a href="javascript:void(0)" class="arr-down">完美率</a><ul>
        <li><a href="?${query}ob=trophyid&psngamelang=zh-Hans">XMB</a></li>
        <li><a href="?${query}ob=type&psngamelang=zh-Hans">类型</a></li>
        <li><a href="?${query}ob=rarity&psngamelang=zh-Hans" class="current">完美率</a></li>
      </ul>
    </li></ul>
    <table class="list"><tbody>${row(2, 4, 3)}${row(1, 1, 10)}${row(3, 2, 40)}</tbody></table>
    </div></main><script>
      // Equivalent to the site's jQuery hover handlers; no other site scripts run.
      document.querySelectorAll('.dropdown').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('hover'));
        el.addEventListener('mouseleave', () => el.classList.remove('hover'));
      });
    </script></body></html>`;
}

for (const personal of [true, false]) {
  test(`native trophy menu: ${personal ? 'personal' : 'public'} page preserves links and supports input`, async ({ page, isMobile }, testInfo) => {
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture(personal) }));
    const query = personal ? 'psnid=fixture_user&' : '';
    await page.goto(`https://psnine.com/psngame/12345?${query}ob=rarity&psngamelang=zh-Hans`);
    await page.evaluate(() => {
      (window as any).__nativeLinks = [...document.querySelectorAll('.dropdown > ul > li > a')];
      (window as any).__nativeHrefs = (window as any).__nativeLinks.map((a: HTMLAnchorElement) => a.getAttribute('href'));
    });
    await page.addScriptTag({ content: bundle });
    const trigger = page.locator('[data-psnine-trophy-sort-trigger]');
    const menu = page.locator('[data-psnine-trophy-sort-menu]');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#psnine-trophy-header-title')).toContainText('奖杯概览');
    await expect(page.locator('#psnine-sort-xmb-btn, #psnine-sort-time-btn, #psnine-sort-type-btn, #psnine-sort-rarity-btn')).toHaveCount(0);
    await expect(page.locator('[data-psnine-sort="time-desc"]')).toHaveCount(personal ? 1 : 0);
    const activate = () => isMobile ? trigger.tap() : trigger.click();
    await activate();
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const within = await menu.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    });
    expect(within).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('native-menu.png') });
    const ascendingType = page.locator('[data-psnine-sort="type-asc"]');
    if (isMobile) await ascendingType.tap(); else await ascendingType.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
    await expect(trigger).toContainText('类型（铜→白金）');
    await expect(menu.locator('a.current')).toHaveCount(1);
    await expect(ascendingType).toHaveClass(/current/);
    expect(await page.locator('tr.trophy').evaluateAll(rows => rows.map(row => row.id))).toEqual(['cup-2', 'cup-3', 'cup-1']);

    // Keyboard must be usable even on a touch-capable browser. Escape returns focus.
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    const initial = page.locator('[data-psnine-sort="initial"]');
    await initial.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toContainText('页面初始顺序');
    await expect(menu.locator('a.current')).toHaveCount(1);
    await expect(initial).toHaveClass(/current/);
    expect(await page.locator('tr.trophy').evaluateAll(rows => rows.map(row => row.id))).toEqual(['cup-2', 'cup-1', 'cup-3']);

    expect(await page.evaluate(() => {
      const links = [...document.querySelectorAll('.dropdown > ul > li > a')].slice(0, 3);
      return links.every((a, i) => a === (window as any).__nativeLinks[i] && a.getAttribute('href') === (window as any).__nativeHrefs[i]);
    })).toBe(true);

    // Tabbing out must close the menu without a later Escape stealing focus.
    await trigger.focus();
    await page.keyboard.press('Enter');
    await initial.focus();
    await page.keyboard.press('Tab');
    const summaryToggle = page.locator('#psnine-toggle-summary-btn');
    await expect(summaryToggle).toBeFocused();
    await expect(menu).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(summaryToggle).toBeFocused();

    await page.waitForTimeout(300);
    await page.evaluate(() => {
      (window as any).__menuMutations = 0;
      new MutationObserver(records => (window as any).__menuMutations += records.length)
        .observe(document.body, { childList: true, subtree: true });
    });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => (window as any).__menuMutations)).toBe(0);

    // Original links still perform native navigation with the full query intact.
    await activate();
    await menu.locator('a[href*="ob=type"]').click();
    await expect(page).toHaveURL(`https://psnine.com/psngame/12345?${query}ob=type&psngamelang=zh-Hans`);
  });
}
