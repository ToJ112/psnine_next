/**
 * psnine_next - Deals Feature Module (D01 - D05)
 *
 * Implements:
 * D01: 普通/Plus 价格历史 (单商品/单游戏页双序列、促销起止和原价恢复，真实.dd_box历史数据，按时间比例尺)
 * D02: 数折人民币换算 (HKD/USD/GBP/JPY，标注汇率日期与来源，全价格换算，安全DOM，毫秒TTL，不可用显式提示)
 * D03: 活动人民币切换 (支持/huodong与.store_box/.store_price，保留原价)
 * D04: 折扣幅度着色 (标题与tag连续色阶着色)
 * D05: 数折与活动只看史低 (同时支持.dd_status_best与/huodong的.store_tag_best，筛选可复原，新增行继承)
 */

import { Context, Mount, Cleanup } from '../core/types';
import { setHidden } from '../core/dom';

export interface DealPromotionEvent {
  title: string;
  region: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  oldPrice: number | null;
  offPrice: number | null;
  plusPrice: number | null;
  currency: string | null;
  isBest: boolean;
  productId?: string | null;
}

export interface ExchangeRatesData {
  base: string; // 'CNY'
  date: string; // 'YYYY-MM-DD'
  rates: Record<string, number>; // 1 CNY = X Foreign
}

export interface CurrencyConversionResult {
  convertedAmount: number;
  formattedCny: string;
  sourceDate: string;
  sourceName: string;
  isStaleOrFallback: boolean;
  isExpired: boolean;
  badgeText: string;
  titleText: string;
}

export interface PriceInterval {
  tStart: number;
  tEnd: number;
  startDate: string;
  endDate: string;
  normalPrice: number | null;
  plusPrice: number | null;
}

export const ONE_DAY_MS = 24 * 3600 * 1000;
export const MAX_FRESHNESS_MS = 7 * ONE_DAY_MS;

/**
 * Escapes XML/HTML characters for safe insertion into SVG and DOM.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats current date string in Asia/Shanghai timezone (YYYY-MM-DD).
 */
export function getTodayShanghaiString(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

/**
 * Validates whether a date string is valid calendar YYYY-MM-DD and not in the future (strictly <= today in Shanghai).
 */
export function isValidFxDate(dateStr: string | null | undefined, now = new Date()): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!isValidCalendarDate(y, m, d)) return false;

  const todayStr = getTodayShanghaiString(now);
  // Strictly reject future calendar dates (including tomorrow)
  if (dateStr > todayStr) {
    return false;
  }
  return true;
}

/**
 * Validates actual calendar date (e.g. leap years, month length).
 */
export function isValidCalendarDate(year: number, month1Based: number, day: number): boolean {
  if (year < 1990 || year > 2100) return false;
  if (month1Based < 1 || month1Based > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month1Based - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month1Based &&
    d.getUTCDate() === day
  );
}

/**
 * Continuous color mapping for discount percentage (D04).
 */
export function getDiscountColor(percent: number): string {
  if (percent <= 0) return '#868e96';
  if (percent < 30) return '#4dabf7';
  if (percent < 50) return '#20c997';
  if (percent < 70) return '#fd7e14';
  if (percent < 85) return '#fa5252';
  return '#e03131';
}

/**
 * Parses numeric price from Element or text.
 * Missing / invalid text returns null (not 0).
 * Free ("免费" or 0) returns 0.
 */
export function parsePrice(el: Element | null): number | null {
  if (!el) return null;
  const text = el.textContent?.trim() || '';
  if (!text) return null;
  if (/免费/.test(text)) return 0;
  const m = text.match(/[\d,]+(?:\.\d+)?/);
  if (!m) return null;
  const num = parseFloat(m[0].replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

/**
 * Parses date range text like "20年10月14日 ~ 20年10月28日" or "2024-10-14 ~ 2024-10-28".
 * Validates calendar dates and ensures end >= start.
 */
export function parseDateRange(text: string): { start: string; end: string; startTime: number; endTime: number } | null {
  const clean = text.trim();
  const m = clean.match(/(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})日\s*~\s*(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})日/);
  if (m) {
    let y1 = m[1] ? parseInt(m[1], 10) : new Date().getFullYear();
    if (y1 < 100) y1 += 2000;
    const mo1 = parseInt(m[2], 10);
    const d1 = parseInt(m[3], 10);

    let y2 = m[4] ? parseInt(m[4], 10) : y1;
    if (y2 < 100) y2 += 2000;
    const mo2 = parseInt(m[5], 10);
    const d2 = parseInt(m[6], 10);

    if (!isValidCalendarDate(y1, mo1, d1) || !isValidCalendarDate(y2, mo2, d2)) {
      return null;
    }

    const startTime = Date.UTC(y1, mo1 - 1, d1);
    const endTime = Date.UTC(y2, mo2 - 1, d2);

    if (endTime < startTime) {
      return null;
    }

    const sStr = `${y1}-${mo1.toString().padStart(2, '0')}-${d1.toString().padStart(2, '0')}`;
    const eStr = `${y2}-${mo2.toString().padStart(2, '0')}-${d2.toString().padStart(2, '0')}`;

    return { start: sStr, end: eStr, startTime, endTime };
  }

  const standardM = clean.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*~\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (standardM) {
    const y1 = parseInt(standardM[1], 10);
    const mo1 = parseInt(standardM[2], 10);
    const d1 = parseInt(standardM[3], 10);

    const y2 = parseInt(standardM[4], 10);
    const mo2 = parseInt(standardM[5], 10);
    const d2 = parseInt(standardM[6], 10);

    if (!isValidCalendarDate(y1, mo1, d1) || !isValidCalendarDate(y2, mo2, d2)) {
      return null;
    }

    const startTime = Date.UTC(y1, mo1 - 1, d1);
    const endTime = Date.UTC(y2, mo2 - 1, d2);

    if (endTime < startTime) {
      return null;
    }

    const sStr = `${y1}-${mo1.toString().padStart(2, '0')}-${d1.toString().padStart(2, '0')}`;
    const eStr = `${y2}-${mo2.toString().padStart(2, '0')}-${d2.toString().padStart(2, '0')}`;

    return { start: sStr, end: eStr, startTime, endTime };
  }

  return null;
}

