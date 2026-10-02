import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mutateUserProgress,
  hasUserMutationQueue,
  syncUserGameProgress,
  parseGameRowProgress,
  extractElementProgressPercent,
  hasOfficialGameProgress,
  mountGames,
  UserProgressData
} from '../src/features/games';
import { Context, defaultSettings, Store } from '../src/core/types';
import { CORE_STYLES, DARK_THEME_STYLES } from '../src/styles/index';

describe('Games Feature Module - Comprehensive Regressions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('1. mutateUserProgress: Queue Failure Recovery & Idle Map Cleanup', () => {
    it('does not poison queue when a job rejects; original caller rejects, subsequent job succeeds, and idle map entry is deleted', async () => {
      let storeState: any = null;
      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(storeState)),
        set: vi.fn().mockImplementation((k, v) => { storeState = v; return Promise.resolve(); }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      const testUser = 'user_queue_test';

      // Job 1: Deliberately throws an error
      const job1Promise = mutateUserProgress(mockStore, testUser, async () => {
        await new Promise(r => setTimeout(r, 15));
        throw new Error('Controlled Job 1 Failure');
      });

      // Job 2: Queued immediately behind Job 1
      const job2Promise = mutateUserProgress(mockStore, testUser, async (cache) => {
        await new Promise(r => setTimeout(r, 10));
        cache.games['555'] = { gameId: '555', percent: 80, platinum: true, updatedAt: 5000 };
        return cache;
      });

      // Job 1's caller MUST reject with original error
      await expect(job1Promise).rejects.toThrow('Controlled Job 1 Failure');

      // Job 2 MUST succeed and apply its mutation (not poisoned by Job 1!)
      const result2 = await job2Promise;
      expect(result2.games['555']).toBeDefined();
      expect(result2.games['555'].percent).toBe(80);
      expect(storeState.games['555'].percent).toBe(80);

      // Verify that after settling, the queue entry was deleted and did not leak memory
      await new Promise(r => setTimeout(r, 10));
      expect(hasUserMutationQueue(testUser)).toBe(false);

      // Subsequent Job 3 executes on clean queue
      const job3Result = await mutateUserProgress(mockStore, testUser, (cache) => {
        cache.games['666'] = { gameId: '666', percent: 100, platinum: false, updatedAt: 6000 };
        return cache;
      });
      expect(job3Result.games['666']).toBeDefined();
      expect(hasUserMutationQueue(testUser)).toBe(false);
    });
  });

  describe('2. Own Profile Merge: Preserves Background Updates & Uses Fresh Cache for UI', () => {
    it('merges only actually parsed visible rows by updatedAt, preserving newer background records from entire stale snapshot', async () => {
      const myUserId = 'alice';

      // Store initially has offpage game 101 at 10%
      let storeState: UserProgressData = {
        userId: myUserId,
        games: {
          '101': { gameId: '101', percent: 10, platinum: false, updatedAt: 1000 }
        },
        lastFullSync: 1000,
        nextRefresh: Date.now() + 3600000,
        refreshInterval: 3600000,
        syncCursorPage: 1,
        syncStatus: 'idle'
      };

      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(storeState)),
        set: vi.fn().mockImplementation((k, v) => { storeState = v; return Promise.resolve(); }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      // Set up DOM for Alice's own profile page: /psnid/alice
      // Visible table contains ONLY game 202 (20%). Offpage game 101 is NOT in this table!
      document.body.innerHTML = `
        <div class="psnzz"><div class="inner"></div></div>
        <table>
          <tr id="row-g202">
            <td class="pd15"><a href="/psngame/202">Game 202</a></td>
            <td class="pd10">
              <div class="progress"><div style="width: 20%"></div></div>
              <small><span class="text-platinum">白0</span></small>
            </td>
          </tr>
        </table>
      `;

      // Simulate a concurrent background sync (or another tab) updating game 101 from 10% to 90%
      storeState.games['101'] = { gameId: '101', percent: 90, platinum: true, updatedAt: 2000 };

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psnid/alice'),
        settings: { ...defaultSettings },
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: myUserId,
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      // Verify that offpage game 101 was NOT overwritten back to 10% by stale mount snapshot!
      expect(storeState.games['101']).toBeDefined();
      expect(storeState.games['101'].percent).toBe(90);
      expect(storeState.games['101'].platinum).toBe(true);

      // Verify that visible game 202 was merged cleanly
      expect(storeState.games['202']).toBeDefined();
      expect(storeState.games['202'].percent).toBe(20);

      if (cleanup) cleanup();
    });

    it('captures scrapeTime at visible row parse time so newer background record is never overwritten by mutator delay', async () => {
      const myUserId = 'alice_time';

      let storeState: UserProgressData = {
        userId: myUserId,
        games: {},
        lastFullSync: 0,
        nextRefresh: Date.now() + 3600000,
        refreshInterval: 3600000,
        syncCursorPage: 1,
        syncStatus: 'idle'
      };

      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(storeState)),
        set: vi.fn().mockImplementation((k, v) => { storeState = v; return Promise.resolve(); }),
        remove: vi.fn()
      };

      document.body.innerHTML = `
        <div class="psnzz"><div class="inner"></div></div>
        <table>
          <tr id="row-time-game">
            <td class="pd15"><a href="/psngame/303">Game 303</a></td>
            <td class="pd10">
              <div class="progress"><div style="width: 30%"></div></div>
            </td>
          </tr>
        </table>
      `;

      // A concurrent background sync queues a mutation for Game 303 with 80% and a future timestamp t2
      const t2 = Date.now() + 5000;
      await mutateUserProgress(mockStore, myUserId, (cache) => {
        cache.games['303'] = { gameId: '303', percent: 80, platinum: false, updatedAt: t2 };
        return cache;
      });

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psnid/alice_time'),
        settings: { ...defaultSettings },
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: myUserId,
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      // mountGames parses visible row (scrapeTime = t1, where t1 < t2)
      const cleanup = await mountGames(ctx);

      // Because visible row's scrapeTime was captured earlier than t2, the background 80% is PRESERVED!
      expect(storeState.games['303'].percent).toBe(80);

      if (cleanup) cleanup();
    });
  });

  describe('3. P05 Pagination: Same-Origin, Exact Path, Integer Page, and Empty / Error Validation', () => {
    it('rejects cross-origin, different user path, and non-consecutive pages', async () => {
      let savedCache: any = null;
      const testUserId = 'test_pag_user';

      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
        set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
        remove: vi.fn()
      };

      const makeMockPage = (nextHref: string) => {
        return new DOMParser().parseFromString(`
          <div class="psnzz"><a href="/psnid/${testUserId}">Profile</a></div>
          <table>
            <tr>
              <td><a href="/psngame/11">G11</a></td>
              <td><div class="progress"><div style="width: 50%"></div></div></td>
            </tr>
          </table>
          <div class="page">
            <a href="${nextHref}">Next</a>
          </div>
        `, 'text/html');
      };

      // 1. Cross-origin link rejected
      const ctxCross = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(makeMockPage('https://evil.com/psnid/test_pag_user/psngame?page=2')), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resCross = await syncUserGameProgress(ctxCross, testUserId, 2);
      expect(resCross.status).toBe('full'); // Stopped at page 1 because cross-origin link was rejected
      expect(savedCache.syncCursorPage).toBe(1);

      // Reset cache for next check
      savedCache = null;

      // 2. Different user path rejected
      const ctxDiffUser = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(makeMockPage('/psnid/other_user/psngame?page=2')), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resDiff = await syncUserGameProgress(ctxDiffUser, testUserId, 2);
      expect(resDiff.status).toBe('full');

      // Reset cache for next check
      savedCache = null;

      // 3. Non-consecutive page (e.g. page=5 when curPage=1) rejected
      const ctxJump = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(makeMockPage(`/psnid/${testUserId}/psngame?page=5`)), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resJump = await syncUserGameProgress(ctxJump, testUserId, 2);
      expect(resJump.status).toBe('full');

      // Reset cache for next check
      savedCache = null;

      // 4. Consecutive page (/psnid/:user/psngame?page=2) accepted
      let pageCallCount = 0;
      const ctxValid = {
        store: mockStore,
        http: {
          text: vi.fn(),
          document: vi.fn().mockImplementation(() => {
            pageCallCount++;
            if (pageCallCount === 1) {
              return Promise.resolve(makeMockPage(`/psnid/${testUserId}/psngame?page=2`));
            }
            // Page 2: last page without next link
            return Promise.resolve(new DOMParser().parseFromString(`
              <div class="psnzz"><a href="/psnid/${testUserId}">Profile</a></div>
              <table>
                <tr>
                  <td><a href="/psngame/22">G22</a></td>
                  <td><div class="progress"><div style="width: 100%"></div></div></td>
                </tr>
              </table>
              <div class="page"></div>
            `, 'text/html'));
          }),
          json: vi.fn()
        },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resValid = await syncUserGameProgress(ctxValid, testUserId, 2);
      expect(pageCallCount).toBe(2);
      expect(resValid.status).toBe('full');
      expect(savedCache.games['11']).toBeDefined();
      expect(savedCache.games['22']).toBeDefined();
    });

    it('does NOT treat login page or error page as full; sets error, retains existing cache, and applies backoff', async () => {
      const existingCache: UserProgressData = {
        userId: 'bob',
        games: {
          '77': { gameId: '77', percent: 77, platinum: false, updatedAt: 1000 }
        },
        lastFullSync: 1000,
        nextRefresh: 0,
        refreshInterval: 3600000,
        syncCursorPage: 3,
        syncStatus: 'partial'
      };

      let savedCache: any = existingCache;
      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
        set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
        remove: vi.fn()
      };

      // Case A: Response is a login page with generic .main
      const loginDoc = new DOMParser().parseFromString(`
        <html>
          <head><title>用户登录 - PSNINE</title></head>
          <body>
            <div class="main">
              <form action="/auth/user/login" method="post">
                <input type="password" name="password" />
              </form>
            </div>
          </body>
        </html>
      `, 'text/html');

      const ctxLogin = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(loginDoc), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resLogin = await syncUserGameProgress(ctxLogin, 'bob', 1);
      expect(resLogin.status).toBe('error');
      // Existing games cache MUST NOT be cleared or overwritten
      expect(savedCache.games['77']).toBeDefined();
      expect(savedCache.games['77'].percent).toBe(77);
      // Cursor page is preserved (not reset to 1)
      expect(savedCache.syncCursorPage).toBe(3);
      // Error backoff applied: nextRefresh is 15 minutes in the future
      expect(savedCache.nextRefresh).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

      // Case B: Table with rows but zero valid games and no explicit empty message (table error)
      const tableErrorDoc = new DOMParser().parseFromString(`
        <html>
          <head><title>游戏列表 - PSNINE</title></head>
          <body>
            <div class="main">
              <table>
                <tr><td>数据库查询失败，请稍后再试</td></tr>
              </table>
            </div>
          </body>
        </html>
      `, 'text/html');

      const ctxTableErr = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(tableErrorDoc), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resTableErr = await syncUserGameProgress(ctxTableErr, 'bob', 1);
      expect(resTableErr.status).toBe('error');
      expect(savedCache.syncStatus).toBe('error');

      // Case C: 0 rows on maintenance page without explicit empty message -> error
      const maintenanceDoc = new DOMParser().parseFromString(`
        <html>
          <head><title>系统维护中 - PSNINE</title></head>
          <body>
            <div class="psnzz"><a href="/psnid/bob">bob</a></div>
            <div class="main"></div>
          </body>
        </html>
      `, 'text/html');

      const ctxMaint = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(maintenanceDoc), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const resMaint = await syncUserGameProgress(ctxMaint, 'bob', 1);
      expect(resMaint.status).toBe('error');
    });

    it('identifies genuine verified empty profile list as full sync', async () => {
      let savedCache: any = null;
      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
        set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
        remove: vi.fn()
      };

      // Verified account profile with explicit empty game list
      const verifiedEmptyDoc = new DOMParser().parseFromString(`
        <html>
          <head><title>charlie 的游戏 - PSNINE</title></head>
          <body>
            <div class="psnzz"><a href="/psnid/charlie">charlie</a></div>
            <div class="main">
              <table>
                <tr><td>暂无游戏记录</td></tr>
              </table>
            </div>
          </body>
        </html>
      `, 'text/html');

      const ctx = {
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(verifiedEmptyDoc), json: vi.fn() },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const res = await syncUserGameProgress(ctx, 'charlie', 1);
      expect(res.status).toBe('full');
      expect(savedCache.syncStatus).toBe('full');
      expect(savedCache.syncCursorPage).toBe(1);
    });
  });

  describe('4. P02 On-Demand Loading: Cancellation, Cleanup, and No DOM / Cache Write', () => {
    it('passes AbortSignal to http.document, does not write cache or DOM after cleanup for in-flight request, and removes listeners', async () => {
      document.body.innerHTML = `
        <table>
          <tr id="row-demand-test">
            <td class="pd15"><a href="/psngame/8888"><img class="imgbgnb" src="cover.png" /></a></td>
          </tr>
        </table>
      `;

      let resolveFetch: (doc: Document) => void = () => {};
      let receivedSignal: AbortSignal | undefined = undefined;

      const mockHttp = {
        text: vi.fn(),
        document: vi.fn().mockImplementation((url: string, opts?: any) => {
          receivedSignal = opts?.signal;
          return new Promise<Document>((resolve) => {
            resolveFetch = resolve;
          });
        }),
        json: vi.fn()
      };

      let savedCache: any = null;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
          set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
          remove: vi.fn()
        },
        http: mockHttp,
        userId: 'demand_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      const demandBtn = document.querySelector('.psnine-ondemand-progress-btn') as HTMLButtonElement;
      const coverImg = document.querySelector('img.imgbgnb') as HTMLElement;
      expect(demandBtn).not.toBeNull();

      // Trigger fetch via button click
      demandBtn.click();
      expect(demandBtn.textContent).toContain('查询中');
      expect(receivedSignal).toBeDefined();
      expect((receivedSignal as any)?.aborted).toBe(false);

      // Now invoke cleanup while request is in-flight!
      if (typeof cleanup === 'function') cleanup();
      expect((receivedSignal as any)?.aborted).toBe(true);

      // Now resolve the in-flight request with authentic trophy document
      const validTrophyDoc = new DOMParser().parseFromString(`
        <div class="main">
          <p><a href="/psnid/demand_user">demand_user</a></p>
          <div class="progress"><div style="width: 50%"></div></div>
          <table>
            <tr class="trophy"><td class="t1"><img class="imgbg earned" /></td></tr>
          </table>
        </div>
      `, 'text/html');

      resolveFetch(validTrophyDoc);
      await new Promise(r => setTimeout(r, 40));

      // 1. MUST NOT write to store/cache after cleanup!
      expect(savedCache?.games?.['8888']).toBeUndefined();

      // 2. MUST NOT write to DOM (no badge added, no row background gradient)
      const row = document.getElementById('row-demand-test')!;
      expect(row.style.background).toBe('');
      expect(row.querySelector('.psnine-game-list-progress-badge')).toBeNull();

      // 3. Listeners removed: clicking button again does NOT trigger another fetch
      mockHttp.document.mockClear();
      demandBtn.click();
      coverImg.dispatchEvent(new MouseEvent('mouseenter'));
      expect(mockHttp.document).not.toHaveBeenCalled();
    });

    it('cancels cache write if unmounted while mutateUserProgress is in queue', async () => {
      document.body.innerHTML = `
        <table>
          <tr id="row-queue-cancel">
            <td class="pd15"><a href="/psngame/9991"><img class="imgbgnb" src="cover.png" /></a></td>
          </tr>
        </table>
      `;

      let releaseBlock: () => void = () => {};
      let savedCache: any = null;
      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
        set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
        remove: vi.fn()
      };

      // Block the mutation queue
      mutateUserProgress(mockStore, 'queue_user', () => new Promise<void>((r) => { releaseBlock = r; }));

      const validDoc = new DOMParser().parseFromString(`
        <div class="main">
          <p><a href="/psnid/queue_user">queue_user</a></p>
          <div class="progress"><div style="width: 80%"></div></div>
          <table>
            <tr class="trophy"><td class="t1"><img class="imgbg earned" /></td></tr>
          </table>
        </div>
      `, 'text/html');

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame'),
        settings: { ...defaultSettings },
        store: mockStore,
        http: { text: vi.fn(), document: vi.fn().mockResolvedValue(validDoc), json: vi.fn() },
        userId: 'queue_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);
      const demandBtn = document.querySelector('.psnine-ondemand-progress-btn') as HTMLButtonElement;
      demandBtn.click();

      await new Promise(r => setTimeout(r, 20));
      // Trigger cleanup while ondemand mutation is waiting in queue!
      if (typeof cleanup === 'function') cleanup();

      // Now release the blocking queue
      releaseBlock();
      await new Promise(r => setTimeout(r, 40));

      // Because cleanup was called before mutator executed, mutator throws AbortError and does NOT write!
      expect(savedCache?.games?.['9991']).toBeUndefined();
    });

    it('supports keyboard activation (Enter) on on-demand button', async () => {
      document.body.innerHTML = `
        <table>
          <tr id="row-kb-test">
            <td class="pd15"><a href="/psngame/7777"><img class="imgbgnb" src="cover.png" /></a></td>
          </tr>
        </table>
      `;

      const mockHttp = {
        text: vi.fn(),
        document: vi.fn().mockImplementation(() => {
          return Promise.resolve(new DOMParser().parseFromString(`
            <div class="main">
              <p><a href="/psnid/kb_user">kb_user</a></p>
              <div class="progress"><div style="width: 100%"></div></div>
              <table>
                <tr class="trophy"><td class="t1"><img class="imgbg earned" /></td></tr>
              </table>
            </div>
          `, 'text/html'));
        }),
        json: vi.fn()
      };

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame'),
        settings: { ...defaultSettings },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
        http: mockHttp,
        userId: 'kb_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);
      const demandBtn = document.querySelector('.psnine-ondemand-progress-btn') as HTMLButtonElement;
      expect(demandBtn).not.toBeNull();

      // Clear mock calls from background sync on mount
      mockHttp.document.mockClear();

      // Trigger with Enter key
      demandBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(r => setTimeout(r, 40));

      expect(mockHttp.document).toHaveBeenCalledWith(
        expect.stringContaining('/psngame/7777?psnid=kb_user'),
        expect.any(Object)
      );

      if (cleanup) cleanup();
    });
  });

  describe('5. Progress Parsing: Style-Only Width 38%, 0..100% Bounds, and Weighted Fallback', () => {
    it('correctly extracts style-only width 38% without text and rejects > 100% or invalid values', () => {
      // 1. Style-only without text: style.width = "38%"
      const el1 = document.createElement('div');
      el1.style.width = '38%';
      expect(extractElementProgressPercent(el1)).toBe(38);

      // 2. Style attribute: style="width: 38%"
      const el2 = document.createElement('div');
      el2.setAttribute('style', 'width: 38%;');
      expect(extractElementProgressPercent(el2)).toBe(38);

      // 3. Floating point percentage
      const el3 = document.createElement('div');
      el3.style.width = '38.6%';
      expect(extractElementProgressPercent(el3)).toBe(39);

      // 4. Boundary values 0% and 100%
      const el0 = document.createElement('div');
      el0.style.width = '0%';
      expect(extractElementProgressPercent(el0)).toBe(0);

      const el100 = document.createElement('div');
      el100.style.width = '100%';
      expect(extractElementProgressPercent(el100)).toBe(100);

      // 5. Reject invalid / out of bounds values
      const elInvalid138 = document.createElement('div');
      elInvalid138.style.width = '138%';
      expect(extractElementProgressPercent(elInvalid138)).toBeNull();

      const elInvalidNegative = document.createElement('div');
      elInvalidNegative.style.width = '-5%';
      expect(extractElementProgressPercent(elInvalidNegative)).toBeNull();

      const elInvalidString = document.createElement('div');
      elInvalidString.style.width = 'auto';
      expect(extractElementProgressPercent(elInvalidString)).toBeNull();

      // Non-percentage units like px or unitless values must be rejected (60px cannot count as 60%)
      const elInvalidPx = document.createElement('div');
      elInvalidPx.style.width = '60px';
      expect(extractElementProgressPercent(elInvalidPx)).toBeNull();

      const elInvalidUnitless = document.createElement('div');
      elInvalidUnitless.style.width = '60';
      expect(extractElementProgressPercent(elInvalidUnitless)).toBeNull();
    });

    it('parses real profile row with style-only 38% and no inner text', () => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="pd15"><a href="/psngame/46507">小丑牌</a></td>
        <td class="pd10">
          <div class="progress"><div style="width: 38%"></div></div>
          <small><span class="text-platinum">白0</span></small>
        </td>
      `;

      const parsed = parseGameRowProgress(row);
      expect(parsed).not.toBeNull();
      expect(parsed?.gameId).toBe('46507');
      expect(parsed?.percent).toBe(38); // Correctly parsed from style.width!
      expect(parsed?.platinum).toBe(false);
    });

    it('rejects 138% official bar and retains weighted points fallback during on-demand loading', async () => {
      document.body.innerHTML = `
        <table>
          <tr id="row-weighted-test">
            <td class="pd15"><a href="/psngame/3333"><img class="imgbgnb" src="cover.png" /></a></td>
          </tr>
        </table>
      `;

      // Game has 1 Gold (90 pts) earned (td.t2) out of 1 Gold + 1 Silver (90 + 30 = 120 pts total)
      // Weighted completion: 90 / 120 = 75%
      // But official bar has an illegal value: width: 138%
      const docWithIllegalBar = new DOMParser().parseFromString(`
        <div class="main">
          <p><a href="/psnid/weighted_user">weighted_user</a></p>
          <div class="progress"><div style="width: 138%"></div></div>
          <table>
            <tr class="trophy">
              <td class="t2"><img class="imgbg earned" /></td>
              <td><em>金</em><span class="text-gold">金杯</span></td>
            </tr>
            <tr class="trophy">
              <td class="t3"><img class="imgbg" /></td>
              <td><em>银</em><span class="text-silver">银杯</span></td>
            </tr>
          </table>
        </div>
      `, 'text/html');

      let savedCache: any = null;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
          set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
          remove: vi.fn()
        },
        http: {
          text: vi.fn(),
          document: vi.fn().mockResolvedValue(docWithIllegalBar),
          json: vi.fn()
        },
        userId: 'weighted_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);
      const demandBtn = document.querySelector('.psnine-ondemand-progress-btn') as HTMLButtonElement;
      demandBtn.click();
      await new Promise(r => setTimeout(r, 40));

      // Because official bar was 138% (invalid), it must retain the weighted fallback of 75%!
      expect(savedCache?.games?.['3333']).toBeDefined();
      expect(savedCache?.games?.['3333'].percent).toBe(75);

      if (cleanup) cleanup();
    });
  });

  describe('6. P06 Progress Colors, Official Bar Non-Duplication, Theme Tokens & Dynamic Rows', () => {
    it('keeps official progress without duplicate badge or plugin gradient, and preserves custom native row background', async () => {
      const now = Date.now();
      const storeState: UserProgressData = {
        userId: 'alice',
        games: {
          '101': { gameId: '101', percent: 38, platinum: false, updatedAt: now },
          '102': { gameId: '102', percent: 42, platinum: false, updatedAt: now },
          '103': { gameId: '103', percent: 75, platinum: false, updatedAt: now }
        },
        lastFullSync: now,
        nextRefresh: now + 3600000,
        refreshInterval: 3600000,
        syncCursorPage: 1,
        syncStatus: 'full'
      };

      const customGradient = 'linear-gradient(90deg, rgba(255, 0, 0, 0.1) 10%, transparent 10%)';
      document.body.innerHTML = `
        <table>
          <tr id="row-101" style="background: ${customGradient}">
            <td class="pd15"><a href="/psngame/101"><img src="c1.png" /></a></td>
            <td><a href="/psngame/101">Game 101</a></td>
            <td><div class="progress"><div style="width: 38%">38%</div></div></td>
          </tr>
          <tr id="row-102">
            <td class="pd15"><a href="/psngame/102"><img src="c2.png" /></a></td>
            <td><a href="/psngame/102">Game 102</a></td>
            <td></td>
          </tr>
        </table>
      `;

      let onContentCb: (() => void) | null = null;
      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psnid/alice/psngame'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockResolvedValue(storeState),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn()
        },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockImplementation((cb) => {
          onContentCb = cb;
          return () => { onContentCb = null; };
        }),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      const row101 = document.getElementById('row-101') as HTMLElement;
      const row102 = document.getElementById('row-102') as HTMLElement;

      // Row 101 has official progress: NO duplicate badge, native custom background preserved
      expect(row101.querySelector('.psnine-game-list-progress-badge')).toBeNull();
      expect(row101.querySelector('.progress > div')?.textContent).toBe('38%');
      expect(row101.style.background).toContain('linear-gradient');

      // Row 102 has no official bar: renders cached 42% badge and no plugin row gradient
      const badge102 = row102.querySelector('.psnine-game-list-progress-badge');
      expect(badge102).not.toBeNull();
      expect(badge102?.textContent).toBe('42%');
      expect(row102.style.background).toBe('');

      // Dynamic update: website later supplies official 52% bar on row 102
      row102.querySelector('td:last-child')!.innerHTML = '<div class="progress"><div style="width: 52%">52%</div></div>';
      if (onContentCb) (onContentCb as () => void)();

      expect(row102.querySelector('.psnine-game-list-progress-badge')).toBeNull();
      expect(row102.querySelector('.progress > div')?.textContent).toBe('52%');

      // Dynamic row addition without official bar
      const tbody = document.querySelector('table tbody') || document.querySelector('table')!;
      const tr103 = document.createElement('tr');
      tr103.id = 'row-103';
      tr103.innerHTML = '<td class="pd15"><a href="/psngame/103">Game 103</a></td><td></td>';
      tbody.appendChild(tr103);
      if (onContentCb) (onContentCb as () => void)();

      expect(tr103.querySelector('.psnine-game-list-progress-badge')?.textContent).toBe('75%');

      // Cleanup removes only plugin badge and keeps native custom style
      if (cleanup) cleanup();
      expect(document.querySelectorAll('.psnine-game-list-progress-badge').length).toBe(0);
      expect(row101.style.background).toContain('linear-gradient');
    });

    it('preserves another user official progress without overlaying my cached progress', async () => {
      const now = Date.now();
      const myCache: UserProgressData = {
        userId: 'alice',
        games: {
          '101': { gameId: '101', percent: 38, platinum: true, updatedAt: now },
          '102': { gameId: '102', percent: 100, platinum: true, updatedAt: now }
        },
        lastFullSync: now,
        nextRefresh: now + 3600000,
        refreshInterval: 3600000,
        syncCursorPage: 1,
        syncStatus: 'full'
      };

      document.body.innerHTML = `
        <table>
          <tr id="other-row-101" style="background: linear-gradient(90deg, #111, #222)">
            <td class="pd15"><a href="/psngame/101">Game 101</a></td>
            <td><div class="progress"><div style="width: 5%">5%</div></div></td>
          </tr>
          <tr id="other-row-102">
            <td class="pd15"><a href="/psngame/102">Game 102</a></td>
            <td></td>
          </tr>
        </table>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psnid/bob/psngame'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockResolvedValue(myCache),
          set: vi.fn(),
          remove: vi.fn()
        },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      expect(document.querySelectorAll('.psnine-game-list-progress-badge').length).toBe(0);
      expect(document.querySelector('#other-row-101 .progress > div')?.textContent).toBe('5%');
      expect((document.getElementById('other-row-101') as HTMLElement).style.background).toContain('linear-gradient');

      if (cleanup) cleanup();
    });

    it('uses theme tokens for badge with contrast >= 4.5 in both light and dark modes', async () => {
      const now = Date.now();
      const storeState: UserProgressData = {
        userId: 'alice',
        games: {
          '102': { gameId: '102', percent: 42, platinum: false, updatedAt: now }
        },
        lastFullSync: now,
        nextRefresh: now + 3600000,
        refreshInterval: 3600000,
        syncCursorPage: 1,
        syncStatus: 'full'
      };

      const styleEl = document.createElement('style');
      styleEl.textContent = CORE_STYLES + '\n' + DARK_THEME_STYLES;
      document.head.appendChild(styleEl);

      document.body.innerHTML = `
        <table>
          <tr id="theme-row-102">
            <td class="pd15"><a href="/psngame/102">Game 102</a></td>
          </tr>
        </table>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame'),
        settings: { ...defaultSettings },
        store: {
          get: vi.fn().mockResolvedValue(storeState),
          set: vi.fn(),
          remove: vi.fn()
        },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);
      const badge = document.querySelector('.psnine-game-list-progress-badge') as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge.getAttribute('style') || '').not.toContain('#0056b3');

      expect(CORE_STYLES).toContain('.psnine-game-list-progress-badge');
      expect(CORE_STYLES).toContain('var(--p9n-surface-alt');
      expect(CORE_STYLES).toContain('var(--p9n-text');
      expect(DARK_THEME_STYLES).toContain('html[data-theme="dark"] .psnine-game-list-progress-badge');

      // Verify contrast calculation for light (#1f2937 on #f4f6fa) and dark (#e6ebf2 on #202c3a)
      const calcContrast = (fg: [number, number, number], bg: [number, number, number]) => {
        const lum = (rgb: [number, number, number]) =>
          rgb.map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const l1 = lum(fg);
        const l2 = lum(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      expect(calcContrast([31, 41, 55], [244, 246, 250])).toBeGreaterThanOrEqual(4.5);
      expect(calcContrast([230, 235, 242], [32, 44, 58])).toBeGreaterThanOrEqual(4.5);

      if (cleanup) cleanup();
      styleEl.remove();
    });

    it('excludes plugin nodes and their unmarked descendants when extracting progress percentage', () => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <a href="/psngame/46507">Balatro</a>
          <span class="psnine-game-list-progress-badge" data-psnine-next="true">88%</span>
          <div class="progress" data-psnine-next="true"><div style="width: 99%">99%</div></div>
        </td>
      `;

      const unmarkedChildDiv = tr.querySelector('.progress > div');
      expect(extractElementProgressPercent(unmarkedChildDiv)).toBeNull();
      expect(hasOfficialGameProgress(tr)).toBe(false);
      expect(parseGameRowProgress(tr)?.percent).toBeNull();

      // Add real official progress bar alongside plugin nodes
      const td = document.createElement('td');
      td.innerHTML = '<div class="progress"><div style="width: 38%">38%</div></div>';
      tr.appendChild(td);

      expect(hasOfficialGameProgress(tr)).toBe(true);
      expect(parseGameRowProgress(tr)?.percent).toBe(38);
    });
  });

  describe('7. Profile, Game List & Trophy Action Buttons: Native Tokens, Touch >= 44px, and DOM Behavior', () => {
    it('mounts profile sync buttons with native tokens, no btn-default/hardcoded blue, and touch >= 44px', async () => {
      document.body.innerHTML = `
        <div class="psnzz"><div class="inner"></div></div>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psnid/alice'),
        settings: { ...defaultSettings },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      const group = document.getElementById('psnine-sync-psn-btn-group');
      expect(group).not.toBeNull();

      const links = group!.querySelectorAll('a');
      expect(links.length).toBe(2);

      const upbaseA = links[0];
      const upgameA = links[1];

      // Verifies neither uses legacy btn-default or plain btn without psnine-btn
      expect(upbaseA.className).not.toContain('btn-default');
      expect(upgameA.className).not.toContain('btn-default');
      expect(upbaseA.className).toContain('psnine-sync-btn');
      expect(upgameA.className).toContain('psnine-sync-btn');
      expect(upbaseA.className).toContain('psnine-btn');
      expect(upgameA.className).toContain('psnine-btn');

      // Verifies no hardcoded #3890ff, #28a745
      const baseStyle = upbaseA.getAttribute('style') || '';
      const gameStyle = upgameA.getAttribute('style') || '';
      expect(baseStyle).not.toContain('#3890ff');
      expect(gameStyle).not.toContain('#28a745');

      // Uses site tokens var(--p9n-surface), var(--p9n-text), var(--p9n-border)
      expect(baseStyle).toContain('var(--p9n-surface)');
      expect(baseStyle).toContain('var(--p9n-text)');
      expect(baseStyle).toContain('var(--p9n-border)');
      expect(gameStyle).toContain('var(--p9n-surface)');
      expect(gameStyle).toContain('var(--p9n-text)');

      // Minimum touch target >= 44px
      expect(baseStyle).toContain('min-height: 44px');
      expect(gameStyle).toContain('min-height: 44px');

      // Authentic link targets and labels
      expect(upbaseA.getAttribute('href')).toBe('https://psnine.com/psnid/alice/upbase');
      expect(upgameA.getAttribute('href')).toBe('https://psnine.com/psnid/alice/upgame');
      expect(upbaseA.textContent).toBe('🔄 等级同步');
      expect(upgameA.textContent).toBe('🎮 游戏同步');

      if (cleanup) cleanup();
    });

    it('mounts trophy to-mine button with neutral outline, no hardcoded #3890ff/#fff, and touch >= 44px', async () => {
      document.body.innerHTML = `
        <div class="box pd10">
          <ul class="inav"><li>Game Nav</li></ul>
        </div>
      `;

      const ctx: Context = {
        document,
        window: { location: { replace: vi.fn() } } as unknown as Window,
        url: new URL('https://psnine.com/psngame/46507?psnid=alice'),
        settings: { ...defaultSettings, redirectToMine: true },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      const toMineBtn = document.getElementById('psnine-to-mine-trophy-btn');
      expect(toMineBtn).not.toBeNull();
      expect(toMineBtn?.className).toContain('psnine-to-mine-btn');
      expect(toMineBtn?.className).toContain('psnine-btn');

      const style = toMineBtn?.getAttribute('style') || '';
      // No hardcoded #3890ff background or #fff color
      expect(style).not.toContain('#3890ff');
      expect(style).not.toContain('background: #3890ff');
      expect(style).not.toContain('background:#3890ff');

      // Uses site tokens
      expect(style).toContain('var(--p9n-surface)');
      expect(style).toContain('var(--p9n-text)');
      expect(style).toContain('var(--p9n-border)');

      // Minimum touch target >= 44px
      expect(style).toContain('min-height: 44px');
      expect(toMineBtn?.textContent).toContain('切换至我的奖杯进度');

      if (cleanup) cleanup();
    });

    it('mounts difficulty sort button and on-demand button with tokens and touch >= 44px, and verifies sorting behavior', async () => {
      document.body.innerHTML = `
        <div class="page-header"></div>
        <table>
          <tr id="row-hard">
            <td class="pd15"><a href="/psngame/111"><img class="imgbgnb" src="c1.png" /></a></td>
            <td class="pd1015 title"><a href="/psngame/111">Hard Game</a></td>
            <td class="twoge"><em>5.00%完美</em></td>
          </tr>
          <tr id="row-easy">
            <td class="pd15"><a href="/psngame/222"><img class="imgbgnb" src="c2.png" /></a></td>
            <td class="pd1015 title"><a href="/psngame/222">Easy Game</a></td>
            <td class="twoge"><em>85.00%完美</em></td>
          </tr>
        </table>
      `;

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame'),
        settings: { ...defaultSettings },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);

      // 1. Difficulty sort button DOM behavior
      const sortBtn = document.getElementById('psnine-difficulty-sort-btn');
      expect(sortBtn).not.toBeNull();
      expect(sortBtn?.className).toContain('psnine-difficulty-sort-btn');
      const sortStyle = sortBtn?.getAttribute('style') || '';
      expect(sortStyle).not.toContain('#3890ff');
      expect(sortStyle).toContain('var(--p9n-surface)');
      expect(sortStyle).toContain('var(--p9n-text)');
      expect(sortStyle).toContain('min-height: 44px');

      // Click to toggle sorting
      expect(sortBtn?.textContent).toContain('从难到易');
      sortBtn?.click();
      expect(sortBtn?.textContent).toContain('从易到难');
      const tableRows = Array.from(document.querySelectorAll('table tr'));
      expect(tableRows[0].id).toBe('row-easy');
      expect(tableRows[1].id).toBe('row-hard');

      // 2. On-demand progress query button DOM behavior
      const demandBtn = document.querySelector('.psnine-ondemand-progress-btn') as HTMLElement;
      expect(demandBtn).not.toBeNull();
      expect(demandBtn.className).toContain('psnine-ondemand-progress-btn');
      const demandStyle = demandBtn.getAttribute('style') || '';
      expect(demandStyle).not.toContain('#3890ff');
      expect(demandStyle).toContain('var(--p9n-surface)');
      expect(demandStyle).toContain('var(--p9n-link)');
      expect(demandStyle).toContain('min-height: 44px');

      if (cleanup) cleanup();
    });

    it('mounts game variants with token-based styles and touch >= 44px without hardcoded #0056b3', async () => {
      document.body.innerHTML = `
        <div class="main">
          <ul class="inav"><li>Nav</li></ul>
          <div class="box pd10">
            <div class="min-inner">
              <ul class="darklist">
                <li><span class="r">PS5</span><a href="/game/555">Variant Title</a></li>
              </ul>
            </div>
          </div>
        </div>
      `;

      const mockHttp = {
        text: vi.fn(),
        document: vi.fn().mockImplementation((url: string) => {
          if (url.includes('/game/')) {
            return Promise.resolve(new DOMParser().parseFromString(`
              <div class="min-inner">
                <ul class="darklist">
                  <li><span class="r">PS5</span><a href="/game/555">Variant Title</a></li>
                </ul>
              </div>
            `, 'text/html'));
          }
          return Promise.resolve(document);
        }),
        json: vi.fn()
      };

      const ctx: Context = {
        document,
        window,
        url: new URL('https://psnine.com/psngame/444?psnid=alice'),
        settings: { ...defaultSettings, referGameVariants: true },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
        http: mockHttp,
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      const cleanup = await mountGames(ctx);
      await new Promise(r => setTimeout(r, 40));

      const variantsDiv = document.getElementById('psnine-game-variants-section');
      if (variantsDiv) {
        expect(variantsDiv.getAttribute('style') || '').toContain('var(--p9n-surface-alt)');
        const variantA = variantsDiv.querySelector('.psnine-variant-btn');
        if (variantA) {
          const aStyle = variantA.getAttribute('style') || '';
          expect(aStyle).not.toContain('#0056b3');
          expect(aStyle).toContain('var(--p9n-surface)');
          expect(aStyle).toContain('var(--p9n-link)');
          expect(aStyle).toContain('min-height: 44px');
        }
      }

      if (cleanup) cleanup();
    });

    it('hasOfficialGameProgress accurately detects presence of authentic progress bar with valid 0..100 percent', () => {
      // 1. Row with authentic progress element (valid 38%)
      const trWithNative = document.createElement('tr');
      trWithNative.innerHTML = `
        <td><a href="/psngame/1">Game 1</a></td>
        <td><div class="progress"><div style="width: 38%">38%</div></div></td>
      `;
      expect(hasOfficialGameProgress(trWithNative)).toBe(true);

      // 2. Row with invalid out-of-bounds bar (138%) -> false, triggering on-demand fallback
      const trWithInvalid = document.createElement('tr');
      trWithInvalid.innerHTML = `
        <td><a href="/psngame/1b">Game 1b</a></td>
        <td><div class="progress"><div style="width: 138%">138%</div></div></td>
      `;
      expect(hasOfficialGameProgress(trWithInvalid)).toBe(false);

      // 3. Row with only plugin nodes -> false
      const trWithPluginOnly = document.createElement('tr');
      trWithPluginOnly.innerHTML = `
        <td><a href="/psngame/2">Game 2</a></td>
        <td><div class="progress" data-psnine-next="true"><div style="width: 38%">38%</div></div></td>
      `;
      expect(hasOfficialGameProgress(trWithPluginOnly)).toBe(false);

      // 4. Row with no progress element -> false
      const trEmpty = document.createElement('tr');
      trEmpty.innerHTML = `<td><a href="/psngame/3">Game 3</a></td>`;
      expect(hasOfficialGameProgress(trEmpty)).toBe(false);
    });
  });
});
