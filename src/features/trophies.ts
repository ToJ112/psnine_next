/**
 * psnine_next - Trophies Feature Module (T01 - T14 + C19)
 *
 * Implements:
 * T01: 奖杯类型统计 (白金/金/银/铜计数和占比)
 * T02: 奖杯稀有度统计 (0–5/5–10/10–20/20–50/50–100 边界)
 * T03: 获得时间曲线 (已获累计数、单点/零点明确呈现、真实时间比例尺与可读数据表)
 * T04: 已获/未获图标汇总 (图标网格button支持键盘、安全URL、无XSS)
 * T05: 汇总 Tips 标记与预览 (悬浮/点击安全DOM展示名称描述与跳转)
 * T06: 奖杯汇总折叠 (默认折叠偏好与手动展开切换)
 * T07: 奖杯图表折叠 (默认折叠偏好与手动展开切换)
 * T08: 获得时间排序 (个人页原生排序菜单内补充最新/最早，持久data-psnine-orig-seq恢复页面初始顺序，DLC分组独立且Tips跟随)
 * T09: 原序/类型/稀有度排序 (保留原生XMB/类型/完美率链接，菜单内补充反向排序与恢复页面初始顺序，DLC 分组不混排)
 * T10: 获得状态筛选 (全部/已获/未获，setHidden多原因隔离，保留内联 Tips 归属)
 * T11: 内联展开单个 Tips (http.document安全DOM保留链接/图片/剧透刮刮条，黑名单大小写忽略，屏蔽词正则与可揭示button，重试与setHidden)
 * T12: 批量全部/未获 Tips (支持全展与仅未获、公开页禁用未获并提示、AbortController支持随时打断无假错误)
 * T13: Tips 顶数排序 (仅限直接子li、持久orig-seq恢复、onContent动态追加)
 * T14: Tips 输入框缩放 (垂直resize、移动端16px防缩放)
 * C19: 攻略中我的奖杯 (slice(0,-3)提取gameId、knownSet+earnedSet准确区分未获与未知、同段多杯独立徽章)
 */

import { Context, Mount } from '../core/types';
import { setHidden, isHiddenByReason } from '../core/dom';
import { parseP9Timestamp } from './reviews';
import { enhanceMasks } from './global';

export type TrophyType = 'platinum' | 'gold' | 'silver' | 'bronze';
export type TrophyEarnedStatus = 'earned' | 'unearned' | 'unknown';

export interface TrophyItem {
  row: HTMLElement;
  table: HTMLElement;
  trophyId: string;
  name: string;
  description: string;
  iconSrc: string;
  type: TrophyType;
  rarityPercent: number;
  status: TrophyEarnedStatus;
  earnedTimestamp: number | null;
  earnedTimeStr: string;
  tipsCount: number;
  originalIndex: number;
}

export interface TrophyStats {
  total: number;
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
  earnedCount: number;
  unearnedCount: number;
  unknownCount: number;
  rarityBuckets: { label: string; count: number }[];
  timeCurve: { time: number; dateStr: string; cumCount: number }[];
  missingTimeCount: number;
}

export interface ParsedTip {
  author: string;
  avatar: string;
  contentEl: HTMLElement | null;
  likes: number;
  timeStr: string;
}

const SHANGHAI_OFFSET_MS = 8 * 3600 * 1000;

/**
 * Extracts trophy type from row classes or cell classes.
 */
export function extractTrophyType(row: Element): TrophyType {
  const tCell = row.querySelector('td.t1, td.t2, td.t3, td.t4');
  if (tCell) {
    if (tCell.classList.contains('t1')) return 'platinum';
    if (tCell.classList.contains('t2')) return 'gold';
    if (tCell.classList.contains('t3')) return 'silver';
    if (tCell.classList.contains('t4')) return 'bronze';
  }
  const text = row.textContent || '';
  if (row.querySelector('.text-platinum') || text.includes('白金')) return 'platinum';
  if (row.querySelector('.text-gold') || text.includes('金杯') || text.includes('（金）')) return 'gold';
  if (row.querySelector('.text-silver') || text.includes('银杯') || text.includes('（银）')) return 'silver';
  return 'bronze';
}

/**
 * Parses rarity percentage from td.twoge (e.g. "3.60% 极为珍贵").
 */
export function parseRarityPercent(td: Element | null): number {
  if (!td) return 100;
  const text = td.textContent || '';
  const m = text.match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : 100;
}

/**
 * Parses all trophy rows from trophy list tables.
 * Accurately reads persistent data-psnine-orig-seq to guarantee page initial order restoration (T08).
 */
export function parseTrophyRows(doc: ParentNode, isPersonalPage: boolean): TrophyItem[] {
  const items: TrophyItem[] = [];
  const tables = (doc instanceof Element && doc.matches('table.list'))
    ? [doc]
    : Array.from(doc.querySelectorAll('table.list'));

  tables.forEach((tbl) => {
    const tableEl = tbl as HTMLElement;
    const rows = Array.from(tableEl.querySelectorAll('tr')).filter(
      r => r.classList.contains('trophy') || (r.id && !isNaN(Number(r.id)))
    );

    // Find max persistent seq across existing rows in this table (Defect 5)
    let maxPersistentSeq = -1;
    rows.forEach((r) => {
      if (r.hasAttribute('data-psnine-orig-seq')) {
        const val = parseInt(r.getAttribute('data-psnine-orig-seq') || '0', 10);
        if (!isNaN(val) && val > maxPersistentSeq) {
          maxPersistentSeq = val;
        }
      }
    });

    rows.forEach((r, idx) => {
      const row = r as HTMLElement;
      if (row.classList.contains('psnine-inline-tip-row') || row.hasAttribute('data-psnine-next')) return;

      // Stable original index from persistent attribute (T08 & Defect 5)
      let originalIndex: number;
      if (row.hasAttribute('data-psnine-orig-seq')) {
        originalIndex = parseInt(row.getAttribute('data-psnine-orig-seq') || '0', 10);
      } else {
        if (maxPersistentSeq === -1) {
          originalIndex = idx;
          maxPersistentSeq = idx;
        } else {
          maxPersistentSeq++;
          originalIndex = maxPersistentSeq;
        }
        row.setAttribute('data-psnine-orig-seq', String(originalIndex));
      }

      const link = row.querySelector('td:nth-child(2) a[href*="/trophy/"], td:not(:first-child) a[href*="/trophy/"]') as HTMLAnchorElement | null;
      const href = link?.href || link?.getAttribute('href') || '';
      const mId = href.match(/\/trophy\/(\d+)/);
      const trophyId = mId ? mId[1] : `seq_${originalIndex}`;

      const name = link?.textContent?.trim() || '奖杯';

      // Robust description extraction (check td.pd15 p, .text-strong, em)
      const descEl = row.querySelector('td.pd15 p, td:nth-child(2) div.text-strong, td:nth-child(2) em.mt10, td div.mt10, td p:last-child');
      const description = descEl?.textContent?.trim() || '';

      const img = row.querySelector('img.imgbg, img');
      const iconSrc = img?.getAttribute('src') || '';

      const type = extractTrophyType(row);
      const rarityTd = row.querySelector('td.twoge, td:last-child');
      const rarityPercent = parseRarityPercent(rarityTd);

      // Status & Timestamp (T03, T04)
      let status: TrophyEarnedStatus = 'unknown';
      let earnedTimestamp: number | null = null;
      let earnedTimeStr = '';

      if (isPersonalPage) {
        const timeEm = row.querySelector('em.alert-success.pd5.r, em.lh180.alert-success.pd5.r, em.alert-success.r');
        const hasEarnedImg = row.querySelector('img.imgbg.earned, img.earned') !== null;
        if (timeEm || hasEarnedImg) {
          status = 'earned';
          if (timeEm) {
            // Replace <br> with space before reading textContent (T03)
            const clone = timeEm.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('br').forEach(br => br.replaceWith(' '));
            const rawTime = clone.textContent?.trim() || '';

            const tipsYear = timeEm.getAttribute('tips') || '';
            const yMatch = tipsYear.match(/(\d{4})/);
            const yearStr = yMatch ? `${yMatch[1]}-` : '';

            earnedTimeStr = `${yearStr}${rawTime}`;
            earnedTimestamp = parseP9Timestamp(earnedTimeStr);
          }
        } else {
          status = 'unearned';
        }
      }

      let tipsCount = 0;
      const tipsBadge = row.querySelector('em.alert-success:not(.r), em.alert-success b');
      if (tipsBadge) {
        const b = tipsBadge.querySelector('b') || tipsBadge;
        const countMatch = b.textContent?.match(/(\d+)/);
        if (countMatch) tipsCount = parseInt(countMatch[1], 10);
      }

      items.push({
        row,
        table: tableEl,
        trophyId,
        name,
        description,
        iconSrc,
        type,
        rarityPercent,
        status,
        earnedTimestamp,
        earnedTimeStr,
        tipsCount,
        originalIndex
      });
    });
  });

  return items;
}