/**
 * Validates and converts foreign currency to CNY using reciprocal rate (D02).
 */
export function convertToCny(
  foreignAmount: number,
  currency: string,
  ratesData: ExchangeRatesData | null,
  fallbackRates: Record<string, number> = {},
  fallbackDate = '',
  now = new Date()
): CurrencyConversionResult | null {
  if (typeof foreignAmount !== 'number' || !Number.isFinite(foreignAmount) || foreignAmount < 0) {
    return null;
  }

  const curr = currency.toUpperCase().trim();
  if (curr === 'CNY' || curr === 'CN' || curr === 'RMB') {
    return {
      convertedAmount: foreignAmount,
      formattedCny: `¥${foreignAmount.toFixed(2)}`,
      sourceDate: '无需换算',
      sourceName: '原币种人民币',
      isStaleOrFallback: false,
      isExpired: false,
      badgeText: '(无需换算)',
      titleText: '原币种人民币'
    };
  }

  let ratePerCny: number | undefined;
  let sourceDate = '';
  let sourceName = 'Frankfurter API';
  let isStaleOrFallback = false;
  let isExpired = false;

  // Validate ratesData
  if (ratesData) {
    if (
      ratesData.base === 'CNY' &&
      isValidFxDate(ratesData.date, now) &&
      ratesData.rates &&
      typeof ratesData.rates === 'object'
    ) {
      const r = ratesData.rates[curr];
      if (typeof r === 'number' && Number.isFinite(r) && r > 0) {
        ratePerCny = r;
        sourceDate = ratesData.date;
        const rateMs = new Date(ratesData.date + 'T00:00:00Z').getTime();
        if (now.getTime() - rateMs > MAX_FRESHNESS_MS) {
          isExpired = true;
          isStaleOrFallback = true;
        }
      }
    }
  }

  // Fallback check
  if (!ratePerCny && fallbackRates && typeof fallbackRates === 'object') {
    if (isValidFxDate(fallbackDate, now)) {
      const fRate = fallbackRates[curr];
      if (typeof fRate === 'number' && Number.isFinite(fRate) && fRate > 0) {
        const rateMs = new Date(fallbackDate + 'T00:00:00Z').getTime();
        const expired = now.getTime() - rateMs > MAX_FRESHNESS_MS;
        const converted = Number((foreignAmount * fRate).toFixed(2));
        const badgeText = expired
          ? `(约 ¥${converted.toFixed(2)} [已过期])`
          : `(约 ¥${converted.toFixed(2)})`;
        const titleText = expired
          ? `汇率来源: 用户设置汇率 (${fallbackDate} 已过期)`
          : `汇率来源: 用户设置汇率 (${fallbackDate})`;
        return {
          convertedAmount: converted,
          formattedCny: `¥${converted.toFixed(2)}`,
          sourceDate: fallbackDate,
          sourceName: '用户设置汇率',
          isStaleOrFallback: true,
          isExpired: expired,
          badgeText,
          titleText
        };
      }
    }
  }

  if (!ratePerCny || ratePerCny <= 0) {
    return null;
  }

  const cnyPerForeign = 1 / ratePerCny;
  const converted = Number((foreignAmount * cnyPerForeign).toFixed(2));
  const badgeText = isExpired
    ? `(约 ¥${converted.toFixed(2)} [已过期])`
    : `(约 ¥${converted.toFixed(2)})`;
  const titleText = isExpired
    ? `汇率来源: ${sourceName} (${sourceDate} 已过期)`
    : `汇率来源: ${sourceName} (${sourceDate})`;

  return {
    convertedAmount: converted,
    formattedCny: `¥${converted.toFixed(2)}`,
    sourceDate: sourceDate || '未知日期',
    sourceName,
    isStaleOrFallback,
    isExpired,
    badgeText,
    titleText
  };
}

/**
 * Parses promotion events from deal history (D01).
 * Unknown currency stays null (does not default to HKD).
 * Price values: missing is null, valid Plus 0 stays 0.
 */
