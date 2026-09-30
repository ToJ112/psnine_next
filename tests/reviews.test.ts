import { describe, it, expect, vi } from 'vitest';
import {
  parseP9Timestamp,
  getISOWeekInfo,
  calculateReviewStats,
  calculateGaussianPdf,
  renderScoreDistributionSvg,
  renderTrendSvg,
  renderWeeklyHeatmapSvg,
  mountReviews,
  extractReviewItems,
  ReviewItem
} from '../src/features/reviews';
import { Context, defaultSettings } from '../src/core/types';
import { isHiddenByReason, setHidden } from '../src/core/dom';

describe('Reviews Feature Module (R01 - R06)', () => {
  describe('parseP9Timestamp & getISOWeekInfo', () => {
    it('parses standard YYYY-MM-DD HH:mm timestamp and validates calendar bounds', () => {
      const ts = parseP9Timestamp('2024-05-18 14:30');
      expect(ts).not.toBeNull();
      // Compare epoch/UTC not local getHours so CI works outside Shanghai
      expect(ts).toBe(Date.UTC(2024, 4, 18, 14 - 8, 30));
      const d = new Date(ts! + 8 * 3600 * 1000);
      expect(d.getUTCFullYear()).toBe(2024);
      expect(d.getUTCMonth()).toBe(4); // 0-indexed May
      expect(d.getUTCDate()).toBe(18);
      expect(d.getUTCHours()).toBe(14);
      expect(d.getUTCMinutes()).toBe(30);
    });

    it('validates leap years and non-leap years accurately', () => {
      // Leap year 2024-02-29 is valid
      expect(parseP9Timestamp('2024-02-29 12:00')).toBe(Date.UTC(2024, 1, 29, 12 - 8, 0));
      // Non-leap year 2023-02-29 is invalid
      expect(parseP9Timestamp('2023-02-29 12:00')).toBeNull();
      // April 31 is invalid (30 days)
      expect(parseP9Timestamp('2024-04-31 12:00')).toBeNull();
    });

    it('parses relative time formats and rejects invalid relative times', () => {
      const fixedNow = new Date('2024-05-18T12:00:00Z').getTime();
      const minTs = parseP9Timestamp('15分钟前', fixedNow);
      expect(minTs).toBe(fixedNow - 15 * 60 * 1000);

      const hourTs = parseP9Timestamp('2小时前', fixedNow);
      expect(hourTs).toBe(fixedNow - 2 * 3600 * 1000);

      const dayTs = parseP9Timestamp('3天前', fixedNow);
      expect(dayTs).toBe(fixedNow - 3 * 86400 * 1000);

      // Preserves HH:mm following 今天 / 昨天 / 前天
      const todayTs = parseP9Timestamp('今天 14:30', fixedNow);
      expect(todayTs).toBe(Date.UTC(2024, 4, 18, 14 - 8, 30));

      const yestTs = parseP9Timestamp('昨天 23:59', fixedNow);
      expect(yestTs).toBe(Date.UTC(2024, 4, 17, 23 - 8, 59));

      // Rejects invalid relative HH:mm (e.g. yesterday 25:99)
      expect(parseP9Timestamp('昨天 25:99', fixedNow)).toBeNull();
      expect(parseP9Timestamp('')).toBeNull();
    });

    it('normalizes 2025-12-29 Monday 00:30 Shanghai to ISO week 2026-W01', () => {
      // 2025-12-29 00:30 Shanghai time is Monday of the first ISO week of 2026
      const ts = parseP9Timestamp('2025-12-29 00:30');
      expect(ts).toBe(Date.UTC(2025, 11, 29, 0 - 8, 30));
      const info = getISOWeekInfo(ts!);
      expect(info.year).toBe(2026);
      expect(info.week).toBe(1);
      expect(info.weekKey).toBe('2026-W01');
    });

    it('calculates ISO week and handles year boundaries (R06)', () => {
      // 2024-01-01 is Monday, week 1 of 2024
      const info = getISOWeekInfo(new Date('2024-01-01T00:00:00Z').getTime());
      expect(info.year).toBe(2024);
      expect(info.week).toBe(1);
      expect(info.weekKey).toBe('2024-W01');
    });
  });

  describe('extractReviewItems with real reviews.html structure', () => {
    it('extracts date from second .meta and does NOT count subcomment scores', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul class="list">
          <li>
            <a class="l" href="https://psnine.com/psnid/darklaw233"><img src="avatar1.png" width="50" height="50"/></a>
            <div class="ml64">
              <div class="meta pb10">
                <a href="https://psnine.com/psnid/darklaw233" class="psnnode">darklaw233</a>
              </div>
              <div class="content pb10">大概率是实体单独一套杯</div>
              <div class="meta">
                <span>2024-10-28 15:56修改</span>
                北京
              </div>
            </div>
            <div class="sonlistmark ml64 mt10">
              <ul class="sonlist">
                <li>
                  <div class="meta"><span class="alert-success pd5">评分 1</span></div>
                  <div class="content">子评论打分不应被计入顶层评测</div>
                </li>
              </ul>
            </div>
          </li>
          <li>
            <a class="l" href="https://psnine.com/psnid/mastman429"><img src="avatar2.png" width="50" height="50"/></a>
            <div class="ml64">
              <div class="meta pb10">
                <a href="https://psnine.com/psnid/mastman429" class="psnnode">mastman429</a>
                <span class="alert-success pd5">评分 10</span>&nbsp;&nbsp;
              </div>
              <div class="content pb10">挑战7小时打完挑战</div>
              <div class="meta">
                <span>2024-11-10 04:02</span>
                广东
              </div>
            </div>
          </li>
        </ul>
      `;

      const items = extractReviewItems(container);
      expect(items.length).toBe(2);

      // Item 0: No top-level score, subcomment score 1 ignored, date parsed from second meta
      expect(items[0].score).toBeNull();
      expect(items[0].timeStr).toBe('2024-10-28 15:56');
      expect(items[0].timestamp).toBe(Date.UTC(2024, 9, 28, 15 - 8, 56));

      // Item 1: Score 10, date parsed from second meta
      expect(items[1].score).toBe(10);
      expect(items[1].timeStr).toBe('2024-11-10 04:02');
      expect(items[1].timestamp).toBe(Date.UTC(2024, 10, 10, 4 - 8, 2));

      // Stats: non-zero samples with timestamp, accurate first known timestamp
      const stats = calculateReviewStats(items);
      expect(stats.scoredCount).toBe(1);
      expect(stats.missingTimeCount).toBe(0);
      expect(stats.cumulativeTrend[0].time).toBe(Date.UTC(2024, 10, 10, 4 - 8, 2));
    });
  });

  describe('calculateReviewStats (R01, R02, R04, R05, R06)', () => {
    it('calculates correct mean, max bucket, and distribution', () => {
      const dummyEl = document.createElement('li');
      const items: ReviewItem[] = [
        { element: dummyEl, score: 8, timestamp: 1000000, timeStr: '2024-01-01 10:00' },
        { element: dummyEl, score: 9, timestamp: 2000000, timeStr: '2024-01-02 10:00' },
        { element: dummyEl, score: 9, timestamp: 3000000, timeStr: '2024-01-03 10:00' },
        { element: dummyEl, score: 10, timestamp: 4000000, timeStr: '2024-01-04 10:00' },
        { element: dummyEl, score: null, timestamp: 5000000, timeStr: '2024-01-05 10:00' }, // no score
      ];

      const stats = calculateReviewStats(items);
      expect(stats.totalLoaded).toBe(5);
      expect(stats.scoredCount).toBe(4);
      expect(stats.average).toBe(9.0); // (8 + 9 + 9 + 10) / 4 = 9.0
      expect(stats.maxScoreBucket).toBe(9); // score 9 has count 2
      expect(stats.distribution[8]).toBe(2); // score 9
      expect(stats.distribution[7]).toBe(1); // score 8
      expect(stats.distribution[9]).toBe(1); // score 10
      expect(stats.distribution[0]).toBe(0); // score 1
    });

    it('zero-variance protection does NOT produce NaN (R04)', () => {
      const dummyEl = document.createElement('li');
      // All reviews have identical score 10
      const items: ReviewItem[] = [
        { element: dummyEl, score: 10, timestamp: 1000000, timeStr: '2024-01-01' },
        { element: dummyEl, score: 10, timestamp: 2000000, timeStr: '2024-01-02' },
      ];

      const stats = calculateReviewStats(items);
      expect(stats.average).toBe(10);
      expect(stats.variance).toBe(0);
      expect(stats.stdDev).toBe(0);

      // Verify Gaussian PDF does not divide by zero or yield NaN
      const pdfAt10 = calculateGaussianPdf(10, stats.average, stats.stdDev);
      const pdfAt5 = calculateGaussianPdf(5, stats.average, stats.stdDev);
      expect(isNaN(pdfAt10)).toBe(false);
      expect(isNaN(pdfAt5)).toBe(false);
      expect(pdfAt10).toBe(1);
      expect(pdfAt5).toBe(0);

      const svg = renderScoreDistributionSvg(stats, true, null);
      expect(svg).not.toContain('NaN');
      expect(svg).toContain('<svg');
    });

    it('cumulative average trend is correctly computed (R05)', () => {
      const dummyEl = document.createElement('li');
      const items: ReviewItem[] = [
        { element: dummyEl, score: 6, timestamp: 1000, timeStr: 't1' },
        { element: dummyEl, score: 10, timestamp: 2000, timeStr: 't2' },
      ];

      const stats = calculateReviewStats(items);
      expect(stats.cumulativeTrend.length).toBe(2);
      expect(stats.cumulativeTrend[0].cumAvg).toBe(6.0);
      expect(stats.cumulativeTrend[1].cumAvg).toBe(8.0); // (6 + 10) / 2 = 8

      const svg = renderTrendSvg(stats);
      expect(svg).not.toContain('NaN');
      expect(svg).toContain('polyline');
    });

    it('fills intermediate empty weeks with 0 count and avoids extra future week (R06)', () => {
      const dummyEl = document.createElement('li');
      const tWeek1 = Date.UTC(2024, 0, 3, 10 - 8, 0); // 2024-01-03 Wednesday (Week 1)
      const tWeek3 = Date.UTC(2024, 0, 18, 10 - 8, 0); // 2024-01-18 Thursday (Week 3)
      const items: ReviewItem[] = [
        { element: dummyEl, score: 8, timestamp: tWeek1, timeStr: 'w1' },
        { element: dummyEl, score: 9, timestamp: tWeek3, timeStr: 'w3' },
      ];

      const stats = calculateReviewStats(items);
      // Week 2 should exist with count 0
      const weekKeys = stats.weeklyHeatmap.map(w => w.weekKey);
      expect(weekKeys).toEqual(['2024-W01', '2024-W02', '2024-W03']);
      const week2 = stats.weeklyHeatmap.find((w) => w.weekKey === '2024-W02');
      expect(week2).toBeDefined();
      expect(week2?.count).toBe(0);

      // Exactly 3 weeks, no artificial future trailing week like 2024-W04
      expect(stats.weeklyHeatmap.length).toBe(3);
    });

    it('renders weekly heatmap with <details> table for values without mouseover', () => {
      const dummyEl = document.createElement('li');
      const items: ReviewItem[] = [
        { element: dummyEl, score: 8, timestamp: Date.UTC(2024, 0, 3, 2, 0), timeStr: 'w1' }
      ];
      const stats = calculateReviewStats(items);
      const svg = renderWeeklyHeatmapSvg(stats);
      expect(svg).toContain('<details');
      expect(svg).toContain('查看每周热度数据表格');
      expect(svg).toContain('2024-W01');
    });
  });

  describe('mountReviews DOM Integration (R01 - R03)', () => {
    it('mounts ONLY on /psngame/:id/comment and rejects unrelated QA/topic routes', () => {
      document.body.innerHTML = `
        <div class="box">
          <span class="alert-success">评分 10</span>
        </div>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/qa/12345'),
        settings: { ...defaultSettings },
        store: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'test_user',
        onContent: vi.fn(),
        report: vi.fn()
      };

      const cleanup = mountReviews(ctx);
      expect(cleanup).toBeUndefined();
      expect(document.getElementById('psnine-enhanced-reviews-panel')).toBeNull();
    });

    it('mounts review panel and performs score filtering using setHidden (R03)', () => {
      document.body.innerHTML = `
        <div class="min-inner mt40">
          <div class="box">
            <ul class="list">
              <li id="rev-1">
                <div class="ml64">
                  <div class="meta pb10">
                    <span class="alert-success pd5">评分 8</span>
                    <span class="h-p">2024-01-01 10:00</span>
                  </div>
                  <div class="content">Great game!</div>
                </div>
              </li>
              <li id="rev-2">
                <div class="ml64">
                  <div class="meta pb10">
                    <span class="alert-success pd5">评分 10</span>
                    <span class="h-p">2024-01-02 10:00</span>
                  </div>
                  <div class="content">Masterpiece!</div>
                </div>
              </li>
              <li id="rev-3">
                <div class="ml64">
                  <div class="meta pb10">
                    <span class="h-p">2024-01-03 10:00</span>
                  </div>
                  <div class="content">No score comment</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame/12345/comment'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined)
        },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: vi.fn()
        },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = mountReviews(ctx);

      const panel = document.getElementById('psnine-enhanced-reviews-panel');
      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('均分 9 (2人打分 / 共3条)');

      const rev1 = document.getElementById('rev-1')!;
      const rev2 = document.getElementById('rev-2')!;
      const rev3 = document.getElementById('rev-3')!;

      // Click filter chip for score 8
      const chip8 = panel?.querySelector('.psnine-score-filter-chip[data-score="8"]') as HTMLElement;
      expect(chip8).not.toBeNull();
      chip8.click();

      // Rev 1 (score 8) should remain visible
      expect(isHiddenByReason(rev1, 'score-filter')).toBe(false);
      // Rev 2 (score 10) and Rev 3 (no score) should be hidden by 'score-filter'
      expect(isHiddenByReason(rev2, 'score-filter')).toBe(true);
      expect(isHiddenByReason(rev3, 'score-filter')).toBe(true);

      // Click clear filter button
      const clearBtn = document.getElementById('psnine-clear-score-filter-btn') as HTMLElement;
      expect(clearBtn).not.toBeNull();
      clearBtn.click();

      // All should be unhidden from score-filter
      expect(isHiddenByReason(rev1, 'score-filter')).toBe(false);
      expect(isHiddenByReason(rev2, 'score-filter')).toBe(false);
      expect(isHiddenByReason(rev3, 'score-filter')).toBe(false);

      if (typeof cleanup === 'function') cleanup();
      expect(document.getElementById('psnine-enhanced-reviews-panel')).toBeNull();
    });

    it('inherits active score filter independently of blocklist on dynamic updates', () => {
      document.body.innerHTML = `
        <div class="min-inner mt40">
          <div class="box">
            <ul class="list">
              <li id="r-1">
                <div class="ml64">
                  <div class="meta pb10"><span class="alert-success">评分 8</span></div>
                  <div class="content">Comment 1</div>
                  <div class="meta"><span>2024-01-01 10:00</span></div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      `;

      let subscriber: (root: ParentNode) => void = () => {};
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame/999/comment'),
        settings: { ...defaultSettings },
        store: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'test_user',
        onContent: vi.fn().mockImplementation((fn) => {
          subscriber = fn;
          return () => {};
        }),
        report: vi.fn()
      };

      const cleanup = mountReviews(ctx);
      const panel = document.getElementById('psnine-enhanced-reviews-panel');
      const chip8 = panel?.querySelector('.psnine-score-filter-chip[data-score="8"]') as HTMLElement;
      chip8.click();

      // r-1 has score 8, so score-filter is false. Now add blocklist reason
      const r1 = document.getElementById('r-1')!;
      setHidden(r1, 'blocklist', true);
      expect(isHiddenByReason(r1, 'blocklist')).toBe(true);
      expect(isHiddenByReason(r1, 'score-filter')).toBe(false);

      // Append new row r-2 with score 5
      const ul = document.querySelector('ul.list')!;
      const r2 = document.createElement('li');
      r2.id = 'r-2';
      r2.innerHTML = `
        <div class="ml64">
          <div class="meta pb10"><span class="alert-success">评分 5</span></div>
          <div class="content">Comment 2</div>
          <div class="meta"><span>2024-01-02 10:00</span></div>
        </div>
      `;
      ul.appendChild(r2);

      // Trigger onContent
      subscriber(r2);

      // r-2 should inherit score-filter=true because activeFilterScore is 8
      expect(isHiddenByReason(r2, 'score-filter')).toBe(true);
      // r-1 blocklist reason should remain intact
      expect(isHiddenByReason(r1, 'blocklist')).toBe(true);
      expect(isHiddenByReason(r1, 'score-filter')).toBe(false);

      if (typeof cleanup === 'function') cleanup();
    });
  });
});
