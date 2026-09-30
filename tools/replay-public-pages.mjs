import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { JSDOM } from 'jsdom';
// Pass saved public HTML/CSS directory, then optional comma-separated page names.
// No live website requests are permitted.
const base = path.resolve(process.argv[2] || '.audit-cache/live');
const selectedPages = new Set((process.argv[3] || '').split(',').filter(Boolean));
const output = path.resolve('.audit-cache/final-page-replay');
await fs.mkdir(output, {recursive:true});
const script = await fs.readFile('dist/psnine_next.user.js','utf8');
const bundleSha256 = createHash('sha256').update(script).digest('hex');
const cases = [
 ['home','/'], ['games','/psngame'], ['game','/psngame/46507'],
 ['game-personal','/psngame/46507?psnid=toonn95'], ['trophy','/trophy/12518001'],
 ['reviews','/psngame/46507/comment'], ['deals','/dd'],
 ['deal-history','/dd/HP9000-CUSA10218_00-HRZCE00000000000'],
 ['battle','/battle'], ['profile','/psnid/toonn95'], ['topic','/topic/39074'], ['qa','/qa'],
 ['game-meta-46507','/game/46507'], ['profile-games','/psnid/toonn95/psngame'],
 ['trophy-game','/psngame/12518'], ['trophy-game-meta','/game/10999']
];
const fixtures = new Map();
for (const [name,url] of cases) {
 const raw = await fs.readFile(path.join(base,`${name}.html`),'utf8');
 const dom = new JSDOM(raw, {url:'https://psnine.com'+url});
 const doc=dom.window.document;
 doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv]').forEach(e=>e.remove());
 doc.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes]) if(/^on/i.test(a.name))e.removeAttribute(a.name);});
 const meta=doc.createElement('meta');meta.setAttribute('charset','utf-8');doc.head.prepend(meta);
 fixtures.set(name,dom.serialize());
 dom.window.close();
}
const summary=[];
for (const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await launcher.launch({headless:true});
 for (const [name,url] of cases.filter(([name])=>!['game-meta-46507','trophy-game','trophy-game-meta'].includes(name) && (!selectedPages.size || selectedPages.has(name)))) {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  // Keep time-dependent public fixtures deterministic while letting timers advance normally.
  await page.clock.setFixedTime(new Date('2026-09-30T06:00:00Z'));
  const errors=[];const requests=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error' && m.text().includes('psnine'))errors.push(m.text());});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());requests.push({method:route.request().method(),url:u.href});
   if(route.request().method()!=='GET'){await route.fulfill({status:405,body:'Blocked in read-only fixture test'});return;}
   if(u.hostname==='api.frankfurter.dev'){await route.fulfill({contentType:'application/json',body:JSON.stringify({base:'CNY',date:'2026-09-29',rates:{HKD:1.17,USD:.15,GBP:.11,JPY:23.4}})});return;}
   if(u.pathname.endsWith('.css')){
    try{await route.fulfill({contentType:'text/css',body:await fs.readFile(path.join(base,path.basename(u.pathname)),'utf8')});}catch{await route.fulfill({contentType:'text/css',body:''});}return;
   }
   if(route.request().resourceType()==='image'){await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#789"/></svg>'});return;}
   let target=cases.find(([,p])=>p===u.pathname+u.search)?.[0];
   if(!target)target=cases.find(([,p])=>p===u.pathname)?.[0];
   if(target){await route.fulfill({contentType:'text/html; charset=utf-8',body:fixtures.get(target)});return;}
   await route.fulfill({status:404,contentType:'text/html; charset=utf-8',body:'<!doctype html><title>Fixture not provided</title>'});
  });
  await page.goto('https://psnine.com'+url,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    window.__mutations=0;
    new MutationObserver(ms=>window.__mutations+=ms.length).observe(document.body,{subtree:true,childList:true});
    window.__nativeSortLinks=[...document.querySelectorAll('ul.dropmenu > li.dropdown > ul > li > a')]
      .filter(a=>['trophyid','type','rarity'].includes(new URL(a.href,location.href).searchParams.get('ob')))
      .map(node=>({node,href:node.getAttribute('href')}));
  });
  await page.addScriptTag({content:script});
  await page.waitForTimeout(1800);
  const checks={};
  if (['home','game','game-personal','reviews','deals'].includes(name)) {
  await page.locator('#psnine-settings-gear').click();
  checks.settings=await page.locator('.psnine-settings-dialog').evaluate(n=>({fields:n.querySelectorAll('input,select,textarea').length,width:n.getBoundingClientRect().width,withinViewport:n.getBoundingClientRect().left>=0&&n.getBoundingClientRect().right<=innerWidth}));
  await page.keyboard.press('Escape');
  checks.settingsCloses=await page.locator('.psnine-settings-dialog').count()===0;
  if(name==='game' || name==='game-personal'){
    const order=()=>page.locator('tr.trophy').evaluateAll(rs=>rs.map(r=>r.id).join(','));
    const original=await order();
    const trigger=page.locator('[data-psnine-trophy-sort-trigger]');
    const menu=page.locator('[data-psnine-trophy-sort-menu]');
    checks.noDuplicateSortToolbar=await page.locator('#psnine-sort-xmb-btn, #psnine-sort-time-btn, #psnine-sort-type-btn, #psnine-sort-rarity-btn').count()===0;
    checks.timeOptions=await page.locator('[data-psnine-sort="time-desc"], [data-psnine-sort="time-asc"]').count()===(name==='game-personal'?2:0);
    await trigger.tap();
    checks.touchMenuOpens=await menu.isVisible() && await trigger.getAttribute('aria-expanded')==='true';
    checks.menuWithinViewport=await menu.evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;});
    await page.screenshot({path:path.join(output,`${engine}-${name}-sort-menu.png`),fullPage:false});
    await page.locator('[data-psnine-sort="type-asc"]').tap();await page.waitForTimeout(150);
    checks.sortChanged=original!==await order();
    checks.menuClosesAfterChoice=!(await menu.isVisible());
    await trigger.tap();
    await page.locator('[data-psnine-sort="initial"]').tap();await page.waitForTimeout(150);
    checks.originalRestored=original===await order();
    checks.nativeLinksPreserved=await page.evaluate(()=>window.__nativeSortLinks.length===3 && window.__nativeSortLinks.every(({node,href})=>node.isConnected && node.getAttribute('href')===href));
    if(name==='game-personal'){
      await page.locator('#psnine-filter-status-btn').click();await page.waitForTimeout(100);
      checks.unearnedFilter=await page.locator('tr.trophy').evaluateAll(rs=>({hidden:rs.filter(r=>r.hidden).length,visible:rs.filter(r=>!r.hidden).length}));
      await page.locator('#psnine-filter-status-btn').click();await page.locator('#psnine-filter-status-btn').click();
      checks.filterRestored=await page.locator('tr.trophy').evaluateAll(rs=>rs.every(r=>!r.hidden));
    }
  }
  if(name==='deals'){
    await page.locator('#psnine-toggle-best-deal-btn').click();
    checks.bestFilter=await page.locator('li.dd_box').evaluateAll(rs=>({hidden:rs.filter(r=>r.hidden).length,visible:rs.filter(r=>!r.hidden).length}));
    await page.locator('#psnine-toggle-best-deal-btn').click();
    checks.bestRestored=await page.locator('li.dd_box').evaluateAll(rs=>rs.every(r=>!r.hidden));
  }
  }
  const first=await page.evaluate(()=>window.__mutations);
  await page.waitForTimeout(400);
  const info=await page.evaluate(()=>({
   characterSet:document.characterSet, pageTitle:document.title, mutationDelta:window.__mutations,
   injected:[...document.querySelectorAll('[id^="psnine"], [id^="p9n"]')].map(n=>n.id),
   charts:document.querySelectorAll('svg[class*="psnine"]').length,
   controls:[...document.querySelectorAll('button')].map(n=>n.textContent?.trim()).filter(t=>t&&/Tips|设置|Next|评分|史低|人民币|监控/.test(t)),
   overflow:[...document.querySelectorAll('[id^="psnine"], [id^="p9n"]')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2);}).map(n=>n.id),
  }));
  info.mutationDelta-=first;
  await page.screenshot({path:path.join(output,`${engine}-${name}.png`),fullPage:false});
  summary.push({bundleSha256,engine,name,url,errors,checks,requestCount:requests.length,...info});
  await ctx.close();
 }
 await browser.close();
}
await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
const failures=summary.filter(r=>r.errors.length || r.overflow.length || r.mutationDelta !== 0 || Object.values(r.checks).some(v=>v===false) || (r.checks.settings && !r.checks.settings.withinViewport));
console.log(JSON.stringify({bundleSha256,cases:summary.length,interactionCases:summary.filter(r=>Object.keys(r.checks).length).length,failures:failures.map(r=>({engine:r.engine,name:r.name,errors:r.errors,overflow:r.overflow,mutationDelta:r.mutationDelta,checks:r.checks})),output},null,2));
if(failures.length)process.exitCode=1;
