/**
 * psnine_next - Battle Feature Module (B01 - B05)
 *
 * Implements:
 * B01: 隐藏约战发起人头像 (按设置作用于头像列，无:has兼容Safari 15，不误伤游戏封面)
 * B02: 约战列表我的进度 (与games共享UserProgressData模型、渐变背景、严格验证用户ID与schema)
 * B03: 约战游戏监控 (游戏页及列表行增加/移除、状态同步，标题单元格挂载，data-psnine-next标记)
 * B04: 导航招募提醒 (本地监控游戏与公开列表求交集，按游戏ID去重计数，桌面/手机菜单)
 * B05: 约战信息缓存 (刷新间隔、无监控不请求、有效空列表清空缓存、失败及登录页保留旧缓存)
 */

import { Context, Mount } from '../core/types';
import { setHidden } from '../core/dom';
import { GameProgressRecord, UserProgressData, validateUserProgressData } from './games';

export type { GameProgressRecord, UserProgressData };

export interface BattleEntry {
  gameId: string;
  gameTitle: string;
  creatorId: string;
  description: string;
  dateStr: string;
  recruitsCount: number;
}

export interface BattleCache {
  entries: BattleEntry[];
  timestamp: number;
}

const MONITORED_GAMES_STORE_KEY = 'psnine_next:battle_monitored_games';
const BATTLE_CACHE_STORE_KEY = 'psnine_next:battle_cache';

/**
 * Extracts gameId from URL.
 */
