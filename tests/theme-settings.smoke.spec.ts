import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../dist/psnine_next.user.js', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { --c-card:#fcfdff; --c-bg:#f4f6fa; --c-line:#e5e8ef; --c-text:#1f2937; --c-text-2:#6b7280; --c-brand:#1e5ae6; --c-brand-soft:#e8effe; --r-md:8px; --r-sm:4px; }
html[data-theme="dark"] { --c-card:#1a222d; --c-bg:#10151d; --c-line:#303b49; --c-text:#e6ebf2; --c-text-2:#a8b3c2; --c-brand:#79aaff; --c-brand-soft:#202c3a; }
body { margin:0; background:#a9bbca; color:#333; font:14px sans-serif; }
.box { padding:12px; background:var(--c-card); }
.mobile-nav-panel { padding:12px; background:var(--c-card); }
.mobile-nav-panel nav { display:grid; gap:8px; }
.mobile-nav-panel a { display:flex; align-items:center; justify-content:center; min-height:46px; border:1px solid var(--c-line); border-radius:var(--r-md); color:var(--c-text); font-size:14px; font-weight:600; text-decoration:none; }
.user-menu-list a { display:flex; align-items:center; min-height:38px; padding:8px 12px; color:var(--c-text-2); border-radius:var(--r-sm); }
#native-icon-probe { background:var(--c-card); border:1px solid var(--c-line); border-radius:var(--r-md); color:var(--c-text-2); }
.float-layer { position:fixed; right:16px; bottom:20px; z-index:40; display:flex; flex-direction:column; gap:8px; }
.float-layer .float-btn { width:46px; height:46px; border:1px solid var(--c-line); border-radius:var(--r-md); background:var(--c-card); color:var(--c-text-2); }
.list { width:100%; } td { padding:8px; }
.inav { padding:15px; background:white; } .inav a { color:#3890ff; }
.text-strong { color:#333; } a { color:#1686db; }
.text-platinum { color:#7a96d1; } .text-gold { color:#cd9a46; }
.t1 { background:#d5d9e4; } .t4 { background:#e4cdc1; }
.alert-success { color:#659f13; background:#f5faec; }
</style></head><body class="bg">
<div class="mobile-nav-panel" hidden><nav><a href="/psngame">游戏</a><a href="/gene">机因</a><a href="/qa">问答</a></nav></div>
<div class="user-menu-list" hidden><a href="/set">设置</a></div>
<div class="nav-user" hidden><div class="dropdown"><ul><li><a href="/set">旧版设置</a></li></ul></div></div>
<button id="native-icon-probe" hidden>原生图标按钮</button>
<div class="box"><h1>奖杯列表</h1>
<ul class="inav"><li class="current"><a href="/psngame/12345">奖杯</a></li><li><a href="/psngame/12345/comment">评论</a></li></ul>
<p>完成度 <span class="text-strong">1/2</span></p>
<table class="list"><tbody>
<tr class="trophy" id="1"><td class="t1"><a href="/trophy/12345001">白金</a></td><td>完成所有挑战</td><td class="twoge">3.6%</td></tr>
<tr class="trophy" id="2"><td class="t4"><a href="/trophy/12345002">铜杯</a></td><td>开始游戏</td><td class="twoge">50%</td></tr>
</tbody></table><p class="content"><span class="mark">剧透内容</span></p>
<div data-psnine-next="semantic-fixture">
<a id="semantic-platinum" class="text-platinum" href="/trophy/12345001">白金标题</a>
<a id="semantic-gold" class="text-gold" href="/trophy/12345002">金杯标题</a>
<a id="semantic-deal" href="/deals/12345" style="color:#f39800">折扣标题</a>
<em id="semantic-tips" class="alert-success"><b>1</b> Tips</em>
<button id="semantic-icon" class="psnine-trophy-icon-chip" data-psnine-next="true" style="width:36px;height:36px;padding:0;border:1px solid #28a745">已获</button>
<button id="semantic-score" class="psnine-score-filter-chip" data-psnine-next="true" style="border:1px solid #ff9800;background:#ff9800;color:#fff">10分</button>
<button id="psnine-toggle-best-deal-btn" data-psnine-next="true" style="background:#da314b;color:#fff">仅史低</button>
<button id="psnine-toggle-cny-btn" data-psnine-next="true" style="border:1px solid #28a745;background:transparent;color:#28a745">人民币</button>
<button id="semantic-bell" class="psnine-battle-bell-btn" data-psnine-next="true" style="border:1px solid #f59f00;background:rgba(245,159,0,.15);color:#d97706">已监控</button>
</div></div></body></html>`;

async function colors(locator: import('@playwright/test').Locator) {
  return locator.evaluate(el => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, color: style.color };
  });
}

function luminance(color: string) {
  const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(foreground: string, background: string) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType:'text/html; charset=utf-8', body:html }));
  await page.addInitScript({ content: bundle });
});

test('theme selection saves manual/system modes, restores after reload, and only shows schedule when needed', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('https://psnine.com/psngame/12345');
  const open = () => page.locator('#psnine-settings-gear').click();
  const theme = page.locator('#psnine-setting-theme-mode');
  const save = () => Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.getByRole('button', { name:'保存配置', exact:true }).click(),
  ]);
  await open();
  await expect(theme).toHaveValue('SYSTEM');
  await expect(page.locator('[id^="psnine-setting-nightStart"]')).toBeHidden();
  await theme.selectOption('TIME');
  await expect(page.locator('[id^="psnine-setting-nightStart"]')).toBeVisible();
  await theme.selectOption('DARK');
  await expect(page.locator('[id^="psnine-setting-nightStart"]')).toBeHidden();
  await save();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await open();
  await expect(theme).toHaveValue('DARK');
  await theme.selectOption('LIGHT');
  await save();
  await expect(page.locator('#nightModeStyle')).toHaveCount(0);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('#nightModeStyle')).toHaveCount(0);
  // A later native theme script must not override the saved explicit LIGHT preference.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
  await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
  await open();
  await expect(theme).toHaveValue('LIGHT');
  await theme.selectOption('SYSTEM');
  await save();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('#nightModeStyle')).toHaveCount(0);
});

test('settings switches stay compact, dark controls are readable, and modal fits short phone viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:640 });
  await page.emulateMedia({ colorScheme:'dark' });
  await page.goto('https://psnine.com/psngame/12345');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const bodyColors = await colors(page.locator('body'));
  expect(luminance(bodyColors.background)).toBeLessThan(0.1);
  const navColors = await colors(page.locator('.inav'));
  expect(luminance(navColors.background)).toBeLessThan(0.15);
  const panelColors = await colors(page.locator('.box').first());
  const countsColors = await colors(page.locator('#psnine-batch-load-all-tips-btn'));
  expect(contrast(countsColors.color,panelColors.background)).toBeGreaterThanOrEqual(4.5);
  // Safari touch taps do not focus buttons; start with keyboard focus to test restoration.
  await page.locator('#psnine-settings-gear').focus();
  await page.locator('#psnine-settings-gear').press('Enter');
  const dialog=page.locator('.psnine-settings-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#psnine-setting-foldTrophySummary, #psnine-setting-foldTrophyChart')).toHaveCount(0);
  const geometry=await dialog.evaluate(el=> {
    const d=el.getBoundingClientRect();
    const footer=el.querySelector('.psnine-settings-footer')!.getBoundingClientRect();
    const body=el.querySelector('.psnine-settings-body')!;
    return { left:d.left,right:d.right,top:d.top,bottom:d.bottom,width:innerWidth,height:innerHeight,
      footerBottom:footer.bottom,bodyHeight:body.clientHeight, scrollable:body.scrollHeight>body.clientHeight };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.height);
  expect(geometry.bodyHeight).toBeGreaterThan(180);
  const track=page.locator('.psnine-slider:visible').first();
  const trackBox=await track.boundingBox();
  expect(trackBox!.width).toBeGreaterThanOrEqual(40);
  expect(trackBox!.width).toBeLessThanOrEqual(54);
  expect(trackBox!.height).toBeLessThanOrEqual(32);
  const checkbox=page.locator('.psnine-switch:visible input').first();
  const initiallyChecked=await checkbox.isChecked();
  await track.click();
  expect(await checkbox.isChecked()).toBe(!initiallyChecked);
  await track.click();
  expect(await checkbox.isChecked()).toBe(initiallyChecked);
  const theme=page.locator('#psnine-setting-theme-mode');
  expect(await theme.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  const dialogColors=await colors(dialog);
  expect(luminance(dialogColors.background)).toBeLessThan(0.15);
  expect(contrast(dialogColors.color,dialogColors.background)).toBeGreaterThanOrEqual(4.5);
  const save=page.getByRole('button',{name:'保存配置',exact:true});
  const cancel=page.getByRole('button',{name:'取消',exact:true});
  await page.locator('.psnine-settings-close').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.psnine-settings-close')).toBeFocused();
  const saveColors=await colors(save), cancelColors=await colors(cancel);
  expect(contrast(saveColors.color,saveColors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(cancelColors.color,cancelColors.background)).toBeGreaterThanOrEqual(4.5);
  expect(luminance(cancelColors.background)).toBeLessThan(0.2);
  await page.screenshot({path:testInfo.outputPath('settings-dark-phone.png')});
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('#nightModeStyle')).toHaveCount(0);
  const lightColors=await colors(dialog);
  expect(luminance(lightColors.background)).toBeGreaterThan(0.8);
  expect(contrast(lightColors.color,lightColors.background)).toBeGreaterThanOrEqual(4.5);
  expect((await track.boundingBox())!.width).toBe(trackBox!.width);
  await page.screenshot({path:testInfo.outputPath('settings-light-phone.png')});
  // Expanded groups must remain reachable in the scroll area without widening the dialog.
  for (const summary of (await dialog.locator('.psnine-settings-section > summary').all()).slice(1)) await summary.click();
  const expanded = await dialog.evaluate(el => {
    const body = el.querySelector('.psnine-settings-body')!;
    return {
      scrolls: body.scrollHeight > body.clientHeight,
      overflow: [...el.querySelectorAll('input:not([type="checkbox"]),select,textarea,.psnine-switch')]
        .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > innerWidth); }).length,
      footerBottom: el.querySelector('.psnine-settings-footer')!.getBoundingClientRect().bottom,
    };
  });
  expect(expanded.scrolls).toBe(true);
  expect(expanded.overflow).toBe(0);
  expect(expanded.footerBottom).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#psnine-settings-gear')).toBeFocused();
});

test('dark theme preserves trophy, discount and selected-state colors while keeping Tips readable', async ({ page }) => {
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('https://psnine.com/psngame/12345');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const platinumTitle = await colors(page.locator('#semantic-platinum'));
  const goldTitle = await colors(page.locator('#semantic-gold'));
  expect(platinumTitle.color).not.toBe(goldTitle.color);
  const panelBackground = (await colors(page.locator('.box'))).background;
  expect(contrast(platinumTitle.color,panelBackground)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(goldTitle.color,panelBackground)).toBeGreaterThanOrEqual(4.5);
  expect((await colors(page.locator('#semantic-deal'))).color).toBe('rgb(243, 152, 0)');
  expect((await colors(page.locator('#semantic-score'))).background).toBe('rgb(255, 152, 0)');
  expect((await colors(page.locator('#psnine-toggle-best-deal-btn'))).background).toBe('rgb(218, 49, 75)');
  expect(await page.locator('#psnine-toggle-cny-btn').evaluate(el=>getComputedStyle(el).borderTopColor)).toBe('rgb(40, 167, 69)');
  expect(await page.locator('#semantic-icon').evaluate(el=>getComputedStyle(el).borderTopColor)).toBe('rgb(40, 167, 69)');
  expect(await page.locator('#semantic-icon').evaluate(el=>getComputedStyle(el).paddingLeft)).toBe('0px');
  expect(await page.locator('#semantic-bell').evaluate(el=>getComputedStyle(el).borderTopColor)).toBe('rgb(245, 159, 0)');
  const platinum = await colors(page.locator('td.t1')), bronze = await colors(page.locator('td.t4'));
  expect(platinum.background).not.toBe(bronze.background);
  expect(luminance(platinum.background)).toBeLessThan(.2);
  expect(luminance(bronze.background)).toBeLessThan(.2);
  const tips = await colors(page.locator('#semantic-tips'));
  const count = await colors(page.locator('#semantic-tips b'));
  expect(luminance(tips.background)).toBeLessThan(.2);
  expect(contrast(tips.color,tips.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(count.color,tips.background)).toBeGreaterThanOrEqual(4.5);
});

for (const scheme of ['light','dark'] as const) {
  test(`plugin navigation and trophy controls inherit native ${scheme} design`, async ({ page }, testInfo) => {
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({colorScheme:scheme});
    const nativeLayer='<div class="float-layer"><button type="button" class="float-btn" id="native-float-button">原站</button></div>';
    await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html.replace('<div class="box">',nativeLayer+'<div class="box">')}));
    await page.goto('https://psnine.com/psngame/12345');
    const menu=page.locator('.mobile-nav-panel');
    await menu.evaluate(el=>{(el as HTMLElement).hidden=false;});
    const entry=menu.locator('nav > a.psnine-nav-settings-btn');
    await expect(entry).toHaveCount(1);
    await expect(page.locator('.user-menu-list > a.psnine-nav-settings-btn')).toHaveCount(1);
    await expect(page.locator('.nav-user .dropdown ul > li > a.psnine-nav-settings-btn')).toHaveCount(1);
    const styleOf=(locator:import('@playwright/test').Locator)=>locator.evaluate(el=>{
      const s=getComputedStyle(el);
      return {background:s.backgroundColor,color:s.color,border:s.borderTopColor,borderWidth:s.borderTopWidth,radius:s.borderRadius,fontSize:s.fontSize,fontWeight:s.fontWeight,minHeight:s.minHeight,justify:s.justifyContent,boxSizing:s.boxSizing};
    });
    expect(await styleOf(entry)).toEqual(await styleOf(menu.locator('nav > a').first()));
    expect((await entry.boundingBox())!.height).toBe((await menu.locator('nav > a').first().boundingBox())!.height);
    const native=await styleOf(page.locator('#native-icon-probe'));
    for(const id of ['#psnine-settings-gear','#psnine-scrollbottom']) {
      const button=page.locator(id), style=await styleOf(button);
      await expect(page.locator('.float-layer > '+id)).toHaveCount(1);
      expect(style.background).toBe(native.background);
      expect(style.border).toBe(native.border);
      expect(style.radius).toBe(native.radius);
      const box=await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const floatingBoxes=await page.locator('.float-layer > button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}).sort((a,b)=>a.top-b.top));
    expect(floatingBoxes).toHaveLength(3);
    expect(floatingBoxes[0].top).toBeGreaterThanOrEqual(0);
    for(let i=1;i<floatingBoxes.length;i++) expect(floatingBoxes[i].top).toBeGreaterThanOrEqual(floatingBoxes[i-1].bottom+4);
    const action=page.locator('#psnine-trophy-tips-toolbar .psnine-trophy-pill-btn').first();
    expect((await colors(action)).background).toBe(native.background);
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(36);
    expect(parseFloat((await styleOf(action)).radius)).toBeGreaterThanOrEqual(12);
    await page.screenshot({path:testInfo.outputPath(`native-style-${scheme}.png`)});
    // Native variables may be changed by the site; plugin surfaces must follow without reinjection.
    await page.evaluate(()=>document.documentElement.style.setProperty('--c-card','#26364a'));
    await expect(action).toHaveCSS('background-color',(await colors(page.locator('#native-icon-probe'))).background);
    await page.evaluate(()=>document.documentElement.style.removeProperty('--c-card'));
    const url=page.url();
    await entry.focus();
    await entry.press('Space');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(page.url()).toBe(url);
    await page.keyboard.press('Escape');
    await expect(entry).toBeFocused();
    // Repeated content hooks must not insert another entry or duplicate IDs.
    await page.evaluate(()=>document.body.appendChild(document.createElement('aside')));
    await expect(entry).toHaveCount(1);
    expect(await page.locator('[id]').evaluateAll(els=>new Set(els.map(el=>el.id)).size===els.length)).toBe(true);
  });
}