/**
 * Calculates Trophy Stats (T01 - T04).
 */
export function calculateTrophyStats(items: TrophyItem[]): TrophyStats {
  let platinum = 0;
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let earnedCount = 0;
  let unearnedCount = 0;
  let unknownCount = 0;

  const buckets = [
    { label: '0–5% (极为珍贵)', count: 0 },
    { label: '5–10% (非常珍贵)', count: 0 },
    { label: '10–20% (珍贵)', count: 0 },
    { label: '20–50% (比较珍贵)', count: 0 },
    { label: '50–100% (普通)', count: 0 },
  ];

  for (const it of items) {
    if (it.type === 'platinum') platinum++;
    else if (it.type === 'gold') gold++;
    else if (it.type === 'silver') silver++;
    else bronze++;

    if (it.status === 'earned') earnedCount++;
    else if (it.status === 'unearned') unearnedCount++;
    else unknownCount++;

    const r = it.rarityPercent;
    if (r <= 5) buckets[0].count++;
    else if (r <= 10) buckets[1].count++;
    else if (r <= 20) buckets[2].count++;
    else if (r <= 50) buckets[3].count++;
    else buckets[4].count++;
  }

  // T03: Time curve in Asia/Shanghai timezone
  const earnedItemsWithTime = items
    .filter((it): it is typeof it & { earnedTimestamp: number } => it.status === 'earned' && it.earnedTimestamp !== null)
    .sort((a, b) => a.earnedTimestamp - b.earnedTimestamp);

  const missingTimeCount = earnedCount - earnedItemsWithTime.length;
  const timeCurve: TrophyStats['timeCurve'] = [];
  for (let i = 0; i < earnedItemsWithTime.length; i++) {
    timeCurve.push({
      time: earnedItemsWithTime[i].earnedTimestamp,
      dateStr: new Date(earnedItemsWithTime[i].earnedTimestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10),
      cumCount: i + 1
    });
  }

  return {
    total: items.length,
    platinum,
    gold,
    silver,
    bronze,
    earnedCount,
    unearnedCount,
    unknownCount,
    rarityBuckets: buckets,
    timeCurve,
    missingTimeCount
  };
}

/**
 * Sorts trophies strictly WITHIN their DLC table group, keeping inline tips attached (T08, T09).
 */
export type TrophySortMode = 'initial' | 'xmb' | 'time-desc' | 'time-asc' | 'rarity-asc' | 'rarity-desc' | 'type-desc' | 'type-asc';

export function sortTrophiesInTable(
  table: HTMLElement,
  trophies: TrophyItem[],
  mode: TrophySortMode
): void {
  const tableTrophies = trophies.filter(t => t.table === table);
  const tbody = table.querySelector('tbody') || table;

  const sorted = [...tableTrophies].sort((a, b) => {
    if (mode === 'initial' || mode === 'xmb') {
      return a.originalIndex - b.originalIndex;
    }
    if (mode === 'time-desc') {
      if (a.earnedTimestamp === null && b.earnedTimestamp === null) return 0;
      if (a.earnedTimestamp === null) return 1;
      if (b.earnedTimestamp === null) return -1;
      return b.earnedTimestamp - a.earnedTimestamp;
    }
    if (mode === 'time-asc') {
      if (a.earnedTimestamp === null && b.earnedTimestamp === null) return 0;
      if (a.earnedTimestamp === null) return 1;
      if (b.earnedTimestamp === null) return -1;
      return a.earnedTimestamp - b.earnedTimestamp;
    }
    if (mode === 'rarity-asc') {
      return a.rarityPercent - b.rarityPercent;
    }
    if (mode === 'rarity-desc') {
      return b.rarityPercent - a.rarityPercent;
    }
    if (mode === 'type-desc') {
      const typeRank = { platinum: 1, gold: 2, silver: 3, bronze: 4 };
      return typeRank[a.type] - typeRank[b.type];
    }
    if (mode === 'type-asc') {
      const typeRank = { platinum: 1, gold: 2, silver: 3, bronze: 4 };
      return typeRank[b.type] - typeRank[a.type];
    }
    return 0;
  });

  const desiredNodes: HTMLElement[] = [];
  sorted.forEach((item) => {
    desiredNodes.push(item.row);
    const tipRow = table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${item.trophyId}"]`) as HTMLElement | null;
    if (tipRow) {
      desiredNodes.push(tipRow);
    }
  });

  const desiredSet = new Set<Element>(desiredNodes);
  const currentNodes = Array.from(tbody.children).filter(el => desiredSet.has(el));
  const alreadyOrdered =
    currentNodes.length === desiredNodes.length &&
    desiredNodes.every((node, idx) => currentNodes[idx] === node) &&
    sorted.every((item) => {
      const tipRow = table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${item.trophyId}"]`);
      return !tipRow || item.row.nextElementSibling === tipRow;
    });

  if (alreadyOrdered) return;

  desiredNodes.forEach((node) => {
    tbody.appendChild(node);
  });
}

/**
 * Renders Native SVG Trophy Charts including Time Curve (T01, T02, T03).
 */
