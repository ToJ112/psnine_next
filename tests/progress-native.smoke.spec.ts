import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../dist/psnine_next.user.js', import.meta.url), 'utf8');
const base = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--c-card:#fff;--c-bg:#f4f6fa;--c-text:#1f2937;--c-text-2:#566274;--c-brand:#1e5ae6;--c-line:#dbe2eb}
html[data-theme="dark"]{--c-card:#1a222d;--c-bg:#10151d;--c-text:#e6ebf2;--c-text-2:#a8b3c2;--c-brand:#79aaff;--c-line:#303b49}
body{margin:0;font:14px sans-serif;background:var(--c-bg);color:var(--c-text)}
.box{background:var(--c-card);padding:12px}table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid var(--c-line)}
a{color:var(--c-brand)}.progress{width:60px;background:#777}.progress>div{background:#bf7110;color:white}
button{font:inherit}.o_btn{border:1px solid var(--c-line);border-radius:16px;padding:6px 12px;color:var(--c-text);background:var(--c-card)}
.o_btn.select{background:var(--c-brand);color:var(--c-bg)}
</style>`;
const identity = `<div class="nav-user"><button class="auth-user"><span class="name">fixture_user</span></button></div>`;
const gameRow = (id: number, official: number | null) => `<tr id="game-${id}"><td class="pd15"><a href="/psngame/${id}"><img width="64" height="64" alt="游戏封面"></a></td><td><a href="/psngame/${id}">游戏 ${id}</a></td><td>${official === null ? '' : `<div class="progress"><div style="width:${official}%">${official}%</div></div>`}</td></tr>`;

async function seedProgress(page: Page) {
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('psnine_next:progress:fixture_user', JSON.stringify({
      userId: 'fixture_user', lastFullSync: now, nextRefresh: now + 86400000,
      refreshInterval: 3600000, syncCursorPage: 1, syncStatus: 'full',
      games: { '101': { gameId: '101', percent: 38, platinum: false, updatedAt: now }, '102': { gameId: '102', percent: 42, platinum: false, updatedAt: now } },
    }));
  });
}

async function badgeContrast(page: Page) {
  return page.locator('.psnine-game-list-progress-badge').evaluate(el => {
    const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = (rgb: number[]) => rgb.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
    const layers: number[][] = [];
    for (let n: Element | null = el; n; n = n.parentElement) layers.push(parse(getComputedStyle(n).backgroundColor));
    const bg = layers.reverse().reduce((base,c) => c.slice(0,3).map((v,i) => v*(c[3]??1)+base[i]*(1-(c[3]??1))), [255,255,255]);
    const a = lum(parse(getComputedStyle(el).color)), b = lum(bg);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`profile progress: ${scheme} keeps official progress and readable cached hints`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width:390, height:844 });
    await page.emulateMedia({ colorScheme:scheme });
    const html = `<!doctype html><html><head>${base}</head><body>${identity}<main class="main box"><table class="list"><tbody>${gameRow(101,38)}${gameRow(102,null)}</tbody></table></main></body></html>`;
    await page.route('**/*', route => route.fulfill({ contentType:'text/html; charset=utf-8', body:html }));
    await page.goto('https://psnine.com/psnid/fixture_user/psngame');
    await seedProgress(page);
    await page.addScriptTag({ content:bundle });
    await expect(page.locator('#game-102 .psnine-game-list-progress-badge')).toContainText('42%');
    await expect(page.locator('#game-101 .psnine-game-list-progress-badge')).toHaveCount(0);
    await expect(page.locator('#game-101 .progress > div')).toHaveText('38%');
    for (const id of [101,102]) expect(await page.locator(`#game-${id}`).evaluate(el => getComputedStyle(el).backgroundImage)).toBe('none');
    expect(await badgeContrast(page)).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path:testInfo.outputPath(`profile-progress-${scheme}.png`) });
    await page.emulateMedia({ colorScheme:scheme === 'dark' ? 'light' : 'dark' });
    if (scheme === 'dark') await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    else await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    expect(await badgeContrast(page)).toBeGreaterThanOrEqual(4.5);
    // The website supplies a progress bar later; its value must replace the redundant hint.
    await page.locator('#game-102 td:last-child').evaluate(el => { el.innerHTML = '<div class="progress"><div style="width:52%">52%</div></div>'; });
    await expect(page.locator('#game-102 .psnine-game-list-progress-badge')).toHaveCount(0);
    await expect(page.locator('#game-102 .progress > div')).toHaveText('52%');
  });
}

