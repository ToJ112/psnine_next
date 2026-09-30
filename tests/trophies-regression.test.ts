import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountTrophies } from '../src/features/trophies';
import { createContext } from '../src/core/context';
import { createStore } from '../src/core/store';
import { createHttpClient } from '../src/core/http';
import { defaultSettings } from '../src/core/types';
import { isHiddenByReason } from '../src/core/dom';

function clearCookies() {
  document.cookie.split(';').forEach(c => {
    document.cookie = c.trim().split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });
}

function makeWindowWithUrl(urlStr: string): Window {
  const urlObj = new URL(urlStr);
  return new Proxy(window, {
    get(target, prop, receiver) {
      if (prop === 'location') {
        return urlObj;
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
}

describe('Trophies Last-Mile Regression Suite', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearCookies();
  });

  describe('1. Real MutationObserver onContent Integration & Native Filter Sync (Defect 5 & 6)', () => {
    it('accurately handles append/prepend, preserves tips toolbar identity, assigns maxseq+1, and syncs native filter with inline tips and dynamic rows', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/psngame/46507?psnid=test_user');
      document.cookie = '__Psnine_psnid=test_user; path=/';

      let nativeCalls = 0;
      const runNativeFilter = (which: 'own' | 'unown') => {
        nativeCalls++;
        const btn = document.querySelector(`.${which}`) as HTMLElement;
        const other = document.querySelector(`.${which === 'own' ? 'unown' : 'own'}`) as HTMLElement;
        const wasSelected = btn.classList.contains('select');
        if (wasSelected) {
          btn.classList.remove('select');
          document.querySelectorAll<HTMLElement>('tr.trophy').forEach(r => {
            r.style.display = '';
          });
        } else {
          btn.classList.add('select');
          other?.classList.remove('select');
          document.querySelectorAll<HTMLElement>('tr.trophy').forEach(r => {
            const hasEarned = r.querySelector('.earned') !== null;
            const show = which === 'own' ? hasEarned : !hasEarned;
            r.style.display = show ? '' : 'none';
          });
        }
      };


      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box pd10">
            <ul class="dropmenu">
              <li><em>排序</em></li>
              <li class="dropdown">
                <a href="javascript:void(0)" class="arr-down">XMB</a>
                <ul>
                  <li><a href="?psnid=test_user&ob=trophyid&psngamelang=zh-Hans" class="current">XMB</a></li>
                  <li><a href="?psnid=test_user&ob=type&psngamelang=zh-Hans">类型</a></li>
                  <li><a href="?psnid=test_user&ob=rarity&psngamelang=zh-Hans">完美率</a></li>
                </ul>
              </li>
              <li>
                <button type="button" class="o_btn own" onclick="getOwn()">已获得</button>
                <button type="button" class="o_btn unown" onclick="getUnOwn()">未获得</button>
              </li>
            </ul>
            <table class="list">
              <tbody>
                <tr id="trophy-1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001"><img class="imgbg earned" src="t1.png" /></a></td>
                  <td>
                    <p><a href="/trophy/46507001">白金弄臣</a> <em class="alert-success"><b>2</b> Tips</em></p>
                    <div class="text-strong">解锁所有奖杯</div>
                  </td>
                  <td class="twoge">3.60% 极为珍贵</td>
                  <td><em class="alert-success pd5 r" tips="2024">05-18<br>10:00</em></td>
                </tr>
                <tr id="trophy-2" class="trophy">
                  <td class="t4"><a href="/trophy/46507002"><img class="imgbg" src="t2.png" /></a></td>
                  <td>
                    <p><a href="/trophy/46507002">铜杯手牌</a> <em class="alert-success"><b>1</b> Tips</em></p>
                    <div class="text-strong">打出一次同花</div>
                  </td>
                  <td class="twoge">50.0% 普通</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings },
        store,
        http
      });

      const cleanup = await mountTrophies(ctx);

      const toolbarBefore = document.getElementById('psnine-trophy-tips-toolbar')!;
      expect(toolbarBefore).not.toBeNull();
      expect(document.getElementById('psnine-trophy-stats-panel')).toBeNull();
      expect(document.getElementById('psnine-filter-status-btn')).toBeNull();

      // Attach an inline tip row to trophy-1 (earned) and trophy-2 (unearned)
      const tbody = document.querySelector('table.list tbody')!;
      const tipRow1 = document.createElement('tr');
      tipRow1.className = 'psnine-inline-tip-row';
      tipRow1.setAttribute('data-psnine-next', 'true');
      tipRow1.setAttribute('data-for-trophy', '46507001');
      document.getElementById('trophy-1')!.after(tipRow1);

      const tipRow2 = document.createElement('tr');
      tipRow2.className = 'psnine-inline-tip-row';
      tipRow2.setAttribute('data-psnine-next', 'true');
      tipRow2.setAttribute('data-for-trophy', '46507002');
      document.getElementById('trophy-2')!.after(tipRow2);

      const ownBtn = document.querySelector('.own') as HTMLElement;
      const unownBtn = document.querySelector('.unown') as HTMLElement;
      ownBtn.onclick = () => runNativeFilter('own');
      unownBtn.onclick = () => runNativeFilter('unown');

      // 1. Click native .own -> earned visible, unearned hidden + tipRow2 hidden
      ownBtn.click();
      expect(nativeCalls).toBe(1);
      expect(document.getElementById('trophy-1')!.style.display).toBe('');
      expect(document.getElementById('trophy-2')!.style.display).toBe('none');
      expect(isHiddenByReason(tipRow1, 'trophy-status-filter')).toBe(false);
      expect(isHiddenByReason(tipRow2, 'trophy-status-filter')).toBe(true);
      // Native tr must NOT be locked by setHidden data-psnine-native-hidden
      expect(document.getElementById('trophy-2')!.hasAttribute('data-psnine-native-hidden')).toBe(false);

      // 2. Click native .unown -> unearned visible, earned hidden + tipRow1 hidden, tipRow2 visible
      unownBtn.click();
      expect(nativeCalls).toBe(2);
      expect(document.getElementById('trophy-1')!.style.display).toBe('none');
      expect(document.getElementById('trophy-2')!.style.display).toBe('');
      expect(isHiddenByReason(tipRow1, 'trophy-status-filter')).toBe(true);
      expect(isHiddenByReason(tipRow2, 'trophy-status-filter')).toBe(false);

      // Prepend a new earned row into table body while .unown is active
      const newRow = document.createElement('tr');
      newRow.id = 'trophy-3';
      newRow.className = 'trophy';
      newRow.innerHTML = `
        <td class="t2"><a href="/trophy/46507003"><img class="imgbg earned" src="t3.png" /></a></td>
        <td>
          <p><a href="/trophy/46507003">金杯牌型</a> <em class="alert-success"><b>3</b> Tips</em></p>
          <div class="text-strong">达成同花顺</div>
        </td>
        <td class="twoge">10.0% 珍贵</td>
        <td><em class="alert-success pd5 r" tips="2024">05-19<br>12:00</em></td>
      `;
      tbody.insertBefore(newRow, tbody.firstChild);

      // Wait for real MutationObserver & flush
      await new Promise(r => setTimeout(r, 120));

      // Toolbar identity preserved
      const toolbarAfter = document.getElementById('psnine-trophy-tips-toolbar');
      expect(toolbarAfter).toBe(toolbarBefore);

      // Newly prepended earned row is synced to hidden while .unown.select is active
      expect(newRow.style.display).toBe('none');
      expect(newRow.getAttribute('data-psnine-native-sync-hidden')).toBe('true');

      // Pre-pended row got maxSeq + 1 (2), preserving original sequence logic
      expect(newRow.getAttribute('data-psnine-orig-seq')).toBe('2');

      // 3. Click native .unown again -> restores all rows and inline tips
      unownBtn.click();
      expect(nativeCalls).toBe(3);
      expect(document.getElementById('trophy-1')!.style.display).toBe('');
      expect(document.getElementById('trophy-2')!.style.display).toBe('');
      expect(newRow.style.display).toBe('');
      expect(newRow.hasAttribute('data-psnine-native-sync-hidden')).toBe(false);
      expect(isHiddenByReason(tipRow1, 'trophy-status-filter')).toBe(false);
      expect(isHiddenByReason(tipRow2, 'trophy-status-filter')).toBe(false);

      // Click restore initial order via native dropdown: new row (origSeq=2) must sort to the end of original items!
      const initialItem = document.querySelector('[data-psnine-sort="initial"]') as HTMLElement;
      expect(initialItem).not.toBeNull();
      initialItem.click();
      const rowsAfterXmb = Array.from(tbody.querySelectorAll('tr.trophy'));
      expect(rowsAfterXmb[0].id).toBe('trophy-1');
      expect(rowsAfterXmb[1].id).toBe('trophy-2');
      expect(rowsAfterXmb[2].id).toBe('trophy-3');

      if (cleanup) cleanup();
    });
  });

  describe('2. AbortSignal and Batch Queue Stop Cancellation (Defect 2 & 6)', () => {
    it('aborts active fetch, cleans up loading row without reported network error, and allows retry', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/psngame/46507?psnid=test_user');
      document.cookie = '__Psnine_psnid=test_user; path=/';

      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box pd10">
            <table class="list">
              <tbody>
                <tr id="trophy-1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001"><img class="imgbg" src="t1.png" /></a></td>
                  <td>
                    <p><a href="/trophy/46507001">奖杯一</a> <em class="alert-success"><b>1</b> Tips</em></p>
                  </td>
                  <td class="twoge">10.0%</td>
                  <td></td>
                </tr>
                <tr id="trophy-2" class="trophy">
                  <td class="t4"><a href="/trophy/46507002"><img class="imgbg" src="t2.png" /></a></td>
                  <td>
                    <p><a href="/trophy/46507002">奖杯二</a> <em class="alert-success"><b>2</b> Tips</em></p>
                  </td>
                  <td class="twoge">20.0%</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      let requestCount = 0;
      const mockHttpDocument = vi.fn().mockImplementation((url: string, options?: any) => {
        requestCount++;
        const signal: AbortSignal | undefined = options?.signal;
        return new Promise((resolve, reject) => {
          if (signal?.aborted) {
            reject(new DOMException('This operation was aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'));
          }, { once: true });
        });
      });

      const store = createStore();
      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings },
        store,
        http: {
          text: vi.fn(),
          document: mockHttpDocument,
          json: vi.fn()
        }
      });

      const cleanup = await mountTrophies(ctx);

      const batchBtn = document.getElementById('psnine-batch-load-all-tips-btn') as HTMLElement;
      const stopBtn = document.getElementById('psnine-stop-batch-tips-btn') as HTMLElement;

      // Start batch queue
      batchBtn.click();
      expect(stopBtn.style.display).toBe('inline-block');
      expect(mockHttpDocument).toHaveBeenCalledTimes(1);

      // Row is currently in loading state
      expect(document.querySelector('.psnine-inline-tip-row')).not.toBeNull();

      // Click Stop button to abort
      stopBtn.click();
      await new Promise(r => setTimeout(r, 60));

      // 1. Still loading row is cleanly removed
      expect(document.querySelector('.psnine-inline-tip-row')).toBeNull();

      // 2. NO false network error displayed
      expect(document.body.textContent).not.toContain('❌ 加载 Tips 失败');

      // 3. NO following requests made after stop
      await new Promise(r => setTimeout(r, 100));
      expect(mockHttpDocument).toHaveBeenCalledTimes(1);

      // 4. Retry works cleanly
      const validTipDoc = new DOMParser().parseFromString(`
        <ul class="list">
          <li>
            <div class="ml64">
              <div class="meta"><a class="psnnode" href="/psnid/alice">Alice</a></div>
              <div class="content">Awesome tip on retry</div>
              <div class="meta"><span class="h-p">2024-05-18</span><a onclick="up_tip(1, this)">赞(3)</a></div>
            </div>
          </li>
        </ul>
      `, 'text/html');
      mockHttpDocument.mockResolvedValue(validTipDoc);

      const badge = document.getElementById('trophy-1')!.querySelector('em.alert-success') as HTMLElement;
      badge.click();
      await new Promise(r => setTimeout(r, 60));

      const tipRow = document.querySelector('.psnine-inline-tip-row');
      expect(tipRow).not.toBeNull();
      expect(tipRow?.textContent).toContain('Awesome tip on retry');

      if (cleanup) cleanup();
    });
  });

  describe('3. Global enhanceMasks on Cloned & Filtered Tips (Defect 1 & 6)', () => {
    it('applies enhanceMasks to hiddenBody clone and allows keyboard Enter/Space reveal', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/psngame/46507?psnid=test_user');
      document.cookie = '__Psnine_psnid=test_user; path=/';

      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box pd10">
            <table class="list">
              <tbody>
                <tr id="trophy-1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001"><img class="imgbg" src="t1.png" /></a></td>
                  <td>
                    <p><a href="/trophy/46507001">奖杯一</a> <em class="alert-success"><b>1</b> Tips</em></p>
                  </td>
                  <td class="twoge">10.0%</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Filtered tip with spoiler .mark
      const mockTipDoc = new DOMParser().parseFromString(`
        <ul class="list">
          <li>
            <div class="meta"><a class="psnnode" href="/psnid/blocked_player">Blocked_Player</a></div>
            <div class="content">Spoilers ahead: <span class="mark" data-psnine-mask-ready="true">super secret</span></div>
          </li>
        </ul>
      `, 'text/html');

      const store = createStore();
      const ctx = createContext({
        document,
        window: mockWin,
        settings: {
          ...defaultSettings,
          blockList: ['blocked_player']
        },
        store,
        http: {
          text: vi.fn(),
          document: vi.fn().mockResolvedValue(mockTipDoc),
          json: vi.fn()
        }
      });

      const cleanup = await mountTrophies(ctx);

      const tipsBadge = document.querySelector('em.alert-success') as HTMLElement;
      tipsBadge.click();
      await new Promise(r => setTimeout(r, 60));

      const filterBtn = document.querySelector('.psnine-filtered-tip-btn') as HTMLElement;
      expect(filterBtn).not.toBeNull();

      // Click reveal filter button
      filterBtn.click();

      // Now hiddenBody is visible, check .mark inside
      const mark = document.querySelector('.mark') as HTMLElement;
      expect(mark).not.toBeNull();
      expect(mark.getAttribute('data-psnine-mask-ready')).toBe('true');
      expect(mark.classList.contains('unmasked')).toBe(false);

      // Keyboard Enter reveals spoiler
      mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(mark.classList.contains('unmasked')).toBe(true);

      // Keyboard Space toggles spoiler
      mark.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(mark.classList.contains('unmasked')).toBe(false);

      if (cleanup) cleanup();
    });
  });

  describe('4. T13: Likes Sorting Excludes Sub-replies & Handles Dynamic onContent (Defect 3 & 6)', () => {
    it('sorts strictly by own meta likes excluding .sonlist, assigns maxseq+1, and restores dynamic additions to end', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/trophy/46507001');

      document.body.innerHTML = `
        <div class="main">
          <ul class="list">
            <li id="tip-1">
              <div class="ml64">
                <div class="meta"><a class="psnnode" href="/psnid/user1">User1</a></div>
                <div class="content">
                  Tip 1
                  <ul class="sonlist">
                    <li><div class="meta"><a onclick="up_tip(10, this)">赞(99)</a></div></li>
                  </ul>
                </div>
                <div class="meta"><span class="h-p">2024-05-18</span><a onclick="up_tip(1, this)">赞(2)</a></div>
              </div>
            </li>
            <li id="tip-2">
              <div class="ml64">
                <div class="meta"><a class="psnnode" href="/psnid/user2">User2</a></div>
                <div class="content">Tip 2</div>
                <div class="meta"><span class="h-p">2024-05-18</span><a onclick="up_tip(2, this)">赞(5)</a></div>
              </div>
            </li>
            <li id="tip-3">
              <div class="ml64">
                <div class="meta"><a class="psnnode" href="/psnid/user3">User3</a></div>
                <div class="content">
                  Tip 3
                  <ul class="sonlist">
                    <li><div class="meta"><a onclick="up_tip(20, this)">赞(88)</a></div></li>
                  </ul>
                </div>
                <div class="meta"><span class="h-p">2024-05-18</span></div>
              </div>
            </li>
          </ul>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings },
        store,
        http
      });

      const cleanup = await mountTrophies(ctx);

      const tipsList = document.querySelector('ul.list')!;
      const sortBtn = document.getElementById('psnine-sort-tips-by-likes-btn') as HTMLElement;
      expect(sortBtn).not.toBeNull();

      // Click to sort by likes
      sortBtn.click();
      // Tip 2 (5 likes) > Tip 1 (2 likes) > Tip 3 (0 likes)
      // Note: Tip 1's sonlist has 99 likes and Tip 3's sonlist has 88 likes, which MUST be ignored!
      expect(tipsList.children[0].id).toBe('tip-2');
      expect(tipsList.children[1].id).toBe('tip-1');
      expect(tipsList.children[2].id).toBe('tip-3');

      // Dynamic append new tip with 10 likes
      const newTip = document.createElement('li');
      newTip.id = 'tip-4';
      newTip.innerHTML = `
        <div class="ml64">
          <div class="meta"><a class="psnnode" href="/psnid/user4">User4</a></div>
          <div class="content">Tip 4</div>
          <div class="meta"><span class="h-p">2024-05-18</span><a onclick="up_tip(4, this)">赞(10)</a></div>
        </div>
      `;
      tipsList.appendChild(newTip);

      // Wait for onContent
      await new Promise(r => setTimeout(r, 120));

      // With likes sort active, Tip 4 (10 likes) ranks 1st
      expect(tipsList.children[0].id).toBe('tip-4');
      expect(tipsList.children[1].id).toBe('tip-2');
      expect(tipsList.children[2].id).toBe('tip-1');
      expect(tipsList.children[3].id).toBe('tip-3');

      // Click restore default order
      sortBtn.click();
      // Tip 4 has maxseq+1 (3), so it must be placed at the very end!
      expect(tipsList.children[0].id).toBe('tip-1');
      expect(tipsList.children[1].id).toBe('tip-2');
      expect(tipsList.children[2].id).toBe('tip-3');
      expect(tipsList.children[3].id).toBe('tip-4');

      if (cleanup) cleanup();
    });
  });

  describe('5. C19: Personal View Verification, Exact ID, Scoped Article (Defect 4)', () => {
    it('marks unverified public page as unknown, prevents startsWith prefix collisions, and ignores sidebar links', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/topic/39074');
      document.cookie = '__Psnine_psnid=test_user; path=/';

      document.body.innerHTML = `
        <div class="sidebar">
          <a href="https://psnine.com/trophy/1234001" id="sidebar-link">Sidebar Trophy</a>
        </div>
        <div class="post">
          <div class="content">
            <p>
              <a href="https://psnine.com/trophy/1234001" id="link-t1">Game 1234 Trophy</a>
              <a href="https://psnine.com/trophy/12345001" id="link-t2">Game 12345 Trophy</a>
            </p>
          </div>
        </div>
      `;

      // 1234: Public page without personal indicator (no user link, no earned marker)
      const mockGame1234Unverified = new DOMParser().parseFromString(`
        <table>
          <tr class="trophy">
            <td><a href="/trophy/1234001"><img class="imgbg" /></a></td>
            <td></td>
          </tr>
        </table>
      `, 'text/html');

      // 12345: Personal page with earned marker
      const mockGame12345Personal = new DOMParser().parseFromString(`
        <table>
          <tr class="trophy">
            <td><a href="/trophy/12345001"><img class="imgbg earned" /></a></td>
            <td><em class="alert-success r">2024-05-18</em></td>
          </tr>
        </table>
      `, 'text/html');

      const mockHttpDocument = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/psngame/1234?')) return Promise.resolve(mockGame1234Unverified);
        if (url.includes('/psngame/12345?')) return Promise.resolve(mockGame12345Personal);
        return Promise.reject(new Error('not found'));
      });

      const store = createStore();
      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings },
        store,
        http: { text: vi.fn(), document: mockHttpDocument, json: vi.fn() }
      });

      const cleanup = await mountTrophies(ctx);

      // Sidebar link must NOT be annotated (scoped article only)
      expect(document.getElementById('sidebar-link')!.nextElementSibling).toBeNull();

      // Game 1234 unverified personal view: status unknown!
      const badge1 = document.getElementById('link-t1')!.nextElementSibling as HTMLElement;
      expect(badge1?.textContent).toBe('❓ 状态未知');

      // Game 12345 exact ID match (NOT overriden to 1234): verified personal view, earned!
      const badge2 = document.getElementById('link-t2')!.nextElementSibling as HTMLElement;
      expect(badge2?.textContent).toBe('✅ 已获得');

      // Dynamic onContent does NOT re-fetch already cached games
      const newP = document.createElement('p');
      newP.innerHTML = `<a href="https://psnine.com/trophy/12345001" id="link-t2-dyn">Game 12345 Dynamic</a>`;
      document.querySelector('.post .content')!.appendChild(newP);

      await new Promise(r => setTimeout(r, 120));

      const badgeDyn = document.getElementById('link-t2-dyn')!.nextElementSibling as HTMLElement;
      expect(badgeDyn?.textContent).toBe('✅ 已获得');
      // No extra HTTP request made for 12345!
      expect(mockHttpDocument).toHaveBeenCalledTimes(2);

      if (cleanup) cleanup();
    });
  });

  describe('6. Native ul.dropmenu Sort Menu, Non-XMB Initial Order, DLC/Tips Co-movement, Keyboard & Cleanup', () => {
    it('preserves native links, distinguishes initial order from XMB, keeps DLC and inline tips grouped, supports keyboard/Escape, settles observer, and restores on cleanup', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/psngame/46507?psnid=toonn95&ob=rarity&psngamelang=zh-Hans');
      document.cookie = '__Psnine_psnid=toonn95; path=/';

      // Initial order on this ?ob=rarity page is #2 (3.6%), #1 (15.0%), #3 (50.0%) - NOT XMB (#1, #2, #3)
      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box">
            <ul class="dropmenu">
              <li><em>排序</em></li>
              <li class="dropdown">
                <a href="javascript:void(0)" class="arr-down">完美率</a>
                <ul>
                  <li><a href="?psnid=toonn95&ob=trophyid&psngamelang=zh-Hans">XMB</a></li>
                  <li><a href="?psnid=toonn95&ob=type&psngamelang=zh-Hans">类型</a></li>
                  <li><a href="?psnid=toonn95&ob=rarity&psngamelang=zh-Hans" class="current">完美率</a></li>
                </ul>
              </li>
            </ul>
            <table class="list" id="base-table">
              <tbody>
                <tr id="2" class="trophy">
                  <td class="t4"><a href="/trophy/46507002"><img class="imgbg earned" src="t2.png" /></a></td>
                  <td><p><a href="/trophy/46507002">铜杯罕见</a></p></td>
                  <td><em class="alert-success pd5 r" tips="2025年">01-10<br>10:00</em></td>
                  <td class="twoge">3.60%</td>
                </tr>
                <tr id="1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001"><img class="imgbg earned" src="t1.png" /></a></td>
                  <td><p><a href="/trophy/46507001">白金奖杯</a></p></td>
                  <td><em class="alert-success pd5 r" tips="2026年">05-20<br>12:00</em></td>
                  <td class="twoge">15.00%</td>
                </tr>
                <tr id="3" class="trophy">
                  <td class="t2"><a href="/trophy/46507003"><img class="imgbg" src="t3.png" /></a></td>
                  <td><p><a href="/trophy/46507003">金杯未获</a></p></td>
                  <td></td>
                  <td class="twoge">50.00%</td>
                </tr>
              </tbody>
            </table>
            <table class="list" id="dlc-table">
              <tbody>
                <tr id="101" class="trophy">
                  <td class="t4"><a href="/trophy/46507101"><img class="imgbg" src="d1.png" /></a></td>
                  <td><p><a href="/trophy/46507101">DLC铜杯</a></p></td>
                  <td></td>
                  <td class="twoge">8.00%</td>
                </tr>
                <tr id="102" class="trophy">
                  <td class="t2"><a href="/trophy/46507102"><img class="imgbg earned" src="d2.png" /></a></td>
                  <td><p><a href="/trophy/46507102">DLC金杯</a></p></td>
                  <td><em class="alert-success pd5 r" tips="2026年">02-01<br>09:00</em></td>
                  <td class="twoge">25.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const origLinks = Array.from(document.querySelectorAll('ul.dropmenu > li.dropdown > ul > li > a')) as HTMLAnchorElement[];
      const origHrefs = origLinks.map(a => a.getAttribute('href'));

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings },
        store,
        http
      });

      const cleanup = await mountTrophies(ctx);

      const trigger = document.querySelector('[data-psnine-trophy-sort-trigger]') as HTMLAnchorElement;
      const menu = document.querySelector('[data-psnine-trophy-sort-menu]') as HTMLUListElement;
      expect(trigger).not.toBeNull();
      expect(menu).not.toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      // Only missing directions + time + initial added (5 items on personal page)
      const addedItems = Array.from(menu.querySelectorAll('a[data-psnine-sort]')).map(a => a.getAttribute('data-psnine-sort'));
      expect(addedItems).toEqual(['time-desc', 'time-asc', 'type-asc', 'rarity-desc', 'initial']);

      // Attach an inline tip row to trophy #1 (46507001) to verify co-movement
      const baseTbody = document.querySelector('#base-table tbody')!;
      const tipRow = document.createElement('tr');
      tipRow.className = 'psnine-inline-tip-row';
      tipRow.setAttribute('data-psnine-next', 'true');
      tipRow.setAttribute('data-for-trophy', '46507001');
      document.getElementById('1')!.after(tipRow);

      // Keyboard open + Escape close + focus restoration
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);

      // Tab / focus moving outside dropdown silently closes menu and external Escape neither steals focus nor calls preventDefault
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const outsideBtn = document.getElementById('psnine-batch-load-all-tips-btn') as HTMLButtonElement;
      outsideBtn.focus();
      trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outsideBtn }));
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(outsideBtn);

      const extEscEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      outsideBtn.dispatchEvent(extEscEvent);
      expect(extEscEvent.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(outsideBtn);

      // Select time-desc: #1 (2026-05) -> #2 (2025-01) -> #3 (unearned last)
      const timeDescLink = menu.querySelector('[data-psnine-sort="time-desc"]') as HTMLAnchorElement;
      timeDescLink.click();
      expect(trigger.textContent).toBe('获得时间（新→旧）');
      expect(menu.querySelectorAll('a.current').length).toBe(1);
      expect(timeDescLink.classList.contains('current')).toBe(true);

      expect(Array.from(baseTbody.querySelectorAll('tr.trophy')).map(r => r.id)).toEqual(['1', '2', '3']);
      expect(document.getElementById('1')!.nextElementSibling).toBe(tipRow);
      // DLC table sorted independently without mixing into base table
      const dlcTbody = document.querySelector('#dlc-table tbody')!;
      expect(Array.from(dlcTbody.querySelectorAll('tr.trophy')).map(r => r.id)).toEqual(['102', '101']);

      // Select initial: restores page load order (#2, #1, #3), NOT XMB (#1, #2, #3)
      const initialLink = menu.querySelector('[data-psnine-sort="initial"]') as HTMLAnchorElement;
      initialLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(trigger.textContent).toBe('页面初始顺序');
      expect(Array.from(baseTbody.querySelectorAll('tr.trophy')).map(r => r.id)).toEqual(['2', '1', '3']);
      expect(document.getElementById('1')!.nextElementSibling).toBe(tipRow);

      // Native links are still the exact same DOM nodes with original hrefs and unintercepted click
      const currentFirstThree = Array.from(menu.querySelectorAll(':scope > li > a')).slice(0, 3);
      expect(currentFirstThree).toEqual(origLinks);
      expect(currentFirstThree.map(a => a.getAttribute('href'))).toEqual(origHrefs);
      let nativeClickDefaultPreventedByPlugin = true;
      document.addEventListener('click', (e) => {
        nativeClickDefaultPreventedByPlugin = e.defaultPrevented;
        e.preventDefault(); // prevent JSDOM navigation warning after verifying plugin did not intercept
      }, { once: true });
      const nativeClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      origLinks[0].dispatchEvent(nativeClickEvent);
      expect(nativeClickDefaultPreventedByPlugin).toBe(false);

      // Dynamic row append under active rarity-desc maintains sort & settles without observer loop
      (menu.querySelector('[data-psnine-sort="rarity-desc"]') as HTMLElement).click();
      expect(Array.from(baseTbody.querySelectorAll('tr.trophy')).map(r => r.id)).toEqual(['3', '1', '2']);

      const dynRow = document.createElement('tr');
      dynRow.id = '4';
      dynRow.className = 'trophy';
      dynRow.innerHTML = `
        <td class="t3"><a href="/trophy/46507004"><img class="imgbg" src="t4.png" /></a></td>
        <td><p><a href="/trophy/46507004">动态银杯</a></p></td>
        <td></td>
        <td class="twoge">30.00%</td>
      `;
      baseTbody.appendChild(dynRow);
      await new Promise(r => setTimeout(r, 120));

      expect(Array.from(baseTbody.querySelectorAll('tr.trophy')).map(r => r.id)).toEqual(['3', '4', '1', '2']);
      expect(menu.querySelectorAll('a[data-psnine-sort]').length).toBe(5);

      let extraMutations = 0;
      const obs = new MutationObserver(ms => { extraMutations += ms.length; });
      obs.observe(document.body, { childList: true, subtree: true });
      await new Promise(r => setTimeout(r, 150));
      obs.disconnect();
      expect(extraMutations).toBe(0);

      // Open menu first, then call cleanup while open: must remove .hover/.psnine-dropdown-open, restore trigger/menu/current, and unbind listeners
      trigger.click();
      const dropdownLi = trigger.parentElement as HTMLElement;
      expect(dropdownLi.classList.contains('hover')).toBe(true);
      expect(dropdownLi.classList.contains('psnine-dropdown-open')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      if (cleanup) cleanup();
      expect(dropdownLi.classList.contains('hover')).toBe(false);
      expect(dropdownLi.classList.contains('psnine-dropdown-open')).toBe(false);
      expect(dropdownLi.hasAttribute('data-psnine-trophy-sort-dropdown')).toBe(false);
      expect(menu.hasAttribute('data-psnine-trophy-sort-menu')).toBe(false);
      expect(menu.querySelectorAll('[data-psnine-sort-item]').length).toBe(0);
      expect(trigger.hasAttribute('data-psnine-trophy-sort-trigger')).toBe(false);
      expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
      expect(trigger.hasAttribute('aria-expanded')).toBe(false);
      expect(trigger.textContent).toBe('完美率');
      expect(origLinks[2].classList.contains('current')).toBe(true);

      // Verify click and keydown listeners on trigger are unbound after cleanup
      trigger.click();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(dropdownLi.classList.contains('hover')).toBe(false);
      expect(dropdownLi.classList.contains('psnine-dropdown-open')).toBe(false);
      expect(trigger.hasAttribute('aria-expanded')).toBe(false);
    });

    it('hides time sort options on public page and skips enhancement when native sort menu is missing or from another path', async () => {
      const publicWin = makeWindowWithUrl('https://psnine.com/psngame/46507');
      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box">
            <ul class="dropmenu">
              <li class="dropdown">
                <a href="javascript:void(0)" class="arr-down">语言</a>
                <ul>
                  <li><a href="/psngame/46507/rank?ob=trophyid">异路径</a></li>
                  <li><a href="/psngame/46507/rank?ob=type">异路径2</a></li>
                  <li><a href="/psngame/46507/rank?ob=rarity">异路径3</a></li>
                </ul>
              </li>
              <li class="dropdown" id="real-sort-dropdown">
                <a href="javascript:void(0)" class="arr-down">XMB</a>
                <ul>
                  <li><a href="?ob=trophyid" class="current">XMB</a></li>
                  <li><a href="?ob=type">类型</a></li>
                  <li><a href="?ob=rarity">完美率</a></li>
                </ul>
              </li>
            </ul>
            <table class="list">
              <tbody>
                <tr id="1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001">白金</a></td>
                  <td class="twoge">3.6%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const ctx = createContext({
        document,
        window: publicWin,
        settings: { ...defaultSettings },
        store: createStore(),
        http: createHttpClient()
      });

      const cleanup = await mountTrophies(ctx);

      const realDropdown = document.getElementById('real-sort-dropdown')!;
      expect(realDropdown.getAttribute('data-psnine-trophy-sort-dropdown')).toBe('true');
      expect(realDropdown.querySelectorAll('[data-psnine-sort="time-desc"], [data-psnine-sort="time-asc"]').length).toBe(0);
      expect(Array.from(realDropdown.querySelectorAll('a[data-psnine-sort]')).map(a => a.getAttribute('data-psnine-sort'))).toEqual([
        'type-asc',
        'rarity-desc',
        'initial'
      ]);
      if (cleanup) cleanup();

      // Now test with NO valid sort menu at all: must not create fallback buttons
      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box">
            <table class="list">
              <tbody>
                <tr id="1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001">白金</a></td>
                  <td class="twoge">3.6%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      const cleanup2 = await mountTrophies(ctx);
      expect(document.querySelectorAll('[data-psnine-trophy-sort-trigger], [data-psnine-sort], #psnine-sort-xmb-btn').length).toBe(0);
      if (cleanup2) cleanup2();
    });
  });

  describe('7. Multi-DLC Native Filter Sync, Manual Tip Collapse Coexistence, Dynamic Native Controls & Cleanup', () => {
    it('syncs inline tips across multiple DLC tables, preserves manual inline-tip-toggle reason, handles dynamic native control insertion, and cleans up hidden reasons', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/psngame/46507?psnid=toonn95');
      document.cookie = '__Psnine_psnid=toonn95; path=/';

      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box">
            <ul class="dropmenu" id="dropmenu-bar">
              <li><em>排序</em></li>
            </ul>
            <table class="list" id="base-table">
              <tbody>
                <tr id="1" class="trophy">
                  <td class="t1"><a href="/trophy/46507001"><img class="imgbg earned" src="t1.png" /></a></td>
                  <td><p><a href="/trophy/46507001">本体已获</a></p></td>
                  <td><em class="alert-success pd5 r" tips="2026年">05-20<br>12:00</em></td>
                  <td class="twoge">15.00%</td>
                </tr>
              </tbody>
            </table>
            <table class="list" id="dlc-table">
              <tbody>
                <tr id="101" class="trophy">
                  <td class="t4"><a href="/trophy/46507101"><img class="imgbg" src="d1.png" /></a></td>
                  <td><p><a href="/trophy/46507101">DLC未获</a></p></td>
                  <td></td>
                  <td class="twoge">8.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings },
        store: createStore(),
        http: createHttpClient()
      });

      const cleanup = await mountTrophies(ctx);

      // Even without native .own/.unown controls initially, plugin does NOT render #psnine-filter-status-btn
      expect(document.getElementById('psnine-filter-status-btn')).toBeNull();
      expect(document.getElementById('psnine-trophy-tips-toolbar')).not.toBeNull();

      // Attach inline tips to both base trophy (earned) and DLC trophy (unearned)
      const baseTip = document.createElement('tr');
      baseTip.className = 'psnine-inline-tip-row';
      baseTip.setAttribute('data-psnine-next', 'true');
      baseTip.setAttribute('data-for-trophy', '46507001');
      document.getElementById('1')!.after(baseTip);

      const dlcTip = document.createElement('tr');
      dlcTip.className = 'psnine-inline-tip-row';
      dlcTip.setAttribute('data-psnine-next', 'true');
      dlcTip.setAttribute('data-for-trophy', '46507101');
      document.getElementById('101')!.after(dlcTip);

      // Unrelated bare .own element outside ul.dropmenu / .o_btn must NOT trigger trophy filtering
      const unrelatedOwn = document.createElement('div');
      unrelatedOwn.className = 'own select';
      document.body.appendChild(unrelatedOwn);
      unrelatedOwn.click();
      expect(isHiddenByReason(dlcTip, 'trophy-status-filter')).toBe(false);
      unrelatedOwn.remove();

      // Dynamically inject native .own and .unown controls
      const dropmenu = document.getElementById('dropmenu-bar')!;
      const nativeLi = document.createElement('li');
      nativeLi.innerHTML = `
        <button type="button" class="o_btn own">已获得</button>
        <button type="button" class="o_btn unown">未获得</button>
      `;
      dropmenu.appendChild(nativeLi);
      await new Promise(r => setTimeout(r, 120));

      const ownBtn = document.querySelector('.own') as HTMLElement;
      const unownBtn = document.querySelector('.unown') as HTMLElement;

      // Simulate native own selection via class change
      ownBtn.classList.add('select');
      document.getElementById('101')!.style.display = 'none';
      await new Promise(r => setTimeout(r, 50));

      expect(isHiddenByReason(baseTip, 'trophy-status-filter')).toBe(false);
      expect(isHiddenByReason(dlcTip, 'trophy-status-filter')).toBe(true);

      // Cleanup while filter is active must clear plugin trophy-status-filter reason on inline tips
      if (cleanup) cleanup();
      expect(isHiddenByReason(dlcTip, 'trophy-status-filter')).toBe(false);
    });
  });
});
