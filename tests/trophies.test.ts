import { describe, it, expect, vi } from 'vitest';
import {
  extractTrophyType,
  parseRarityPercent,
  parseTrophyRows,
  calculateTrophyStats,
  sortTrophiesInTable,
  renderTrophyChartsSvg,
  mountTrophies
} from '../src/features/trophies';
import { Context, defaultSettings } from '../src/core/types';
import { isHiddenByReason } from '../src/core/dom';

describe('Trophies Feature Module (T01 - T14 + C19) - Followup Verification', () => {
  describe('1. C19: Guide Topic Page Personal Trophy Matching (Point 1)', () => {
    it('uses slice(0,-3) for 4-digit gameId, deduplicates requests, tags multiple trophies in same paragraph, and marks unknown as unknown', async () => {
      document.body.innerHTML = `
        <div class="post">
          <div class="content">
            <p>
              Check out <a href="https://psnine.com/trophy/1234001" id="link-t1">奖杯一</a>
              and <a href="https://psnine.com/trophy/1234002" id="link-t2">奖杯二</a>
              and <a href="https://psnine.com/trophy/1234999" id="link-t-unknown">未在列表的杯</a>
            </p>
          </div>
        </div>
      `;

      // 4-digit game 1234 document where 1234001 is earned, 1234002 is unearned, and 1234999 is NOT present
      const mockGameDoc = new DOMParser().parseFromString(`
        <table>
          <tr class="trophy">
            <td><a href="/trophy/1234001"><img class="imgbg earned" /></a></td>
            <td><em class="alert-success r">2024-05-18</em></td>
          </tr>
          <tr class="trophy">
            <td><a href="/trophy/1234002"><img class="imgbg" /></a></td>
            <td></td>
          </tr>
        </table>
      `, 'text/html');

      const mockHttpDocument = vi.fn().mockResolvedValue(mockGameDoc);
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/topic/39074'),
        settings: { ...defaultSettings },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), remove: vi.fn() },
        http: { text: vi.fn(), document: mockHttpDocument, json: vi.fn() },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      await mountTrophies(ctx);

      // Verify ONLY ONE HTTP request was made for gameId 1234 (deduplicated!)
      expect(mockHttpDocument).toHaveBeenCalledTimes(1);
      expect(mockHttpDocument).toHaveBeenCalledWith(expect.stringContaining('/psngame/1234?psnid=test_user'), expect.any(Object));

      // Verify each link in the SAME paragraph has its own badge!
      const link1 = document.getElementById('link-t1')!;
      const link2 = document.getElementById('link-t2')!;
      const linkUnknown = document.getElementById('link-t-unknown')!;

      const badge1 = link1.nextElementSibling as HTMLElement;
      const badge2 = link2.nextElementSibling as HTMLElement;
      const badgeUnknown = linkUnknown.nextElementSibling as HTMLElement;

      expect(badge1?.classList.contains('psnine-guide-trophy-badge')).toBe(true);
      expect(badge1?.textContent).toBe('✅ 已获得');

      expect(badge2?.classList.contains('psnine-guide-trophy-badge')).toBe(true);
      expect(badge2?.textContent).toBe('⏳ 未获得');

      // T999 is NOT in game page -> marked as unknown, NOT unearned!
      expect(badgeUnknown?.classList.contains('psnine-guide-trophy-badge')).toBe(true);
      expect(badgeUnknown?.textContent).toBe('❓ 状态未知');
    });
  });

  describe('2. T08: Original XMB Order Restoration across observer events', () => {
    it('restores original XMB order after sorting and re-parsing (originalRestored: true)', () => {
      const table = document.createElement('table');
      table.className = 'list';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);

      const row1 = document.createElement('tr');
      row1.id = 'trophy-1';
      row1.className = 'trophy';
      row1.innerHTML = `<td class="t4"><a href="/trophy/101">T1</a></td><td class="twoge">50%</td>`;

      const row2 = document.createElement('tr');
      row2.id = 'trophy-2';
      row2.className = 'trophy';
      row2.innerHTML = `<td class="t1"><a href="/trophy/102">T2</a></td><td class="twoge">5%</td>`;

      tbody.appendChild(row1);
      tbody.appendChild(row2);

      const items1 = parseTrophyRows(table, false);
      expect(items1[0].originalIndex).toBe(0);
      expect(items1[1].originalIndex).toBe(1);

      sortTrophiesInTable(table, items1, 'rarity-asc');
      expect(tbody.children[0]).toBe(row2);
      expect(tbody.children[1]).toBe(row1);

      // Re-parse simulates observer/onContent firing after DOM reorder
      const items2 = parseTrophyRows(table, false);
      expect(items2.find(i => i.row === row1)?.originalIndex).toBe(0);
      expect(items2.find(i => i.row === row2)?.originalIndex).toBe(1);

      // Sort back to XMB original order
      sortTrophiesInTable(table, items2, 'xmb');
      expect(tbody.children[0]).toBe(row1);
      expect(tbody.children[1]).toBe(row2);
    });
  });

  describe('3. T03 & Wording: Single-point Time Curve and Count Percentage', () => {
    it('renders single-point time curve and labels count percentage', () => {
      const dummyTable = document.createElement('table');
      const dummyRow = document.createElement('tr');

      const statsWith1 = calculateTrophyStats([
        {
          row: dummyRow,
          table: dummyTable,
          trophyId: '1',
          name: 'Plat',
          description: 'd1',
          iconSrc: 'p.png',
          type: 'platinum' as const,
          rarityPercent: 3.5,
          status: 'earned' as const,
          earnedTimestamp: 1700000000000,
          earnedTimeStr: '2023-11-14 10:00',
          tipsCount: 2,
          originalIndex: 0
        }
      ]);

      expect(statsWith1.timeCurve.length).toBe(1);
      const svg1 = renderTrophyChartsSvg(statsWith1);
      expect(svg1).toContain('奖杯获得时间积累曲线');
      expect(svg1).toContain('查看获得时间数据表');
      expect(svg1).toContain('已载入');
    });
  });

  describe('4. mountTrophies DOM Integration (T04 - T14)', () => {
    it('handles interactive sorting, filtering, safe tips loader, batch queue abort, and guide matching', async () => {
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
            </ul>
            <table class="list">
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
            </table>
          </div>
        </div>
      `;

      const mockTipDoc = new DOMParser().parseFromString(`
        <ul class="list">
          <li>
            <div class="meta"><a class="psnnode" href="/psnid/alice">Alice</a> <span class="h-p">2024-05-18</span></div>
            <div class="content">Use high pair strategy <span class="mark" style="color:transparent;">spoiler secret</span></div>
          </li>
          <li>
            <div class="meta"><a class="psnnode" href="/psnid/blocked_user">Blocked_User</a></div>
            <div class="content">Toxic comment with badword</div>
          </li>
        </ul>
      `, 'text/html');

      let onContentCb: (() => void) | null = null;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame/46507?psnid=test_user'),
        settings: {
          ...defaultSettings,
          blockList: ['blocked_user'],
          blockWordsList: ['badword'],
          foldTrophySummary: false,
          foldTrophyChart: false
        },
        store: {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined)
        },
        http: {
          text: vi.fn(),
          document: vi.fn().mockResolvedValue(mockTipDoc),
          json: vi.fn()
        },
        userId: 'test_user',
        onContent: vi.fn().mockImplementation((cb) => { onContentCb = cb; return () => {}; }),
        report: vi.fn()
      };

      const cleanup = await mountTrophies(ctx);

      // Overview panel, header, charts, icon chips, and plugin status filter must NOT exist
      expect(document.getElementById('psnine-trophy-stats-panel')).toBeNull();
      expect(document.getElementById('psnine-trophy-header-title')).toBeNull();
      expect(document.getElementById('psnine-trophy-charts-container')).toBeNull();
      expect(document.getElementById('psnine-trophy-icon-grid-wrapper')).toBeNull();
      expect(document.getElementById('psnine-filter-status-btn')).toBeNull();
      expect(document.querySelectorAll('#psnine-sort-xmb-btn, #psnine-sort-time-btn, #psnine-sort-rarity-btn, #psnine-sort-type-btn').length).toBe(0);

      // Compact Tips toolbar is rendered with the 3 action buttons
      const toolbar = document.getElementById('psnine-trophy-tips-toolbar')!;
      expect(toolbar).not.toBeNull();
      expect(toolbar.getAttribute('data-psnine-next')).toBe('true');
      expect(document.getElementById('psnine-batch-load-all-tips-btn')).not.toBeNull();
      expect((document.getElementById('psnine-batch-load-unearned-tips-btn') as HTMLButtonElement).disabled).toBe(false);

      // T08 & T09: Sort via native dropdown menu items
      const sortRarityDescItem = document.querySelector('[data-psnine-sort="rarity-desc"]') as HTMLElement;
      expect(sortRarityDescItem).not.toBeNull();
      sortRarityDescItem.click(); // desc (50% then 3.6%)
      const table = document.querySelector('table.list')!;
      expect(table.querySelector('tbody')?.children[0].id).toBe('trophy-2');

      const sortInitialItem = document.querySelector('[data-psnine-sort="initial"]') as HTMLElement;
      sortInitialItem.click(); // restore initial order (trophy-1 then trophy-2)
      expect(table.querySelector('tbody')?.children[0].id).toBe('trophy-1');

      // T11: Click tips badge loads sanitized tips
      const tr1 = document.getElementById('trophy-1')!;
      const tipsBadge = tr1.querySelector('em.alert-success') as HTMLElement;
      tipsBadge.click();
      await new Promise(r => setTimeout(r, 60));

      const inlineTipRow = document.querySelector('.psnine-inline-tip-row');
      expect(inlineTipRow).not.toBeNull();
      expect(inlineTipRow?.querySelector('.mark')).not.toBeNull();

      // Blocked user and word: focusable reveal button
      expect(inlineTipRow?.querySelector('.psnine-filtered-tip-btn')).not.toBeNull();

      // Test spoiler reveal on click (uses global enhanceMasks class)
      const mark = inlineTipRow?.querySelector('.mark') as HTMLElement;
      mark.click();
      expect(mark.classList.contains('unmasked')).toBe(true);

      // T12: Batch queue abort
      const batchBtn = document.getElementById('psnine-batch-load-all-tips-btn') as HTMLElement;
      const stopBtn = document.getElementById('psnine-stop-batch-tips-btn') as HTMLElement;
      batchBtn.click();
      expect(stopBtn.style.display).toBe('inline-block');
      stopBtn.click(); // Abort!
      await new Promise(r => setTimeout(r, 50));
      expect(stopBtn.style.display).toBe('none');

      // Verify onContent preserves toolbar reference
      const toolbarRef = document.getElementById('psnine-trophy-tips-toolbar');
      if (onContentCb) (onContentCb as () => void)();
      expect(document.getElementById('psnine-trophy-tips-toolbar')).toBe(toolbarRef);

      if (cleanup) cleanup();
    });
  });
});
