import { describe, it, expect, vi } from 'vitest';
import {
  extractGameIdFromUrl,
  parseBattleEntries,
  syncBattleCache,
  isValidBattlePage,
  validateBattleCache,
  mountBattle
} from '../src/features/battle';
import { Context, defaultSettings } from '../src/core/types';
import { isHiddenByReason } from '../src/core/dom';

describe('Battle Feature Module (B01 - B05)', () => {
  describe('extractGameIdFromUrl & parseBattleEntries', () => {
    it('extracts gameId accurately', () => {
      expect(extractGameIdFromUrl('https://psnine.com/psngame/21035')).toBe('21035');
      expect(extractGameIdFromUrl('/psngame/999/comment')).toBe('999');
      expect(extractGameIdFromUrl('/topic/123')).toBeNull();
    });

    it('parses battle entries from legacy HTML structure without :has()', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <table class="list">
          <tr>
            <td class="pdd15"><a href="https://psnine.com/psngame/21035">无主之地3</a></td>
            <td class="pdd15 h-p"><a href="https://psnine.com/psnid/tonywch"><img src="avatar.jpg" /></a></td>
            <td class="pd15"><p>决斗一次 复活一次</p></td>
            <td class="twoge">9月30日</td>
            <td class="twoge">2人招募</td>
          </tr>
        </table>
      `;

      const entries = parseBattleEntries(container);
      expect(entries.length).toBe(1);
      expect(entries[0].gameId).toBe('21035');
      expect(entries[0].gameTitle).toBe('无主之地3');
      expect(entries[0].creatorId).toBe('tonywch');
      expect(entries[0].recruitsCount).toBe(2);
    });

    it('parses battle entries from real live battle.html minimal fixture', () => {
      // In real battle.html:
      // - Cover cell td.pdd15 width="91" contains gameLink with EMPTY text (only img)
      // - Title is in td.pd15 > p > a[href*="/battle/"]
      // - Description is in td.pd15 > span.font12
      // - Creator avatar link has EMPTY text (only img)
      const container = document.createElement('div');
      container.innerHTML = `
        <table class="list">
          <tr>
            <td class="pdd15" width="91">
              <a href="https://psnine.com/psngame/59465"><img src="cover.png" width="91" height="91" class="imgbgnb"/></a>
            </td>
            <td width="50" class="pdd15 h-p">
              <a href="https://psnine.com/psnid/nyi5tiu4ebp"><img src="avatar.png" width="50" height="50"/></a>
            </td>
            <td class="pd15">
              <p>
                <span class="pf_ps5">PS5</span>
                <a href="https://psnine.com/battle/33621">伊莫</a>
                <em>（+0）</em>
              </p>
              <span class="font12" style="color:#9ba3af;">做好友羁绊奖杯和送蛋奖杯，工作日中午晚上有空，周末全天有空</span>
            </td>
            <td class="twoge h-p" width="10%">9月30日 <em>星期三</em></td>
            <td class="twoge h-p" width="10%">2人<em>招募</em></td>
          </tr>
        </table>
      `;

      const entries = parseBattleEntries(container);
      expect(entries.length).toBe(1);
      expect(entries[0].gameId).toBe('59465');
      expect(entries[0].gameTitle).toBe('伊莫');
      expect(entries[0].creatorId).toBe('nyi5tiu4ebp');
      expect(entries[0].description).toBe('做好友羁绊奖杯和送蛋奖杯，工作日中午晚上有空，周末全天有空');
      expect(entries[0].recruitsCount).toBe(2);
    });
  });

  describe('syncBattleCache & Validation (B05: 无监控不请求 / 失败保留旧缓存 / 200登录页防误清 / 有效空列表更新)', () => {
    it('returns empty array without making HTTP request when monitoredGames is empty', async () => {
      const mockHttp = { text: vi.fn(), document: vi.fn(), json: vi.fn() };
      const mockStore = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };

      const ctx = {
        settings: { ...defaultSettings, BattleInfoUpdateInterval: 3600000 },
        store: mockStore,
        http: mockHttp,
        report: vi.fn(),
        url: new URL('https://psnine.com/battle'),
        window
      } as unknown as Context;

      const res = await syncBattleCache(ctx, []);
      expect(res).toEqual([]);
      expect(mockHttp.text).not.toHaveBeenCalled();
    });

    it('uses cached entries if cache is within update interval', async () => {
      const mockCached = {
        entries: [{ gameId: '21035', gameTitle: '无主之地3', creatorId: 'tony', description: 'test', dateStr: 'now', recruitsCount: 2 }],
        timestamp: Date.now() - 1000
      };
      const mockHttp = { text: vi.fn(), document: vi.fn(), json: vi.fn() };
      const mockStore = {
        get: vi.fn().mockResolvedValue(mockCached),
        set: vi.fn(),
        remove: vi.fn()
      };
      const ctx = {
        settings: { ...defaultSettings, BattleInfoUpdateInterval: 3600000 },
        store: mockStore,
        http: mockHttp,
        report: vi.fn(),
        url: new URL('https://psnine.com/battle'),
        window
      } as unknown as Context;

      const res = await syncBattleCache(ctx, ['21035']);
      expect(res).toEqual(mockCached.entries);
      expect(mockHttp.text).not.toHaveBeenCalled();
    });

    it('retains old cache on network failure', async () => {
      const oldCached = {
        entries: [{ gameId: '21035', gameTitle: '无主之地3', creatorId: 'tony', description: 'test', dateStr: 'now', recruitsCount: 2 }],
        timestamp: Date.now() - 7200000
      };
      const mockHttp = {
        text: vi.fn().mockRejectedValue(new Error('Network error')),
        document: vi.fn(),
        json: vi.fn()
      };
      const mockStore = {
        get: vi.fn().mockResolvedValue(oldCached),
        set: vi.fn(),
        remove: vi.fn()
      };
      const ctx = {
        settings: { ...defaultSettings, BattleInfoUpdateInterval: 3600000 },
        store: mockStore,
        http: mockHttp,
        report: vi.fn(),
        url: new URL('https://psnine.com/battle'),
        window
      } as unknown as Context;

      const res = await syncBattleCache(ctx, ['21035']);
      expect(res).toEqual(oldCached.entries);
    });

    it('distinguishes HTTP 200 login / error page vs valid empty page', async () => {
      const oldCached = {
        entries: [{ gameId: '21035', gameTitle: '无主之地3', creatorId: 'tony', description: 'test', dateStr: 'now', recruitsCount: 2 }],
        timestamp: Date.now() - 7200000
      };

      // Case 1: HTTP 200 returns login page
      const loginHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>用户登录 - PSNINE</title></head>
          <body>
            <form action="/auth/user/login" method="post">
              <input name="psnid" />
              <input name="pass" type="password" />
            </form>
          </body>
        </html>
      `;

      const mockReport = vi.fn();
      const mockStoreSet = vi.fn();
      const ctxLogin = {
        settings: { ...defaultSettings, BattleInfoUpdateInterval: 3600000 },
        store: {
          get: vi.fn().mockResolvedValue(oldCached),
          set: mockStoreSet,
          remove: vi.fn()
        },
        http: {
          text: vi.fn().mockResolvedValue(loginHtml),
          document: vi.fn(),
          json: vi.fn()
        },
        report: mockReport,
        url: new URL('https://psnine.com/battle'),
        window
      } as unknown as Context;

      const resLogin = await syncBattleCache(ctxLogin, ['21035'], true);
      // Retains old cache and does NOT overwrite with empty entries
      expect(resLogin).toEqual(oldCached.entries);
      expect(mockStoreSet).not.toHaveBeenCalled();
      expect(mockReport).toHaveBeenCalledWith('battle_cache_sync', expect.any(Error));

      // Case 2: HTTP 200 returns TRUE valid empty battle page
      const validEmptyHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>PSN约战系统</title></head>
          <body>
            <center><a href="https://psnine.com/set/battle" class="btn">创建</a></center>
            <div class="box"><table class="list"></table></div>
          </body>
        </html>
      `;

      const mockStoreSetEmpty = vi.fn();
      const ctxEmpty = {
        settings: { ...defaultSettings, BattleInfoUpdateInterval: 3600000 },
        store: {
          get: vi.fn().mockResolvedValue(oldCached),
          set: mockStoreSetEmpty,
          remove: vi.fn()
        },
        http: {
          text: vi.fn().mockResolvedValue(validEmptyHtml),
          document: vi.fn(),
          json: vi.fn()
        },
        report: vi.fn(),
        url: new URL('https://psnine.com/battle'),
        window
      } as unknown as Context;

      const resEmpty = await syncBattleCache(ctxEmpty, ['21035'], true);
      // Valid empty page clears cache
      expect(resEmpty).toEqual([]);
      expect(mockStoreSetEmpty).toHaveBeenCalledWith('psnine_next:battle_cache', expect.objectContaining({
        entries: [],
        timestamp: expect.any(Number)
      }));
    });

    it('validates battle cache schema and rejects corrupted payloads', () => {
      expect(validateBattleCache(null)).toBeNull();
      expect(validateBattleCache('string')).toBeNull();
      expect(validateBattleCache({ timestamp: 0, entries: [] })).toBeNull();
      expect(validateBattleCache({ timestamp: 12345, entries: 'not-array' })).toBeNull();

      const valid = validateBattleCache({
        timestamp: 1234567,
        entries: [
          { gameId: '1001', gameTitle: 'G1', creatorId: 'c1', description: 'd1', dateStr: 'today', recruitsCount: 2 },
          { gameId: 'bad_id', gameTitle: 'G2', creatorId: 'c2', description: 'd2', dateStr: 'today', recruitsCount: 2 } // non-numeric rejected
        ]
      });
      expect(valid).not.toBeNull();
      expect(valid?.entries.length).toBe(1);
      expect(valid?.entries[0].gameId).toBe('1001');
    });

    it('rejects generic site shell with nav battle link and arbitrary table to prevent cache clearing', async () => {
      const oldCached = {
        entries: [{ gameId: '21035', gameTitle: '无主之地3', creatorId: 'tony', description: 'test', dateStr: 'now', recruitsCount: 2 }],
        timestamp: Date.now() - 7200000
      };

      // Generic unrelated page with .site-nav containing /battle and an unrelated table.list
      const genericShellHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>游戏社区 - PSNINE</title></head>
          <body>
            <header class="site-nav">
              <nav><a href="/battle">约战</a></nav>
            </header>
            <div class="main">
              <table class="list">
                <tr><td>Unrelated Topic 1</td></tr>
              </table>
            </div>
          </body>
        </html>
      `;

      const parsedDoc = new DOMParser().parseFromString(genericShellHtml, 'text/html');
      expect(isValidBattlePage(parsedDoc)).toBe(false);

      const mockStoreSet = vi.fn();
      const mockReport = vi.fn();
      const ctx = {
        settings: { ...defaultSettings, BattleInfoUpdateInterval: 3600000 },
        store: {
          get: vi.fn().mockResolvedValue(oldCached),
          set: mockStoreSet,
          remove: vi.fn()
        },
        http: {
          text: vi.fn().mockResolvedValue(genericShellHtml),
          document: vi.fn(),
          json: vi.fn()
        },
        report: mockReport,
        url: new URL('https://psnine.com/battle'),
        window
      } as unknown as Context;

      const res = await syncBattleCache(ctx, ['21035'], true);
      // Retains existing cache; does NOT clear cache erroneously!
      expect(res).toEqual(oldCached.entries);
      expect(mockStoreSet).not.toHaveBeenCalled();
      expect(mockReport).toHaveBeenCalledWith('battle_cache_sync', expect.any(Error));
    });
  });

  describe('mountBattle DOM Integration (B01, B02, B03, B04)', () => {
    it('applies avatar hiding without :has, progress background, bell toggling, and distinct count badge', async () => {
      document.body.innerHTML = `
        <header class="site-nav">
          <nav class="nav-menu">
            <a href="https://psnine.com/battle">约战</a>
          </nav>
        </header>
        <div class="min-inner">
          <div class="box">
            <table class="list">
              <tr id="row-battle-1">
                <td class="pdd15" width="91"><a href="https://psnine.com/psngame/21035"><img src="cover.png" width="91" height="91"/></a></td>
                <td class="pdd15 h-p" width="50"><a href="https://psnine.com/psnid/tonywch"><img class="avatar" src="avatar.jpg" /></a></td>
                <td class="pd15"><p><a href="https://psnine.com/battle/33629">无主之地3</a></p><span class="font12">决斗一次</span></td>
                <td class="twoge">9月30日</td>
                <td class="twoge">2人招募</td>
              </tr>
            </table>
          </div>
        </div>
      `;

      let storedMonitored: string[] = [];
      const mockStore = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key.includes('progress:test_user')) {
            return Promise.resolve({
              userId: 'test_user',
              games: {
                '21035': { gameId: '21035', percent: 85, platinum: false, updatedAt: Date.now() }
              },
              lastFullSync: Date.now()
            });
          }
          if (key.includes('battle_monitored_games')) {
            return Promise.resolve(storedMonitored);
          }
          return Promise.resolve(null);
        }),
        set: vi.fn().mockImplementation((key: string, val: any) => {
          if (key.includes('battle_monitored_games')) {
            storedMonitored = val;
          }
          return Promise.resolve();
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/battle'),
        settings: {
          ...defaultSettings,
          removeHeaderInBattle: true, // B01
          showGameProgressInBattle: true, // B02
          BattleInfoUpdateInterval: 3600000
        },
        store: mockStore,
        http: {
          text: vi.fn().mockResolvedValue(`
            <table class="list">
              <tr>
                <td class="pdd15"><a href="https://psnine.com/psngame/21035">无主之地3</a></td>
                <td class="twoge">2人招募</td>
              </tr>
              <tr>
                <td class="pdd15"><a href="https://psnine.com/psngame/21035">无主之地3 (第二条)</a></td>
                <td class="twoge">1人招募</td>
              </tr>
            </table>
          `),
          document: vi.fn(),
          json: vi.fn()
        },
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountBattle(ctx);

      const row = document.getElementById('row-battle-1')!;
      // B01: Avatar column (width=50) should be hidden, cover (width=91) should NOT be hidden!
      const avatarTd = row.querySelector('td.h-p') as HTMLElement;
      expect(isHiddenByReason(avatarTd, 'battle-avatar')).toBe(true);
      const coverTd = row.querySelector('td[width="91"]') as HTMLElement;
      expect(isHiddenByReason(coverTd, 'battle-avatar')).toBe(false);

      // B02: Progress background and badge
      expect(row.style.background).toContain('85%');
      expect(row.textContent).toContain('我的进度:85%');

      // B03: Bell button mounted inside title cell td.pd15, NOT cover cell td.pdd15
      const bellBtn = row.querySelector('.psnine-battle-bell-btn') as HTMLElement;
      expect(bellBtn).not.toBeNull();
      expect(bellBtn.hasAttribute('data-psnine-next')).toBe(true);
      expect(bellBtn.closest('td.pd15')).not.toBeNull();
      expect(bellBtn.closest('td.pdd15')).toBeNull();
      expect(bellBtn.textContent).toContain('监控');

      // Click to monitor game 21035
      bellBtn.click();
      await new Promise((r) => setTimeout(r, 60));

      expect(storedMonitored).toContain('21035');
      expect(bellBtn.textContent).toContain('已监控');

      // B04: Nav battle link badge should count unique game (1 distinct game despite 2 recruitment rows)
      const navBadge = document.querySelector('.psnine-battle-notify-badge');
      expect(navBadge).not.toBeNull();
      expect(navBadge?.hasAttribute('data-psnine-next')).toBe(true);
      expect(navBadge?.textContent).toBe('1');

      if (typeof cleanup === 'function') cleanup();
    });

    it('cleans up subscriptions and ignores pending async operations after unmount', async () => {
      document.body.innerHTML = `
        <div class="box"><table class="list"></table></div>
      `;

      let unsubCalled = false;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/battle'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 50))),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined)
        },
        http: {
          text: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('<table class="list"></table>'), 100))),
          document: vi.fn(),
          json: vi.fn()
        },
        userId: 'test_user',
        onContent: vi.fn().mockImplementation(() => {
          return () => { unsubCalled = true; };
        }),
        report: vi.fn()
      };

      const cleanup = await mountBattle(ctx);
      if (typeof cleanup === 'function') cleanup();
      expect(unsubCalled).toBe(true);
    });

    it('validates UserProgressData strictly against own ctx.userId and rejects other users', async () => {
      document.body.innerHTML = `
        <table class="list">
          <tr id="r-prog">
            <td class="pdd15"><a href="/psngame/123">G</a></td>
            <td class="pd15"><p><a href="/battle/1">B</a></p></td>
          </tr>
        </table>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/battle'),
        settings: { ...defaultSettings, showGameProgressInBattle: true },
        store: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key.includes('progress:user_me')) {
              // Store contains data for DIFFERENT user (e.g. user_attacker)
              return Promise.resolve({
                userId: 'user_attacker',
                games: {
                  '123': { gameId: '123', percent: 100, platinum: true, updatedAt: 100 }
                }
              });
            }
            return Promise.resolve([]);
          }),
          set: vi.fn(),
          remove: vi.fn()
        },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'user_me', // Own user is user_me
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      await mountBattle(ctx);
      const row = document.getElementById('r-prog')!;
      // Should NOT apply progress background because userId in store ('user_attacker') does not match ctx.userId ('user_me')
      expect(row.style.background).toBe('');
      expect(row.querySelector('.psnine-battle-progress-badge')).toBeNull();
    });

    it('enhances dynamically appended rows via onContent', async () => {
      document.body.innerHTML = `
        <table class="list">
          <tr id="row-initial">
            <td class="pdd15"><a href="/psngame/100">G1</a></td>
            <td class="pd15"><p><a href="/battle/1">B1</a></p></td>
          </tr>
        </table>
      `;

      let contentSubscriber: () => void = () => {};
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/battle'),
        settings: { ...defaultSettings, showGameProgressInBattle: true },
        store: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key.includes('progress:test_user')) {
              return Promise.resolve({
                userId: 'test_user',
                games: {
                  '200': { gameId: '200', percent: 50, platinum: false, updatedAt: 100 }
                }
              });
            }
            return Promise.resolve(['200']); // monitored
          }),
          set: vi.fn(),
          remove: vi.fn()
        },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'test_user',
        onContent: vi.fn().mockImplementation((fn) => {
          contentSubscriber = fn;
          return () => {};
        }),
        report: vi.fn()
      };

      await mountBattle(ctx);

      // Dynamically append new row
      const table = document.querySelector('table.list')!;
      const newRow = document.createElement('tr');
      newRow.id = 'row-appended';
      newRow.innerHTML = `
        <td class="pdd15"><a href="/psngame/200">G2</a></td>
        <td class="pd15"><p><a href="/battle/2">B2</a></p></td>
      `;
      table.appendChild(newRow);

      contentSubscriber();

      expect(newRow.style.background).toContain('50%');
      expect(newRow.querySelector('.psnine-battle-progress-badge')).not.toBeNull();
      const bell = newRow.querySelector('.psnine-battle-bell-btn') as HTMLElement;
      expect(bell).not.toBeNull();
      expect(bell.textContent).toContain('已监控');
    });
  });
});
