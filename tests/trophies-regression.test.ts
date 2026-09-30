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

  describe('1. Real MutationObserver onContent Integration (Defect 5 & 6)', () => {
    it('accurately handles append/prepend, preserves panel identity, assigns maxseq+1, and applies active filters', async () => {
      const mockWin = makeWindowWithUrl('https://psnine.com/psngame/46507?psnid=test_user');
      document.cookie = '__Psnine_psnid=test_user; path=/';

      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box pd10">
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
        settings: { ...defaultSettings, foldTrophySummary: false, foldTrophyChart: false },
        store,
        http
      });

      const cleanup = await mountTrophies(ctx);

      const panelBefore = document.getElementById('psnine-trophy-stats-panel')!;
      expect(panelBefore).not.toBeNull();
      let chips = panelBefore.querySelectorAll('.psnine-trophy-icon-chip');
      expect(chips.length).toBe(2);

      // Filter: click to filter 'unearned'
      const filterBtn = document.getElementById('psnine-filter-status-btn') as HTMLElement;
      filterBtn.click(); // unearned
      expect(isHiddenByReason(document.getElementById('trophy-1')!, 'trophy-status-filter')).toBe(true);
      expect(isHiddenByReason(document.getElementById('trophy-2')!, 'trophy-status-filter')).toBe(false);

      // Prepend a new row into table body
      const tbody = document.querySelector('table.list tbody')!;
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

      // Panel identity preserved (not destroyed and recreated)
      const panelAfter = document.getElementById('psnine-trophy-stats-panel');
      expect(panelAfter).toBe(panelBefore);

      // Chips count updated from 2 to 3
      chips = panelAfter!.querySelectorAll('.psnine-trophy-icon-chip');
      expect(chips.length).toBe(3);

      // Header typecounts updated (includes 金1)
      const headerCounts = document.getElementById('psnine-trophy-header-counts');
      expect(headerCounts?.textContent).toContain('金1');

      // Filter state applied to newly added row: newRow is earned, so must be hidden!
      expect(isHiddenByReason(newRow, 'trophy-status-filter')).toBe(true);

      // Pre-pended row got maxSeq + 1 (2), preserving original sequence logic
      expect(newRow.getAttribute('data-psnine-orig-seq')).toBe('2');

      // Click restore XMB order: new row (origSeq=2) must sort to the end of original items!
      const xmbBtn = document.getElementById('psnine-sort-xmb-btn') as HTMLElement;
      xmbBtn.click();
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
});