export function renderTrophyChartsSvg(stats: TrophyStats): string {
  const { total, platinum, gold, silver, bronze, rarityBuckets, timeCurve, missingTimeCount } = stats;
  if (total === 0) return '';

  const svgWidth = 460;
  const svgHeight = 160;

  const pPct = ((platinum / total) * 100).toFixed(1);
  const gPct = ((gold / total) * 100).toFixed(1);
  const sPct = ((silver / total) * 100).toFixed(1);
  const bPct = ((bronze / total) * 100).toFixed(1);

  const maxRarity = Math.max(1, Math.max(...rarityBuckets.map(b => b.count)));

  // T03: Time Curve SVG (supports 1 point, multiple points, or empty statement)
  let timeCurveHtml = '';
  if (timeCurve.length >= 1) {
    const margin = { top: 15, right: 25, bottom: 25, left: 35 };
    const innerW = svgWidth - margin.left - margin.right;
    const innerH = svgHeight - margin.top - margin.bottom;

    const minT = timeCurve[0].time;
    const maxT = timeCurve[timeCurve.length - 1].time;
    const tSpan = Math.max(1, maxT - minT);
    const maxCount = timeCurve[timeCurve.length - 1].cumCount;

    const pts: string[] = [];
    for (const pt of timeCurve) {
      const x = timeCurve.length === 1 ? margin.left + innerW / 2 : margin.left + ((pt.time - minT) / tSpan) * innerW;
      const y = margin.top + innerH - (pt.cumCount / maxCount) * innerH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    timeCurveHtml = `
      <div data-psnine-next="true" class="psnine-trophy-chart-section">
        <div class="psnine-trophy-chart-header" style="font-size:12px;font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;">
          <span>奖杯获得时间积累曲线 (已获: ${timeCurve[timeCurve.length - 1].cumCount}个)</span>
          <span style="font-size:11px;color:var(--p9n-muted,#5f6b7a);">${timeCurve[0].dateStr} ~ ${timeCurve[timeCurve.length - 1].dateStr}</span>
        </div>
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" data-psnine-next="true" style="width:100%;height:100px;font-family:inherit;">
          <line x1="${margin.left}" y1="${margin.top + innerH}" x2="${margin.left + innerW}" y2="${margin.top + innerH}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
          <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerH}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
          <text x="${margin.left - 5}" y="${margin.top + 6}" text-anchor="end" font-size="10" fill="currentColor">${maxCount}</text>
          <text x="${margin.left - 5}" y="${margin.top + innerH}" text-anchor="end" font-size="10" fill="currentColor">0</text>
          ${pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#28a745" stroke-width="2.5" />` : ''}
          ${pts.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="#28a745" />`).join('')}
        </svg>
        <details style="margin-top:4px;font-size:11px;color:var(--p9n-muted,#5f6b7a);">
          <summary style="cursor:pointer;">查看获得时间数据表</summary>
          <div style="max-height:80px;overflow-y:auto;margin-top:4px;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th style="text-align:left;">日期</th><th style="text-align:right;">累计已获</th></tr></thead>
              <tbody>
                ${timeCurve.map(t => `<tr><td>${t.dateStr}</td><td style="text-align:right;">${t.cumCount}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </details>
        ${missingTimeCount > 0 ? `<div style="font-size:10px;color:var(--p9n-muted,#5f6b7a);text-align:right;margin-top:2px;">${missingTimeCount}个已获奖杯缺失时间戳</div>` : ''}
      </div>
    `;
  } else {
    timeCurveHtml = `
      <div data-psnine-next="true" class="psnine-trophy-chart-section" style="font-size:12px;color:var(--p9n-muted,#5f6b7a);">
        暂无有效获得时间记录（已载入样本）
      </div>
    `;
  }

  return `
    <div data-psnine-next="true" class="psnine-trophy-charts">
      <!-- Type Breakdown -->
      <div data-psnine-next="true" class="psnine-trophy-chart-section">
        <div class="psnine-trophy-chart-header" style="font-size:12px;font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;">
          <span>奖杯类型构成 (已载入: ${total})</span>
        </div>
        <div style="height:12px;display:flex;border-radius:6px;overflow:hidden;margin-bottom:8px;">
          <div style="width:${pPct}%;background:#4dabf7;" title="白金: ${platinum} (${pPct}%)"></div>
          <div style="width:${gPct}%;background:#ffd43b;" title="金杯: ${gold} (${gPct}%)"></div>
          <div style="width:${sPct}%;background:#ced4da;" title="银杯: ${silver} (${sPct}%)"></div>
          <div style="width:${bPct}%;background:#e59966;" title="铜杯: ${bronze} (${bPct}%)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span style="color:#1971c2;">白 ${platinum}</span>
          <span style="color:#f59f00;">金 ${gold}</span>
          <span style="color:#868e96;">银 ${silver}</span>
          <span style="color:#d9480f;">铜 ${bronze}</span>
        </div>
        <div style="font-size:10px;color:var(--p9n-muted,#5f6b7a);margin-top:4px;">*统计范围：当前页面已载入样本（不代表站点加权总进度）</div>
      </div>

      <!-- Rarity Breakdown -->
      <div data-psnine-next="true" class="psnine-trophy-chart-section">
        <div class="psnine-trophy-chart-header" style="font-size:12px;font-weight:600;margin-bottom:6px;">稀有度分布</div>
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" data-psnine-next="true" style="width:100%;height:100px;font-family:inherit;">
          ${rarityBuckets.map((b, i) => {
            const h = (b.count / maxRarity) * 80;
            const x = 30 + i * 85;
            const y = 90 - h;
            return `
              <rect x="${x}" y="${y}" width="45" height="${Math.max(2, h)}" rx="3" fill="#3890ff">
                <title>${b.label}: ${b.count}个</title>
              </rect>
              <text x="${x + 22}" y="${y - 4}" text-anchor="middle" font-size="10" fill="currentColor">${b.count}</text>
              <text x="${x + 22}" y="110" text-anchor="middle" font-size="9" fill="currentColor">${b.label.split(' ')[0]}</text>
            `;
          }).join('')}
        </svg>
      </div>

      ${timeCurveHtml}
    </div>
  `;
}

/**
 * Mounts the Trophies Feature Module.
 */
export const mountTrophies: Mount = async (ctx: Context) => {
  const { document: doc, url, settings, store, userId, onContent, report } = ctx;

  const isTrophyListPage = url.pathname.includes('/psngame/') && !url.pathname.includes('/comment');
  const isTrophyDetailPage = url.pathname.includes('/trophy/');
  const isGuideTopicPage = url.pathname.includes('/topic/') || url.pathname.includes('/node/guide');

  let isActive = true;

  try {
    // 1. Single Trophy Detail Page (/trophy/\d+) - T13 & T14
    if (isTrophyDetailPage) {
      const applyT14Textareas = (root: ParentNode = doc) => {
        const textareas = root instanceof Element && root.matches('textarea')
          ? [root]
          : Array.from(root.querySelectorAll('textarea'));
        textareas.forEach((ta) => {
          if (!ta.getAttribute('data-psnine-t14-ready')) {
            ta.setAttribute('data-psnine-t14-ready', 'true');
            ta.setAttribute('style', `${ta.getAttribute('style') || ''};resize:vertical !important;font-size:16px !important;min-height:80px !important;box-sizing:border-box !important;`);
          }
        });
      };

      applyT14Textareas(doc);

      const tipsList = doc.querySelector('ul.list');
      let isLikesSorted = false;

      const parseTipLikes = (li: Element): number => {
        // Direct metas of this li only, strictly excluding any in .sonlist or child li
        const directMetas = Array.from(li.querySelectorAll(':scope > .ml64 > .meta, :scope > .meta, :scope > div > .meta'))
          .filter(m => !m.closest('.sonlist') && m.closest('li') === li);
        for (const meta of directMetas) {
          const upLink = meta.querySelector('a[onclick*="up_tip"], a.btn-up, em.alert-success');
          if (upLink) {
            const m = upLink.textContent?.match(/(\d+)/);
            if (m) return parseInt(m[1], 10);
          }
        }
        const upLinks = Array.from(li.querySelectorAll('a[onclick*="up_tip"], a.btn-up, em.alert-success'))
          .filter(a => !a.closest('.sonlist') && a.closest('li') === li);
        for (const a of upLinks) {
          const m = a.textContent?.match(/(\d+)/);
          if (m) return parseInt(m[1], 10);
        }
        return 0;
      };

      const updateT13Tips = () => {
        if (!tipsList) return;
        const directLis = Array.from(tipsList.querySelectorAll(':scope > li'));
        if (directLis.length === 0) return;

        let maxSeq = -1;
        directLis.forEach((li) => {
          if (li.hasAttribute('data-psnine-orig-seq')) {
            const val = parseInt(li.getAttribute('data-psnine-orig-seq') || '0', 10);
            if (!isNaN(val) && val > maxSeq) maxSeq = val;
          }
        });

        directLis.forEach((li, idx) => {
          if (!li.hasAttribute('data-psnine-orig-seq')) {
            if (maxSeq === -1) {
              maxSeq = idx;
              li.setAttribute('data-psnine-orig-seq', String(idx));
            } else {
              maxSeq++;
              li.setAttribute('data-psnine-orig-seq', String(maxSeq));
            }
          }
        });

        const targetOrder = [...directLis].sort((a, b) => {
          const seqA = parseInt(a.getAttribute('data-psnine-orig-seq') || '0', 10);
          const seqB = parseInt(b.getAttribute('data-psnine-orig-seq') || '0', 10);
          if (!isLikesSorted) {
            return seqA - seqB;
          }
          const likesA = parseTipLikes(a);
          const likesB = parseTipLikes(b);
          if (likesB !== likesA) {
            return likesB - likesA;
          }
          return seqA - seqB;
        });

        const isDifferent = targetOrder.some((el, i) => el !== directLis[i]);
        if (isDifferent) {
          targetOrder.forEach(li => tipsList.appendChild(li));
        }
      };

      if (tipsList && !doc.getElementById('psnine-sort-tips-by-likes-btn')) {
        updateT13Tips();

        const sortBtn = doc.createElement('button');
        sortBtn.id = 'psnine-sort-tips-by-likes-btn';
        sortBtn.type = 'button';
        sortBtn.setAttribute('data-psnine-next', 'true');
        sortBtn.style.cssText = 'padding:4px 8px;font-size:12px;border-radius:4px;border:1px solid #3890ff;background:transparent;color:#3890ff;cursor:pointer;margin-bottom:8px;';
        sortBtn.textContent = '🔥 按“顶”数热度排序Tips';

        sortBtn.onclick = () => {
          isLikesSorted = !isLikesSorted;
          sortBtn.textContent = isLikesSorted ? '🔄 恢复默认排序' : '🔥 按“顶”数热度排序Tips';
          updateT13Tips();
        };

        tipsList.parentElement?.insertBefore(sortBtn, tipsList);
      }

      const unsubscribe = onContent((root) => {
        if (isActive) {
          applyT14Textareas(root);
          updateT13Tips();
        }
      });

      return () => {
        isActive = false;
        unsubscribe();
      };
    }

    // 2. Guide Page (/topic/\d+) - C19: exact slice(0,-3) 提取 gameId、knownSet + earnedSet、同段多杯独立徽标
    if (isGuideTopicPage && userId) {
      const pageAbortController = new AbortController();

      interface GameData {
        verifiedPersonal: boolean;
        knownSet: Set<string>;
        earnedSet: Set<string>;
      }

      const gameCache = new Map<string, Promise<GameData | null>>();

      const fetchGameData = (gid: string): Promise<GameData | null> => {
        if (gameCache.has(gid)) {
          return gameCache.get(gid)!;
        }
        const p = (async () => {
          try {
            const targetUrl = new URL(`/psngame/${gid}?psnid=${userId}`, ctx.url.origin).href;
            const gameDoc = await ctx.http.document(targetUrl, { ttl: 600000, signal: pageAbortController.signal });
            if (!isActive || pageAbortController.signal.aborted) return null;

            const trophyRows = Array.from(gameDoc.querySelectorAll('table.list tr.trophy, tr.trophy, table.list tr[id]'))
              .filter(r => r.querySelector('a[href*="/trophy/"]') !== null);

            // Verification of personal view:
            // Must contain user-specific link or earned indicators on trophy rows
            const hasUserLink = Array.from(gameDoc.querySelectorAll('a[href*="/psnid/"]'))
              .some(a => (a.getAttribute('href') || '').toLowerCase().includes(`/psnid/${userId.toLowerCase()}`));
            const hasEarnedMarker = gameDoc.querySelector('tr.trophy img.earned, tr.trophy .imgbg.earned, tr.trophy em.alert-success.r, img.earned') !== null;

            const verifiedPersonal = (hasUserLink || hasEarnedMarker) && trophyRows.length > 0;

            const knownSet = new Set<string>();
            const earnedSet = new Set<string>();

            trophyRows.forEach((tr) => {
              const a = tr.querySelector('a[href*="/trophy/"]');
              const tm = a?.getAttribute('href')?.match(/\/trophy\/(\d+)/);
              if (tm) {
                const id = tm[1];
                knownSet.add(id);
                const isEarned = tr.querySelector('img.earned, img.imgbg.earned, em.alert-success.r') !== null;
                if (isEarned) earnedSet.add(id);
              }
            });

            return { verifiedPersonal, knownSet, earnedSet };
          } catch (err) {
            if (!pageAbortController.signal.aborted) {
              report('guide_trophies_sync', err);
            }
            return null;
          }
        })();
        gameCache.set(gid, p);
        return p;
      };

      const annotateArticleTrophies = async () => {
        // Scoped article only:
        const articleContainer = doc.querySelector('.post .content, .post, article, .page_content, .min-inner');
        const rootToSearch = articleContainer || doc;
        const trophyLinks = Array.from(rootToSearch.querySelectorAll('a[href*="/trophy/"]')) as HTMLAnchorElement[];

        if (trophyLinks.length === 0) return;

        const linksToProcess: Array<{ a: HTMLAnchorElement; tId: string; gid: string }> = [];
        const neededGids = new Set<string>();

        for (const a of trophyLinks) {
          if (a.hasAttribute('data-psnine-badge-bound')) continue;
          const href = a.href || a.getAttribute('href') || '';
          const m = href.match(/\/trophy\/(\d+)/);
          if (m) {
            const tId = m[1];
            // Exact derived gameId: last 3 digits are trophy index, prefix is gameId (no startsWith prefix override)
            const gid = tId.length > 3 ? tId.slice(0, -3) : tId;
            linksToProcess.push({ a, tId, gid });
            neededGids.add(gid);
          }
        }

        if (linksToProcess.length === 0) return;

        // Fetch each known game at most once (cached)
        for (const gid of neededGids) {
          fetchGameData(gid);
        }

        for (const item of linksToProcess) {
          if (item.a.hasAttribute('data-psnine-badge-bound')) continue;
          const gameData = await fetchGameData(item.gid);
          if (!isActive || pageAbortController.signal.aborted) return;

          item.a.setAttribute('data-psnine-badge-bound', 'true');

          let badgeText = '❓ 状态未知';
          let bg = '#6c757d';
          let fg = '#fff';

          if (gameData && gameData.verifiedPersonal) {
            if (gameData.earnedSet.has(item.tId)) {
              badgeText = '✅ 已获得';
              bg = '#28a745';
              fg = '#fff';
            } else if (gameData.knownSet.has(item.tId)) {
              badgeText = '⏳ 未获得';
              bg = '#ffc107';
              fg = '#000';
            }
          }

          const badge = doc.createElement('span');
          badge.className = 'psnine-guide-trophy-badge';
          badge.setAttribute('data-psnine-next', 'true');
          badge.style.cssText = `display:inline-block;padding:1px 5px;font-size:11px;border-radius:3px;margin-left:4px;background:${bg};color:${fg};font-weight:500;`;
          badge.textContent = badgeText;
          item.a.after(badge);
        }
      };

      await annotateArticleTrophies();

      const unsubscribe = onContent(() => {
        if (isActive) {
          annotateArticleTrophies();
        }
      });

      return () => {
        isActive = false;
        pageAbortController.abort();
        unsubscribe();
      };
    }

    // 3. Trophy List Page (/psngame/\d+) - T01-T12
    if (isTrophyListPage) {
      const pageAbortController = new AbortController();
      let batchAbortController: AbortController | null = null;
      const activeManualControllers = new Map<string, AbortController>();

      const isPersonalPage = url.searchParams.has('psnid');
      let currentSortMode: TrophySortMode | null = null;
      let cleanupNativeSortDropdown: (() => void) | null = null;
      let cleanupNativeFilterSync: (() => void) | null = null;
      let isBatchRunning = false;

      const applyActiveSortToTables = (mode: TrophySortMode) => {
        doc.querySelectorAll('table.list').forEach((tbl) => {
          sortTrophiesInTable(tbl as HTMLElement, currentTrophies, mode);
        });
      };

      const ensureNativeSortDropdown = () => {
        const candidates = Array.from(doc.querySelectorAll('ul.dropmenu > li.dropdown'));
        let targetDropdown: {
          dropdownLi: HTMLElement;
          trigger: HTMLAnchorElement;
          submenu: HTMLUListElement;
        } | null = null;

        for (const li of candidates) {
          const dropdownLi = li as HTMLElement;
          const trigger = dropdownLi.querySelector(':scope > a') as HTMLAnchorElement | null;
          const submenu = dropdownLi.querySelector(':scope > ul') as HTMLUListElement | null;
          if (!trigger || !submenu) continue;

          const nativeLinks = Array.from(submenu.querySelectorAll(':scope > li > a')) as HTMLAnchorElement[];
          const obs = new Set<string>();
          for (const a of nativeLinks) {
            if (a.hasAttribute('data-psnine-sort')) continue;
            const rawHref = a.getAttribute('href') || '';
            if (!rawHref || rawHref.startsWith('javascript:')) continue;
            try {
              const u = new URL(rawHref, url.href);
              if (u.origin !== url.origin || u.pathname !== url.pathname) continue;
              const ob = u.searchParams.get('ob');
              if (ob === 'trophyid' || ob === 'type' || ob === 'rarity') {
                obs.add(ob);
              }
            } catch {
              // ignore malformed href
            }
          }
          if (obs.has('trophyid') && obs.has('type') && obs.has('rarity')) {
            targetDropdown = { dropdownLi, trigger, submenu };
            break;
          }
        }

        if (!targetDropdown) return;
        const { dropdownLi, trigger, submenu } = targetDropdown;

        if (
          dropdownLi.getAttribute('data-psnine-trophy-sort-dropdown') === 'true' &&
          submenu.querySelector('[data-psnine-sort="initial"]')
        ) {
          return;
        }

        cleanupNativeSortDropdown?.();

        const origHadHover = dropdownLi.classList.contains('hover');
        const origDropdownAttr = dropdownLi.getAttribute('data-psnine-trophy-sort-dropdown');
        const origTriggerAttr = trigger.getAttribute('data-psnine-trophy-sort-trigger');
        const origAriaHaspopup = trigger.getAttribute('aria-haspopup');
        const origAriaExpanded = trigger.getAttribute('aria-expanded');
        const origTriggerText = trigger.textContent;
        const origMenuAttr = submenu.getAttribute('data-psnine-trophy-sort-menu');
        const origNativeLinks = Array.from(submenu.querySelectorAll(':scope > li > a')) as HTMLAnchorElement[];
        const origCurrentNativeLinks = new Set<HTMLAnchorElement>(
          origNativeLinks.filter(a => a.classList.contains('current'))
        );

        dropdownLi.setAttribute('data-psnine-trophy-sort-dropdown', 'true');
        trigger.setAttribute('data-psnine-trophy-sort-trigger', 'true');
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        submenu.setAttribute('data-psnine-trophy-sort-menu', 'true');

        let isDropdownOpen = false;
        const setDropdownOpen = (open: boolean, restoreFocus = false) => {
          isDropdownOpen = open;
          if (open) {
            dropdownLi.classList.add('psnine-dropdown-open', 'hover');
            dropdownLi.setAttribute('data-psnine-dropdown-open', 'true');
            dropdownLi.setAttribute('data-psnine-dropdown-state', 'open');
            trigger.setAttribute('aria-expanded', 'true');
          } else {
            dropdownLi.classList.remove('psnine-dropdown-open', 'hover');
            dropdownLi.removeAttribute('data-psnine-dropdown-open');
            dropdownLi.setAttribute('data-psnine-dropdown-state', 'closed');
            trigger.setAttribute('aria-expanded', 'false');
            if (restoreFocus) {
              trigger.focus();
            }
          }
        };

        const extraItems: Array<{ mode: TrophySortMode; label: string }> = [
          ...(isPersonalPage
            ? [
                { mode: 'time-desc' as const, label: '获得时间（新→旧）' },
                { mode: 'time-asc' as const, label: '获得时间（旧→新）' }
              ]
            : []),
          { mode: 'type-asc', label: '类型（铜→白金）' },
          { mode: 'rarity-desc', label: '完美率（高→低）' },
          { mode: 'initial', label: '页面初始顺序' }
        ];

        const createdLis: HTMLLIElement[] = [];
        const itemCleanups: Array<() => void> = [];

        const selectLocalSort = (mode: TrophySortMode, label: string, restoreFocus: boolean) => {
          currentSortMode = mode;
          trigger.textContent = label;
          submenu.querySelectorAll(':scope > li > a').forEach((el) => {
            if (el.getAttribute('data-psnine-sort') === mode) {
              el.classList.add('current');
              el.setAttribute('data-psnine-sort-active', 'true');
            } else {
              el.classList.remove('current');
              el.removeAttribute('data-psnine-sort-active');
            }
          });
          applyActiveSortToTables(mode);
          setDropdownOpen(false, restoreFocus);
        };

        for (const item of extraItems) {
          const li = doc.createElement('li');
          li.setAttribute('data-psnine-next', 'true');
          li.setAttribute('data-psnine-sort-item', item.mode);

          const a = doc.createElement('a');
          a.href = 'javascript:void(0)';
          a.setAttribute('data-psnine-next', 'true');
          a.setAttribute('data-psnine-sort', item.mode);
          a.textContent = item.label;

          const onItemClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            selectLocalSort(item.mode, item.label, false);
          };
          const onItemKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              selectLocalSort(item.mode, item.label, true);
            }
          };

          a.addEventListener('click', onItemClick);
          a.addEventListener('keydown', onItemKeyDown);
          itemCleanups.push(() => {
            a.removeEventListener('click', onItemClick);
            a.removeEventListener('keydown', onItemKeyDown);
          });

          li.appendChild(a);
          submenu.appendChild(li);
          createdLis.push(li);
        }

        const onTriggerClick = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setDropdownOpen(!isDropdownOpen);
        };

        const onTriggerKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setDropdownOpen(!isDropdownOpen);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setDropdownOpen(true);
            const firstLink = submenu.querySelector(':scope > li > a') as HTMLElement | null;
            firstLink?.focus();
          } else if (e.key === 'Escape') {
            if (isDropdownOpen || dropdownLi.classList.contains('hover')) {
              e.preventDefault();
              e.stopPropagation();
              setDropdownOpen(false, true);
            }
          }
        };

        const onDropdownKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            if (isDropdownOpen || dropdownLi.classList.contains('hover') || dropdownLi.contains(doc.activeElement)) {
              e.preventDefault();
              e.stopPropagation();
              setDropdownOpen(false, true);
            }
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const links = Array.from(submenu.querySelectorAll(':scope > li > a')) as HTMLElement[];
            const idx = links.indexOf(doc.activeElement as HTMLElement);
            if (idx !== -1 && links.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              const nextIdx = e.key === 'ArrowDown'
                ? (idx + 1) % links.length
                : (idx - 1 + links.length) % links.length;
              links[nextIdx]?.focus();
            }
          }
        };

        const onDropdownPointerEnter = (e: PointerEvent) => {
          if (e.pointerType === 'mouse' && !isDropdownOpen && dropdownLi.getAttribute('data-psnine-dropdown-state') === 'closed') {
            dropdownLi.removeAttribute('data-psnine-dropdown-state');
          }
        };

        const onDropdownFocusOut = (e: FocusEvent) => {
          const nextTarget = e.relatedTarget as Node | null;
          if (nextTarget && !dropdownLi.contains(nextTarget)) {
            setDropdownOpen(false, false);
          } else if (
            !nextTarget &&
            doc.activeElement &&
            doc.activeElement !== doc.body &&
            !dropdownLi.contains(doc.activeElement)
          ) {
            setDropdownOpen(false, false);
          }
        };

        const onDocClick = (e: MouseEvent) => {
          if (!isDropdownOpen && !dropdownLi.classList.contains('hover')) return;
          const target = e.target as Node | null;
          if (target && !dropdownLi.contains(target)) {
            setDropdownOpen(false, false);
          }
        };

        const onDocKeyDown = (e: KeyboardEvent) => {
          if (e.key !== 'Escape') return;
          if (dropdownLi.contains(doc.activeElement)) {
            e.preventDefault();
            setDropdownOpen(false, true);
          } else if (isDropdownOpen || dropdownLi.classList.contains('hover')) {
            setDropdownOpen(false, false);
          }
        };

        trigger.addEventListener('click', onTriggerClick);
        trigger.addEventListener('keydown', onTriggerKeyDown);
        dropdownLi.addEventListener('keydown', onDropdownKeyDown);
        dropdownLi.addEventListener('pointerenter', onDropdownPointerEnter);
        dropdownLi.addEventListener('focusout', onDropdownFocusOut);
        doc.addEventListener('click', onDocClick);
        doc.addEventListener('keydown', onDocKeyDown);

        cleanupNativeSortDropdown = () => {
          trigger.removeEventListener('click', onTriggerClick);
          trigger.removeEventListener('keydown', onTriggerKeyDown);
          dropdownLi.removeEventListener('keydown', onDropdownKeyDown);
          dropdownLi.removeEventListener('pointerenter', onDropdownPointerEnter);
          dropdownLi.removeEventListener('focusout', onDropdownFocusOut);
          doc.removeEventListener('click', onDocClick);
          doc.removeEventListener('keydown', onDocKeyDown);
          itemCleanups.forEach(fn => fn());
          createdLis.forEach(li => li.remove());

          dropdownLi.classList.remove('psnine-dropdown-open');
          if (origHadHover) dropdownLi.classList.add('hover');
          else dropdownLi.classList.remove('hover');
          dropdownLi.removeAttribute('data-psnine-dropdown-open');
          dropdownLi.removeAttribute('data-psnine-dropdown-state');

          if (origDropdownAttr === null) dropdownLi.removeAttribute('data-psnine-trophy-sort-dropdown');
          else dropdownLi.setAttribute('data-psnine-trophy-sort-dropdown', origDropdownAttr);

          if (origTriggerAttr === null) trigger.removeAttribute('data-psnine-trophy-sort-trigger');
          else trigger.setAttribute('data-psnine-trophy-sort-trigger', origTriggerAttr);

          if (origAriaHaspopup === null) trigger.removeAttribute('aria-haspopup');
          else trigger.setAttribute('aria-haspopup', origAriaHaspopup);

          if (origAriaExpanded === null) trigger.removeAttribute('aria-expanded');
          else trigger.setAttribute('aria-expanded', origAriaExpanded);

          trigger.textContent = origTriggerText;
          origNativeLinks.forEach((a) => {
            if (origCurrentNativeLinks.has(a)) a.classList.add('current');
            else a.classList.remove('current');
          });

          if (origMenuAttr === null) submenu.removeAttribute('data-psnine-trophy-sort-menu');
          else submenu.setAttribute('data-psnine-trophy-sort-menu', origMenuAttr);
        };
      };

      let currentTrophies: TrophyItem[] = [];
      let observedOwnBtn: HTMLElement | null = null;
      let observedUnownBtn: HTMLElement | null = null;
      let nativeFilterClassObserver: MutationObserver | null = null;
      let docFilterClickBound = false;

      const getNativeFilterControls = (): { ownBtn: HTMLElement | null; unownBtn: HTMLElement | null } => {
        const ownBtn = doc.querySelector<HTMLElement>('ul.dropmenu .own, .o_btn.own, [onclick*="getOwn"]');
        const unownBtn = doc.querySelector<HTMLElement>('ul.dropmenu .unown, .o_btn.unown, [onclick*="getUnOwn"]');
        return { ownBtn, unownBtn };
      };

      const getNativeFilterMode = (): 'all' | 'earned' | 'unearned' => {
        const { ownBtn, unownBtn } = getNativeFilterControls();
        if (ownBtn?.classList.contains('select')) return 'earned';
        if (unownBtn?.classList.contains('select')) return 'unearned';
        return 'all';
      };

      const isTrophyRowEarned = (t: TrophyItem): boolean => {
        return t.status === 'earned' || t.row.querySelector('.earned') !== null;
      };

      const isTrophyRowFilteredOut = (t: TrophyItem): boolean => {
        const nativeMode = getNativeFilterMode();
        const isEarned = isTrophyRowEarned(t);
        const shouldHideByNativeMode =
          (nativeMode === 'earned' && !isEarned) ||
          (nativeMode === 'unearned' && isEarned);
        return shouldHideByNativeMode || t.row.style.display === 'none' || t.row.hidden;
      };

      const syncNativeFilter = () => {
        if (!isActive) return;
        const nativeMode = getNativeFilterMode();

        currentTrophies.forEach((t) => {
          const isEarned = isTrophyRowEarned(t);
          const shouldHideByNativeMode =
            (nativeMode === 'earned' && !isEarned) ||
            (nativeMode === 'unearned' && isEarned);

          if (shouldHideByNativeMode) {
            if (t.row.style.display !== 'none') {
              t.row.style.display = 'none';
              t.row.setAttribute('data-psnine-native-sync-hidden', 'true');
            }
          } else if (t.row.getAttribute('data-psnine-native-sync-hidden') === 'true') {
            t.row.removeAttribute('data-psnine-native-sync-hidden');
            if (t.row.style.display === 'none') {
              t.row.style.removeProperty('display');
            }
          }

          const rowIsHidden = shouldHideByNativeMode || t.row.style.display === 'none' || t.row.hidden;
          const tipRow = t.table.querySelector<HTMLElement>(`tr.psnine-inline-tip-row[data-for-trophy="${t.trophyId}"]`);
          if (tipRow && isHiddenByReason(tipRow, 'trophy-status-filter') !== rowIsHidden) {
            setHidden(tipRow, 'trophy-status-filter', rowIsHidden);
          }
        });
      };

      const onDocNativeFilterClick = (e: MouseEvent) => {
        if (!isActive) return;
        const target = e.target as Node | null;
        if (!target) return;
        const { ownBtn, unownBtn } = getNativeFilterControls();
        const hitOwn = ownBtn ? (ownBtn === target || ownBtn.contains(target)) : false;
        const hitUnown = unownBtn ? (unownBtn === target || unownBtn.contains(target)) : false;
        if (!hitOwn && !hitUnown) return;
        syncNativeFilter();
        queueMicrotask(() => {
          if (isActive) syncNativeFilter();
        });
      };

      const ensureNativeFilterSync = () => {
        if (!docFilterClickBound) {
          doc.addEventListener('click', onDocNativeFilterClick);
          docFilterClickBound = true;
        }

        const { ownBtn, unownBtn } = getNativeFilterControls();
        if (ownBtn !== observedOwnBtn || unownBtn !== observedUnownBtn) {
          nativeFilterClassObserver?.disconnect();
          nativeFilterClassObserver = null;
          observedOwnBtn = ownBtn;
          observedUnownBtn = unownBtn;

          if (ownBtn || unownBtn) {
            nativeFilterClassObserver = new MutationObserver(() => {
              if (isActive) syncNativeFilter();
            });
            if (ownBtn) {
              nativeFilterClassObserver.observe(ownBtn, { attributes: true, attributeFilter: ['class'] });
            }
            if (unownBtn && unownBtn !== ownBtn) {
              nativeFilterClassObserver.observe(unownBtn, { attributes: true, attributeFilter: ['class'] });
            }
          }
        }

        cleanupNativeFilterSync = () => {
          if (docFilterClickBound) {
            doc.removeEventListener('click', onDocNativeFilterClick);
            docFilterClickBound = false;
          }
          nativeFilterClassObserver?.disconnect();
          nativeFilterClassObserver = null;
          observedOwnBtn = null;
          observedUnownBtn = null;

          doc.querySelectorAll<HTMLElement>('tr.psnine-inline-tip-row').forEach((tipRow) => {
            if (isHiddenByReason(tipRow, 'trophy-status-filter')) {
              setHidden(tipRow, 'trophy-status-filter', false);
            }
          });
          doc.querySelectorAll<HTMLElement>('tr[data-psnine-native-sync-hidden="true"]').forEach((row) => {
            row.removeAttribute('data-psnine-native-sync-hidden');
            if (row.style.display === 'none') {
              row.style.removeProperty('display');
            }
          });
        };
      };

      const enhanceTrophyPage = () => {
        currentTrophies = parseTrophyRows(doc, isPersonalPage);
        if (currentTrophies.length === 0) return;

        ensureNativeSortDropdown();
        ensureNativeFilterSync();

        doc.getElementById('psnine-trophy-stats-panel')?.remove();

        let tipsToolbar = doc.getElementById('psnine-trophy-tips-toolbar');
        if (!tipsToolbar) {
          tipsToolbar = doc.createElement('div');
          tipsToolbar.id = 'psnine-trophy-tips-toolbar';
          tipsToolbar.setAttribute('data-psnine-next', 'true');
          tipsToolbar.className = 'psnine-trophy-toolbar';

          const target = doc.querySelector('.main, .box.pd10, .min-inner');
          const firstTbl = doc.querySelector('table.list');
          if (firstTbl && firstTbl.parentElement) {
            firstTbl.parentElement.insertBefore(tipsToolbar, firstTbl);
          } else if (target) {
            target.appendChild(tipsToolbar);
          }
        }

        if (!tipsToolbar.hasChildNodes()) {
          tipsToolbar.innerHTML = `
            <div data-psnine-next="true" class="psnine-trophy-action-group">
              <button type="button" id="psnine-batch-load-all-tips-btn" class="psnine-trophy-pill-btn" data-psnine-next="true">
                展开所有Tips
              </button>
              <button type="button" id="psnine-batch-load-unearned-tips-btn" class="psnine-trophy-pill-btn" data-psnine-next="true"${!isPersonalPage ? ' disabled title="公开页面无法确认获得状态，请访问个人奖杯页使用此功能"' : ''}>
                展开未获Tips
              </button>
              <button type="button" id="psnine-stop-batch-tips-btn" class="psnine-trophy-pill-btn danger" data-psnine-next="true" style="display:none;">
                停止加载
              </button>
            </div>
          `;

          // T12 Batch Tips Loading
          const runBatchQueue = async (unearnedOnly: boolean) => {
            if (isBatchRunning) return;
            isBatchRunning = true;
            batchAbortController = new AbortController();

            const batchAllBtn = doc.getElementById('psnine-batch-load-all-tips-btn');
            const batchUnearnedBtn = doc.getElementById('psnine-batch-load-unearned-tips-btn');
            const stopBtn = doc.getElementById('psnine-stop-batch-tips-btn');

            if (batchAllBtn) batchAllBtn.style.display = 'none';
            if (batchUnearnedBtn) batchUnearnedBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'inline-block';

            const targets = currentTrophies.filter(t => t.tipsCount > 0 && (!unearnedOnly || t.status === 'unearned'));
            for (const t of targets) {
              if (!isActive || batchAbortController.signal.aborted) break;
              const existing = t.table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${t.trophyId}"]`);
              if (!existing) {
                await toggleInlineTips(t, batchAbortController.signal);
                if (!isActive || batchAbortController.signal.aborted) break;
                try {
                  await new Promise<void>((resolve, reject) => {
                    let timer: any = null;
                    const onAbort = () => {
                      if (timer) clearTimeout(timer);
                      batchAbortController?.signal.removeEventListener('abort', onAbort);
                      reject(new Error('aborted'));
                    };
                    timer = setTimeout(() => {
                      batchAbortController?.signal.removeEventListener('abort', onAbort);
                      resolve();
                    }, 300);
                    batchAbortController?.signal.addEventListener('abort', onAbort, { once: true });
                  });
                } catch {
                  break;
                }
              }
            }

            if (stopBtn) stopBtn.style.display = 'none';
            if (batchAllBtn) batchAllBtn.style.display = 'inline-block';
            if (batchUnearnedBtn) batchUnearnedBtn.style.display = 'inline-block';
            isBatchRunning = false;
          };

          const batchAllBtn = doc.getElementById('psnine-batch-load-all-tips-btn');
          if (batchAllBtn) batchAllBtn.onclick = () => runBatchQueue(false);
          const batchUnearnedBtn = doc.getElementById('psnine-batch-load-unearned-tips-btn');
          if (batchUnearnedBtn && isPersonalPage) batchUnearnedBtn.onclick = () => runBatchQueue(true);

          const stopBtn = doc.getElementById('psnine-stop-batch-tips-btn');
          if (stopBtn) {
            stopBtn.onclick = () => {
              batchAbortController?.abort();
              stopBtn.style.display = 'none';
              if (batchAllBtn) batchAllBtn.style.display = 'inline-block';
              if (batchUnearnedBtn) batchUnearnedBtn.style.display = 'inline-block';
            };
          }
        } else if (currentSortMode !== null) {
          applyActiveSortToTables(currentSortMode);
        }

        syncNativeFilter();

        // T11 Single Tip Loader Binding
        currentTrophies.forEach((t) => {
          const tipsBadge = t.row.querySelector('em.alert-success:not(.r)') as HTMLElement | null;
          if (tipsBadge && !tipsBadge.classList.contains('psnine-bound-tip')) {
            tipsBadge.classList.add('psnine-bound-tip');
            tipsBadge.style.cursor = 'pointer';
            tipsBadge.setAttribute('role', 'button');
            tipsBadge.setAttribute('tabindex', '0');
            tipsBadge.setAttribute('title', '点击在下方内联展开本奖杯Tips (键盘可回车)');

            const triggerHandler = async (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              await toggleInlineTips(t);
            };

            tipsBadge.onclick = triggerHandler;
            tipsBadge.onkeydown = (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                triggerHandler(e);
              }
            };
          }
        });
      };

      // T11 Safe DOM Inline Tips Loader
      const toggleInlineTips = async (t: TrophyItem, customSignal?: AbortSignal) => {
        const existingTipRow = t.table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${t.trophyId}"]`) as HTMLElement | null;
        if (existingTipRow) {
          if (activeManualControllers.has(t.trophyId) && !customSignal) {
            activeManualControllers.get(t.trophyId)!.abort();
            activeManualControllers.delete(t.trophyId);
            existingTipRow.remove();
            return;
          }
          const isH = isHiddenByReason(existingTipRow, 'inline-tip-toggle');
          setHidden(existingTipRow, 'inline-tip-toggle', !isH);
          return;
        }

        let requestSignal: AbortSignal;
        let manualCtrl: AbortController | null = null;
        let onPageAbort: (() => void) | null = null;

        if (customSignal) {
          requestSignal = customSignal;
        } else {
          manualCtrl = new AbortController();
          activeManualControllers.set(t.trophyId, manualCtrl);
          requestSignal = manualCtrl.signal;
          onPageAbort = () => manualCtrl?.abort();
          pageAbortController.signal.addEventListener('abort', onPageAbort, { once: true });
        }

        const tipRow = doc.createElement('tr');
        tipRow.className = 'psnine-inline-tip-row';
        tipRow.setAttribute('data-psnine-next', 'true');
        tipRow.setAttribute('data-for-trophy', t.trophyId);

        if (isTrophyRowFilteredOut(t)) {
          setHidden(tipRow, 'trophy-status-filter', true);
        }

        const td = doc.createElement('td');
        td.setAttribute('colspan', '4');
        td.setAttribute('data-psnine-next', 'true');
        td.style.cssText = 'padding:10px 15px;background:var(--p9n-surface-alt,#f8fafc);border-bottom:1px solid var(--p9n-border,#ccd6dd);color:var(--p9n-text,inherit);';

        const loadingDiv = doc.createElement('div');
        loadingDiv.setAttribute('data-psnine-next', 'true');
        loadingDiv.style.cssText = 'font-size:12px;color:var(--p9n-muted,#5f6b7a);';
        loadingDiv.textContent = `⏳ 正在加载奖杯 Tips (#${t.trophyId})...`;
        td.appendChild(loadingDiv);
        tipRow.appendChild(td);

        t.row.after(tipRow);

        try {
          const targetUrl = new URL(`/trophy/${t.trophyId}`, ctx.url.origin).href;
          const tipDoc = await ctx.http.document(targetUrl, { ttl: 600000, signal: requestSignal });
          if (!isActive || requestSignal.aborted) {
            tipRow.remove();
            return;
          }

          td.innerHTML = '';

          const listEl = tipDoc.querySelector('ul.list');
          const directLis = listEl ? Array.from(listEl.querySelectorAll(':scope > li')) : [];
          const tipNodes = directLis.length > 0 ? directLis : Array.from(tipDoc.querySelectorAll('ul.list > li, div.content'));

          if (tipNodes.length === 0) {
            const emptyMsg = doc.createElement('div');
            emptyMsg.setAttribute('data-psnine-next', 'true');
            emptyMsg.style.cssText = 'font-size:12px;color:var(--p9n-muted,#5f6b7a);';
            emptyMsg.textContent = '暂无可用 Tips';
            td.appendChild(emptyMsg);
            return;
          }

          const container = doc.createElement('div');
          container.setAttribute('data-psnine-next', 'true');
          container.style.cssText = 'max-height:280px;overflow-y:auto;';

          const topBar = doc.createElement('div');
          topBar.setAttribute('data-psnine-next', 'true');
          topBar.style.cssText = 'font-size:12px;font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;';

          const countSpan = doc.createElement('span');
          countSpan.textContent = `💡 奖杯 Tips (${tipNodes.length}条):`;
          topBar.appendChild(countSpan);

          const fullLink = doc.createElement('a');
          fullLink.setAttribute('data-psnine-next', 'true');
          fullLink.href = targetUrl;
          fullLink.target = '_blank';
          fullLink.style.cssText = 'font-size:11px;color:#3890ff;text-decoration:none;';
          fullLink.textContent = '前往奖杯完整页 ↗';
          topBar.appendChild(fullLink);
          container.appendChild(topBar);

          const blockedUsers = new Set(settings.blockList.map(u => u.toLowerCase().trim()));

          tipNodes.forEach((liNode) => {
            // Read direct author link (exclude .sonlist and child li)
            const authorA = liNode.querySelector(':scope > .meta a[href*="/psnid/"], :scope > div > .meta a[href*="/psnid/"], :scope > .ml64 > .meta a[href*="/psnid/"], a.psnnode');
            const authorHref = authorA?.getAttribute('href') || '';
            const mAuthor = authorHref.match(/\/psnid\/([^/?#]+)/);
            const authorId = (mAuthor ? mAuthor[1] : authorA?.textContent?.trim() || '').toLowerCase();
            const authorDisplay = authorA?.textContent?.trim() || authorId || '匿名玩家';

            const contentEl = liNode.querySelector(':scope > .content, :scope > div > .content, :scope > .ml64 > .content, .content');
            const rawContentText = contentEl?.textContent || '';

            const isBlockedAuthor = authorId ? blockedUsers.has(authorId) : false;

            let isBlockedWord = false;
            let blockedReasonWord = '';
            for (const word of settings.blockWordsList) {
              if (settings.blockWordsRegex) {
                try {
                  const reg = new RegExp(word, 'i');
                  if (reg.test(rawContentText)) {
                    isBlockedWord = true;
                    blockedReasonWord = word;
                    break;
                  }
                } catch {
                  if (rawContentText.includes(word)) {
                    isBlockedWord = true;
                    blockedReasonWord = word;
                    break;
                  }
                }
              } else if (rawContentText.includes(word)) {
                isBlockedWord = true;
                blockedReasonWord = word;
                break;
              }
            }

            const itemDiv = doc.createElement('div');
            itemDiv.setAttribute('data-psnine-next', 'true');
            itemDiv.style.cssText = 'margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed var(--p9n-border,#ccd6dd);font-size:12px;';

            if (isBlockedAuthor || isBlockedWord) {
              const placeholderBtn = doc.createElement('button');
              placeholderBtn.type = 'button';
              placeholderBtn.setAttribute('data-psnine-next', 'true');
              placeholderBtn.className = 'psnine-filtered-tip-btn';
              placeholderBtn.style.cssText = 'display:block;width:100%;text-align:left;padding:4px 8px;background:var(--p9n-surface-alt,#f8fafc);color:var(--p9n-muted,#5f6b7a);font-size:11px;border-radius:3px;border:1px dashed var(--p9n-border,#ccd6dd);cursor:pointer;user-select:none;';
              placeholderBtn.textContent = `🚫 评论已过滤 (${isBlockedAuthor ? `黑名单用户 ${authorDisplay}` : `屏蔽词: ${blockedReasonWord}`}) - 点击揭示内容`;

              const hiddenBody = doc.createElement('div');
              hiddenBody.setAttribute('data-psnine-next', 'true');
              hiddenBody.style.display = 'none';
              hiddenBody.style.marginTop = '4px';

              placeholderBtn.onclick = () => {
                const isH = hiddenBody.style.display === 'none';
                hiddenBody.style.display = isH ? 'block' : 'none';
                placeholderBtn.textContent = isH ? `👁️ 评论已揭示 (${authorDisplay}) - 点击重新折叠` : `🚫 评论已过滤 (${authorDisplay}) - 点击揭示内容`;
              };

              itemDiv.appendChild(placeholderBtn);
              itemDiv.appendChild(hiddenBody);

              if (contentEl) {
                const clone = contentEl.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('script, form').forEach(s => s.remove());
                // Strip data-psnine-mask-ready/unmasked/pinned from clones
                const markEls = (clone.classList?.contains('mark') ? [clone] : []).concat(
                  Array.from(clone.querySelectorAll('.mark'))
                );
                markEls.forEach(m => {
                  m.removeAttribute('data-psnine-mask-ready');
                  m.classList.remove('unmasked', 'pinned');
                });
                hiddenBody.appendChild(clone);
                enhanceMasks(ctx, hiddenBody);
              }
            } else {
              // Direct metas of liNode only, excluding any in .sonlist or sub-li
              const directMetas = Array.from(liNode.querySelectorAll(':scope > .ml64 > .meta, :scope > .meta, :scope > div > .meta'))
                .filter(m => !m.closest('.sonlist') && m.closest('li') === liNode);
              const bottomMeta = directMetas.length > 1 ? directMetas[directMetas.length - 1] : directMetas[0] || null;

              // Date: actual bottom meta span date, not arbitrary .h-p
              const dateSpan = bottomMeta?.querySelector('.h-p, span[class*="date"], span.time') || liNode.querySelector(':scope > .meta .h-p, :scope > div > .meta .h-p');
              const timeStr = dateSpan?.textContent?.trim() || '';

              // Like button: strictly on direct meta, excluding .sonlist
              const likeBtn = bottomMeta?.querySelector('a[onclick*="up_tip"], a.btn-up, em.alert-success')
                || liNode.querySelector(':scope > .meta a[onclick*="up_tip"], :scope > div > .meta a[onclick*="up_tip"], a[onclick*="up_tip"]');

              let likes: number | null = null;
              if (likeBtn) {
                const likesMatch = likeBtn.textContent?.match(/(\d+)/);
                if (likesMatch) {
                  likes = parseInt(likesMatch[1], 10);
                } else if (likeBtn.textContent && (likeBtn.textContent.includes('赞') || likeBtn.textContent.includes('顶'))) {
                  likes = 0;
                }
              }

              const metaLine = doc.createElement('div');
              metaLine.setAttribute('data-psnine-next', 'true');
              metaLine.style.cssText = 'display:flex;justify-content:space-between;color:var(--p9n-muted,#5f6b7a);font-size:11px;margin-bottom:2px;';

              const authorSpan = doc.createElement('span');
              authorSpan.style.cssText = 'font-weight:500;color:#3890ff;';
              authorSpan.textContent = authorDisplay;
              if (authorId) {
                authorSpan.title = `PSNID: ${authorId}`;
                authorSpan.setAttribute('data-psnid', authorId);
              }
              metaLine.appendChild(authorSpan);

              const timeLikesSpan = doc.createElement('span');
              if (likes !== null && likes > 0) {
                timeLikesSpan.textContent = timeStr ? `${timeStr} | 👍 ${likes}` : `👍 ${likes}`;
              } else {
                timeLikesSpan.textContent = timeStr;
              }
              metaLine.appendChild(timeLikesSpan);
              itemDiv.appendChild(metaLine);

              if (contentEl) {
                const bodyDiv = doc.createElement('div');
                bodyDiv.setAttribute('data-psnine-next', 'true');
                bodyDiv.style.cssText = 'line-height:1.5;';

                const clone = contentEl.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('script, form').forEach(s => s.remove());
                const markEls = (clone.classList?.contains('mark') ? [clone] : []).concat(
                  Array.from(clone.querySelectorAll('.mark'))
                );
                markEls.forEach(m => {
                  m.removeAttribute('data-psnine-mask-ready');
                  m.classList.remove('unmasked', 'pinned');
                });
                bodyDiv.appendChild(clone);
                enhanceMasks(ctx, bodyDiv);
                itemDiv.appendChild(bodyDiv);
              }
            }

            container.appendChild(itemDiv);
          });

          td.appendChild(container);
        } catch (err) {
          if (!isActive || requestSignal.aborted || (err as any)?.name === 'AbortError' || (err as any)?.message === 'aborted') {
            tipRow.remove();
            return;
          }
          td.innerHTML = '';
          const errDiv = doc.createElement('div');
          errDiv.setAttribute('data-psnine-next', 'true');
          errDiv.style.cssText = 'font-size:12px;color:#e03131;';

          const errMsg = doc.createElement('span');
          errMsg.textContent = '❌ 加载 Tips 失败，请检查网络。';
          errDiv.appendChild(errMsg);

          const retryBtn = doc.createElement('button');
          retryBtn.type = 'button';
          retryBtn.setAttribute('data-psnine-next', 'true');
          retryBtn.style.cssText = 'margin-left:8px;padding:2px 6px;border:1px solid var(--p9n-border,#ccd6dd);border-radius:3px;cursor:pointer;';
          retryBtn.textContent = '重试';
          retryBtn.onclick = () => {
            tipRow.remove();
            toggleInlineTips(t);
          };
          errDiv.appendChild(retryBtn);
          td.appendChild(errDiv);
        } finally {
          if (manualCtrl) {
            activeManualControllers.delete(t.trophyId);
            if (onPageAbort) {
              pageAbortController.signal.removeEventListener('abort', onPageAbort);
            }
          }
        }
      };

      enhanceTrophyPage();
      const unsubscribe = onContent(() => {
        if (isActive) enhanceTrophyPage();
      });

      return () => {
        isActive = false;
        cleanupNativeSortDropdown?.();
        cleanupNativeSortDropdown = null;
        cleanupNativeFilterSync?.();
        cleanupNativeFilterSync = null;
        pageAbortController.abort();
        batchAbortController?.abort();
        activeManualControllers.forEach(ctrl => ctrl.abort());
        activeManualControllers.clear();
        unsubscribe();
      };
    }
  } catch (err) {
    report('trophies', err);
  }
};
