import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parsePrice,
  parseDateRange,
  isValidFxDate,
  getTodayShanghaiString,
  convertToCny,
  extractPromotionEvents,
  buildPricePointsFromEvents,
  buildPriceStepTimeline,
  generateStepPath,
  renderPriceHistorySvg,
  mountDeals,
  ExchangeRatesData,
  DealPromotionEvent
} from '../src/features/deals';
import { Context, defaultSettings } from '../src/core/types';
import { isHiddenByReason } from '../src/core/dom';

describe('Deals Feature Last-Mile Regressions (5 Audit Items + Final 3 Items)', () => {
  describe('Item 1 & Final 1: Price Parsing, Plus 0, Unknown Currency & Frozen Clock Date Validation', () => {
    it('parsePrice handles missing/invalid as null, and 0/免费 as 0', () => {
      expect(parsePrice(null)).toBeNull();

      const elEmpty = document.createElement('span');
      elEmpty.textContent = '   ';
      expect(parsePrice(elEmpty)).toBeNull();

      const elInvalid = document.createElement('span');
      elInvalid.textContent = '暂无定价 / 待定';
      expect(parsePrice(elInvalid)).toBeNull();

      const elNormal = document.createElement('span');
      elNormal.textContent = 'HK$148.50';
      expect(parsePrice(elNormal)).toBe(148.5);

      const elComma = document.createElement('span');
      elComma.textContent = '¥1,480.00';
      expect(parsePrice(elComma)).toBe(1480.0);

      const elFreeText = document.createElement('span');
      elFreeText.textContent = '会员免费';
      expect(parsePrice(elFreeText)).toBe(0);

      const elFreeZero = document.createElement('span');
      elFreeZero.textContent = 'HK$0.00';
      expect(parsePrice(elFreeZero)).toBe(0);
    });

    it('extractPromotionEvents keeps valid Plus 0 as 0 and does not overwrite with offPrice', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul>
          <li class="dd_box">
            <div class="dd_info">
              <p class="dd_text">活动：<a href="https://psnine.com/topic/100">会免活动</a></p>
              <p class="dd_text">港服</p>
              <p class="dd_text">20年10月14日 ~ 20年10月28日</p>
              <div class="dd_price">
                <s class="dd_price_old">HK$198.00</s>
                <span class="dd_price_off">HK$99.00</span>
                <span class="dd_price_plus">HK$0.00</span>
              </div>
            </div>
          </li>
        </ul>
      `;

      const events = extractPromotionEvents(container);
      expect(events.length).toBe(1);
      expect(events[0].offPrice).toBe(99.0);
      expect(events[0].plusPrice).toBe(0); // Valid Plus 0 must stay 0!
      expect(events[0].oldPrice).toBe(198.0);
    });

    it('extractPromotionEvents treats missing plusPrice as null (independent series)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul>
          <li class="dd_box">
            <div class="dd_info">
              <p class="dd_text">活动：<a href="https://psnine.com/topic/101">普通特惠</a></p>
              <p class="dd_text">港服</p>
              <p class="dd_text">20年10月14日 ~ 20年10月28日</p>
              <div class="dd_price">
                <s class="dd_price_old">HK$198.00</s>
                <span class="dd_price_off">HK$99.00</span>
              </div>
            </div>
          </li>
        </ul>
      `;

      const events = extractPromotionEvents(container);
      expect(events.length).toBe(1);
      expect(events[0].offPrice).toBe(99.0);
      expect(events[0].plusPrice).toBeNull(); // Missing Plus price is null!
    });

    it('extractPromotionEvents leaves unknown currency as null instead of defaulting to HKD', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul>
          <li class="dd_box">
            <div class="dd_info">
              <p class="dd_text">活动：<a href="https://psnine.com/topic/102">神秘区促销</a></p>
              <p class="dd_text">火星服</p>
              <p class="dd_text">20年10月14日 ~ 20年10月28日</p>
              <div class="dd_price">
                <span class="dd_price_off">100.00</span>
              </div>
            </div>
          </li>
        </ul>
      `;

      const events = extractPromotionEvents(container);
      expect(events.length).toBe(1);
      expect(events[0].currency).toBeNull(); // Unknown currency must remain null, NOT default HKD!
    });

    it('parseDateRange strictly validates calendar dates and chronological end >= start', () => {
      // Valid leap year date
      expect(parseDateRange('20年02月29日 ~ 20年03月05日')).not.toBeNull();

      // Non-leap year Feb 29 -> rejected
      expect(parseDateRange('21年02月29日 ~ 21年03月05日')).toBeNull();

      // Invalid month 13 -> rejected
      expect(parseDateRange('20年13月01日 ~ 20年13月10日')).toBeNull();

      // Invalid day (April 31 has 30 days) -> rejected
      expect(parseDateRange('20年04月31日 ~ 20年05月05日')).toBeNull();

      // Chronological end < start -> rejected
      expect(parseDateRange('20年10月28日 ~ 20年10月14日')).toBeNull();

      // Standard YYYY-MM-DD invalid calendar -> rejected
      expect(parseDateRange('2021-02-29 ~ 2021-03-05')).toBeNull();
      expect(parseDateRange('2020-10-20 ~ 2020-10-10')).toBeNull();
    });

    it('D01 only plots events of a single currency and product without mixing', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul>
          <li class="dd_box">
            <div class="dd_pic"><a href="/dd/PROD_A"></a></div>
            <div class="dd_info">
              <p class="dd_text">港服</p>
              <p class="dd_text">20年10月14日 ~ 20年10月28日</p>
              <div class="dd_price"><span class="dd_price_off">HK$66.00</span></div>
            </div>
          </li>
          <li class="dd_box">
            <div class="dd_pic"><a href="/dd/PROD_A"></a></div>
            <div class="dd_info">
              <p class="dd_text">日服</p>
              <p class="dd_text">20年11月01日 ~ 20年11月15日</p>
              <div class="dd_price"><span class="dd_price_off">¥1000</span></div>
            </div>
          </li>
        </ul>
      `;

      const allEvents = extractPromotionEvents(container);
      expect(allEvents.length).toBe(2);

      // buildPricePointsFromEvents filters to single target currency without mixing
      const points = buildPricePointsFromEvents(allEvents);
      expect(points.length).toBe(2); // Only PROD_A HKD events, JPY is excluded!
      expect(points[0].normalPrice).toBe(66.0);
    });

    it('frozen clock test: isValidFxDate strictly rejects tomorrow in Asia/Shanghai timezone', () => {
      // Freeze clock at 2026-09-30 15:30:00 Shanghai time (UTC 07:30)
      const frozenNow = new Date('2026-09-30T07:30:00Z');
      expect(getTodayShanghaiString(frozenNow)).toBe('2026-09-30');

      // Today in Shanghai -> accepted
      expect(isValidFxDate('2026-09-30', frozenNow)).toBe(true);

      // Yesterday -> accepted
      expect(isValidFxDate('2026-09-29', frozenNow)).toBe(true);

      // Tomorrow in Shanghai -> STRICTLY REJECTED (equality tomorrow is rejected)
      expect(isValidFxDate('2026-10-01', frozenNow)).toBe(false);

      // Distant future -> rejected
      expect(isValidFxDate('2026-10-02', frozenNow)).toBe(false);
      expect(isValidFxDate('2099-01-01', frozenNow)).toBe(false);

      // Invalid calendar day -> rejected
      expect(isValidFxDate('2026-02-29', frozenNow)).toBe(false);
    });
  });

  describe('Item 2 & Final 3: History SVG Step Path, Gap Flat, Terminal Recovery & Accessible Table', () => {
    it('renders step path with horizontal baseline on gap, not diagonal ramp', () => {
      const event1: DealPromotionEvent = {
        title: '秋季特惠',
        region: '港服',
        startDate: '2020-10-14',
        endDate: '2020-10-28',
        startTime: Date.UTC(2020, 9, 14),
        endTime: Date.UTC(2020, 9, 28),
        oldPrice: 148.0,
        offPrice: 66.6,
        plusPrice: 66.6,
        currency: 'HKD',
        isBest: false
      };

      const event2: DealPromotionEvent = {
        title: '冬季特惠',
        region: '港服',
        startDate: '2020-12-01',
        endDate: '2020-12-15',
        startTime: Date.UTC(2020, 11, 1),
        endTime: Date.UTC(2020, 11, 15),
        oldPrice: 148.0,
        offPrice: 50.0,
        plusPrice: 50.0,
        currency: 'HKD',
        isBest: true
      };

      const timeline = buildPriceStepTimeline([event1, event2]);
      // Expect 4 intervals: event1, gap interval at oldPrice 148, event2, terminal recovery to 148
      expect(timeline.length).toBe(4);
      expect(timeline[0].normalPrice).toBe(66.6);
      expect(timeline[1].normalPrice).toBe(148.0); // Baseline old price!
      expect(timeline[2].normalPrice).toBe(50.0);
      expect(timeline[3].normalPrice).toBe(148.0); // Final event terminal recovery to oldPrice!

      const svgHtml = renderPriceHistorySvg([], 'HK$', [event1, event2]);
      expect(svgHtml).toContain('<path d="M');
      expect(svgHtml).not.toContain('<polyline'); // Polyline ramp eliminated!
      expect(svgHtml).toContain('H'); // Horizontal steps
      expect(svgHtml).toContain('V'); // Vertical steps
    });

    it('proves terminal normal and Plus price recover to oldPrice for single event and last event', () => {
      const singleEvent: DealPromotionEvent = {
        title: '独家特惠',
        region: '港服',
        startDate: '2020-10-14',
        endDate: '2020-10-28',
        startTime: Date.UTC(2020, 9, 14),
        endTime: Date.UTC(2020, 9, 28),
        oldPrice: 148.0,
        offPrice: 66.6,
        plusPrice: 50.0,
        currency: 'HKD',
        isBest: false
      };

      const timeline = buildPriceStepTimeline([singleEvent]);
      expect(timeline.length).toBe(2);

      // Interval 0: during promotion
      expect(timeline[0].normalPrice).toBe(66.6);
      expect(timeline[0].plusPrice).toBe(50.0);
      expect(timeline[0].startDate).toBe('2020-10-14');
      expect(timeline[0].endDate).toBe('2020-10-29');

      // Terminal interval: next-day terminal recovery point is shown
      const terminal = timeline[1];
      expect(terminal.normalPrice).toBe(148.0); // Recovered to oldPrice, not promo!
      expect(terminal.plusPrice).toBe(148.0); // Plus also recovered to oldPrice!
      expect(terminal.startDate).toBe('2020-10-29');
      expect(terminal.tStart).toBe(terminal.tEnd); // Zero-duration terminal boundary

      // SVG path contains vertical step up to oldPrice
      const svg = renderPriceHistorySvg([], 'HK$', [singleEvent]);
      expect(svg).toContain('<path d="M');
      expect(svg).toContain('V');
    });

    it('terminal recovery remains unknown when oldPrice is null', () => {
      const eventNoOld: DealPromotionEvent = {
        title: '无原价活动',
        region: '港服',
        startDate: '2020-10-14',
        endDate: '2020-10-28',
        startTime: Date.UTC(2020, 9, 14),
        endTime: Date.UTC(2020, 9, 28),
        oldPrice: null, // Unknown recovery!
        offPrice: 66.6,
        plusPrice: 66.6,
        currency: 'HKD',
        isBest: false
      };

      const timeline = buildPriceStepTimeline([eventNoOld]);
      expect(timeline.length).toBe(1); // No terminal recovery interval created
      expect(timeline[0].normalPrice).toBe(66.6);
    });

    it('handles nested overlap: recovers at max end boundary using winning outer event oldPrice', () => {
      // Event A: Jan 1 - Jan 10 (outer long event)
      const eventA: DealPromotionEvent = {
        title: '新年大促',
        region: '港服',
        startDate: '2021-01-01',
        endDate: '2021-01-10',
        startTime: Date.UTC(2021, 0, 1),
        endTime: Date.UTC(2021, 0, 10),
        oldPrice: 150.0,
        offPrice: 60.0,
        plusPrice: 60.0,
        currency: 'HKD',
        isBest: false
      };

      // Event B: Jan 3 - Jan 4 (nested short event, completely within A)
      const eventB: DealPromotionEvent = {
        title: '周末闪购',
        region: '港服',
        startDate: '2021-01-03',
        endDate: '2021-01-04',
        startTime: Date.UTC(2021, 0, 3),
        endTime: Date.UTC(2021, 0, 4),
        oldPrice: 120.0,
        offPrice: 40.0,
        plusPrice: 40.0,
        currency: 'HKD',
        isBest: true
      };

      const timeline = buildPriceStepTimeline([eventA, eventB]);
      // Intervals must be strictly ordered chronologically without retrogression
      expect(timeline.length).toBe(4);
      expect(timeline[0].startDate).toBe('2021-01-01');
      expect(timeline[0].normalPrice).toBe(60.0);

      expect(timeline[1].startDate).toBe('2021-01-03');
      expect(timeline[1].normalPrice).toBe(40.0);

      expect(timeline[2].startDate).toBe('2021-01-05');
      expect(timeline[2].normalPrice).toBe(60.0);

      const terminal = timeline[3];
      expect(terminal.startDate).toBe('2021-01-11');
      expect(terminal.normalPrice).toBe(150.0); // Recovers to A's oldPrice (150), NOT B's (120)!
      expect(terminal.plusPrice).toBe(150.0);
      expect(terminal.tStart).toBe(Date.UTC(2021, 0, 11));

      // Verify intervals are strictly chronological
      for (let i = 0; i < timeline.length - 1; i++) {
        expect(timeline[i].tEnd).toBeLessThanOrEqual(timeline[i + 1].tStart);
      }

      // Chart SVG must scale to maxTime of Jan 11, not Jan 5
      const svg = renderPriceHistorySvg([], 'HK$', [eventA, eventB]);
      expect(svg).toContain('2021-01-11');
    });

    it('latest active event wins during overlapping promotion periods', () => {
      const event1: DealPromotionEvent = {
        title: '全店折扣',
        region: '港服',
        startDate: '2020-10-14',
        endDate: '2020-10-28',
        startTime: Date.UTC(2020, 9, 14),
        endTime: Date.UTC(2020, 9, 28),
        oldPrice: 100.0,
        offPrice: 60.0,
        plusPrice: 60.0,
        currency: 'HKD',
        isBest: false
      };

      // Event 2 starts on Oct 20 while Event 1 is still running
      const event2: DealPromotionEvent = {
        title: '限时闪购',
        region: '港服',
        startDate: '2020-10-20',
        endDate: '2020-11-05',
        startTime: Date.UTC(2020, 9, 20),
        endTime: Date.UTC(2020, 10, 5),
        oldPrice: 100.0,
        offPrice: 30.0,
        plusPrice: 20.0,
        currency: 'HKD',
        isBest: true
      };

      const timeline = buildPriceStepTimeline([event1, event2]);
      // Segment 1 (Oct 14 - Oct 20): price 60
      expect(timeline[0].normalPrice).toBe(60.0);
      // Segment 2 (Oct 20 onwards): Event 2 wins overlap with price 30!
      expect(timeline[1].normalPrice).toBe(30.0);
      expect(timeline[1].plusPrice).toBe(20.0);
    });

    it('handles oldPrice unknown as a gap rather than dropping to 0 or baseline', () => {
      const event1: DealPromotionEvent = {
        title: '早期活动',
        region: '港服',
        startDate: '2020-10-14',
        endDate: '2020-10-28',
        startTime: Date.UTC(2020, 9, 14),
        endTime: Date.UTC(2020, 9, 28),
        oldPrice: null, // Unknown recovery!
        offPrice: 66.6,
        plusPrice: 66.6,
        currency: 'HKD',
        isBest: false
      };

      const event2: DealPromotionEvent = {
        title: '后期活动',
        region: '港服',
        startDate: '2020-12-01',
        endDate: '2020-12-15',
        startTime: Date.UTC(2020, 11, 1),
        endTime: Date.UTC(2020, 11, 15),
        oldPrice: null,
        offPrice: 50.0,
        plusPrice: 50.0,
        currency: 'HKD',
        isBest: false
      };

      const timeline = buildPriceStepTimeline([event1, event2]);
      expect(timeline.length).toBe(3);
      expect(timeline[1].normalPrice).toBeNull(); // Gap between events!

      const getX = (t: number) => t / 1000000;
      const getY = (p: number) => p;
      const pathD = generateStepPath(timeline, getX, getY, seg => seg.normalPrice);

      // Must break into two M subpaths with no line drawn across the gap!
      const mMatches = pathD.match(/M /g);
      expect(mMatches?.length).toBe(2);
    });

    it('includes an accessible keyboard-navigable data table with escaped strings', () => {
      const event: DealPromotionEvent = {
        title: '<特惠> "双11" & 圣诞',
        region: '港服',
        startDate: '2020-10-14',
        endDate: '2020-10-28',
        startTime: Date.UTC(2020, 9, 14),
        endTime: Date.UTC(2020, 9, 28),
        oldPrice: 148.0,
        offPrice: 66.6,
        plusPrice: 0, // Plus 0
        currency: 'HKD',
        isBest: true
      };

      const html = renderPriceHistorySvg([], 'HK$<script>', [event]);
      // Escaping test
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;特惠&gt;');
      expect(html).toContain('&amp;');

      // Data table test
      expect(html).toContain('<table class="psnine-price-history-table"');
      expect(html).toContain('scope="col"');
      expect(html).toContain('免费 (0.00)');
    });
  });

  describe('Item 3 & Final 1: FX Strict Validation, Freshness & Touchscreen Visible FX Status', () => {
    it('rejects invalid or future dates and invalid rates even if request succeeded', () => {
      expect(isValidFxDate('2099-01-01')).toBe(false); // Future date
      expect(isValidFxDate('2021-02-29')).toBe(false); // Invalid calendar
      expect(isValidFxDate('invalid-date')).toBe(false);

      const futureRates: ExchangeRatesData = {
        base: 'CNY',
        date: '2099-01-01',
        rates: { HKD: 1.10 }
      };
      expect(convertToCny(100, 'HKD', futureRates)).toBeNull();

      const nonCnyRates: ExchangeRatesData = {
        base: 'USD',
        date: '2026-09-29',
        rates: { HKD: 7.8 }
      };
      expect(convertToCny(100, 'HKD', nonCnyRates)).toBeNull();

      const negativeRates: ExchangeRatesData = {
        base: 'CNY',
        date: '2026-09-29',
        rates: { HKD: -1.1 }
      };
      expect(convertToCny(100, 'HKD', negativeRates)).toBeNull();

      // Negative or NaN amount
      expect(convertToCny(-10, 'HKD', null)).toBeNull();
      expect(convertToCny(NaN, 'HKD', null)).toBeNull();
    });

    it('marks rates older than 7 days as expired and visible in badge text and title', () => {
      const staleRates: ExchangeRatesData = {
        base: 'CNY',
        date: '2026-08-01', // > 7 days ago
        rates: { HKD: 1.10 }
      };

      const res = convertToCny(100, 'HKD', staleRates, {}, '', new Date('2026-09-30T00:00:00Z'));
      expect(res).not.toBeNull();
      expect(res?.isExpired).toBe(true);
      expect(res?.badgeText).toContain('[已过期]');
      expect(res?.titleText).toContain('已过期');
      expect(res?.titleText).toContain('2026-08-01');
    });

    it('enforces same strict date validation and expiry on manual fallback rates', () => {
      // Future manual date -> rejected
      expect(convertToCny(100, 'HKD', null, { HKD: 0.9 }, '2099-01-01')).toBeNull();

      // Invalid manual calendar date -> rejected
      expect(convertToCny(100, 'HKD', null, { HKD: 0.9 }, '2021-02-29')).toBeNull();

      // Stale manual date -> marked expired
      const staleManual = convertToCny(100, 'HKD', null, { HKD: 0.9 }, '2026-08-01', new Date('2026-09-30T00:00:00Z'));
      expect(staleManual?.isExpired).toBe(true);
      expect(staleManual?.badgeText).toContain('[已过期]');
      expect(staleManual?.titleText).toContain('用户设置汇率');
    });

    it('renders touchscreen-readable visible FX status in control bar for live, manual and expired rates', async () => {
      document.body.innerHTML = `
        <div class="box">
          <ul class="dd_ul">
            <li class="dd_box">
              <div class="dd_info">
                <p class="dd_text">港服</p>
                <div class="dd_price"><span class="dd_price_off">HK$100.00</span></div>
              </div>
            </li>
          </ul>
        </div>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/dd'),
        settings: {
          ...defaultSettings,
          currencyConversion: true,
          exchangeRates: { HKD: 0.92 },
          exchangeRateDate: '2026-08-01' // Stale manual rate
        },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), remove: vi.fn() },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: vi.fn().mockRejectedValue(new Error('Network error'))
        },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      mountDeals(ctx);

      // Wait microtask for loadRates rejection and fallback
      await new Promise((r) => setTimeout(r, 10));

      const fxStatus = document.getElementById('psnine-fx-status') as HTMLElement;
      expect(fxStatus).not.toBeNull();
      // Verifies compact visible text on mobile without requiring title hover!
      expect(fxStatus.textContent).toContain('汇率: 用户设置');
      expect(fxStatus.textContent).toContain('2026-08-01');
      expect(fxStatus.textContent).toContain('已过期');
      expect(fxStatus.style.color).toBe('rgb(224, 49, 49)'); // Expired color #e03131
    });
  });

  describe('Item 4: Legacy /huodong & /dd Listing Title Disambiguation', () => {
    it('processes legacy /huodong fixture: converts store_price children and filters store_tag_best', async () => {
      const fixturePath = resolve(__dirname, 'fixtures/deals-legacy-huodong.html');
      const fixtureHtml = readFileSync(fixturePath, 'utf8');
      document.body.innerHTML = fixtureHtml;

      const mockRates: ExchangeRatesData = {
        base: 'CNY',
        date: '2026-09-29',
        rates: { HKD: 1.10 }
      };

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/huodong'),
        settings: { ...defaultSettings, currencyConversion: true },
        store: {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined)
        },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: vi.fn().mockResolvedValue(mockRates)
        },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      mountDeals(ctx);
      await new Promise((r) => setTimeout(r, 10));

      const storeBox1 = document.getElementById('store-deal-1')!;
      const storeBox2 = document.getElementById('store-deal-2')!;

      // Converted badges added to store_price children
      const badges1 = storeBox1.querySelectorAll('.psnine-cny-badge');
      expect(badges1.length).toBe(3); // <s>, <span>, <em>

      // D04: Title colored
      const titleLink = storeBox1.querySelector('.store_title a') as HTMLElement;
      expect(titleLink.style.color).toBe('rgb(253, 126, 20)'); // #fd7e14 for 50%

      // D05: Best deal toggle
      const bestBtn = document.getElementById('psnine-toggle-best-deal-btn') as HTMLElement;
      bestBtn.click();
      expect(isHiddenByReason(storeBox1, 'best-deal-filter')).toBe(false); // Has store_tag_best
      expect(isHiddenByReason(storeBox2, 'best-deal-filter')).toBe(true); // No store_tag_best
    });

    it('does NOT color activity link as game title on /dd listing', async () => {
      document.body.innerHTML = `
        <div class="box">
          <ul class="dd_ul">
            <li class="dd_box" id="real-listing-box">
              <div class="dd_pic">
                <div class="dd_tag_plus">省75%</div>
              </div>
              <div class="dd_info">
                <h4 class="dd_title mb10"><a href="/dd/123" id="game-title-link">地平线 零之曙光</a></h4>
                <p class="dd_text">活动：<a href="/topic/35613" id="activity-topic-link">HK$148以下折扣游戏</a></p>
                <p class="dd_text">港服</p>
                <div class="dd_price"><span class="dd_price_off">HK$37.00</span></div>
              </div>
            </li>
          </ul>
        </div>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/dd'),
        settings: { ...defaultSettings, currencyConversion: false },
        store: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      mountDeals(ctx);

      const gameTitleLink = document.getElementById('game-title-link') as HTMLElement;
      const activityTopicLink = document.getElementById('activity-topic-link') as HTMLElement;

      // Game title MUST be colored!
      expect(gameTitleLink.style.color).toBe('rgb(250, 82, 82)'); // #fa5252
      // Activity link MUST NOT be painted!
      expect(activityTopicLink.style.color).not.toBe('rgb(250, 82, 82)');
    });
  });

  describe('Item 5 & Final 2: Immediate Controls, Synchronous Cleanup & In-flight Cancel', () => {
    it('initial currencyConversion=true renders controls immediately and returns cleanup without FX wait', async () => {
      document.body.innerHTML = `
        <div class="box">
          <ul class="dd_ul">
            <li class="dd_box">
              <div class="dd_info">
                <p class="dd_text">港服</p>
                <div class="dd_price"><span class="dd_price_off">HK$100.00</span></div>
              </div>
            </li>
          </ul>
        </div>
      `;

      let resolveFetch: ((val: any) => void) | null = null;
      const mockSet = vi.fn();
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/dd'),
        settings: { ...defaultSettings, currencyConversion: true }, // Default enabled!
        store: { get: vi.fn().mockResolvedValue(null), set: mockSet, remove: vi.fn() },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: vi.fn().mockImplementation(() => new Promise((resolve) => {
            resolveFetch = resolve;
          }))
        },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      // mountDeals returns cleanup synchronously even with FX pending!
      const cleanup = mountDeals(ctx);
      expect(typeof cleanup).toBe('function');

      // Controls are rendered immediately, NOT blocked by slow FX!
      const controlBar = document.getElementById('psnine-deals-controls-bar');
      expect(controlBar).not.toBeNull();
      const bestBtn = document.getElementById('psnine-toggle-best-deal-btn');
      expect(bestBtn).not.toBeNull();
      const cnyBtn = document.getElementById('psnine-toggle-cny-btn');
      expect(cnyBtn).not.toBeNull();

      // Trigger cleanup before fetch resolves (e.g. pagehide / quick navigation)
      if (typeof cleanup === 'function') cleanup();

      // Verify buttons are detached / disabled upon cleanup
      expect((bestBtn as HTMLButtonElement).onclick).toBeNull();
      expect((cnyBtn as HTMLButtonElement).onclick).toBeNull();

      // Now resolve the in-flight fetch
      if (resolveFetch) {
        (resolveFetch as (val: any) => void)({
          base: 'CNY',
          date: '2026-09-29',
          rates: { HKD: 1.10 }
        });
      }

      await new Promise((r) => setTimeout(r, 10));

      // Post-cleanup check: store.set was NOT called, and DOM badges were not finalized
      expect(mockSet).not.toHaveBeenCalled();
      const badge = document.querySelector('.psnine-cny-badge');
      expect(badge?.textContent).not.toContain('约 ¥');
    });

    it('coalesces concurrent load requests when currency conversion is toggled rapidly', async () => {
      document.body.innerHTML = `
        <div class="box">
          <ul class="dd_ul">
            <li class="dd_box">
              <div class="dd_info">
                <p class="dd_text">港服</p>
                <div class="dd_price"><span class="dd_price_off">HK$100.00</span></div>
              </div>
            </li>
          </ul>
        </div>
      `;

      let resolveFetch: ((val: any) => void) | null = null;
      const jsonMock = vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveFetch = resolve;
      }));

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/dd'),
        settings: { ...defaultSettings, currencyConversion: false },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), remove: vi.fn() },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: jsonMock
        },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      mountDeals(ctx);

      const cnyBtn = document.getElementById('psnine-toggle-cny-btn') as HTMLElement;
      // Click toggle to turn on
      cnyBtn.click();
      await new Promise((r) => setTimeout(r, 0));

      // Click toggle again while load is still in-flight
      cnyBtn.click();
      await new Promise((r) => setTimeout(r, 0));

      // Only one network call initiated due to coalescing
      expect(jsonMock).toHaveBeenCalledTimes(1);

      if (resolveFetch) {
        (resolveFetch as (val: any) => void)({
          base: 'CNY',
          date: '2026-09-29',
          rates: { HKD: 1.10 }
        });
      }
      await new Promise((r) => setTimeout(r, 10));
    });

    it('does not create duplicate badges on multiple content updates or toggle clicks', async () => {
      document.body.innerHTML = `
        <div class="box">
          <ul class="dd_ul">
            <li class="dd_box">
              <div class="dd_info">
                <p class="dd_text">港服</p>
                <div class="dd_price"><span class="dd_price_off">HK$100.00</span></div>
              </div>
            </li>
          </ul>
        </div>
      `;

      let onContentCb: (() => void) | null = null;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/dd'),
        settings: { ...defaultSettings, currencyConversion: true },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), remove: vi.fn() },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: vi.fn().mockResolvedValue({
            base: 'CNY',
            date: '2026-09-29',
            rates: { HKD: 1.10 }
          })
        },
        userId: 'test_user',
        onContent: vi.fn().mockImplementation((cb) => {
          onContentCb = cb;
          return () => {};
        }),
        report: vi.fn()
      };

      mountDeals(ctx);
      await new Promise((r) => setTimeout(r, 10));

      let badges = document.querySelectorAll('.psnine-cny-badge');
      expect(badges.length).toBe(1);

      // Trigger dynamic content callback twice
      if (onContentCb) {
        (onContentCb as () => void)();
        (onContentCb as () => void)();
      }
      badges = document.querySelectorAll('.psnine-cny-badge');
      expect(badges.length).toBe(1); // Still exactly 1, no duplicate!

      // Toggle currency button off and on
      const cnyBtn = document.getElementById('psnine-toggle-cny-btn') as HTMLElement;
      cnyBtn.click();
      cnyBtn.click();
      badges = document.querySelectorAll('.psnine-cny-badge');
      expect(badges.length).toBe(1); // Still exactly 1!
    });
  });
});
