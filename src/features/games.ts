/**
 * psnine_next - Games Feature Module (P01 - P14)
 *
 * Implements:
 * P01: 无白金游戏降低透明度 (仅明确无白金，透明度设置)
 * P02: 游戏封面完成度提示 (封面hover/tap按需拉取、加权点数、可访问查询按钮、重试、防并发)
 * P03: 游戏列表按难度排序 (排除人玩过/耗时，按真实td.twoge em百分比/点数，纠正难易语义，动态重查DOM稳定双向排序)
 * P04: 我的游戏进度缓存 (模块级并发队列防覆盖，严格账号隔离，旁观他人页不污染，全字段严格数值校验)
 * P05: 进度后台增量刷新 (实际后台HTTP读取/psnid/:id/psngame、严格next-link与cursor分页补全、退避时钟、DLC白金与官方进度统一解析)
 * P06: 列表背景进度与徽章 (游戏列表/个人主页，动态追加与现有badge刷新)
 * P07: 白金封面修饰 (光晕及触摸友好的静态反馈)
 * P08: 未注册主页同步入口 (挂载至个人主页.psnzz/数据区，真实/upbase与/upgame链接，不污染顶栏)
 * P09: 游戏页转到我的奖杯 (仅裸/psngame/:id生效，保留原有query/hash，他人psnid不覆盖，自动跳转)
 * P10: 元数据关联游戏版本 (真实.min-inner > ul.darklist > li结构，span.r提取平台，Map去重优先非空title，限版本区排除推荐)
 * P11: 搜索关联游戏版本 (preferSearchForFindingVariants控制优先级，标题规范化去平台/后缀，24小时缓存，防XSS)
 * P12: 跨版本奖杯 Tips (在/trophy/:id挂载入口，冷启动自动解析父游戏元数据，真实td:nth-child(2) > a选择器，严谨交叉核对，无盲拼)
 * P13: 子页面版本导航 (保留v2全部子路由)
 * P14: PSPC 与 PS5 封面修正 (移出height属性恢复自然宽高比，PSPC专属标识修复)
 */

import { Context, Mount, Store } from '../core/types';
import { extractTrophyType } from './trophies';

export interface GameProgressRecord {
  gameId: string;
  percent: number;
  platinum: boolean;
  updatedAt: number;
}

export interface UserProgressData {
  userId: string;
  games: Record<string, GameProgressRecord>;
  lastFullSync: number;
  nextRefresh: number;
  refreshInterval: number;
  syncCursorPage: number;
  syncStatus: 'idle' | 'partial' | 'full' | 'error';
}

export interface GameVariant {
  gameId: string;
  platform: string;
  region: string;
  title: string;
}

export interface TrophyReferenceInfo {
  trophyId: string;
  name: string;
  description: string;
}

export const VARIANTS_CACHE_PREFIX = 'psnine_next:variants:';
export const ONE_DAY_MS = 24 * 3600 * 1000;
export const INITIAL_SYNC_INTERVAL = 3600 * 1000; // 1 hour
export const MAX_SYNC_INTERVAL = 24 * 3600 * 1000; // 24 hours

// Module-level mutation queue to prevent concurrent cache read-modify-write races (Point 2)
const userMutationQueues = new Map<string, Promise<UserProgressData>>();

/**
 * Returns true if an active mutation queue exists for the given user (for test verification).
 */
export function hasUserMutationQueue(userId: string): boolean {
  return userMutationQueues.has(userId);
}

/**
 * Executes an atomic mutation on user's progress cache, resolving sequentially.
 * If a prior job rejects, catches it so subsequent jobs proceed without poisoning the queue,
 * while ensuring the original caller still receives the rejection.
 * Deletes idle map entries on completion so memory does not leak.
 */
export async function mutateUserProgress(
  store: Store,
  userId: string,
  mutator: (current: UserProgressData) => Promise<UserProgressData | void> | UserProgressData | void
): Promise<UserProgressData> {
  const currentPromise = userMutationQueues.get(userId) || Promise.resolve({} as UserProgressData);

  const nextPromise = currentPromise
    .catch(() => {
      // Swallows previous job's rejection ONLY for this next job's scheduling
    })
    .then(async () => {
      const progressKey = `psnine_next:progress:${userId}`;
      const rawCache = await store.get<unknown>(progressKey, null);
      const valid = validateUserProgressData(rawCache, userId);
      const result = await mutator(valid);
      const updated = result || valid;
      await store.set(progressKey, updated);
      return updated;
    })
    .finally(() => {
      // Delete idle map entry if no other job has queued after this one
      if (userMutationQueues.get(userId) === nextPromise) {
        userMutationQueues.delete(userId);
      }
    });

  userMutationQueues.set(userId, nextPromise);
  return nextPromise;
}

/**
 * Validates and deeply sanitizes UserProgressData from store (P04).
 * Rejects non-numeric game IDs, NaNs, infinities, and invalid percentages.
 */
export function validateUserProgressData(raw: unknown, expectedUserId: string): UserProgressData {
  const fallback: UserProgressData = {
    userId: expectedUserId,
    games: {},
    lastFullSync: 0,
    nextRefresh: 0,
    refreshInterval: INITIAL_SYNC_INTERVAL,
    syncCursorPage: 1,
    syncStatus: 'idle'
  };

  if (!raw || typeof raw !== 'object') return fallback;
  const data = raw as Partial<UserProgressData>;

  if (data.userId !== expectedUserId) return fallback;

  const validGames: Record<string, GameProgressRecord> = {};
  if (data.games && typeof data.games === 'object') {
    for (const [gid, rec] of Object.entries(data.games)) {
      if (!/^\d+$/.test(gid)) continue;
      if (
        rec &&
        typeof rec === 'object' &&
        typeof rec.percent === 'number' &&
        Number.isFinite(rec.percent) &&
        rec.percent >= 0 &&
        rec.percent <= 100 &&
        typeof rec.platinum === 'boolean' &&
        typeof rec.updatedAt === 'number' &&
        Number.isFinite(rec.updatedAt) &&
        rec.updatedAt > 0
      ) {
        validGames[gid] = {
          gameId: gid,
          percent: Math.round(rec.percent),
          platinum: rec.platinum,
          updatedAt: rec.updatedAt
        };
      }
    }
  }

  return {
    userId: expectedUserId,
    games: validGames,
    lastFullSync: typeof data.lastFullSync === 'number' && Number.isFinite(data.lastFullSync) && data.lastFullSync > 0 ? data.lastFullSync : 0,
    nextRefresh: typeof data.nextRefresh === 'number' && Number.isFinite(data.nextRefresh) && data.nextRefresh > 0 ? data.nextRefresh : 0,
    refreshInterval: typeof data.refreshInterval === 'number' && Number.isFinite(data.refreshInterval) && data.refreshInterval >= INITIAL_SYNC_INTERVAL ? data.refreshInterval : INITIAL_SYNC_INTERVAL,
    syncCursorPage: typeof data.syncCursorPage === 'number' && Number.isInteger(data.syncCursorPage) && data.syncCursorPage >= 1 ? data.syncCursorPage : 1,
    syncStatus: data.syncStatus === 'partial' || data.syncStatus === 'full' || data.syncStatus === 'error' ? data.syncStatus : 'idle'
  };
}

