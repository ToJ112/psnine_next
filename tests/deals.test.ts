import { describe, it, expect, vi } from 'vitest';
import {
  getDiscountColor,
  parseDateRange,
  convertToCny,
  extractPromotionEvents,
  buildPricePointsFromEvents,
  renderPriceHistorySvg,
  mountDeals,
  ExchangeRatesData
} from '../src/features/deals';
import { Context, defaultSettings } from '../src/core/types';
import { isHiddenByReason } from '../src/core/dom';

describe('Deals Feature Module (D01 - D05)', () => {
  describe('getDiscountColor (D04)', () => {
    it('returns continuous gradient colors across discount spectrum', () => {
      expect(getDiscountColor(15)).toBe('#4dabf7');
      expect(getDiscountColor(45)).toBe('#20c997');
      expect(getDiscountColor(60)).toBe('#fd7e14');
      expect(getDiscountColor(75)).toBe('#fa5252');
      expect(getDiscountColor(90)).toBe('#e03131');
    });
  });

  describe('parseDateRange & extractPromotionEvents (D01)', () => {
    it('parses Chinese date range correctly into timestamps', () => {
      const range = parseDateRange('20年10月14日 ~ 20年10月28日');
      expect(range).not.toBeNull();
      expect(range?.start).toBe('2020-10-14');
      expect(range?.end).toBe('2020-10-28');
      expect(range?.startTime).toBeLessThan(range?.endTime || 0);
    });

    it('extracts promotion events and builds price points with price recovery', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <ul>
          <li class="dd_box">
            <div class="dd_status dd_status_best">史低</div>
            <div class="dd_info">
              <p class="dd_text">活动：<a href="#">优惠活动A</a></p>
              <p class="dd_text">港服</p>
              <p class="dd_text">20年10月14日 ~ 20年10月28日</p>
              <div class="dd_price">
                <s class="dd_price_old">HK$148.00</s>
                <span class="dd_price_off">HK$66.60</span>
                <span class="dd_price_plus">HK$66.60</span>
              </div>
            </div>
          </li>
        </ul>
      `;

      const events = extractPromotionEvents(container);
      expect(events.length).toBe(1);
      expect(events[0].oldPrice).toBe(148.0);
      expect(events[0].offPrice).toBe(66.6);
      expect(events[0].currency).toBe('HKD');
      expect(events[0].isBest).toBe(true);

      const points = buildPricePointsFromEvents(events);
      // Expect 3 points: promotion start (66.6), promotion end (66.6), recovery (148.0)
      expect(points.length).toBe(3);
      expect(points[0].normalPrice).toBe(66.6);
      expect(points[1].normalPrice).toBe(66.6);
      expect(points[2].normalPrice).toBe(148.0); // Recovered!
    });
  });

  describe('convertToCny (D02, D03)', () => {
    it('converts foreign currency using reciprocal Frankfurter rate with validation', () => {
      const mockRates: ExchangeRatesData = {
        base: 'CNY',
        date: '2026-09-29',
        rates: {
          HKD: 1.10, // 1 CNY = 1.10 HKD => 1 HKD = ~0.909 CNY
          USD: 0.14,
          JPY: 20.0
        }
      };

      const resHkd = convertToCny(100, 'HKD', mockRates);
      expect(resHkd).not.toBeNull();
      expect(resHkd?.convertedAmount).toBeCloseTo(90.91, 1);
      expect(resHkd?.formattedCny).toBe('¥90.91');
      expect(resHkd?.sourceDate).toBe('2026-09-29');

      // JPY conversion
      const resJpy = convertToCny(1000, 'JPY', mockRates);
      expect(resJpy?.convertedAmount).toBe(50.0);

      // CNY requires no conversion
      const resCny = convertToCny(100, 'CNY', mockRates);
      expect(resCny?.convertedAmount).toBe(100);
      expect(resCny?.sourceName).toContain('原币种');
    });

    it('rejects manual rate without a date and handles stale cache', () => {
      // Manual rate with date
      const validManual = convertToCny(100, 'HKD', null, { HKD: 0.93 }, '2026-08-01');
      expect(validManual?.isStaleOrFallback).toBe(true);
      expect(validManual?.sourceDate).toBe('2026-08-01');

      // Manual rate without date -> rejected
      const noDateManual = convertToCny(100, 'HKD', null, { HKD: 0.93 }, '');
      expect(noDateManual).toBeNull();
    });
  });

  describe('mountDeals DOM Integration (D01 - D05)', () => {
    it('applies title coloring, converts all prices, filters best, and marks data-psnine-next', async () => {
      document.body.innerHTML = `
        <div class="min-inner">
          <div class="box">
            <ul class="dd_list">
              <li class="dd_box" id="deal-1">
                <div class="dd_pic">
                  <div class="dd_tag_plus">省75%</div>
                </div>
                <div class="dd_status dd_status_best">史低</div>
                <div class="dd_info">
                  <p class="dd_text"><a href="#" id="title-link-1">游戏A</a></p>
                  <p class="dd_text">港服</p>
                  <p class="dd_text">20年10月14日 ~ 20年10月28日</p>
                  <div class="dd_price">
                    <s class="dd_price_old">HK$100.00</s>
                    <span class="dd_price_off">HK$25.00</span>
                    <span class="dd_price_plus">HK$20.00</span>
                  </div>
                </div>
              </li>
              <li class="dd_box" id="deal-2">
                <div class="dd_pic">
                  <div class="dd_tag_plus">省30%</div>
                </div>
                <div class="dd_info">
                  <p class="dd_text"><a href="#" id="title-link-2">游戏B</a></p>
                  <p class="dd_text">港服</p>
                  <div class="dd_price">
                    <span class="dd_price_off">HK$200.00</span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      `;

      let onContentCallback: (() => void) | null = null;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/dd'),
        settings: { ...defaultSettings, currencyConversion: true },
        store: {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined)
        },
        http: {
          text: vi.fn(),
          document: vi.fn(),
          json: vi.fn().mockResolvedValue({
            base: 'CNY',
            date: '2026-09-30',
            rates: { HKD: 1.10 }
          })
        },
        userId: 'test_user',
        onContent: vi.fn().mockImplementation((fn) => {
          onContentCallback = fn;
          return () => {};
        }),
        report: vi.fn()
      };

      await mountDeals(ctx);

      const deal1 = document.getElementById('deal-1')!;
      const deal2 = document.getElementById('deal-2')!;

      // D04: Title link should be colored by discount!
      const titleLink1 = document.getElementById('title-link-1') as HTMLElement;
      expect(titleLink1.style.color).toBe('rgb(250, 82, 82)'); // #fa5252 for 75%

      // D02: All prices (old, off, plus) should have converted badges
      const cnyBadges = deal1.querySelectorAll('.psnine-cny-badge');
      expect(cnyBadges.length).toBe(3); // old, off, plus

      // D05: Best-only filter
      const bestBtn = document.getElementById('psnine-toggle-best-deal-btn') as HTMLElement;
      expect(bestBtn).not.toBeNull();
      expect(bestBtn.hasAttribute('data-psnine-next')).toBe(true);

      bestBtn.click();
      expect(isHiddenByReason(deal1, 'best-deal-filter')).toBe(false);
      expect(isHiddenByReason(deal2, 'best-deal-filter')).toBe(true);

      // Verify newly appended row inherits active best-only filter
      const newDealBox = document.createElement('li');
      newDealBox.className = 'dd_box';
      newDealBox.id = 'deal-3';
      newDealBox.innerHTML = `
        <div class="dd_info"><p class="dd_text">港服</p><div class="dd_price"><span class="dd_price_off">HK$50</span></div></div>
      `; // Not best
      deal1.parentElement?.appendChild(newDealBox);

      if (onContentCallback) {
        (onContentCallback as () => void)();
      }
      expect(isHiddenByReason(newDealBox, 'best-deal-filter')).toBe(true);
    });
  });
});