export function extractGameIdFromUrl(urlStr: string): string | null {
  const m = urlStr.match(/\/psngame\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Parses battle rows from a document without using :has().
 * Handles real P9 battle layout:
 * - Cover: td.pdd15 (width="91") a[href*="/psngame/"] with empty text (only img)
 * - Actual title: td.pd15 > p > a[href*="/battle/"]
 * - Description: td.pd15 > span.font12
 * - Creator: avatar link href="/psnid/:id" with empty text
 */
export function parseBattleEntries(root: ParentNode): BattleEntry[] {
  const entries: BattleEntry[] = [];
  const rows = root.querySelectorAll('table.list tr');

  rows.forEach((r) => {
    const gameLink = r.querySelector('a[href*="/psngame/"]');
    if (!gameLink) return;

    const gameId = extractGameIdFromUrl((gameLink as HTMLAnchorElement).href || gameLink.getAttribute('href') || '');
    if (!gameId) return;

    // Real fixture: actual title is in td.pd15 a[href*="/battle/"]
    const battleLink = r.querySelector('td.pd15 a[href*="/battle/"], p a[href*="/battle/"], a[href*="/battle/"]');
    const gameTitle = battleLink?.textContent?.trim() || gameLink.textContent?.trim() || '';

    // Creator: avatar link href="/psnid/:id", text is empty in real fixture
    const creatorA = r.querySelector('a[href*="/psnid/"]');
    const creatorHref = creatorA?.getAttribute('href') || (creatorA as HTMLAnchorElement)?.href || '';
    const creatorId = creatorHref.match(/\/psnid\/([^/?#]+)/)?.[1] || creatorA?.textContent?.trim() || '';

    // Description: td.pd15 > span.font12 in real fixture
    const descSpan = r.querySelector('td.pd15 span.font12, span.font12');
    let description = descSpan?.textContent?.trim() || '';
    if (!description) {
      const descP = r.querySelector('td.pd15 p, td.pd10 p, td:nth-child(3) p');
      if (descP && !descP.querySelector('a[href*="/battle/"]')) {
        description = descP.textContent?.trim() || '';
      }
    }

    const dateTd = r.querySelector('td.twoge:nth-child(4), td.twoge');
    const dateStr = dateTd?.textContent?.trim() || '';
    const recruitTd = r.querySelector('td.twoge:last-child');
    const recruitStr = recruitTd?.textContent?.trim() || '';
    const recruitMatch = recruitStr.match(/(\d+)人/);
    const recruitsCount = recruitMatch ? parseInt(recruitMatch[1], 10) : 1;

    entries.push({
      gameId,
      gameTitle,
      creatorId,
      description,
      dateStr,
      recruitsCount
    });
  });

  return entries;
}

/**
 * Validates whether parsed document is a valid battle page vs an HTTP 200 login / error page.
 */
export function isValidBattlePage(doc: Document): boolean {
  // Check for login page markers
  if (
    doc.querySelector('form[action*="/auth/user/login"], .login-box, input[name="psnid"], input[type="password"]') !== null ||
    /登录\s*[-|]\s*PSNINE/i.test(doc.title) ||
    doc.title === '登录'
  ) {
    return false;
  }

  // Check for error page markers
  if (
    doc.querySelector('.error-box, .alert-danger, .alert-error') !== null ||
    doc.title.includes('出错了') ||
    doc.title.includes('404') ||
    doc.title.includes('500')
  ) {
    return false;
  }

  // 1. If actual battle rows are parsed, it is definitely a valid battle page
  const entries = parseBattleEntries(doc);
  if (entries.length > 0) {
    return true;
  }

  // 2. Genuine page-content marker for empty battle page:
  // Must NOT rely solely on generic shell navigation (.site-nav a[href*="/battle"]) or arbitrary table.list.
  // Requires genuine create-battle link (/set/battle) / rules link (/topic/7552),
  // OR a specific battle title ("约战") combined with expected content container (.box, .main, .min-inner).
  const hasCreateBattleLink = doc.querySelector('a[href*="/set/battle"], a[href*="/topic/7552"]') !== null;
  if (hasCreateBattleLink) {
    return true;
  }

  const hasBattleTitle = doc.title.includes('约战');
  const hasContentContainer = doc.querySelector('.main, .min-inner .box, .box') !== null;
  const hasHeading = Array.from(doc.querySelectorAll('h1, h2, h3, .title, .page-header')).some(
    el => el.textContent?.includes('约战')
  );

  if (hasBattleTitle && (hasContentContainer || hasHeading)) {
    return true;
  }

  return false;
}

/**
 * Deeply validates battle cache structure from store.
 * Rejects non-numeric game IDs, NaNs, non-arrays, and invalid timestamps.
 */
export function validateBattleCache(raw: unknown): BattleCache | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<BattleCache>;
  if (typeof obj.timestamp !== 'number' || !Number.isFinite(obj.timestamp) || obj.timestamp <= 0) {
    return null;
  }
  if (!Array.isArray(obj.entries)) return null;

  const validEntries: BattleEntry[] = [];
  for (const e of obj.entries) {
    if (
      e &&
      typeof e === 'object' &&
      typeof e.gameId === 'string' &&
      /^\d+$/.test(e.gameId) &&
      typeof e.gameTitle === 'string' &&
      typeof e.creatorId === 'string' &&
      typeof e.description === 'string' &&
      typeof e.dateStr === 'string' &&
      typeof e.recruitsCount === 'number' &&
      Number.isFinite(e.recruitsCount) &&
      e.recruitsCount >= 1
    ) {
      validEntries.push({
        gameId: e.gameId,
        gameTitle: e.gameTitle,
        creatorId: e.creatorId,
        description: e.description,
        dateStr: e.dateStr,
        recruitsCount: Math.round(e.recruitsCount)
      });
    }
  }

  return {
    entries: validEntries,
    timestamp: obj.timestamp
  };
}

/**
 * Synchronizes battle cache (B05):
 * - If monitoredGames is empty, returns empty array without network request.
 * - If cache is fresh and not forceRefresh, returns cache.
 * - Verifies page authenticity: HTTP 200 login or error pages do NOT clear cache.
 * - If valid battle response (even if 0 entries), updates cache to clear ended battles.
 * - On network or validation failure, retains old cache and reports error.
 */
export async function syncBattleCache(
  ctx: Context,
  monitoredGames: string[],
  forceRefresh = false
): Promise<BattleEntry[]> {
  if (!monitoredGames || monitoredGames.length === 0) {
    return [];
  }

  const interval = ctx.settings.BattleInfoUpdateInterval || 3600000;
  const rawCache = await ctx.store.get<unknown>(BATTLE_CACHE_STORE_KEY, null);
  const existingCache = validateBattleCache(rawCache);

  if (!forceRefresh && existingCache && Date.now() - existingCache.timestamp < interval) {
    return existingCache.entries;
  }

  try {
    const targetUrl = new URL('/battle', ctx.url.origin).href;
    const httpTtl = forceRefresh ? 0 : Math.min(interval, 300000); // 300,000 ms = 5 minutes
    const htmlText = await ctx.http.text(targetUrl, { ttl: httpTtl });
    const DOMParserClass = (ctx.window as unknown as { DOMParser: typeof DOMParser }).DOMParser || DOMParser;
    const parser = new DOMParserClass();
    const parsedDoc = parser.parseFromString(htmlText, 'text/html');

    if (!isValidBattlePage(parsedDoc)) {
      ctx.report('battle_cache_sync', new Error('HTTP 200 response is not a valid battle page (login or error page)'));
      return existingCache ? existingCache.entries : [];
    }

    const freshEntries = parseBattleEntries(parsedDoc);

    // B05: Valid response (even empty) updates cache so ended battles are cleared
    await ctx.store.set(BATTLE_CACHE_STORE_KEY, {
      entries: freshEntries,
      timestamp: Date.now()
    });
    return freshEntries;
  } catch (err) {
    ctx.report('battle_cache_sync', err);
  }

  return existingCache ? existingCache.entries : [];
}

/**
 * Mounts the Battle Feature Module.
 */
export const mountBattle: Mount = async (ctx: Context) => {
  const { document: doc, url, settings, onContent, report } = ctx;

  const isBattlePage = url.pathname.includes('/battle');
  const isGamePage = url.pathname.includes('/psngame/');

  let isActive = true;
  const unsubs: Array<() => void> = [];

  try {
    let monitoredGames = await ctx.store.get<string[]>(MONITORED_GAMES_STORE_KEY, []);
    if (!Array.isArray(monitoredGames)) monitoredGames = [];

    // Toggle queue to serialize rapid toggles safely
    let toggleQueue = Promise.resolve();

    // Toggle game monitoring (B03) with serialized queue and pending protection
    const toggleGameMonitoring = async (gameId: string, triggeringBtn?: HTMLElement) => {
      if (triggeringBtn) {
        triggeringBtn.style.pointerEvents = 'none';
      }

      toggleQueue = toggleQueue.then(async () => {
        if (!isActive) return;
        try {
          const latest = await ctx.store.get<string[]>(MONITORED_GAMES_STORE_KEY, []);
          const nextMonitored = Array.isArray(latest) ? [...latest] : [];
          const idx = nextMonitored.indexOf(gameId);
          if (idx >= 0) {
            nextMonitored.splice(idx, 1);
          } else {
            nextMonitored.push(gameId);
          }
          await ctx.store.set(MONITORED_GAMES_STORE_KEY, nextMonitored);
          monitoredGames = nextMonitored;

          if (!isActive) return;
          updateAllBellIcons();
          await updateNavRecruitNotification();
        } catch (err) {
          report('battle_toggle_monitoring', err);
        } finally {
          if (triggeringBtn) {
            triggeringBtn.style.removeProperty('pointer-events');
          }
        }
      }).catch((err) => {
        report('battle_toggle_queue', err);
      });

      await toggleQueue;
    };

    // Update bell button styles
    const updateAllBellIcons = () => {
      doc.querySelectorAll('.psnine-battle-bell-btn').forEach((btnEl) => {
        const btn = btnEl as HTMLElement;
        const gid = btn.getAttribute('data-game-id');
        if (!gid) return;
        const isMonitored = monitoredGames.includes(gid);
        btn.textContent = isMonitored ? '🔔 已监控' : '🔕 监控';
        btn.style.borderColor = isMonitored ? '#f59f00' : '#ccc';
        btn.style.background = isMonitored ? 'rgba(245, 159, 0, 0.15)' : 'transparent';
        btn.style.color = isMonitored ? '#d97706' : 'inherit';
        btn.setAttribute('title', isMonitored ? '点击取消对此游戏的约战监控' : '点击开启对此游戏的约战监控');
      });
    };

    // Update navigation recruit notification badge (B04)
    const updateNavRecruitNotification = async () => {
      try {
        const battleLinks = doc.querySelectorAll('.site-nav a[href*="/battle"], #pcmenu a[href*="/battle"], .nav-menu a[href*="/battle"], .mobile-nav-panel a[href*="/battle"]');
        if (battleLinks.length === 0 || !isActive) return;

        if (monitoredGames.length === 0) {
          doc.querySelectorAll('.psnine-battle-notify-badge').forEach(b => b.remove());
          return;
        }

        const activeBattles = await syncBattleCache(ctx, monitoredGames);
        if (!isActive) return;

        // B04: Distinct count of unique monitored games having active recruitments
        const matchingGames = new Set<string>();
        for (const b of activeBattles) {
          if (monitoredGames.includes(b.gameId)) {
            matchingGames.add(b.gameId);
          }
        }
        const distinctGameCount = matchingGames.size;

        battleLinks.forEach((a) => {
          let badge = a.querySelector('.psnine-battle-notify-badge');
          if (distinctGameCount > 0) {
            if (!badge) {
              badge = doc.createElement('span');
              badge.className = 'psnine-battle-notify-badge';
              badge.setAttribute('data-psnine-next', 'true');
              badge.setAttribute('style', 'display:inline-block;padding:0 5px;margin-left:4px;border-radius:10px;background:#e03131;color:#fff;font-size:10px;font-weight:bold;line-height:16px;vertical-align:middle;');
              a.appendChild(badge);
            }
            badge.textContent = `${distinctGameCount}`;
            badge.setAttribute('title', `发现 ${distinctGameCount} 个已监控游戏的约战招募！`);
          } else if (badge) {
            badge.remove();
          }
        });
      } catch (err) {
        report('battle_nav_update', err);
      }
    };

    // 1. Battle Page (/battle)
    if (isBattlePage) {
      // Load user game progress cache (B02: UserProgressData shared model from games)
      let userProgressMap: Record<string, GameProgressRecord> = {};
      if (ctx.userId && settings.showGameProgressInBattle) {
        const progressKey = `psnine_next:progress:${ctx.userId}`;
        const rawProgress = await ctx.store.get<unknown>(progressKey, null);
        const valid = validateUserProgressData(rawProgress, ctx.userId);
        if (valid && valid.userId === ctx.userId && valid.games) {
          userProgressMap = valid.games;
        }
      }

      const enhanceBattlePage = () => {
        if (!isActive) return;
        const rows = doc.querySelectorAll('table.list tr');
        rows.forEach((r) => {
          const row = r as HTMLElement;

          // B01: Hide creator avatar without using :has(), strictly preserving game cover
          if (settings.removeHeaderInBattle) {
            const cells = row.querySelectorAll('td');
            cells.forEach((td) => {
              const isAvatar =
                td.getAttribute('width') === '50' ||
                (td.querySelector('a[href*="/psnid/"]') !== null && td.querySelector('a[href*="/psngame/"]') === null);
              if (isAvatar) {
                setHidden(td as HTMLElement, 'battle-avatar', true);
              }
            });
          }

          const gameLink = row.querySelector('a[href*="/psngame/"]') as HTMLAnchorElement | null;
          if (!gameLink) return;
          const gameId = extractGameIdFromUrl(gameLink.href || gameLink.getAttribute('href') || '');
          if (!gameId) return;

          // B02: Render personal game progress background and badge
          if (settings.showGameProgressInBattle && userProgressMap[gameId]) {
            const rec = userProgressMap[gameId];
            row.style.background = `linear-gradient(to right, rgba(56, 144, 255, 0.12) ${rec.percent}%, transparent ${rec.percent}%)`;
            if (!row.querySelector('.psnine-battle-progress-badge')) {
              const badge = doc.createElement('span');
              badge.className = 'psnine-battle-progress-badge';
              badge.setAttribute('data-psnine-next', 'true');
              badge.style.cssText = 'display:inline-block;padding:1px 4px;font-size:10px;border-radius:3px;background:rgba(56, 144, 255, 0.2);color:#0056b3;margin-left:4px;';
              badge.textContent = `我的进度:${rec.percent}%`;
              const battleTitleLink = row.querySelector('td.pd15 a[href*="/battle/"]') || gameLink;
              battleTitleLink.parentElement?.appendChild(badge);
            }
          }

          // B03: Add Bell monitor button with data-psnine-next mounted in title cell td.pd15 (NOT cover cell)
          if (!row.querySelector('.psnine-battle-bell-btn')) {
            const bellBtn = doc.createElement('button');
            bellBtn.type = 'button';
            bellBtn.className = 'psnine-battle-bell-btn';
            bellBtn.setAttribute('data-psnine-next', 'true');
            bellBtn.setAttribute('data-game-id', gameId);
            bellBtn.style.cssText = 'padding:2px 6px;font-size:11px;border-radius:4px;border:1px solid #ccc;cursor:pointer;margin-left:6px;user-select:none;transition:all 0.15s;';
            bellBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleGameMonitoring(gameId, bellBtn).catch((err) => report('battle_bell_click', err));
            };

            const titleTd = row.querySelector('td.pd15') || row.querySelector('td.pdd15:not([width="91"]):not(.h-p)') || row.querySelector('td:nth-child(3)');
            if (titleTd) {
              const p = titleTd.querySelector('p');
              if (p) {
                p.appendChild(bellBtn);
              } else {
                titleTd.appendChild(bellBtn);
              }
            } else {
              gameLink.parentElement?.appendChild(bellBtn);
            }
          }
        });

        updateAllBellIcons();
      };

      enhanceBattlePage();
      const unsub = onContent(() => enhanceBattlePage());
      unsubs.push(unsub);
    }

    // 2. Single Game Page (/psngame/\d+)
    if (isGamePage) {
      const gameId = extractGameIdFromUrl(url.pathname);
      if (gameId) {
        const injectGamePageBell = () => {
          if (!isActive || doc.getElementById('psnine-game-page-battle-bell')) return;
          const targetBar = doc.querySelector('.main > ul.inav, ul.inav, .box.pd10, h1');
          if (!targetBar) return;

          const bellBtn = doc.createElement('button');
          bellBtn.type = 'button';
          bellBtn.id = 'psnine-game-page-battle-bell';
          bellBtn.className = 'psnine-battle-bell-btn';
          bellBtn.setAttribute('data-psnine-next', 'true');
          bellBtn.setAttribute('data-game-id', gameId);
          bellBtn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:4px;border:1px solid #ccc;cursor:pointer;margin-left:10px;vertical-align:middle;';

          bellBtn.onclick = (e) => {
            e.preventDefault();
            toggleGameMonitoring(gameId, bellBtn).catch((err) => report('battle_game_bell_click', err));
          };

          if (targetBar.tagName === 'H1') {
            targetBar.appendChild(bellBtn);
          } else {
            const li = doc.createElement('li');
            li.setAttribute('data-psnine-next', 'true');
            li.appendChild(bellBtn);
            targetBar.appendChild(li);
          }
          updateAllBellIcons();
        };

        injectGamePageBell();
        const unsub = onContent(() => injectGamePageBell());
        unsubs.push(unsub);
      }
    }

    updateNavRecruitNotification().catch((err) => report('battle_nav_init', err));

    return () => {
      isActive = false;
      for (const unsub of unsubs) {
        try {
          unsub();
        } catch (err) {
          report('battle_cleanup', err);
        }
      }
    };
  } catch (err) {
    report('battle', err);
  }
};