test('another profile keeps its own official percentage without my cached overlay', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType:'text/html; charset=utf-8', body:`<!doctype html><html><head>${base}</head><body>${identity}<main class="main box"><table class="list">${gameRow(101,5)}</table></main></body></html>` }));
  await page.goto('https://psnine.com/psnid/another_user/psngame');
  await seedProgress(page);
  await page.addScriptTag({ content:bundle });
  await expect(page.locator('#psnine-settings-gear')).toBeVisible();
  await expect(page.locator('.psnine-game-list-progress-badge')).toHaveCount(0);
  await expect(page.locator('.progress > div')).toHaveText('5%');
  expect(await page.locator('#game-101').evaluate(el => getComputedStyle(el).backgroundImage)).toBe('none');
});

for (const scheme of ['light', 'dark'] as const) {
test(`native trophy status controls and Tips share a row in ${scheme} and keep inline Tips together`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.emulateMedia({ colorScheme:scheme });
  const row = (id: number, earned: boolean) => `<tr class="trophy" id="cup-${id}"><td class="t4"><img class="imgbg ${earned ? 'earned' : ''}" width="54" height="54"></td><td><a href="/trophy/1234500${id}">奖杯 ${id}</a><p>说明</p><em class="alert-success"><b>1</b> Tips</em></td><td class="twoge">30%</td></tr>`;
  // Model the site's getOwn/getUnOwn/showAll behavior; no live account action occurs.
  const nativeScript = `<script>
  window.nativeCalls=0;
  function filterNative(which){
    window.nativeCalls++;
    const active=document.querySelector('.'+which), selected=active.classList.contains('select');
    document.querySelectorAll('.o_btn').forEach(el=>el.classList.remove('select'));
    if(!selected)active.classList.add('select');
    document.querySelectorAll('tr.trophy').forEach(row=>{
      const earned=!!row.querySelector('.earned');
      row.style.display=selected || (which==='own' ? earned : !earned) ? '' : 'none';
    });
  }
  function getOwn(){filterNative('own')} function getUnOwn(){filterNative('unown')}
  </script>`;
  const html = `<!doctype html><html><head>${base}</head><body><main class="main box"><style>
  .dropmenu,.dropmenu ul{padding:0;margin:0;list-style:none}.dropmenu{height:36px;line-height:36px}.dropmenu li{float:left;position:relative}
  .dropdown>a{padding:0 20px 0 10px}.dropdown>ul{display:none;position:absolute}.dropdown>ul li{float:none}
  .o_btn{display:inline-block;margin:8px -12px 5px 16px;padding:2px 4px;font-size:12px;text-align:center;width:52px;line-height:17px;border:1px solid darkslategray;border-radius:15px;box-sizing:content-box}
  </style><ul class="dropmenu"><li><em>排序</em></li><li class="dropdown"><a class="arr-down" href="#">XMB</a><ul><li><a href="?psnid=fixture_user&ob=trophyid">XMB</a></li><li><a href="?psnid=fixture_user&ob=type">类型</a></li><li><a href="?psnid=fixture_user&ob=rarity">完美率</a></li></ul></li><li><button class="o_btn own" onclick="getOwn()">已获得</button><button class="o_btn unown" onclick="getUnOwn()">未获得</button></li></ul><table class="list"><tbody>${row(1,true)}${row(2,false)}</tbody></table></main>${nativeScript}</body></html>`;
  await page.route('**/*', route => route.fulfill({ contentType:'text/html; charset=utf-8', body:route.request().url().includes('/trophy/') ? '<ul class="list"><li><div class="content">测试 Tips <a href="/trophy/12345001">同游戏奖杯</a><a href="/trophy/54321001">跨游戏奖杯</a></div></li></ul>' : html }));
  await page.goto('https://psnine.com/psngame/12345?psnid=fixture_user');
  await page.evaluate(() => {
    (window as any).nativeOwn = document.querySelector('.own');
    (window as any).nativeFixtureMutations = 0;
    new MutationObserver(ms => { (window as any).nativeFixtureMutations += ms.length; }).observe(document.body, { subtree:true, childList:true, attributes:true });
  });
  await page.addScriptTag({ content:bundle });
  await expect(page.locator('#psnine-trophy-tips-toolbar')).toBeVisible();
  const tipsTrigger=page.locator('#psnine-trophy-tips-trigger');
  const tipsMenu=page.locator('#psnine-trophy-tips-menu');
  await expect(tipsMenu).toBeHidden();
  const geometry=await page.locator('[data-psnine-trophy-sort-trigger], .o_btn.own, .o_btn.unown, #psnine-trophy-tips-trigger').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {center:r.y+r.height/2,left:r.left,right:r.right,height:r.height,color:s.color,border:s.borderTopColor,radius:s.borderRadius,fontSize:s.fontSize};}));
  expect(geometry).toHaveLength(4);
  for(const g of geometry){expect(Math.abs(g.center-geometry[0].center)).toBeLessThanOrEqual(3);expect(g.right).toBeLessThanOrEqual(390);expect(g.left).toBeGreaterThanOrEqual(0);}
  for (let i=2; i<geometry.length; i++) expect(geometry[i].left-geometry[i-1].right).toBeGreaterThanOrEqual(4);
  const native=geometry[1],tips=geometry[3];
  for(const prop of ['border','radius','fontSize'] as const)expect(tips[prop]).toBe(native[prop]);
  expect(Math.abs(tips.height-native.height)).toBeLessThanOrEqual(1);
  await tipsTrigger.click();
  await expect(tipsMenu).toBeVisible();
  expect(await tipsMenu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})).toBe(true);
  await page.keyboard.press('Escape');
  await expect(tipsTrigger).toBeFocused();
  await expect(tipsMenu).toBeHidden();
  await tipsTrigger.click();
  await page.locator('#cup-1').click();
  await expect(tipsMenu).toBeHidden();
  // Switching to a longer local sort label must not push Tips onto another row.
  await page.locator('[data-psnine-trophy-sort-trigger]').click();
  await page.locator('[data-psnine-sort="time-desc"]').click();
  const aligned=await page.locator('[data-psnine-trophy-sort-trigger], .o_btn.own, .o_btn.unown, #psnine-trophy-tips-trigger').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {center:r.y+r.height/2,right:r.right};}));
  for(const g of aligned){expect(Math.abs(g.center-aligned[0].center)).toBeLessThanOrEqual(3);expect(g.right).toBeLessThanOrEqual(390);}


  await expect(page.locator('#psnine-trophy-stats-panel, #psnine-trophy-header-title')).toHaveCount(0);
  await expect(page.locator('#psnine-filter-status-btn')).toHaveCount(0);
  await expect(page.locator('#psnine-trophy-charts-container')).toHaveCount(0);
  await expect(page.locator('#psnine-trophy-icon-grid-wrapper')).toHaveCount(0);
  await page.locator('#cup-2 em.alert-success').click();
  const tip = page.locator('tr.psnine-inline-tip-row[data-for-trophy="12345002"]');
  await expect(tip).toContainText('测试 Tips');
  await page.locator('.own').click();
  await expect(page.locator('#cup-1')).toBeVisible();
  await expect(page.locator('#cup-2')).toBeHidden();
  await expect(tip).toBeHidden();
  await page.locator('.unown').click();
  await expect(page.locator('#cup-1')).toBeHidden();
  await expect(page.locator('#cup-2')).toBeVisible();
  await expect(tip).toBeVisible();
  const before=page.url();
  await tip.getByText('同游戏奖杯',{exact:true}).click();
  await expect(page.locator('#cup-1')).toBeVisible();
  await expect(page.locator('.unown')).not.toHaveClass(/select/);
  await expect(tip).toBeVisible();
  expect(await page.evaluate(() => (window as any).nativeCalls)).toBe(3);
  // A same-game Tip link focuses the real target without navigating; other games keep their link.
  expect(page.url()).toBe(before);
  await expect(page.locator('#cup-1')).toHaveClass(/psnine-tip-jump-target/);
  await expect(tip.getByText('跨游戏奖杯',{exact:true})).toHaveAttribute('href','https://psnine.com/trophy/54321001');

  expect(await page.evaluate(() => (window as any).nativeOwn === document.querySelector('.own'))).toBe(true);
  await expect(page.locator('.own')).toHaveAttribute('onclick','getOwn()');
  await expect(page.locator('#cup-1')).not.toHaveClass(/psnine-tip-jump-target/);
  await page.waitForTimeout(300);
  const settled = await page.evaluate(() => (window as any).nativeFixtureMutations);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).nativeFixtureMutations)).toBe(settled);
  await page.screenshot({ path:testInfo.outputPath('native-trophy-compact.png') });
});

}
