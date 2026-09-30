/**
 * psnine_next - Reviews Feature Module (R01 - R06)
 *
 * Implements:
 * R01: 测评均分 (有效评分的已载入样本，显示样本数量)
 * R02: 评分分布 (1–10 分直方图，最高计数高亮)
 * R03: 按分数过滤评论 (点击柱/刻度、隐藏无评分，与黑名单叠加)
 * R04: 正态参考曲线 (可开关，零方差不产生 NaN)
 * R05: 累计均分趋势 (按上海时区可信时间累计，缺失时间单独说明，可读数据表)
 * R06: 每周评分热度 (ISO 周跨年及空周补零，实际渲染)
 */

import { Context, Mount } from '../core/types';
import { setHidden } from '../core/dom';

export interface ReviewItem {
  element: HTMLElement;
  score: number | null; // 1-10, null if no rating
  timestamp: number | null; // ms epoch, null if invalid/missing
  timeStr: string;
}

export interface ReviewStats {
  totalLoaded: number;
  scoredCount: number;
  average: number;
  variance: number;
  stdDev: number;
  distribution: number[]; // Index 0..9 for score 1..10
  maxScoreBucket: number; // 1-10 which has max count
  cumulativeTrend: { time: number; timeStr: string; cumAvg: number; score: number }[];
  missingTimeCount: number;
  weeklyHeatmap: { weekKey: string; count: number }[];
}

const SHANGHAI_OFFSET_MS = 8 * 3600 * 1000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

/**
 * Gets calendar parts in Asia/Shanghai timezone (UTC+8).
 */
export function getShanghaiDateParts(ms: number) {
  const d = new Date(ms + SHANGHAI_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1, // 1-12
    day: d.getUTCDate(), // 1-31
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes()
  };
}

/**
 * Computes Monday 00:00 (Asia/Shanghai) for the week containing timestamp.
 */
export function getShanghaiMonday(timestamp: number): number {
  const d = new Date(timestamp + SHANGHAI_OFFSET_MS);
  const day = d.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const date = d.getUTCDate() - diffToMonday;
  return Date.UTC(year, month, date) - SHANGHAI_OFFSET_MS;
}

/**
 * Parses timestamp from P9 time string formats (Asia/Shanghai UTC+8).
 * Validates calendar month lengths (including leap years) and relative HH:mm.
 * Returns null if missing or invalid.
 */
export function parseP9Timestamp(text: string, nowMs = Date.now()): number | null {
  const clean = text.trim();
  if (!clean) return null;

  if (clean.includes('刚刚')) {
    return nowMs;
  }

  const nowSh = getShanghaiDateParts(nowMs);

  // YYYY-MM-DD HH:mm or YYYY-MM-DD
  const ymdMatch = clean.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;

    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays || hour < 0 || hour > 23 || min < 0 || min > 59) {
      return null;
    }
    return Date.UTC(year, month - 1, day, hour - 8, min);
  }

  // MM-DD HH:mm
  const mdMatch = clean.match(/(?:^|[^\d])(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    const hour = parseInt(mdMatch[3], 10);
    const min = parseInt(mdMatch[4], 10);

    let year = nowSh.year;
    // If month > current month in Shanghai by more than 1, assume previous year
    if (month > nowSh.month + 1) {
      year -= 1;
    }

    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays || hour < 0 || hour > 23 || min < 0 || min > 59) {
      return null;
    }

    return Date.UTC(year, month - 1, day, hour - 8, min);
  }

  // Relative N天前
  const dayMatch = clean.match(/(\d+)\s*天前/);
  if (dayMatch) {
    const d = parseInt(dayMatch[1], 10);
    if (isNaN(d) || d < 0) return null;
    return nowMs - d * 86400 * 1000;
  }
  // Relative N小时前
  const hourMatch = clean.match(/(\d+)\s*小时前/);
  if (hourMatch) {
    const h = parseInt(hourMatch[1], 10);
    if (isNaN(h) || h < 0) return null;
    return nowMs - h * 3600 * 1000;
  }
  // Relative N分钟前
  const minMatch = clean.match(/(\d+)\s*分钟前/);
  if (minMatch) {
    const m = parseInt(minMatch[1], 10);
    if (isNaN(m) || m < 0) return null;
    return nowMs - m * 60 * 1000;
  }

  // 今天 / 昨天 / 前天 [HH:mm]
  const relDayMatch = clean.match(/(今天|昨天|前天)(?:\s*(\d{1,2}):(\d{1,2}))?/);
  if (relDayMatch) {
    // Check if there is an attempted invalid HH:mm like 25:99
    const colonMatch = clean.match(/(\d+):(\d+)/);
    let h = 0;
    let m = 0;
    let hasTime = false;
    if (colonMatch) {
      h = parseInt(colonMatch[1], 10);
      m = parseInt(colonMatch[2], 10);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        return null;
      }
      hasTime = true;
    }

    let baseSh: { year: number; month: number; day: number };
    if (relDayMatch[1] === '今天') {
      baseSh = nowSh;
    } else if (relDayMatch[1] === '昨天') {
      baseSh = getShanghaiDateParts(nowMs - 86400 * 1000);
    } else {
      baseSh = getShanghaiDateParts(nowMs - 2 * 86400 * 1000);
    }

    if (hasTime) {
      return Date.UTC(baseSh.year, baseSh.month - 1, baseSh.day, h - 8, m);
    }
    if (relDayMatch[1] === '今天') return nowMs;
    if (relDayMatch[1] === '昨天') return nowMs - 86400 * 1000;
    return nowMs - 2 * 86400 * 1000;
  }

  return null;
}