/**
 * Normalizes game title for search matching (P11).
 * Strips platform prefixes (including bracketed 【PSPC】), 《 》, and suffixes.
 */
export function normalizeGameTitle(title: string): string {
  return (title || '')
    .replace(/(^(\s*《\s*)+)|((\s*》\s*)+$)/g, '')
    .replace(/\s*[（(]VR2?(\s*可选)?[）)]\s*$/gi, '')
    .replace(/\s*Trophies\s*$/gi, '')
    .replace(/^(?:\[|【|\()?(?:PSVITA|PSVR2?|PSPC|PS[345V]|PC)(?:\]|】|\))?\s*/i, '')
    .replace(/\s*(中文)?(奖杯列表|测评评分|约战|问答|主题|游列)\s*$/i, '')
    .replace(/[《》〈〉「」『』""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extracts gameId from URL path.
 */
export function extractGameId(urlStr: string): string | null {
  const m = urlStr.match(/\/psngame\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Checks if a game row has explicitly 0 platinum trophies (P01).
 */
export function isExplicitlyNoPlatinum(row: Element): boolean {
  const platSpan = row.querySelector('.text-platinum');
  if (platSpan) {
    const text = platSpan.textContent?.trim() || '';
    if (text === '白0' || text === '0') return true;
    return false;
  }
  const em = row.querySelector('td.pd1015 em, td.title em, td em, .meta em');
  if (em) {
    const emText = em.textContent || '';
    if (emText.includes('金') && !emText.includes('白')) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts a valid percentage (0..100) from an element's style.width, style attribute, or text content.
 * Accepts anchored finite 0..100 values. Rejects values outside 0..100, NaNs, and infinities.
 */
export function extractElementProgressPercent(el: Element | null): number | null {
  if (!el) return null;
  const htmlEl = el as HTMLElement;

  // 1. Check style.width (e.g. "38%", "38.5%")
  if (htmlEl.style && typeof htmlEl.style.width === 'string' && htmlEl.style.width.trim()) {
    const raw = htmlEl.style.width.trim();
    const m = raw.match(/^([\d.]+)%$/);
    if (m) {
      const val = parseFloat(m[1]);
      if (Number.isFinite(val) && val >= 0 && val <= 100) {
        return Math.round(val);
      }
      return null;
    }
  }

  // 2. Check getAttribute('style') (e.g. "width: 38%", "width: 38.5%; ...")
  const styleAttr = el.getAttribute('style');
  if (styleAttr) {
    const m = styleAttr.match(/(?:^|;)\s*width:\s*([\d.]+)%/i);
    if (m) {
      const val = parseFloat(m[1]);
      if (Number.isFinite(val) && val >= 0 && val <= 100) {
        return Math.round(val);
      }
      return null;
    }
  }

  // 3. Fallback to text content if official style was absent (e.g. "38%")
  const text = el.textContent?.trim() || '';
  if (text) {
    const textM = text.match(/(?:^|\s)(\d{1,3})%(?:\s|$)/);
    if (textM) {
      const val = parseInt(textM[1], 10);
      if (Number.isFinite(val) && val >= 0 && val <= 100) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Parses game progress and explicit platinum earned from a profile game row (P05 shared parser).
 * ONLY reads official user completion from .progress-bar or div.progress.
 * NEVER confuses game rarity/difficulty (e.g. 18.63%完美) with user completion (Point 4).
 */
export function parseGameRowProgress(tr: Element): { gameId: string; percent: number | null; platinum: boolean } | null {
  const gameA = tr.querySelector('a[href*="/psngame/"]') as HTMLAnchorElement | null;
  if (!gameA) return null;
  const gid = extractGameId(gameA.href || gameA.getAttribute('href') || '');
  if (!gid) return null;

  let percent: number | null = null;
  // Strictly read user completion from .progress-bar or div.progress
  const progDiv = tr.querySelector('.progress-bar, .progress > div, div.progress');
  if (progDiv) {
    const innerBar = progDiv.querySelector('div');
    percent = extractElementProgressPercent(innerBar) ?? extractElementProgressPercent(progDiv);
  }

  // Explicit platinum check (independent of percent >= 100)
  const platSpan = tr.querySelector('.text-platinum');
  const platText = platSpan?.textContent?.trim() || '';
  const hasPlatImg = tr.querySelector('img.earned[src*="platinum"]') !== null;
  const isPlatEarned = hasPlatImg || (platSpan !== null && !platText.includes('白0') && (platText.includes('白1') || platText === '1'));

  return { gameId: gid, percent, platinum: isPlatEarned };
}

/**
 * Parses difficulty percentage / score from difficulty td (P03).
 * Excludes player counts and play times.
 */
export function parseGameDifficulty(td: Element | null): number {
  if (!td) return -1;
  const text = td.textContent?.trim() || '';

  if (text.includes('玩过') || text.includes('耗时') || text.includes('次数')) {
    return -1;
  }

  const em = td.querySelector('em');
  const emText = em?.textContent?.trim() || text;

  const m = emText.match(/([\d,.]+)\s*(?:%|点|难度|分)?/);
  if (m) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val)) return val;
  }
  return -1;
}

/**
 * Sorts game rows stably by difficulty (P03).
 * In P9: Lower completion percentage = HARDER! Higher completion percentage = EASIER!
 * When descending (从难到易): lowest percentage / highest points first.
 * When ascending (从易到难): highest percentage / lowest points first.
 */
export function sortGameRowsByDifficulty(rows: HTMLElement[], hardestFirst = true): HTMLElement[] {
  return [...rows].sort((a, b) => {
    const findDiffTd = (row: HTMLElement) => {
      const twoges = row.querySelectorAll('td.twoge');
      for (const td of Array.from(twoges)) {
        const t = td.textContent || '';
        if (!t.includes('玩过') && !t.includes('耗时') && !t.includes('次数')) {
          return td;
        }
      }
      return null;
    };

    const valA = parseGameDifficulty(findDiffTd(a));
    const valB = parseGameDifficulty(findDiffTd(b));

    if (valA === -1 && valB === -1) return 0;
    if (valA === -1) return 1;
    if (valB === -1) return -1;

    // For percentage difficulty (e.g. 18.63% vs 80%): lower is harder
    return hardestFirst ? valA - valB : valB - valA;
  });
}

/**
 * Validates cross-version trophy matching (P12).
 */
export function findMatchingTrophyAcrossVersions(
  sourceTrophy: TrophyReferenceInfo,
  targetVersionTrophies: TrophyReferenceInfo[]
): TrophyReferenceInfo | null {
  const normSrcName = sourceTrophy.name.trim().toLowerCase();
  const normSrcDesc = sourceTrophy.description.trim().toLowerCase();

  if (!normSrcName && !normSrcDesc) return null;

  if (normSrcName.length >= 2) {
    const nameMatches = targetVersionTrophies.filter(
      (t) => t.name.trim().toLowerCase() === normSrcName
    );
    if (nameMatches.length === 1) return nameMatches[0];
  }

  if (normSrcDesc.length >= 6) {
    const descMatches = targetVersionTrophies.filter(
      (t) => t.description.trim().toLowerCase() === normSrcDesc
    );
    if (descMatches.length === 1) return descMatches[0];
  }

  return null;
}

/**
 * Performs actual background incremental HTTP sync of user game records (P05).
 * Connects page-by-page via cursor, respects next links, updates backoff clock.
 */
export async function syncUserGameProgress(
  ctx: Context,
  verifiedUserId: string,
  maxPages = 3
): Promise<{ updatedCount: number; hasChanges: boolean; status: 'full' | 'partial' | 'error' }> {
  let updatedCount = 0;
  let hasChanges = false;
  let finalStatus: 'full' | 'partial' | 'error' = 'idle' as any;

  await mutateUserProgress(ctx.store, verifiedUserId, async (cache) => {
    const startPage = cache.syncCursorPage || 1;
    let hasNextPage = true;
    let hasError = false;

    for (let batch = 0; batch < maxPages; batch++) {
      const curPage = startPage + batch;
      try {
        const pageUrl = new URL(`/psnid/${verifiedUserId}/psngame?page=${curPage}`, ctx.url.origin).href;
        const pageDoc = await ctx.http.document(pageUrl, { ttl: 300000 });

        // 1. Check for login or error page: NEVER treat as full
        const isLoginOrError = pageDoc.querySelector('form[action*="login"], form[action*="signin"], input[type="password"], .alert-error, .alert-danger, .error-page') !== null ||
          /登录|错误|Error|404|500/.test(pageDoc.title);

        if (isLoginOrError) {
          hasError = true;
          break;
        }

        // 2. Verified account / profile check (exact profile path, not just includes)
        const normUserId = verifiedUserId.toLowerCase();
        const expectedUserPath = `/psnid/${normUserId}`;
        const hasVerifiedAccount = Array.from(pageDoc.querySelectorAll('a[href*="/psnid/"], .psnzz a, .psninfo a')).some((a) => {
          const href = a.getAttribute('href') || '';
          try {
            const u = new URL(href, pageUrl);
            const p = u.pathname.replace(/\/+$/, '').toLowerCase();
            return p === expectedUserPath || p === `${expectedUserPath}/psngame`;
          } catch {
            return false;
          }
        }) || (pageDoc.querySelector('.psnzz, .psninfo') !== null && pageDoc.querySelector(`a[href*="/psnid/${normUserId}"]`) !== null);

        const pageText = pageDoc.body ? pageDoc.body.textContent || '' : '';
        const isExplicitEmpty = /没有.*游戏|暂无.*游戏|暂无数据|没有找到/.test(pageText);

        const rows = pageDoc.querySelectorAll('table tr');

        if (rows.length === 0) {
          // If no rows, verify if it is an explicit verified empty account/profile list
          if (hasVerifiedAccount && isExplicitEmpty && curPage === 1) {
            hasNextPage = false;
            break;
          }
          hasError = true;
          break;
        }

        let foundGame = false;
        rows.forEach((tr) => {
          const parsed = parseGameRowProgress(tr);
          if (!parsed || parsed.percent === null) return;

          foundGame = true;
          const prev = cache.games[parsed.gameId];
          if (!prev || prev.percent !== parsed.percent || prev.platinum !== parsed.platinum) {
            cache.games[parsed.gameId] = {
              gameId: parsed.gameId,
              percent: parsed.percent,
              platinum: parsed.platinum,
              updatedAt: Date.now()
            };
            updatedCount++;
            hasChanges = true;
          }
        });

        if (!foundGame) {
          // Table error unless explicit verified empty message
          if (hasVerifiedAccount && isExplicitEmpty) {
            hasNextPage = false;
            break;
          }
          hasError = true;
          break;
        }

        // P05 next page check: same origin, exact /psnid/:user/psngame path, integer page === curPage + 1
        let foundNextLink = false;
        const paginationLinks = pageDoc.querySelectorAll('.page a, a.next, a[href*="page="]');
        for (const a of Array.from(paginationLinks)) {
          const href = a.getAttribute('href') || '';
          if (!href || href === '#' || href.startsWith('javascript:')) continue;

          try {
            const nextUrl = new URL(href, pageUrl);
            if (nextUrl.origin !== ctx.url.origin) continue;

            const expectedPath = `/psnid/${normUserId}/psngame`;
            const actualPath = nextUrl.pathname.replace(/\/+$/, '').toLowerCase();
            if (actualPath !== expectedPath) continue;

            const pageParam = nextUrl.searchParams.get('page');
            if (pageParam && /^\d+$/.test(pageParam) && parseInt(pageParam, 10) === curPage + 1) {
              foundNextLink = true;
              break;
            }
          } catch {
            // Invalid URL
          }
        }

        if (!foundNextLink) {
          hasNextPage = false;
          break;
        }
      } catch (err) {
        hasError = true;
        ctx.report('progress_sync_page', err);
        break;
      }
    }

    if (hasError) {
      cache.syncStatus = 'error';
      finalStatus = 'error';
      // Error backoff: delay next retry by 15 mins to avoid request storm
      cache.nextRefresh = Date.now() + 15 * 60 * 1000;
    } else if (!hasNextPage) {
      cache.syncStatus = 'full';
      finalStatus = 'full';
      cache.syncCursorPage = 1;
      cache.lastFullSync = Date.now();
    } else {
      cache.syncStatus = 'partial';
      finalStatus = 'partial';
      cache.syncCursorPage = startPage + maxPages;
    }

    if (hasChanges) {
      cache.refreshInterval = INITIAL_SYNC_INTERVAL;
      cache.nextRefresh = Date.now() + cache.refreshInterval;
    } else if (!hasError) {
      cache.refreshInterval = Math.min(MAX_SYNC_INTERVAL, Math.round(cache.refreshInterval * 1.5));
      cache.nextRefresh = Date.now() + cache.refreshInterval;
    }

    return cache;
  });

  return { updatedCount, hasChanges, status: finalStatus };
}

/**
 * Resolves game variants using real metadata layout (.min-inner.mt20 > ul.darklist > li) or search (P10 & P11).
 */
export async function resolveGameVariants(
  ctx: Context,
  gid: string,
  doc: Document,
  preferSearch = false
): Promise<GameVariant[]> {
  const cacheKey = `${VARIANTS_CACHE_PREFIX}${gid}`;
  const cached = await ctx.store.get<{ variants: GameVariant[]; timestamp: number } | null>(cacheKey, null);
  if (cached && Date.now() - cached.timestamp < ONE_DAY_MS && Array.isArray(cached.variants) && cached.variants.length > 0) {
    return cached.variants;
  }

  const variantsMap = new Map<string, GameVariant>();

  // Helper 1: Metadata resolver (Point 1: real .min-inner.mt20 > ul.darklist > li structure)
  const tryMetadata = async () => {
    let metaLink = doc.querySelector('.side a[href*="/game/"]') as HTMLAnchorElement | null;
    let metaHref = metaLink?.href || metaLink?.getAttribute('href') || '';

    // If on subpage and side link not present, fetch main /psngame/:id
    if (!metaHref) {
      try {
        const mainDoc = await ctx.http.document(new URL(`/psngame/${gid}`, ctx.url.origin).href, { ttl: ONE_DAY_MS });
        metaLink = mainDoc.querySelector('.side a[href*="/game/"]') as HTMLAnchorElement | null;
        metaHref = metaLink?.href || metaLink?.getAttribute('href') || '';
      } catch {
        // continue
      }
    }

    if (metaHref) {
      try {
        const metaDoc = await ctx.http.document(new URL(metaHref, ctx.url.origin).href, { ttl: ONE_DAY_MS });
        // Target .darklist inside .min-inner (version section, exclude sidebar recommendations)
        const darklistLis = metaDoc.querySelectorAll('.min-inner > ul.darklist > li, ul.darklist > li');
        darklistLis.forEach((li) => {
          const links = Array.from(li.querySelectorAll('a[href*="/psngame/"]'));
          const platform = li.querySelector('span.r')?.textContent?.trim() || '';

          links.forEach((a) => {
            const vid = extractGameId((a as HTMLAnchorElement).href || a.getAttribute('href') || '');
            if (vid && vid !== gid) {
              const text = a.textContent?.trim() || '';
              // Deduplicate prioritizing non-empty text
              if (!variantsMap.has(vid) || (!variantsMap.get(vid)!.title && text)) {
                variantsMap.set(vid, {
                  gameId: vid,
                  platform,
                  region: '',
                  title: text
                });
              }
            }
          });
        });
      } catch (err) {
        ctx.report('meta_variants', err);
      }
    }
  };

  // Helper 2: Search resolver (P11)
  const trySearch = async () => {
    // Determine parent game title
    let rawTitle = doc.querySelector('h1, .box h1')?.textContent || '';
    let normTitle = normalizeGameTitle(rawTitle);

    // If on /trophy/:id, h1 is trophy name, so fetch parent game page title
    if (!normTitle || ctx.url.pathname.includes('/trophy/')) {
      try {
        const parentGameDoc = await ctx.http.document(new URL(`/psngame/${gid}`, ctx.url.origin).href, { ttl: ONE_DAY_MS });
        rawTitle = parentGameDoc.querySelector('h1, .box h1')?.textContent || '';
        normTitle = normalizeGameTitle(rawTitle);
      } catch {
        // continue
      }
    }

    if (!normTitle) return;

    try {
      const searchUrl = new URL(`/psngame?title=${encodeURIComponent(normTitle)}`, ctx.url.origin).href;
      const searchDoc = await ctx.http.document(searchUrl, { ttl: ONE_DAY_MS });
      searchDoc.querySelectorAll('td.pd1015, td.title').forEach((cell) => {
        const link = cell.querySelector('a[href*="/psngame/"]');
        const vid = extractGameId((link as HTMLAnchorElement)?.href || link?.getAttribute('href') || '');
        if (vid && vid !== gid) {
          const text = link?.textContent?.trim() || '';
          if (normalizeGameTitle(text) === normTitle) {
            const platform = cell.querySelector('span.r, span[class*="pf_"]')?.textContent?.trim() || '';
            if (!variantsMap.has(vid) || (!variantsMap.get(vid)!.title && text)) {
              variantsMap.set(vid, {
                gameId: vid,
                platform,
                region: '',
                title: text
              });
            }
          }
        }
      });
    } catch (err) {
      ctx.report('search_variants', err);
    }
  };

  if (preferSearch) {
    await trySearch();
    if (variantsMap.size === 0) await tryMetadata();
  } else {
    await tryMetadata();
    if (variantsMap.size === 0) await trySearch();
  }

  const result = Array.from(variantsMap.values());
  if (result.length > 0) {
    await ctx.store.set(cacheKey, { variants: result, timestamp: Date.now() });
  }
  return result;
}

/**
 * Mounts the Games Feature Module.
 */
export const mountGames: Mount = async (ctx: Context) => {
  const { document: doc, url, settings, store, userId, onContent, report } = ctx;

  let isActive = true;
  const abortController = new AbortController();
  const subscriptions: (() => void)[] = [];

  const isGameListPage = (url.pathname === '/psngame' || /^\/psngame\/page\/\d+/.test(url.pathname)) && !/^\/psngame\/\d+/.test(url.pathname);
  const isSingleGamePage = /^\/psngame\/\d+/.test(url.pathname);
  const isProfilePage = /^\/psnid\/[^/]+/.test(url.pathname);
  const isTrophyDetailPage = /^\/trophy\/\d+/.test(url.pathname);

  try {
    // P14: PSPC & PS5 cover natural aspect-ratio style
    const styleId = 'psnine-enhanced-games-style';
    if (!doc.getElementById(styleId)) {
      const style = doc.createElement('style');
      style.id = styleId;
      style.setAttribute('data-psnine-next', 'true');
      style.textContent = `
        td.pd15 img.imgbgnb, td.pdd15 img.imgbgnb, td.pd15 img.imgbg, td.pdd15 img.imgbg, .game-cover img {
          object-fit: contain !important;
          max-width: 91px !important;
          height: auto !important;
          border-radius: 4px !important;
        }
        .pf_pspc {
          font-size: 11px !important;
          color: #fff !important;
          background-color: #0070d1 !important;
          border-radius: 2px !important;
          padding: 2px 6px !important;
          margin-right: 4px !important;
          display: inline-block !important;
        }
        .psnine-platinum-glow {
          box-shadow: 0 0 10px rgba(56, 144, 255, 0.8), 0 0 20px rgba(56, 144, 255, 0.4) !important;
          border: 1px solid rgba(56, 144, 255, 0.6) !important;
          border-radius: 4px !important;
        }
      `;
      doc.head.appendChild(style);

      doc.querySelectorAll('span.pf_pspc').forEach((tag) => {
        tag.closest('tr')?.querySelectorAll('img.imgbgnb').forEach(img => img.removeAttribute('height'));
      });
    }

    // 1. Load user progress cache (P04: schema validation)
    let myProgress: UserProgressData = {
      userId: userId || '',
      games: {},
      lastFullSync: 0,
      nextRefresh: 0,
      refreshInterval: INITIAL_SYNC_INTERVAL,
      syncCursorPage: 1,
      syncStatus: 'idle'
    };

    if (userId) {
      const progressKey = `psnine_next:progress:${userId}`;
      const rawCache = await store.get<unknown>(progressKey, null);
      myProgress = validateUserProgressData(rawCache, userId);

      // P05: Trigger background incremental HTTP sync if nextRefresh reached.
      // Note: Background cache-owned sync completes headless cache persistence independently,
      // but never performs DOM writes if component is cleaned up / inactive.
      if (Date.now() >= myProgress.nextRefresh) {
        syncUserGameProgress(ctx, userId).then(() => {
          if (!isActive || abortController.signal.aborted) return;
          store.get<unknown>(progressKey, null).then((freshRaw) => {
            if (!isActive || abortController.signal.aborted) return;
            myProgress = validateUserProgressData(freshRaw, userId);
            refreshGameListBadgesAndBackgrounds();
          });
        }).catch(err => report('bg_sync', err));
      }
    }

    // Helper: Refresh all badges and backgrounds dynamically
    const refreshGameListBadgesAndBackgrounds = () => {
      doc.querySelectorAll('table tr').forEach((tr) => {
        const gameA = tr.querySelector('a[href*="/psngame/"]') as HTMLAnchorElement | null;
        if (!gameA) return;
        const gid = extractGameId(gameA.href || gameA.getAttribute('href') || '');
        if (!gid || !myProgress.games[gid]) return;

        const rec = myProgress.games[gid];
        const row = tr as HTMLElement;
        row.style.background = `linear-gradient(to right, rgba(56, 144, 255, 0.12) ${rec.percent}%, transparent ${rec.percent}%)`;

        let badge = row.querySelector('.psnine-game-list-progress-badge') as HTMLElement | null;
        if (!badge) {
          badge = doc.createElement('span');
          badge.className = 'psnine-game-list-progress-badge';
          badge.setAttribute('data-psnine-next', 'true');
          badge.style.cssText = 'display:inline-block;padding:1px 5px;font-size:11px;border-radius:3px;background:rgba(56, 144, 255, 0.2);color:#0056b3;font-weight:500;margin-left:6px;';
          gameA.parentElement?.appendChild(badge);
        }
        badge.textContent = `${rec.percent}%`;

        // Remove on-demand button if now resolved
        row.querySelector('.psnine-ondemand-progress-btn')?.remove();

        if (settings.platinumGlow && rec.platinum) {
          const coverImg = row.querySelector('img');
          if (coverImg) coverImg.classList.add('psnine-platinum-glow');
        }
      });
    };

    // 2. Profile Page (P04, P05, P08)
    if (isProfilePage) {
      const pathParts = url.pathname.split('/');
      const profileId = pathParts[2] || '';
      const isBareProfile = url.pathname === `/psnid/${profileId}` || url.pathname === `/psnid/${profileId}/`;
      const isMyProfile = Boolean(userId && profileId && userId.toLowerCase() === profileId.toLowerCase());

      // P08: Mount sync links strictly in profile data area (NOT .nav-user)
      if (isBareProfile) {
        const syncBtnId = 'psnine-sync-psn-btn-group';
        if (!doc.getElementById(syncBtnId)) {
          const profileDataArea = doc.querySelector('.psnzz .inner, .psnbtnright form, .psninfo, .min-inner .box.pd10, .main > div.box');
          if (profileDataArea) {
            const group = doc.createElement('div');
            group.id = syncBtnId;
            group.setAttribute('data-psnine-next', 'true');
            group.style.cssText = 'display:inline-flex;flex-wrap:wrap;gap:8px;margin:8px 0;vertical-align:middle;max-width:100%;box-sizing:border-box;';

            const upbaseA = doc.createElement('a');
            upbaseA.setAttribute('data-psnine-next', 'true');
            upbaseA.href = `https://psnine.com/psnid/${profileId}/upbase`;
            upbaseA.className = 'btn btn-default btn-sm';
            upbaseA.style.cssText = 'padding:3px 10px;font-size:12px;border-radius:4px;border:1px solid #3890ff;color:#3890ff;text-decoration:none;';
            upbaseA.textContent = '🔄 等级同步';
            group.appendChild(upbaseA);

            const upgameA = doc.createElement('a');
            upgameA.setAttribute('data-psnine-next', 'true');
            upgameA.href = `https://psnine.com/psnid/${profileId}/upgame`;
            upgameA.className = 'btn btn-default btn-sm';
            upgameA.style.cssText = 'padding:3px 10px;font-size:12px;border-radius:4px;border:1px solid #28a745;color:#28a745;text-decoration:none;';
            upgameA.textContent = '🎮 游戏同步';
            group.appendChild(upgameA);

            profileDataArea.appendChild(group);
          }
        }
      }

      // P04: Scrape games strictly if viewing user's OWN profile
      if (isMyProfile && userId) {
        const scrapeTime = Date.now();
        const parsedVisibleRows: Record<string, { gameId: string; percent: number; platinum: boolean; updatedAt: number }> = {};
        doc.querySelectorAll('table tr').forEach((tr) => {
          const parsed = parseGameRowProgress(tr);
          if (!parsed || parsed.percent === null) return;

          parsedVisibleRows[parsed.gameId] = {
            gameId: parsed.gameId,
            percent: parsed.percent,
            platinum: parsed.platinum,
            updatedAt: scrapeTime
          };

          if (settings.platinumGlow && parsed.platinum) {
            const coverImg = tr.querySelector('img');
            if (coverImg) coverImg.classList.add('psnine-platinum-glow');
          }
        });

        const visibleEntries = Object.entries(parsedVisibleRows);
        if (visibleEntries.length > 0) {
          const freshCache = await mutateUserProgress(store, userId, (cache) => {
            for (const [gid, row] of visibleEntries) {
              const existing = cache.games[gid];
              if (!existing) {
                cache.games[gid] = {
                  gameId: gid,
                  percent: row.percent,
                  platinum: row.platinum,
                  updatedAt: row.updatedAt
                };
              } else if (existing.percent !== row.percent || existing.platinum !== row.platinum) {
                // Merge by updatedAt: only update if visible page data is as fresh or fresher than existing record
                if (!existing.updatedAt || row.updatedAt >= existing.updatedAt) {
                  cache.games[gid] = {
                    gameId: gid,
                    percent: row.percent,
                    platinum: row.platinum,
                    updatedAt: row.updatedAt
                  };
                }
              }
            }
            // Notice: do NOT set lastFullSync from a single visible page!
            return cache;
          });

          // Use returned fresh cache for UI
          myProgress = freshCache;
          if (isActive && !abortController.signal.aborted) {
            refreshGameListBadgesAndBackgrounds();
          }
        }
      }
    }

    // 3. Game List Page (P01, P02, P03, P06)
    if (isGameListPage) {
      let isHardestFirst = true;

      const enhanceGameList = () => {
        refreshGameListBadgesAndBackgrounds();

        const tables = doc.querySelectorAll('table');
        tables.forEach((table) => {
          table.querySelectorAll('tr').forEach((r) => {
            const row = r as HTMLElement;
            if (isExplicitlyNoPlatinum(row)) {
              row.style.opacity = `${settings.filterNonePlatinumAlpha}`;
            }

            // P02: On-demand progress loading on cover hover/tap with accessible button & retry (Point 3)
            const gameA = row.querySelector('a[href*="/psngame/"]') as HTMLAnchorElement | null;
            if (gameA && userId) {
              const gid = extractGameId(gameA.href || gameA.getAttribute('href') || '');
              if (gid && !myProgress.games[gid]) {
                const coverImg = row.querySelector('td.pd15 img, td.pdd15 img, img.imgbgnb');
                if (coverImg && !coverImg.hasAttribute('data-psnine-demand-bound')) {
                  coverImg.setAttribute('data-psnine-demand-bound', 'true');

                  // Accessible on-demand query button
                  let demandBtn = row.querySelector('.psnine-ondemand-progress-btn') as HTMLButtonElement | null;
                  if (!demandBtn) {
                    demandBtn = doc.createElement('button');
                    demandBtn.type = 'button';
                    demandBtn.className = 'psnine-ondemand-progress-btn';
                    demandBtn.setAttribute('data-psnine-next', 'true');
                    demandBtn.setAttribute('aria-label', '查询个人进度');
                    demandBtn.style.cssText = 'padding:1px 5px;font-size:10px;border-radius:3px;border:1px solid #3890ff;background:transparent;color:#3890ff;cursor:pointer;margin-left:6px;';
                    demandBtn.textContent = '🔍 查进度';
                    gameA.parentElement?.appendChild(demandBtn);
                  }

                  let isLoading = false;
                  const fetchOnDemand = async () => {
                    if (!isActive || abortController.signal.aborted || isLoading || myProgress.games[gid]) return;
                    isLoading = true;
                    if (demandBtn) demandBtn.textContent = '⏳ 查询中...';

                    try {
                      const targetUrl = new URL(`/psngame/${gid}?psnid=${userId}`, ctx.url.origin).href;
                      const gameDoc = await ctx.http.document(targetUrl, { ttl: 600000, signal: abortController.signal });

                      if (!isActive || abortController.signal.aborted) return;

                      // Validate that response contains trophies
                      const trophyRows = gameDoc.querySelectorAll('tr.trophy, table.list tr[id]');
                      if (trophyRows.length === 0) {
                        throw new Error('No trophies found (login required or invalid page)');
                      }

                      // Check platinum earned
                      let isPlat = false;
                      const platRow = Array.from(trophyRows).find(tr => extractTrophyType(tr) === 'platinum');
                      if (platRow) {
                        isPlat = platRow.querySelector('img.earned, img.imgbg.earned, em.alert-success.r') !== null;
                      }

                      // Avoid reading sidebar .oh / .side progress bars of other players
                      // Check user verification on main game document
                      const userAnchor = gameDoc.querySelector(`.main p a[href*="/psnid/${userId}"], .box p a[href*="/psnid/${userId}"]`);
                      const hasEarnedMarker = gameDoc.querySelector('tr.trophy img.earned, tr.trophy .imgbg.earned, tr.trophy em.alert-success.r, img.earned');
                      if (!userAnchor && !hasEarnedMarker && trophyRows.length > 0) {
                        // Response is not an authentic personal trophy page (e.g. public page or login redirect)
                        throw new Error('Not an authentic personal trophy page for user');
                      }

                      // Exact non-platinum weighted points calculation: Gold=90, Silver=30, Bronze=15
                      let earnedPoints = 0;
                      let totalPoints = 0;
                      trophyRows.forEach((tr) => {
                        const type = extractTrophyType(tr);
                        const weight = type === 'bronze' ? 15 : type === 'silver' ? 30 : type === 'gold' ? 90 : 0;
                        if (weight > 0) {
                          totalPoints += weight;
                          const isEarned = tr.querySelector('img.earned, img.imgbg.earned, em.alert-success.r') !== null;
                          if (isEarned) {
                            earnedPoints += weight;
                          }
                        }
                      });

                      let pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

                      // Check official progress bar strictly within .main (exclude sidebar .oh)
                      // Reject 138%/invalid, retain weighted fallback only when official absent/invalid
                      const mainProgBar = gameDoc.querySelector('.main .progress-bar, .main .progress > div, .box.pd10 .progress > div, .main div.progress');
                      if (mainProgBar) {
                        const innerBar = mainProgBar.querySelector('div');
                        const officialPct = extractElementProgressPercent(innerBar) ?? extractElementProgressPercent(mainProgBar);
                        if (officialPct !== null) {
                          pct = officialPct;
                        }
                      }

                      if (!isActive || abortController.signal.aborted) return;

                      const rec: GameProgressRecord = {
                        gameId: gid,
                        percent: pct,
                        platinum: isPlat,
                        updatedAt: Date.now()
                      };

                      await mutateUserProgress(store, userId, (cache) => {
                        if (!isActive || abortController.signal.aborted) {
                          const abortErr = new Error('Aborted');
                          abortErr.name = 'AbortError';
                          throw abortErr;
                        }
                        cache.games[gid] = rec;
                        return cache;
                      });

                      if (!isActive || abortController.signal.aborted) return;

                      myProgress.games[gid] = rec;
                      refreshGameListBadgesAndBackgrounds();
                    } catch (err: any) {
                      isLoading = false;
                      if (!isActive || abortController.signal.aborted || err?.name === 'AbortError') return;

                      if (demandBtn) {
                        demandBtn.textContent = '❌ 重试';
                        demandBtn.style.color = '#e03131';
                      }
                      report('demand_progress', err);
                    }
                  };

                  const onMouseEnter = () => { fetchOnDemand(); };
                  const onTouchStart = () => { fetchOnDemand(); };
                  const onClick = (e: MouseEvent) => {
                    e.preventDefault();
                    fetchOnDemand();
                  };
                  const onKeyDown = (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fetchOnDemand();
                    }
                  };

                  coverImg.addEventListener('mouseenter', onMouseEnter);
                  coverImg.addEventListener('touchstart', onTouchStart);
                  demandBtn.addEventListener('click', onClick);
                  demandBtn.addEventListener('keydown', onKeyDown);

                  subscriptions.push(() => {
                    coverImg.removeEventListener('mouseenter', onMouseEnter);
                    coverImg.removeEventListener('touchstart', onTouchStart);
                    demandBtn?.removeEventListener('click', onClick);
                    demandBtn?.removeEventListener('keydown', onKeyDown);
                  });
                }
              }
            }
          });

          // P03: Difficulty sort button (Point 6: semantically correct labels)
          if (!doc.getElementById('psnine-difficulty-sort-btn')) {
            const navOrHeader = doc.querySelector('.inav, .dropmenu, .box.pd10, .page-header');
            if (navOrHeader) {
              const sortBtn = doc.createElement('button');
              sortBtn.id = 'psnine-difficulty-sort-btn';
              sortBtn.type = 'button';
              sortBtn.setAttribute('data-psnine-next', 'true');
              sortBtn.style.cssText = 'padding:4px 10px;font-size:12px;border-radius:4px;border:1px solid #3890ff;background:transparent;color:#3890ff;cursor:pointer;margin:5px 0;';
              sortBtn.textContent = '📊 按难度排序 (从难到易)';

              sortBtn.onclick = () => {
                const currentRows = Array.from(table.querySelectorAll('tr')).filter(
                  r => r.querySelector('a[href*="/psngame/"]') && (r.querySelector('td.pd1015') || r.querySelector('td.pd15') || r.querySelector('td.pdd15'))
                ) as HTMLElement[];

                isHardestFirst = !isHardestFirst;
                sortBtn.textContent = isHardestFirst ? '📊 按难度排序 (从难到易)' : '📊 按难度排序 (从易到难)';
                const sortedRows = sortGameRowsByDifficulty(currentRows, isHardestFirst);
                const tbody = table.querySelector('tbody') || table;
                sortedRows.forEach(r => tbody.appendChild(r));
              };

              navOrHeader.parentElement?.insertBefore(sortBtn, navOrHeader);
            }
          }
        });
      };

      enhanceGameList();
      subscriptions.push(onContent(() => {
        if (isActive) enhanceGameList();
      }));
    }

    // 4. Single Game Page (P09, P10, P11, P13)
    if (isSingleGamePage) {
      const gid = extractGameId(url.pathname);
      const isBareGameTrophyPage = /^\/psngame\/\d+\/?$/.test(url.pathname);

      if (gid && isBareGameTrophyPage) {
        const hasPsnid = url.searchParams.has('psnid');
        const existingPsnid = url.searchParams.get('psnid');

        // P09: Bare page redirect preserving query/hash
        if (userId && settings.redirectToMine && (!hasPsnid || existingPsnid === userId)) {
          const targetUrl = new URL(url.href);
          targetUrl.searchParams.set('psnid', userId);

          if (!hasPsnid) {
            ctx.window.location.replace(targetUrl.href);
          }

          let toMineBtn = doc.getElementById('psnine-to-mine-trophy-btn');
          if (!toMineBtn) {
            const inav = doc.querySelector('ul.inav, .main > ul.inav, .box.pd10');
            if (inav) {
              toMineBtn = doc.createElement('a');
              toMineBtn.id = 'psnine-to-mine-trophy-btn';
              toMineBtn.setAttribute('data-psnine-next', 'true');
              toMineBtn.setAttribute('href', targetUrl.href);
              toMineBtn.style.cssText = 'display:inline-block;padding:3px 8px;font-size:12px;border-radius:4px;background:#3890ff;color:#fff;text-decoration:none;margin-left:8px;font-weight:500;';
              toMineBtn.textContent = '🏆 切换至我的奖杯进度';
              inav.appendChild(toMineBtn);
            }
          }
        }
      }

      // P10 & P11: Associated Game Variants
      if (gid && settings.referGameVariants && !doc.getElementById('psnine-game-variants-section')) {
        resolveGameVariants(ctx, gid, doc, settings.preferSearchForFindingVariants).then((variants) => {
          if (!isActive || variants.length === 0 || doc.getElementById('psnine-game-variants-section')) return;

          const variantsDiv = doc.createElement('div');
          variantsDiv.id = 'psnine-game-variants-section';
          variantsDiv.setAttribute('data-psnine-next', 'true');
          variantsDiv.style.cssText = 'margin:12px 0;padding:10px 14px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:8px;';

          const subPageMatch = url.pathname.match(/\/psngame\/\d+(\/[^/?#]+)/);
          const subPath = subPageMatch ? subPageMatch[1] : '';

          const heading = doc.createElement('div');
          heading.setAttribute('data-psnine-next', 'true');
          heading.style.cssText = 'font-weight:600;font-size:13px;margin-bottom:6px;';
          heading.textContent = '🎮 本游戏其他版本/平台关联：';
          variantsDiv.appendChild(heading);

          const btnContainer = doc.createElement('div');
          btnContainer.setAttribute('data-psnine-next', 'true');
          btnContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';

          // Point 1: Include platform and gameId in title
          variants.forEach((v) => {
            const a = doc.createElement('a');
            a.setAttribute('data-psnine-next', 'true');
            a.href = new URL(`/psngame/${v.gameId}${subPath}${url.search}`, ctx.url.origin).href;
            a.style.cssText = 'display:inline-block;padding:4px 8px;font-size:12px;border-radius:4px;background:rgba(56, 144, 255, 0.1);color:#0056b3;text-decoration:none;border:1px solid rgba(56, 144, 255, 0.2);';
            const platformPrefix = v.platform ? `[${v.platform}] ` : '';
            a.textContent = `${platformPrefix}${v.title || '版本'} (#${v.gameId})`;
            btnContainer.appendChild(a);
          });

          variantsDiv.appendChild(btnContainer);

          const targetBar = doc.querySelector('.main > ul.inav, .inav, .box.pd10');
          if (targetBar && targetBar.parentElement) {
            targetBar.parentElement.insertBefore(variantsDiv, targetBar.nextSibling);
          }
        }).catch(err => report('variants_resolve', err));
      }
    }

    // 5. P12: Cross-version Trophy Tips on /trophy/:id
    if (isTrophyDetailPage && settings.referGameVariants && !doc.getElementById('psnine-cross-version-tips-section')) {
      const currentTrophyMatch = url.pathname.match(/\/trophy\/(\d+)/);
      if (currentTrophyMatch) {
        const currentTrophyId = currentTrophyMatch[1];
        const gameLink = doc.querySelector('a[href*="/psngame/"]') as HTMLAnchorElement | null;
        const gid = gameLink ? extractGameId(gameLink.href || '') : null;

        if (gid) {
          const h1Text = doc.querySelector('h1')?.textContent?.trim() || '';
          const nameMatch = h1Text.match(/《([^》]+)》奖杯/);
          const trophyName = nameMatch ? nameMatch[1] : h1Text.replace(/奖杯.*$/, '').trim();
          const descEl = doc.querySelector('.box.pd5 em, .box.pd10 em, td.title em, .text-strong');
          const trophyDesc = descEl?.textContent?.trim() || '';
          const sourceTrophy: TrophyReferenceInfo = { trophyId: currentTrophyId, name: trophyName, description: trophyDesc };

          resolveGameVariants(ctx, gid, doc, settings.preferSearchForFindingVariants).then(async (variants) => {
            if (!isActive || variants.length === 0) return;

            for (const variant of variants) {
              try {
                const variantGameDoc = await ctx.http.document(new URL(`/psngame/${variant.gameId}`, ctx.url.origin).href, { ttl: ONE_DAY_MS });
                const targetTrophies: TrophyReferenceInfo[] = [];

                variantGameDoc.querySelectorAll('tr.trophy, table.list tr[id]').forEach((tr) => {
                  const a = tr.querySelector('td:nth-child(2) > a, td:nth-child(2) a[href*="/trophy/"], a[href*="/trophy/"]') as HTMLAnchorElement | null;
                  if (!a) return;
                  const tm = (a.href || a.getAttribute('href') || '').match(/\/trophy\/(\d+)/);
                  if (tm) {
                    const tName = a.textContent?.trim() || '';
                    const tDesc = tr.querySelector('td:nth-child(2) em, .text-strong, div.mt10')?.textContent?.trim() || '';
                    targetTrophies.push({ trophyId: tm[1], name: tName, description: tDesc });
                  }
                });

                const matched = findMatchingTrophyAcrossVersions(sourceTrophy, targetTrophies);
                if (matched && isActive) {
                  let crossDiv = doc.getElementById('psnine-cross-version-tips-section');
                  if (!crossDiv) {
                    crossDiv = doc.createElement('div');
                    crossDiv.id = 'psnine-cross-version-tips-section';
                    crossDiv.setAttribute('data-psnine-next', 'true');
                    crossDiv.style.cssText = 'margin:12px 0;padding:10px 14px;background:rgba(30, 90, 230, 0.06);border:1px solid rgba(30, 90, 230, 0.18);border-radius:6px;';

                    const header = doc.createElement('div');
                    header.setAttribute('data-psnine-next', 'true');
                    header.style.cssText = 'font-weight:600;font-size:13px;margin-bottom:6px;';
                    header.textContent = '🎮 该游戏其他版本的奖杯Tips：';
                    crossDiv.appendChild(header);

                    const contentArea = doc.querySelector('.main, .box.pd10, .min-inner');
                    contentArea?.insertBefore(crossDiv, contentArea.firstChild);
                  }

                  const linkA = doc.createElement('a');
                  linkA.setAttribute('data-psnine-next', 'true');
                  linkA.href = new URL(`/trophy/${matched.trophyId}`, ctx.url.origin).href;
                  linkA.style.cssText = 'display:inline-block;padding:4px 8px;margin-right:8px;font-size:12px;border-radius:4px;background:#3890ff;color:#fff;text-decoration:none;';
                  linkA.textContent = `${variant.title || `版本 #${variant.gameId}`} 的Tips (#${matched.trophyId}) ↗`;
                  crossDiv.appendChild(linkA);
                }
              } catch (err) {
                report('cross_trophy_tips', err);
              }
            }
          }).catch(err => report('resolve_variants_for_tips', err));
        }
      }
    }

    return () => {
      isActive = false;
      abortController.abort();
      subscriptions.forEach(unsub => unsub());
    };
  } catch (err) {
    report('games', err);
  }
};