export function extractPromotionEvents(root: ParentNode): DealPromotionEvent[] {
  const events: DealPromotionEvent[] = [];
  const boxes = root.querySelectorAll('li.dd_box');

  boxes.forEach((b) => {
    let dateText = '';
    let region: string | null = null;
    let currency: string | null = null;

    b.querySelectorAll('p.dd_text').forEach((p) => {
      const t = p.textContent || '';
      if (t.includes('~')) dateText = t;
      if (t.includes('日服')) { region = '日服'; currency = 'JPY'; }
      else if (t.includes('美服')) { region = '美服'; currency = 'USD'; }
      else if (t.includes('英服')) { region = '英服'; currency = 'GBP'; }
      else if (t.includes('国服')) { region = '国服'; currency = 'CNY'; }
      else if (t.includes('港服')) { region = '港服'; currency = 'HKD'; }
    });

    const range = parseDateRange(dateText);
    if (!range) return;

    const oldPriceEl = b.querySelector('.dd_price_old');
    const offPriceEl = b.querySelector('.dd_price_off');
    const plusPriceEl = b.querySelector('.dd_price_plus');

    // If currency not resolved from text, check symbols
    if (!currency) {
      const allPriceText = b.querySelector('.dd_price')?.textContent || '';
      if (allPriceText.includes('HK$')) { currency = 'HKD'; region = region || '港服'; }
      else if (allPriceText.includes('円')) { currency = 'JPY'; region = region || '日服'; }
      else if (allPriceText.includes('£')) { currency = 'GBP'; region = region || '英服'; }
      else if (allPriceText.includes('¥')) {
        if (region === '国服') { currency = 'CNY'; }
        else { currency = 'JPY'; region = region || '日服'; }
      }
      else if (allPriceText.includes('$')) {
        if (region === '港服') { currency = 'HKD'; }
        else { currency = 'USD'; region = region || '美服'; }
      }
    }

    const oldPrice = parsePrice(oldPriceEl);
    const offPrice = parsePrice(offPriceEl);
    const plusPrice = plusPriceEl ? parsePrice(plusPriceEl) : null;
    const isBest = b.querySelector('.dd_status_best, .store_tag_best') !== null;

    // Hist only activity heading allowed caption
    const activityA = b.querySelector('.dd_text a[href*="topic"], .dd_info p.dd_text a');
    const titleA = activityA || b.querySelector('.dd_info h4.dd_title a, .dd_text a, .dd_info a');
    const title = titleA?.textContent?.trim() || '折扣活动';

    const prodLink = b.querySelector('.dd_pic a');
    const prodHref = prodLink?.getAttribute('href') || '';
    const prodMatch = prodHref.match(/\/dd\/([A-Za-z0-9_-]+)/);
    const productId = prodMatch ? prodMatch[1] : null;

    events.push({
      title,
      region: region || '未知地区',
      startDate: range.start,
      endDate: range.end,
      startTime: range.startTime,
      endTime: range.endTime,
      oldPrice,
      offPrice,
      plusPrice,
      currency,
      isBest,
      productId
    });
  });

  return events.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Builds chronological price history points with promotion drops and recovery to old price (D01).
 * Maintained for backward compatibility with existing tests.
 */
export function buildPricePointsFromEvents(
  events: DealPromotionEvent[]
): { date: string; timestamp: number; normalPrice: number; plusPrice: number }[] {
  if (events.length === 0) return [];

  // Filter to single currency if mixed
  const targetCurrency = events.find(e => e.currency !== null)?.currency;
  const filteredEvents = targetCurrency ? events.filter(e => e.currency === targetCurrency) : events;

  const points: { date: string; timestamp: number; normalPrice: number; plusPrice: number }[] = [];

  for (let i = 0; i < filteredEvents.length; i++) {
    const ev = filteredEvents[i];
    if (ev.offPrice === null) continue;

    points.push({
      date: ev.startDate,
      timestamp: ev.startTime,
      normalPrice: ev.offPrice,
      plusPrice: ev.plusPrice ?? ev.offPrice
    });

    points.push({
      date: ev.endDate,
      timestamp: ev.endTime,
      normalPrice: ev.offPrice,
      plusPrice: ev.plusPrice ?? ev.offPrice
    });

    const recoveryTime = ev.endTime + ONE_DAY_MS;
    const nextEvent = filteredEvents[i + 1];
    // Baseline oldprice if known, otherwise gap (do not create fake 0 recovery)
    if (ev.oldPrice !== null && (!nextEvent || nextEvent.startTime > recoveryTime)) {
      const recDate = new Date(recoveryTime).toISOString().slice(0, 10);
      points.push({
        date: recDate,
        timestamp: recoveryTime,
        normalPrice: ev.oldPrice,
        plusPrice: ev.oldPrice
      });
    }
  }

  return points.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Builds rigorous step timeline intervals from event boundaries.
 * Inclusive end -> next day revert.
 * Latest active event wins overlap.
 * Baseline oldprice if known, otherwise gap (null).
 * Ordinary and Plus preserved independently, missing gaps not zero.
 * Terminal boundary guarantees next-day recovery point is shown for the overall latest ending promotion.
 */
export function buildPriceStepTimeline(events: DealPromotionEvent[]): PriceInterval[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.startTime - b.startTime);

  const boundarySet = new Set<number>();
  for (const ev of sorted) {
    boundarySet.add(ev.startTime);
    boundarySet.add(ev.endTime + ONE_DAY_MS);
  }
  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  const rawIntervals: PriceInterval[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const tStart = boundaries[i];
    const tEnd = boundaries[i + 1];

    // Find active events: startTime <= tStart and (endTime + 1 day) >= tEnd
    const activeEvents = sorted.filter(e => e.startTime <= tStart && (e.endTime + ONE_DAY_MS) >= tEnd);

    if (activeEvents.length > 0) {
      // Latest active event wins overlap
      activeEvents.sort((a, b) => {
        if (b.startTime !== a.startTime) return b.startTime - a.startTime;
        return sorted.indexOf(b) - sorted.indexOf(a);
      });
      const winner = activeEvents[0];
      rawIntervals.push({
        tStart,
        tEnd,
        startDate: new Date(tStart).toISOString().slice(0, 10),
        endDate: new Date(tEnd).toISOString().slice(0, 10),
        normalPrice: winner.offPrice,
        plusPrice: winner.plusPrice
      });
    } else {
      // Non-promotional gap: baseline oldprice if known otherwise gap
      const pastEvents = sorted.filter(e => (e.endTime + ONE_DAY_MS) <= tStart);
      const mostRecent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;
      const baselineOldPrice = mostRecent ? mostRecent.oldPrice : null;
      rawIntervals.push({
        tStart,
        tEnd,
        startDate: new Date(tStart).toISOString().slice(0, 10),
        endDate: new Date(tEnd).toISOString().slice(0, 10),
        normalPrice: baselineOldPrice,
        plusPrice: baselineOldPrice
      });
    }
  }

  // Merge contiguous intervals with identical prices
  const merged: PriceInterval[] = [];
  for (const interval of rawIntervals) {
    if (merged.length === 0) {
      merged.push({ ...interval });
    } else {
      const prev = merged[merged.length - 1];
      if (
        prev.tEnd === interval.tStart &&
        prev.normalPrice === interval.normalPrice &&
        prev.plusPrice === interval.plusPrice
      ) {
        prev.tEnd = interval.tEnd;
        prev.endDate = interval.endDate;
      } else {
        merged.push({ ...interval });
      }
    }
  }

  // Final next-day recovery point: find max end boundary among all promotions
  // and pick the event that was actively winning right before that max end boundary.
  // If that event's oldPrice is null, do not create a fake recovery.
  const maxRevertTime = Math.max(...sorted.map(e => e.endTime + ONE_DAY_MS));
  const activeAtFinalBoundary = sorted.filter(e => e.startTime < maxRevertTime && (e.endTime + ONE_DAY_MS) >= maxRevertTime);
  activeAtFinalBoundary.sort((a, b) => {
    if (b.startTime !== a.startTime) return b.startTime - a.startTime;
    return sorted.indexOf(b) - sorted.indexOf(a);
  });
  const recoverySource = activeAtFinalBoundary[0];

  if (recoverySource && recoverySource.oldPrice !== null) {
    const finalDateStr = new Date(maxRevertTime).toISOString().slice(0, 10);
    merged.push({
      tStart: maxRevertTime,
      tEnd: maxRevertTime,
      startDate: finalDateStr,
      endDate: finalDateStr,
      normalPrice: recoverySource.oldPrice,
      plusPrice: recoverySource.oldPrice
    });
  }

  return merged;
}

/**
 * Generates an SVG step path M/H/V from timeline intervals.
 * Step transitions are horizontal during interval, vertical at step change.
 * Missing prices (null) produce a gap (no line drawn).
 */
export function generateStepPath(
  intervals: PriceInterval[],
  getX: (t: number) => number,
  getY: (p: number) => number,
  priceSelector: (i: PriceInterval) => number | null
): string {
  const parts: string[] = [];
  let inSubpath = false;
  let lastX = 0;
  let lastY = 0;

  for (const seg of intervals) {
    const price = priceSelector(seg);
    if (price === null) {
      inSubpath = false;
      continue;
    }

    const x1 = Number(getX(seg.tStart).toFixed(1));
    const x2 = Number(getX(seg.tEnd).toFixed(1));
    const y = Number(getY(price).toFixed(1));

    if (!inSubpath) {
      parts.push(`M ${x1} ${y}`);
      if (x2 > x1) {
        parts.push(`H ${x2}`);
      }
      inSubpath = true;
      lastX = x2;
      lastY = y;
    } else {
      if (Math.abs(x1 - lastX) <= 1) {
        if (y !== lastY) {
          parts.push(`V ${y}`);
        }
        if (x2 > x1) {
          parts.push(`H ${x2}`);
        }
        lastX = x2;
        lastY = y;
      } else {
        parts.push(`M ${x1} ${y}`);
        if (x2 > x1) {
          parts.push(`H ${x2}`);
        }
        lastX = x2;
        lastY = y;
      }
    }
  }

  return parts.join(' ');
}

/**
 * Renders Native SVG Price History Chart with step path M/H/V, proportional date axis,
 * escaped strings, and an accessible keyboard/readable data table (D01).
 */
export function renderPriceHistorySvg(
  pointsOrEvents: { date: string; timestamp: number; normalPrice: number | null; plusPrice: number | null }[] | DealPromotionEvent[],
  currencySymbol = 'HK$',
  eventsList?: DealPromotionEvent[]
): string {
  let displayEvents: DealPromotionEvent[] = [];
  if (eventsList && eventsList.length > 0) {
    displayEvents = eventsList;
  } else if (pointsOrEvents.length > 0 && 'startDate' in pointsOrEvents[0]) {
    displayEvents = pointsOrEvents as DealPromotionEvent[];
  }

  // Build step intervals from events if available
  let intervals: PriceInterval[] = [];
  if (displayEvents.length > 0) {
    intervals = buildPriceStepTimeline(displayEvents);
  } else if (pointsOrEvents.length >= 2) {
    // Fallback: build simple intervals from points
    const pts = pointsOrEvents as { date: string; timestamp: number; normalPrice: number | null; plusPrice: number | null }[];
    for (let i = 0; i < pts.length - 1; i++) {
      intervals.push({
        tStart: pts[i].timestamp,
        tEnd: pts[i + 1].timestamp,
        startDate: pts[i].date,
        endDate: pts[i + 1].date,
        normalPrice: pts[i].normalPrice,
        plusPrice: pts[i].plusPrice
      });
    }
  }

  if (intervals.length === 0) {
    return '<div data-psnine-next="true" style="padding:10px;color:#888;">需至少一条有效历史促销记录生成走势图</div>';
  }

  const svgWidth = 500;
  const svgHeight = 220;
  const margin = { top: 25, right: 35, bottom: 40, left: 50 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const validPrices: { price: number; time: number; date: string }[] = [];
  for (const seg of intervals) {
    if (seg.normalPrice !== null) {
      validPrices.push({ price: seg.normalPrice, time: seg.tStart, date: seg.startDate });
    }
    if (seg.plusPrice !== null) {
      validPrices.push({ price: seg.plusPrice, time: seg.tStart, date: seg.startDate });
    }
  }

  const minPrice = 0;
  const maxPriceNum = validPrices.length > 0 ? Math.max(...validPrices.map(v => v.price)) : 100;
  const maxPrice = Math.max(10, Math.ceil(maxPriceNum * 1.15));
  const priceSpan = maxPrice - minPrice;

  const minTime = intervals[0].tStart;
  const maxTime = intervals[intervals.length - 1].tEnd;
  const timeSpan = Math.max(1, maxTime - minTime);

  const getX = (t: number) => margin.left + ((t - minTime) / timeSpan) * innerWidth;
  const getY = (p: number) => margin.top + innerHeight - ((p - minPrice) / priceSpan) * innerHeight;

  const normalPath = generateStepPath(intervals, getX, getY, seg => seg.normalPrice);
  const plusPath = generateStepPath(intervals, getX, getY, seg => seg.plusPrice);

  let lowestPrice: number | null = null;
  let lowestPt: { cx: number; cy: number; date: string } | null = null;
  if (validPrices.length > 0) {
    lowestPrice = Math.min(...validPrices.map(v => v.price));
    const lowest = validPrices.find(v => v.price === lowestPrice);
    if (lowest) {
      lowestPt = {
        cx: getX(lowest.time),
        cy: getY(lowest.price),
        date: lowest.date
      };
    }
  }

  const safeCurrency = escapeXml(currencySymbol);
  const displayStartDate = intervals[0].startDate;
  const displayEndDate = intervals[intervals.length - 1].endDate;

  // Build keyboard / screen-reader readable data table
  let tableHtml = '';
  if (displayEvents.length > 0) {
    const rowsHtml = displayEvents.map(ev => {
      const normalStr = ev.offPrice !== null ? `${safeCurrency}${ev.offPrice.toFixed(2)}` : '未知';
      const plusStr = ev.plusPrice === 0 ? '免费 (0.00)' : (ev.plusPrice !== null ? `${safeCurrency}${ev.plusPrice.toFixed(2)}` : '-');
      const oldStr = ev.oldPrice !== null ? `${safeCurrency}${ev.oldPrice.toFixed(2)}` : '未知';
      return `
        <tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
          <td style="padding:6px 8px;">${escapeXml(ev.title)}</td>
          <td style="padding:6px 8px;">${escapeXml(ev.startDate)} ~ ${escapeXml(ev.endDate)}</td>
          <td style="padding:6px 8px;">${normalStr}</td>
          <td style="padding:6px 8px;">${plusStr}</td>
          <td style="padding:6px 8px;">${oldStr}</td>
        </tr>
      `;
    }).join('');

    tableHtml = `
      <div class="psnine-price-history-table-wrapper" style="margin-top:12px;overflow-x:auto;">
        <table class="psnine-price-history-table" style="width:100%;font-size:12px;text-align:left;border-collapse:collapse;border:1px solid rgba(0,0,0,0.1);" summary="商品历史价格走势明细">
          <caption style="text-align:left;font-weight:600;padding:4px 0;">促销历史数据明细 (可键盘访问)</caption>
          <thead>
            <tr style="background:rgba(0,0,0,0.04);border-bottom:1px solid rgba(0,0,0,0.1);">
              <th scope="col" style="padding:6px 8px;">活动名称</th>
              <th scope="col" style="padding:6px 8px;">促销周期</th>
              <th scope="col" style="padding:6px 8px;">普通会员价</th>
              <th scope="col" style="padding:6px 8px;">PS+会员价</th>
              <th scope="col" style="padding:6px 8px;">原价恢复</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" data-psnine-next="true" class="psnine-price-chart-svg" style="width:100%;height:auto;max-height:240px;user-select:none;font-family:inherit;">
      <desc>历史价格阶梯走势图，包含普通会员价与 PS+ 会员价阶梯走势及原价恢复记录</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />

      <text x="${margin.left - 6}" y="${margin.top + 6}" text-anchor="end" font-size="10" fill="currentColor">${safeCurrency}${maxPrice}</text>
      <text x="${margin.left - 6}" y="${margin.top + innerHeight}" text-anchor="end" font-size="10" fill="currentColor">${safeCurrency}0</text>

      <text x="${margin.left}" y="${margin.top + innerHeight + 18}" text-anchor="start" font-size="10" fill="currentColor">${escapeXml(displayStartDate)}</text>
      <text x="${margin.left + innerWidth}" y="${margin.top + innerHeight + 18}" text-anchor="end" font-size="10" fill="currentColor">${escapeXml(displayEndDate)}</text>

      ${normalPath ? `<path d="${normalPath}" fill="none" stroke="#00a2ff" stroke-width="2.5" />` : ''}
      ${plusPath ? `<path d="${plusPath}" fill="none" stroke="#ffd633" stroke-width="2.5" stroke-dasharray="6,3" />` : ''}

      ${lowestPt && lowestPrice !== null ? `
        <circle cx="${lowestPt.cx.toFixed(1)}" cy="${lowestPt.cy.toFixed(1)}" r="5" fill="#e03131" stroke="#fff" stroke-width="1.5">
          <title>历史史低: ${safeCurrency}${lowestPrice.toFixed(2)} (${escapeXml(lowestPt.date)})</title>
        </circle>
      ` : ''}

      <g transform="translate(${margin.left + 10}, ${margin.top - 8})">
        <line x1="0" y1="0" x2="16" y2="0" stroke="#00a2ff" stroke-width="2" />
        <text x="20" y="3" font-size="11" fill="currentColor">普通会员价</text>
        <line x1="100" y1="0" x2="116" y2="0" stroke="#ffd633" stroke-width="2" stroke-dasharray="4,2" />
        <text x="120" y="3" font-size="11" fill="currentColor">PS+会员价</text>
      </g>
    </svg>
    ${tableHtml}
  `;
}

/**
 * Mounts the Deals Feature Module.
 * Returns synchronous cleanup function and initializes controls without blocking on FX network requests.
 */
export const mountDeals: Mount = (ctx: Context): Cleanup => {
  const { document: doc, url, settings, onContent, report } = ctx;

  const isDealsPage = url.pathname.includes('/dd') || url.pathname.includes('/huodong') || url.pathname.includes('/game/');
  if (!isDealsPage) return () => {};

  const isSingleProductDealPage = /^\/dd\/[A-Za-z0-9_-]+/.test(url.pathname) || /\/game\/\d+\/dd/.test(url.pathname);

  let isMounted = true;
  const abortController = new AbortController();
  let pendingLoadPromise: Promise<ExchangeRatesData | null> | null = null;

  try {
    let currentShowCny = settings.currencyConversion;
    let ratesData: ExchangeRatesData | null = null;
    let ratesFetchFailed = false;
    let isBestOnlyFilterActive = false;

    // Helper: fetch live rates safely with ms TTL and promise coalescing
    const loadRates = async (): Promise<ExchangeRatesData | null> => {
      if (!isMounted || abortController.signal.aborted) return null;
      if (ratesData) return ratesData;
      if (pendingLoadPromise) return pendingLoadPromise;

      pendingLoadPromise = (async () => {
        const CACHE_KEY = 'psnine_next:rates:latest';
        try {
          const cached = await ctx.store.get<{ data: ExchangeRatesData; time: number } | null>(CACHE_KEY, null);
          if (!isMounted || abortController.signal.aborted) return null;
          if (
            cached &&
            Date.now() - cached.time < ONE_DAY_MS &&
            cached.data.base === 'CNY' &&
            isValidFxDate(cached.data.date)
          ) {
            ratesData = cached.data;
            ratesFetchFailed = false;
            return ratesData;
          }

          const live = await ctx.http.json<ExchangeRatesData>(
            'https://api.frankfurter.dev/v1/latest?base=CNY&symbols=HKD,USD,GBP,JPY',
            { ttl: ONE_DAY_MS, signal: abortController.signal }
          );
          if (!isMounted || abortController.signal.aborted) return null;

          if (
            live &&
            live.base === 'CNY' &&
            isValidFxDate(live.date) &&
            live.rates &&
            typeof live.rates.HKD === 'number' &&
            Number.isFinite(live.rates.HKD) &&
            live.rates.HKD > 0
          ) {
            await ctx.store.set(CACHE_KEY, { data: live, time: Date.now() });
            ratesData = live;
            ratesFetchFailed = false;
            return ratesData;
          }
        } catch (err) {
          if (!isMounted || abortController.signal.aborted) return null;
          ratesFetchFailed = true;
          ctx.report('deals_rates', err);
        }

        if (!isMounted || abortController.signal.aborted) return null;

        // Check stale cache
        try {
          const stale = await ctx.store.get<{ data: ExchangeRatesData; time: number } | null>(CACHE_KEY, null);
          if (!isMounted || abortController.signal.aborted) return null;
          if (stale && stale.data && stale.data.base === 'CNY' && isValidFxDate(stale.data.date)) {
            ratesData = stale.data;
            ratesFetchFailed = false;
            return ratesData;
          }
        } catch {
          // ignore
        }

        ratesFetchFailed = true;
        return null;
      })().finally(() => {
        pendingLoadPromise = null;
      });

      return pendingLoadPromise;
    };

    // Helper: detect currency of element/box
    const detectCurrency = (el: HTMLElement): string | null => {
      const text = el.textContent || '';
      const regionParam = url.searchParams.get('region');
      if (regionParam === 'jp' || text.includes('日服') || text.includes('円')) return 'JPY';
      if (regionParam === 'us' || text.includes('美服')) return 'USD';
      if (regionParam === 'gb' || text.includes('英服')) return 'GBP';
      if (regionParam === 'cn' || text.includes('国服')) return 'CNY';
      if (regionParam === 'hk' || text.includes('港服') || text.includes('HK$')) return 'HKD';
      if (text.includes('$')) return 'USD';
      if (text.includes('£')) return 'GBP';
      if (text.includes('¥')) return 'JPY';
      return null;
    };

    // Helper: update visible FX status in control bar for mobile / touchscreen users
    const updateFxStatusDisplay = () => {
      const fxStatus = doc.getElementById('psnine-fx-status');
      if (!fxStatus) return;

      if (!currentShowCny) {
        fxStatus.textContent = '';
        fxStatus.style.display = 'none';
        return;
      }

      fxStatus.style.display = 'inline-block';
      if (ratesData) {
        const isExp = (Date.now() - new Date(ratesData.date + 'T00:00:00Z').getTime()) > MAX_FRESHNESS_MS;
        fxStatus.textContent = `汇率: Frankfurter (${ratesData.date}${isExp ? ' 已过期' : ''})`;
        fxStatus.style.color = isExp ? '#e03131' : '#666';
      } else if (settings.exchangeRateDate && isValidFxDate(settings.exchangeRateDate)) {
        const isExp = (Date.now() - new Date(settings.exchangeRateDate + 'T00:00:00Z').getTime()) > MAX_FRESHNESS_MS;
        fxStatus.textContent = `汇率: 用户设置 (${settings.exchangeRateDate}${isExp ? ' 已过期' : ''})`;
        fxStatus.style.color = isExp ? '#e03131' : '#666';
      } else if (ratesFetchFailed) {
        fxStatus.textContent = '汇率: 不可用';
        fxStatus.style.color = '#888';
      } else {
        fxStatus.textContent = '汇率: 加载中...';
        fxStatus.style.color = '#888';
      }
    };

    // Helper to convert single price element
    const convertPriceElement = (priceEl: HTMLElement, currency: string | null) => {
      if (!currency || !currentShowCny || priceEl.classList.contains('psnine-cny-badge')) return;
      const rawText = priceEl.getAttribute('data-psnine-orig-text') || priceEl.textContent?.trim() || '';
      if (!priceEl.hasAttribute('data-psnine-orig-text')) {
        priceEl.setAttribute('data-psnine-orig-text', rawText);
      }

      const amt = parsePrice(priceEl);
      if (amt === null) return;

      const res = convertToCny(amt, currency, ratesData, settings.exchangeRates, settings.exchangeRateDate);

      let cnySpan = priceEl.nextElementSibling as HTMLElement | null;
      const isOurBadge = cnySpan && cnySpan.classList.contains('psnine-cny-badge');

      if (!res && !ratesFetchFailed && !ratesData && !settings.exchangeRateDate) {
        // Pending load: render placeholder
        if (!isOurBadge) {
          cnySpan = doc.createElement('span');
          cnySpan.className = 'psnine-cny-badge';
          cnySpan.setAttribute('data-psnine-next', 'true');
          cnySpan.setAttribute('style', 'display:inline-block;font-size:11px;color:#888;font-weight:500;margin-left:4px;');
          priceEl.after(cnySpan);
        }
        cnySpan!.textContent = '(换算中...)';
        cnySpan!.style.display = currentShowCny ? 'inline-block' : 'none';
        return;
      }

      if (!res && !ratesFetchFailed) {
        if (isOurBadge && cnySpan) {
          cnySpan.remove();
        }
        return;
      }

      if (!isOurBadge) {
        cnySpan = doc.createElement('span');
        cnySpan.className = 'psnine-cny-badge';
        cnySpan.setAttribute('data-psnine-next', 'true');
        cnySpan.setAttribute('style', 'display:inline-block;font-size:11px;color:#28a745;font-weight:500;margin-left:4px;');
        priceEl.after(cnySpan);
      }

      if (res) {
        cnySpan!.textContent = res.badgeText;
        cnySpan!.setAttribute('title', res.titleText);
        cnySpan!.style.color = res.isExpired ? '#e03131' : '#28a745';
        cnySpan!.style.display = currentShowCny ? 'inline-block' : 'none';
      } else if (ratesFetchFailed) {
        cnySpan!.textContent = '(汇率不可用)';
        cnySpan!.setAttribute('title', '汇率服务不可用或数据失效');
        cnySpan!.style.color = '#888';
        cnySpan!.style.display = currentShowCny ? 'inline-block' : 'none';
      }
    };

    // 1. Process Deal Boxes (li.dd_box & li.store_box) (D02 - D05)
    const enhanceDealsAndStores = () => {
      const dealBoxes = doc.querySelectorAll('li.dd_box, li.store_box');

      dealBoxes.forEach((b) => {
        const box = b as HTMLElement;
        const currency = detectCurrency(box);

        // D04: Color the title AND tag
        // Do NOT paint activity as game title on listing (.dd_info h4.dd_title a or .store_title a)
        const tags = box.querySelectorAll('.dd_tag_plus, .dd_tag, .dd_tag_nor, .store_tag, .store_tag_plus');
        let discountTag: HTMLElement | null = null;
        let discountPercent = 0;
        for (let i = 0; i < tags.length; i++) {
          const tEl = tags[i] as HTMLElement;
          const match = tEl.textContent?.match(/(\d+)%/);
          if (match) {
            discountTag = tEl;
            discountPercent = parseInt(match[1], 10);
            break;
          }
        }
        if (discountPercent > 0) {
          const color = getDiscountColor(discountPercent);
          if (discountTag) {
            discountTag.style.backgroundColor = color;
            discountTag.style.color = '#fff';
          }
          // Prioritize actual game title link and exclude activity links
          let titleA = box.querySelector('.dd_info h4.dd_title > a, h4.dd_title a, a.dd_title, .store_title a, .title a') as HTMLElement | null;
          if (!titleA) {
            // Fallback for mocks without h4: ensure it does not start with activity
            const candidates = box.querySelectorAll('.dd_info p a');
            for (let c = 0; c < candidates.length; c++) {
              const el = candidates[c] as HTMLElement;
              const parentText = el.parentElement?.textContent || '';
              if (!parentText.includes('活动') && !el.getAttribute('href')?.includes('topic')) {
                titleA = el;
                break;
              }
            }
          }

          if (titleA) {
            titleA.style.color = color;
            titleA.style.fontWeight = 'bold';
          }
        }

        // D02: Convert all price elements (old, off, plus, store_price)
        box.querySelectorAll('.dd_price_old, .dd_price_off, .dd_price_plus').forEach((pEl) => {
          convertPriceElement(pEl as HTMLElement, currency);
        });
        box.querySelectorAll('.store_price > span:not(.psnine-cny-badge), .store_price > em:not(.psnine-cny-badge), .store_price > s, .store_price > b').forEach((pEl) => {
          convertPriceElement(pEl as HTMLElement, currency);
        });

        // D05: Apply active historical low filter (.dd_status_best or .store_tag_best)
        const isBest = box.querySelector('.dd_status_best, .store_tag_best') !== null;
        if (isBestOnlyFilterActive && !isBest) {
          setHidden(box, 'best-deal-filter', true);
        } else {
          setHidden(box, 'best-deal-filter', false);
        }
      });

      // Insert or update Control Bar
      if (dealBoxes.length > 0 && !doc.getElementById('psnine-deals-controls-bar')) {
        const targetContainer = doc.querySelector('.min-inner .box, .box');
        if (targetContainer) {
          const bar = doc.createElement('div');
          bar.id = 'psnine-deals-controls-bar';
          bar.setAttribute('data-psnine-next', 'true');
          bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 0;padding:8px 12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:6px;';

          const titleSpan = doc.createElement('span');
          titleSpan.textContent = '🏷️ 数折增强:';
          titleSpan.style.cssText = 'font-weight:500;font-size:13px;';
          bar.appendChild(titleSpan);

          // D05 Button
          const bestBtn = doc.createElement('button');
          bestBtn.type = 'button';
          bestBtn.id = 'psnine-toggle-best-deal-btn';
          bestBtn.setAttribute('data-psnine-next', 'true');
          bestBtn.style.cssText = 'padding:4px 10px;border-radius:4px;border:1px solid #ccc;background:transparent;cursor:pointer;font-size:12px;';
          bestBtn.textContent = isBestOnlyFilterActive ? '已过滤：只看史低' : '只看史低';
          bestBtn.onclick = () => {
            if (!isMounted) return;
            isBestOnlyFilterActive = !isBestOnlyFilterActive;
            bestBtn.textContent = isBestOnlyFilterActive ? '已过滤：只看史低' : '只看史低';
            bestBtn.style.background = isBestOnlyFilterActive ? '#da314b' : 'transparent';
            bestBtn.style.color = isBestOnlyFilterActive ? '#fff' : 'inherit';
            bestBtn.style.borderColor = isBestOnlyFilterActive ? '#da314b' : '#ccc';
            enhanceDealsAndStores();
          };
          bar.appendChild(bestBtn);

          // D03 Currency Toggle Button
          const cnyBtn = doc.createElement('button');
          cnyBtn.type = 'button';
          cnyBtn.id = 'psnine-toggle-cny-btn';
          cnyBtn.setAttribute('data-psnine-next', 'true');
          cnyBtn.style.cssText = 'padding:4px 10px;border-radius:4px;border:1px solid #28a745;background:transparent;color:#28a745;cursor:pointer;font-size:12px;';
          cnyBtn.textContent = currentShowCny ? '已开启人民币换算 (CNY)' : '切换人民币换算';
          cnyBtn.onclick = async () => {
            if (!isMounted) return;
            currentShowCny = !currentShowCny;
            cnyBtn.textContent = currentShowCny ? '已开启人民币换算 (CNY)' : '切换人民币换算';
            updateFxStatusDisplay();
            if (currentShowCny && !ratesData) {
              await loadRates();
            }
            if (!isMounted) return;
            updateFxStatusDisplay();
            doc.querySelectorAll('.psnine-cny-badge').forEach((bg) => {
              (bg as HTMLElement).style.display = currentShowCny ? 'inline-block' : 'none';
            });
            enhanceDealsAndStores();
          };
          bar.appendChild(cnyBtn);

          // Visible FX Status for mobile / touch devices
          const fxStatusSpan = doc.createElement('span');
          fxStatusSpan.id = 'psnine-fx-status';
          fxStatusSpan.setAttribute('data-psnine-next', 'true');
          fxStatusSpan.style.cssText = 'font-size:11px;color:#666;margin-left:auto;';
          bar.appendChild(fxStatusSpan);

          targetContainer.insertBefore(bar, targetContainer.firstChild);
          updateFxStatusDisplay();
        }
      }
    };

    // Helper: render D01 price history chart synchronously on single product deal page
    const renderChartIfSingleProduct = () => {
      if (isSingleProductDealPage && !doc.getElementById('psnine-price-chart-container')) {
        const allEvents = extractPromotionEvents(doc);
        if (allEvents.length > 0) {
          const firstValidEvent = allEvents.find(e => e.currency !== null);
          if (firstValidEvent && firstValidEvent.currency) {
            const targetCurrency = firstValidEvent.currency;
            const targetProductId = firstValidEvent.productId;
            const events = allEvents.filter(e =>
              e.currency === targetCurrency &&
              (!targetProductId || !e.productId || e.productId === targetProductId)
            );

            if (events.length > 0) {
              const points = buildPricePointsFromEvents(events);
              if (points.length >= 2 || events.length >= 1) {
                const chartDiv = doc.createElement('div');
                chartDiv.id = 'psnine-price-chart-container';
                chartDiv.setAttribute('data-psnine-next', 'true');
                chartDiv.style.cssText = 'margin:15px 0;padding:12px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;background:rgba(0,0,0,0.015);';

                const heading = doc.createElement('div');
                heading.setAttribute('data-psnine-next', 'true');
                heading.style.cssText = 'font-weight:600;font-size:13px;margin-bottom:8px;';
                heading.textContent = '📈 本商品历史价格变动走势 (真实促销阶梯记录)';
                chartDiv.appendChild(heading);

                const currencySymbol = targetCurrency === 'HKD' ? 'HK$'
                  : targetCurrency === 'USD' ? '$'
                  : targetCurrency === 'GBP' ? '£'
                  : targetCurrency === 'JPY' ? '円'
                  : targetCurrency === 'CNY' ? '¥'
                  : targetCurrency;

                const svgWrapper = doc.createElement('div');
                svgWrapper.setAttribute('data-psnine-next', 'true');
                svgWrapper.innerHTML = renderPriceHistorySvg(points, currencySymbol, events);
                chartDiv.appendChild(svgWrapper);

                const firstBox = doc.querySelector('li.dd_box');
                if (firstBox && firstBox.parentElement) {
                  firstBox.parentElement.parentElement?.insertBefore(chartDiv, firstBox.parentElement);
                }
              }
            }
          }
        }
      }
    };

    // Synchronous initial UI render: controls, coloring, filtering, chart
    enhanceDealsAndStores();
    renderChartIfSingleProduct();

    // Async FX load in background without blocking initial controls/chart
    if (currentShowCny) {
      loadRates().then(() => {
        if (!isMounted || abortController.signal.aborted) return;
        updateFxStatusDisplay();
        enhanceDealsAndStores();
      }).catch(() => {
        if (!isMounted || abortController.signal.aborted) return;
        updateFxStatusDisplay();
      });
    }

    const unsubscribe = onContent(() => {
      if (isMounted) {
        enhanceDealsAndStores();
        renderChartIfSingleProduct();
      }
    });

    const cleanup: Cleanup = () => {
      isMounted = false;
      abortController.abort();
      unsubscribe();
      // Remove button callbacks so retained / detached DOM buttons cannot trigger fetches
      const bestBtn = doc.getElementById('psnine-toggle-best-deal-btn');
      if (bestBtn) (bestBtn as HTMLButtonElement).onclick = null;
      const cnyBtn = doc.getElementById('psnine-toggle-cny-btn');
      if (cnyBtn) (cnyBtn as HTMLButtonElement).onclick = null;
    };

    return cleanup;
  } catch (err) {
    report('deals', err);
    return () => {};
  }
};