/**
 * Returns ISO 8601 week key (YYYY-Www) in Asia/Shanghai timezone.
 */
export function getISOWeekInfo(timestamp: number): { year: number; week: number; weekKey: string } {
  // Use timestamp shifted to Shanghai
  const date = new Date(timestamp + SHANGHAI_OFFSET_MS);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = date.getTime();
  date.setUTCMonth(0, 4);
  const dayOfWeek = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 3);
  const weekNumber = 1 + Math.round((firstThursday - date.getTime()) / (7 * 86400000));
  const isoYear = new Date(firstThursday).getUTCFullYear();
  const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, '0')}`;
  return { year: isoYear, week: weekNumber, weekKey };
}

const TIME_REGEX = /\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{1,2})?|\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{1,2}|\d+\s*(?:天|小时|分钟)前|刚刚|(?:今天|昨天|前天)(?:\s+\d{1,2}:\d{1,2})?/;

/**
 * Extracts review items from document.
 * Iterates OWN direct metas of each top-level review item, ignoring subcomments (sonlist).
 */
export function extractReviewItems(doc: ParentNode): ReviewItem[] {
  const items: ReviewItem[] = [];
  const commentElements = doc.querySelectorAll('ul.list > li, div.post');

  commentElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.hasAttribute('data-psnine-next')) return;
    // Exclude nested subcomment items
    if (htmlEl.closest('.sonlist, .sonlistmark')) return;

    const mainContainer = htmlEl.querySelector('.ml64') || htmlEl;
    // Direct metas of this review item, excluding any meta belonging to nested subcomments
    const ownMetas = Array.from(mainContainer.querySelectorAll('.meta')).filter(
      (m) => !m.closest('.sonlist, .sonlistmark')
    );

    let score: number | null = null;
    for (const meta of ownMetas) {
      const scoreSpan = meta.querySelector('span.alert-success, em.alert-success');
      if (scoreSpan) {
        const text = scoreSpan.textContent || '';
        const m = text.match(/评分\s*(\d+)/) || text.match(/^(\d+)$/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val >= 1 && val <= 10) {
            score = val;
            break;
          }
        }
      }
    }
    if (score === null) {
      const pScore = mainContainer.querySelector('p.text-success b');
      if (pScore && !pScore.closest('.sonlist, .sonlistmark')) {
        const text = pScore.textContent || '';
        const m = text.match(/评分\s*(\d+)/) || text.match(/^(\d+)$/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val >= 1 && val <= 10) score = val;
        }
      }
    }

    let timestamp: number | null = null;
    let timeStr = '';
    for (const meta of ownMetas) {
      const text = meta.textContent || '';
      const m = text.match(TIME_REGEX);
      if (m) {
        const parsed = parseP9Timestamp(m[0]);
        if (parsed !== null) {
          timeStr = m[0];
          timestamp = parsed;
          break;
        }
      }
    }

    items.push({
      element: htmlEl,
      score,
      timestamp,
      timeStr
    });
  });

  return items;
}

/**
 * Calculates complete statistics for reviews (R01 - R06).
 */
export function calculateReviewStats(items: ReviewItem[]): ReviewStats {
  const scoredItems = items.filter((it): it is ReviewItem & { score: number } => it.score !== null);
  const distribution = new Array(10).fill(0);
  let totalScore = 0;

  for (const it of scoredItems) {
    distribution[it.score - 1] += 1;
    totalScore += it.score;
  }

  const scoredCount = scoredItems.length;
  const average = scoredCount > 0 ? Number((totalScore / scoredCount).toFixed(2)) : 0;

  let variance = 0;
  if (scoredCount > 1) {
    let sumSqDiff = 0;
    for (const it of scoredItems) {
      const diff = it.score - average;
      sumSqDiff += diff * diff;
    }
    variance = sumSqDiff / scoredCount;
  }
  const stdDev = Math.sqrt(variance);

  let maxCount = -1;
  let maxScoreBucket = 10;
  for (let s = 1; s <= 10; s++) {
    if (distribution[s - 1] > maxCount) {
      maxCount = distribution[s - 1];
      maxScoreBucket = s;
    }
  }

  const itemsWithTime = scoredItems
    .filter((it): it is typeof it & { timestamp: number } => it.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const missingTimeCount = scoredItems.length - itemsWithTime.length;
  const cumulativeTrend: ReviewStats['cumulativeTrend'] = [];
  let runningSum = 0;
  for (let i = 0; i < itemsWithTime.length; i++) {
    runningSum += itemsWithTime[i].score;
    const cumAvg = Number((runningSum / (i + 1)).toFixed(2));
    cumulativeTrend.push({
      time: itemsWithTime[i].timestamp,
      timeStr: itemsWithTime[i].timeStr,
      cumAvg,
      score: itemsWithTime[i].score
    });
  }

  const weeklyHeatmap: { weekKey: string; count: number }[] = [];
  if (itemsWithTime.length > 0) {
    const weekCountMap = new Map<string, number>();
    for (const it of itemsWithTime) {
      const { weekKey } = getISOWeekInfo(it.timestamp);
      weekCountMap.set(weekKey, (weekCountMap.get(weekKey) || 0) + 1);
    }

    const firstMonday = getShanghaiMonday(itemsWithTime[0].timestamp);
    const lastMonday = getShanghaiMonday(itemsWithTime[itemsWithTime.length - 1].timestamp);
    const ONE_WEEK_MS = 7 * 86400000;

    let curTime = firstMonday;
    const visitedWeeks = new Set<string>();
    while (curTime <= lastMonday) {
      const { weekKey } = getISOWeekInfo(curTime);
      if (!visitedWeeks.has(weekKey)) {
        visitedWeeks.add(weekKey);
        weeklyHeatmap.push({
          weekKey,
          count: weekCountMap.get(weekKey) || 0
        });
      }
      curTime += ONE_WEEK_MS;
    }
  }

  return {
    totalLoaded: items.length,
    scoredCount,
    average,
    variance,
    stdDev,
    distribution,
    maxScoreBucket,
    cumulativeTrend,
    missingTimeCount,
    weeklyHeatmap
  };
}

export function calculateGaussianPdf(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0.00001) {
    return Math.abs(x - mean) < 0.5 ? 1 : 0;
  }
  const exponent = -((x - mean) * (x - mean)) / (2 * stdDev * stdDev);
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

export function renderScoreDistributionSvg(
  stats: ReviewStats,
  showNormalCurve: boolean,
  activeFilterScore: number | null
): string {
  const { distribution, maxScoreBucket, average, stdDev, scoredCount } = stats;
  if (scoredCount === 0) {
    return '<div class="psnine-empty-chart" style="padding:10px;color:#888;">暂无有效评分样本</div>';
  }

  const svgWidth = 460;
  const svgHeight = 200;
  const margin = { top: 20, right: 30, bottom: 35, left: 35 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const maxCount = Math.max(1, Math.max(...distribution));
  const barWidth = innerWidth / 10;

  let barsHtml = '';
  for (let s = 1; s <= 10; s++) {
    const count = distribution[s - 1];
    const barHeight = (count / maxCount) * innerHeight;
    const x = margin.left + (s - 1) * barWidth + 4;
    const y = margin.top + innerHeight - barHeight;
    const isMax = s === maxScoreBucket;
    const isSelected = activeFilterScore === s;
    const color = isSelected ? '#ff9800' : isMax ? '#da314b' : '#3890ff';
    const opacity = activeFilterScore === null || isSelected ? '1' : '0.35';

    barsHtml += `
      <g class="score-bar-group" data-score="${s}" style="cursor:pointer;" tabindex="0" role="button" aria-label="${s}分: ${count}人">
        <rect x="${x}" y="${y}" width="${barWidth - 8}" height="${Math.max(2, barHeight)}" rx="2" fill="${color}" fill-opacity="${opacity}">
          <title>${s}分: ${count}人 (${((count / scoredCount) * 100).toFixed(1)}%)</title>
        </rect>
        <text x="${x + (barWidth - 8) / 2}" y="${margin.top + innerHeight + 16}" text-anchor="middle" font-size="11" fill="currentColor">${s}</text>
        ${count > 0 ? `<text x="${x + (barWidth - 8) / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.8">${count}</text>` : ''}
      </g>
    `;
  }

  let normalCurveHtml = '';
  if (showNormalCurve && scoredCount > 1) {
    const points: string[] = [];
    const samples = 40;
    let maxPdf = 0;
    for (let i = 0; i <= samples; i++) {
      const xScore = 1 + (i / samples) * 9;
      const pdf = calculateGaussianPdf(xScore, average, stdDev);
      if (pdf > maxPdf) maxPdf = pdf;
    }

    if (maxPdf > 0 && !isNaN(maxPdf)) {
      for (let i = 0; i <= samples; i++) {
        const xScore = 1 + (i / samples) * 9;
        const pdf = calculateGaussianPdf(xScore, average, stdDev);
        const xPos = margin.left + (xScore - 1) * barWidth + (barWidth - 8) / 2;
        const yPos = margin.top + innerHeight - (pdf / maxPdf) * innerHeight;
        if (!isNaN(xPos) && !isNaN(yPos)) {
          points.push(`${xPos.toFixed(1)},${yPos.toFixed(1)}`);
        }
      }
      if (points.length > 1) {
        normalCurveHtml = `<polyline points="${points.join(' ')}" fill="none" stroke="#4caf50" stroke-width="2" stroke-dasharray="4,2" />`;
      }
    }
  }

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="psnine-score-svg" style="width:100%;height:auto;max-height:220px;user-select:none;font-family:inherit;">
      <desc>评论评分分布直方图，横轴为1-10分，纵轴为评价人数</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      ${barsHtml}
      ${normalCurveHtml}
    </svg>
  `;
}

export function renderTrendSvg(stats: ReviewStats): string {
  const { cumulativeTrend, missingTimeCount } = stats;
  if (cumulativeTrend.length < 2) {
    return '<div class="psnine-empty-chart" style="padding:10px;color:#888;">需至少 2 条有效时间样本生成走势图</div>';
  }

  const svgWidth = 460;
  const svgHeight = 200;
  const margin = { top: 20, right: 30, bottom: 35, left: 35 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const avgs = cumulativeTrend.map((d) => d.cumAvg);
  const minAvg = Math.max(0, Math.floor(Math.min(...avgs) - 0.5));
  const maxAvg = Math.min(10, Math.ceil(Math.max(...avgs) + 0.5));
  const ySpan = Math.max(1, maxAvg - minAvg);

  const firstTime = cumulativeTrend[0].time;
  const lastTime = cumulativeTrend[cumulativeTrend.length - 1].time;
  const timeSpan = Math.max(1, lastTime - firstTime);

  const points: string[] = [];
  const len = cumulativeTrend.length;
  for (let i = 0; i < len; i++) {
    const x = margin.left + ((cumulativeTrend[i].time - firstTime) / timeSpan) * innerWidth;
    const y = margin.top + innerHeight - ((cumulativeTrend[i].cumAvg - minAvg) / ySpan) * innerHeight;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const firstDate = new Date(firstTime + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  const lastDate = new Date(lastTime + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="psnine-trend-svg" style="width:100%;height:auto;max-height:220px;user-select:none;font-family:inherit;">
      <desc>累计均分走势折线图，从 ${firstDate} 至 ${lastDate}</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <text x="${margin.left - 5}" y="${margin.top + 5}" text-anchor="end" font-size="10" fill="currentColor">${maxAvg}</text>
      <text x="${margin.left - 5}" y="${margin.top + innerHeight}" text-anchor="end" font-size="10" fill="currentColor">${minAvg}</text>
      <text x="${margin.left}" y="${margin.top + innerHeight + 16}" text-anchor="start" font-size="10" fill="currentColor">${firstDate}</text>
      <text x="${margin.left + innerWidth}" y="${margin.top + innerHeight + 16}" text-anchor="end" font-size="10" fill="currentColor">${lastDate}</text>
      <polyline points="${points.join(' ')}" fill="none" stroke="#3890ff" stroke-width="2.5" />
      <circle cx="${points[points.length - 1].split(',')[0]}" cy="${points[points.length - 1].split(',')[1]}" r="4" fill="#da314b">
        <title>当前均分: ${cumulativeTrend[len - 1].cumAvg}</title>
      </circle>
    </svg>
    <details style="margin-top:4px;font-size:11px;color:#666;">
      <summary style="cursor:pointer;">查看走势数据表格</summary>
      <div style="max-height:100px;overflow-y:auto;margin-top:4px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="border-bottom:1px solid #ddd;"><th style="text-align:left;">日期</th><th style="text-align:right;">当条评分</th><th style="text-align:right;">累计均分</th></tr>
          </thead>
          <tbody>
            ${cumulativeTrend.slice(-15).map(t => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.05);"><td style="text-align:left;">${new Date(t.time + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10)}</td><td style="text-align:right;">${t.score}分</td><td style="text-align:right;font-weight:500;">${t.cumAvg}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </details>
    ${missingTimeCount > 0 ? `<div style="font-size:11px;color:#888;text-align:right;padding-right:10px;margin-top:2px;">注：${missingTimeCount} 条评价无有效时间戳未纳入趋势</div>` : ''}
  `;
}

export function renderWeeklyHeatmapSvg(stats: ReviewStats): string {
  const { weeklyHeatmap, scoredCount, missingTimeCount } = stats;
  if (weeklyHeatmap.length === 0) {
    return '<div class="psnine-empty-chart" style="padding:10px;color:#888;">暂无时间数据</div>';
  }

  const svgWidth = 460;
  const svgHeight = 180;
  const margin = { top: 15, right: 20, bottom: 35, left: 30 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const maxWeeklyCount = Math.max(1, Math.max(...weeklyHeatmap.map(w => w.count)));
  const totalWeeks = weeklyHeatmap.length;
  const colWidth = innerWidth / totalWeeks;

  let barsHtml = '';
  for (let i = 0; i < totalWeeks; i++) {
    const w = weeklyHeatmap[i];
    const barHeight = (w.count / maxWeeklyCount) * innerHeight;
    const x = margin.left + i * colWidth;
    const y = margin.top + innerHeight - barHeight;

    barsHtml += `
      <rect x="${x + 1}" y="${y}" width="${Math.max(1, colWidth - 2)}" height="${Math.max(1, barHeight)}" fill="#20c997">
        <title>${w.weekKey}: ${w.count}条评论</title>
      </rect>
    `;
  }

  const sampleCount = scoredCount - missingTimeCount;

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="psnine-weekly-svg" style="width:100%;height:auto;max-height:200px;user-select:none;font-family:inherit;">
      <desc>每周评论热度柱状图，包含跨年空周</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <text x="${margin.left}" y="${margin.top + innerHeight + 16}" text-anchor="start" font-size="10" fill="currentColor">${weeklyHeatmap[0].weekKey}</text>
      <text x="${margin.left + innerWidth}" y="${margin.top + innerHeight + 16}" text-anchor="end" font-size="10" fill="currentColor">${weeklyHeatmap[totalWeeks - 1].weekKey}</text>
      <text x="${margin.left - 5}" y="${margin.top + 6}" text-anchor="end" font-size="10" fill="currentColor">${maxWeeklyCount}</text>
      ${barsHtml}
    </svg>
    <details style="margin-top:4px;font-size:11px;color:#666;">
      <summary style="cursor:pointer;">查看每周热度数据表格 (${sampleCount} 条时间样本 / ${totalWeeks} 周)</summary>
      <div style="max-height:100px;overflow-y:auto;margin-top:4px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="border-bottom:1px solid #ddd;"><th style="text-align:left;">周 (ISO)</th><th style="text-align:right;">评论数</th></tr>
          </thead>
          <tbody>
            ${weeklyHeatmap.map(w => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.05);"><td style="text-align:left;">${w.weekKey}</td><td style="text-align:right;font-weight:500;">${w.count}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

/**
 * Mounts the Reviews Feature Module.
 * Strictly limited to game comment route /psngame/\\d+/comment/?
 */
export const mountReviews: Mount = (ctx: Context) => {
  const { document: doc, url, onContent, report } = ctx;

  // R01 Route: Only /psngame/\d+/comment/? (profile comments aren't game ratings)
  if (!/^\/psngame\/\d+\/comment\/?$/.test(url.pathname)) {
    return;
  }

  try {
    let showNormalCurve = true;
    let activeFilterScore: number | null = null;
    let activeSubTab: 'dist' | 'weekly' = 'dist';
    let reviewItems: ReviewItem[] = [];

    const containerId = 'psnine-enhanced-reviews-panel';

    const applyFilterToItems = () => {
      for (const item of reviewItems) {
        if (activeFilterScore === null) {
          setHidden(item.element, 'score-filter', false);
        } else {
          setHidden(item.element, 'score-filter', item.score !== activeFilterScore);
        }
      }
    };

    const renderPanel = () => {
      reviewItems = extractReviewItems(doc);
      if (reviewItems.length === 0) return;

      const stats = calculateReviewStats(reviewItems);
      let container = doc.getElementById(containerId);
      if (!container) {
        container = doc.createElement('div');
        container.id = containerId;
        container.setAttribute('data-psnine-next', 'true');
        container.style.cssText = 'margin:15px 0;padding:12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.08);border-radius:8px;box-sizing:border-box;';

        const target = doc.querySelector('div.min-inner.mt40 div.box, .box');
        if (target) {
          const list = target.querySelector('ul.list');
          if (list) {
            target.insertBefore(container, list);
          } else {
            target.appendChild(container);
          }
        }
      }

      container.innerHTML = `
        <div data-psnine-next="true" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div data-psnine-next="true" style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;">
            <span>📊 玩家评测与均分统计</span>
            <span class="alert-success pd5" style="border-radius:4px;font-size:12px;padding:2px 8px;background:#5cb85c;color:#fff;">
              均分 ${stats.average} (${stats.scoredCount}人打分 / 共${stats.totalLoaded}条)
            </span>
          </div>
          <div data-psnine-next="true" style="display:flex;align-items:center;gap:6px;font-size:12px;">
            <button type="button" id="psnine-toggle-tab-btn" data-psnine-next="true" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;background:transparent;cursor:pointer;font-size:12px;">
              ${activeSubTab === 'dist' ? '切换: 每周热度' : '切换: 评分分布'}
            </button>
            <button type="button" id="psnine-toggle-gaussian-btn" data-psnine-next="true" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;background:transparent;cursor:pointer;font-size:12px;">
              ${showNormalCurve ? '正态曲线: 开' : '正态曲线: 关'}
            </button>
            ${activeFilterScore !== null ? `
              <button type="button" id="psnine-clear-score-filter-btn" data-psnine-next="true" style="padding:4px 8px;border-radius:4px;border:1px solid #ff9800;background:rgba(255,152,0,0.1);color:#e65100;cursor:pointer;font-weight:500;">
                清除 ${activeFilterScore}分 筛选
              </button>
            ` : ''}
          </div>
        </div>

        <div data-psnine-next="true" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;align-items:center;">
          <span style="font-size:12px;color:#666;">快捷分段筛选:</span>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
            const count = stats.distribution[s - 1];
            const isSel = activeFilterScore === s;
            return `
              <button type="button" class="psnine-score-filter-chip" data-psnine-next="true" data-score="${s}" style="padding:2px 6px;font-size:11px;border-radius:3px;border:1px solid ${isSel ? '#ff9800' : '#ddd'};background:${isSel ? '#ff9800' : 'rgba(0,0,0,0.03)'};color:${isSel ? '#fff' : 'inherit'};cursor:pointer;">
                ${s}分 (${count})
              </button>
            `;
          }).join('')}
        </div>

        <div data-psnine-next="true" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;">
          <div data-psnine-next="true" style="background:rgba(255,255,255,0.03);border-radius:6px;padding:8px;border:1px solid rgba(0,0,0,0.04);">
            <div style="font-size:12px;font-weight:500;margin-bottom:4px;color:#666;">
              ${activeSubTab === 'dist' ? `评分分布直方图 ${showNormalCurve ? '(含正态拟合)' : ''}` : '每周评分热度趋势 (含空周补零)'}
            </div>
            <div id="psnine-score-dist-container" data-psnine-next="true">
              ${activeSubTab === 'dist' ? renderScoreDistributionSvg(stats, showNormalCurve, activeFilterScore) : renderWeeklyHeatmapSvg(stats)}
            </div>
          </div>
          <div data-psnine-next="true" style="background:rgba(255,255,255,0.03);border-radius:6px;padding:8px;border:1px solid rgba(0,0,0,0.04);">
            <div style="font-size:12px;font-weight:500;margin-bottom:4px;color:#666;">累计均分走势</div>
            <div id="psnine-trend-container" data-psnine-next="true">${renderTrendSvg(stats)}</div>
          </div>
        </div>
      `;

      const tabBtn = doc.getElementById('psnine-toggle-tab-btn');
      if (tabBtn) {
        tabBtn.onclick = () => {
          activeSubTab = activeSubTab === 'dist' ? 'weekly' : 'dist';
          renderPanel();
        };
      }

      const gaussianBtn = doc.getElementById('psnine-toggle-gaussian-btn');
      if (gaussianBtn) {
        gaussianBtn.onclick = () => {
          showNormalCurve = !showNormalCurve;
          renderPanel();
        };
      }

      const clearFilterBtn = doc.getElementById('psnine-clear-score-filter-btn');
      if (clearFilterBtn) {
        clearFilterBtn.onclick = () => {
          applyScoreFilter(null);
        };
      }

      container.querySelectorAll('.score-bar-group, .psnine-score-filter-chip').forEach((el) => {
        const btn = el as HTMLElement;
        const trigger = () => {
          const s = parseInt(btn.getAttribute('data-score') || '0', 10);
          if (s >= 1 && s <= 10) {
            applyScoreFilter(activeFilterScore === s ? null : s);
          }
        };
        btn.onclick = trigger;
        btn.onkeydown = (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            trigger();
          }
        };
      });

      applyFilterToItems();
    };

    const applyScoreFilter = (score: number | null) => {
      activeFilterScore = score;
      renderPanel();
    };

    renderPanel();

    const unsubscribe = onContent((root?: ParentNode) => {
      if (root instanceof HTMLElement) {
        if (root.hasAttribute('data-psnine-next') || root.closest?.('[data-psnine-next]')) {
          return;
        }
        const isOrContainsReview =
          root.matches?.('ul.list > li, div.post') ||
          root.querySelector?.('ul.list > li, div.post') !== null;
        if (!isOrContainsReview) {
          return;
        }
      }

      const freshItems = extractReviewItems(doc);
      if (
        freshItems.length === reviewItems.length &&
        freshItems.every((it, i) => it.element === reviewItems[i]?.element && it.score === reviewItems[i]?.score && it.timestamp === reviewItems[i]?.timestamp)
      ) {
        return;
      }

      renderPanel();
    });

    return () => {
      unsubscribe();
      const container = doc.getElementById(containerId);
      if (container) container.remove();
      for (const it of reviewItems) {
        setHidden(it.element, 'score-filter', false);
      }
    };
  } catch (err) {
    report('reviews', err);
  }
};
