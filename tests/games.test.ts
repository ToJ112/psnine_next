import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeGameTitle,
  isExplicitlyNoPlatinum,
  parseGameDifficulty,
  sortGameRowsByDifficulty,
  findMatchingTrophyAcrossVersions,
  validateUserProgressData,
  parseGameRowProgress,
  syncUserGameProgress,
  resolveGameVariants,
  mutateUserProgress,
  mountGames
} from '../src/features/games';
import { Context, defaultSettings, Store } from '../src/core/types';

describe('Games Feature Module (P01 - P14) - Last Mile Verification', () => {
  describe('1. P10 & Fixture: Real game-variants.html (.min-inner > ul.darklist > li)', () => {
    it('accurately parses real fixture: extracts span.r platform, dedupes 46507, and captures 42152 & 42066', async () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/game-variants.html');
      const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');
      const metaDoc = new DOMParser().parseFromString(fixtureHtml, 'text/html');

      const mockHttp = {
        text: vi.fn(),
        document: vi.fn().mockImplementation((url: string) => {
          if (url.includes('/game/46507')) return Promise.resolve(metaDoc);
          return Promise.resolve(new DOMParser().parseFromString('', 'text/html'));
        }),
        json: vi.fn()
      };

      const ctx = {
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
        http: mockHttp,
        url: new URL('https://psnine.com'),
        report: vi.fn()
      } as unknown as Context;

      // Current game is 46507
      const variants = await resolveGameVariants(ctx, '46507', new DOMParser().parseFromString(`
        <div class="side"><a href="/game/46507">元数据主页</a></div>
      `, 'text/html'), false);

      // Current game 46507 excluded from variants; 42152 (PS4) and 42066 (PS5) captured and deduplicated!
      expect(variants.length).toBe(2);

      const v42152 = variants.find(v => v.gameId === '42152');
      expect(v42152).toBeDefined();
      expect(v42152?.platform).toBe('PS4');
      expect(v42152?.title).toBe('Balatro');

      const v42066 = variants.find(v => v.gameId === '42066');
      expect(v42066).toBeDefined();
      expect(v42066?.platform).toBe('PS5');
      expect(v42066?.title).toBe('Balatro');
    });
  });

  describe('2. P04 & P05: Controlled Promises Mutation Queue (Race Condition Prevention)', () => {
    it('serializes concurrent mutations sequentially without dropping records', async () => {
      let storeState: any = null;
      const mockStore: Store = {
        get: vi.fn().mockImplementation(() => Promise.resolve(storeState)),
        set: vi.fn().mockImplementation((k, v) => { storeState = v; return Promise.resolve(); }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      // Two concurrent mutations with controlled delays
      const p1 = mutateUserProgress(mockStore, 'user_test', async (cache) => {
        await new Promise(r => setTimeout(r, 20)); // Simulated async network delay
        cache.games['101'] = { gameId: '101', percent: 100, platinum: true, updatedAt: 1000 };
      });

      const p2 = mutateUserProgress(mockStore, 'user_test', async (cache) => {
        await new Promise(r => setTimeout(r, 5));
        cache.games['102'] = { gameId: '102', percent: 50, platinum: false, updatedAt: 2000 };
      });

      await Promise.all([p1, p2]);

      // Both game_1 and game_2 MUST exist in final storeState (no overwrite!)
      expect(storeState.games['101']).toBeDefined();
      expect(storeState.games['102']).toBeDefined();
      expect(storeState.games['101'].percent).toBe(100);
      expect(storeState.games['102'].percent).toBe(50);
    });
  });

  describe('3. P02: On-Demand Progress Loading with Accessible Button & Retry', () => {
    it('renders accessible query button, handles network failure with retry button, and does not set percent=0 on invalid response', async () => {
      document.body.innerHTML = `
        <table>
          <tr id="row-g1">
            <td class="pd15"><a href="/psngame/9999"><img src="cover.png" /></a></td>
          </tr>
        </table>
      `;

      let requestCount = 0;
      const mockHttp = {
        text: vi.fn(),
        document: vi.fn().mockImplementation(() => {
          requestCount++;
          if (requestCount === 1) {
            // First attempt: network error
            return Promise.reject(new Error('Network error'));
          }
          // Second attempt (retry): valid trophy document with 1 plat earned
          return Promise.resolve(new DOMParser().parseFromString(`
            <table>
              <tr class="trophy"><td class="t1"><img class="imgbg earned" /></td><td><em class="alert-success r">2024-05-18</em></td></tr>
            </table>
          `, 'text/html'));
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
        userId: 'test_user',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      await mountGames(ctx);

      const btn = document.querySelector('.psnine-ondemand-progress-btn') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('查进度');

      // Click to trigger first fetch (fails)
      btn.click();
      await new Promise(r => setTimeout(r, 40));

      expect(btn.textContent).toContain('重试');
      // Must NOT write percent=0 to cache on failure!
      expect(savedCache?.games['9999']).toBeUndefined();

      // Click retry
      btn.click();
      await new Promise(r => setTimeout(r, 40));

      // Now succeeded
      expect(savedCache?.games['9999']).toBeDefined();
      expect(savedCache?.games['9999'].platinum).toBe(true);
    });
  });

  describe('4. P04 & P05: Real Fixture (19/32 vs 38% and 白0) & Schema Validation', () => {
    it('uses official 38% for completion, rejects rarity 18.63% as completion, and validates schema', () => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="pd15"><a href="/psngame/46507">小丑牌</a></td>
        <td class="twoge"><em>18.63%完美</em></td>
        <td class="pd10">
          <div class="progress"><div style="width: 38%"></div></div>
          <small><span class="text-platinum">白0</span></small>
        </td>
      `;

      const parsed = parseGameRowProgress(row);
      expect(parsed?.percent).toBe(38); // Official 38%
      expect(parsed?.platinum).toBe(false); // 白0

      // Schema rejects invalid percent (NaN, > 100) or non-numeric IDs
      const raw = {
        userId: 'u1',
        games: {
          '46507': { gameId: '46507', percent: 38, platinum: false, updatedAt: 1000 },
          'invalid_id': { gameId: 'invalid_id', percent: 50, platinum: false, updatedAt: 1000 },
          '100': { gameId: '100', percent: NaN, platinum: false, updatedAt: 1000 }
        }
      };
      const validated = validateUserProgressData(raw, 'u1');
      expect(validated.games['46507']).toBeDefined();
      expect(validated.games['invalid_id']).toBeUndefined();
      expect(validated.games['100']).toBeUndefined();
    });
  });

  describe('5. P05: Strict Next Link Pagination (Exact page=2 vs page=20)', () => {
    it('requires exact next page query or .next class and tracks cursor without loops', async () => {
      // Mock page where pagination has page=20 (not page=2!)
      const mockPageWithPage20 = new DOMParser().parseFromString(`
        <table><tr><td><a href="/psngame/1">G1</a></td><td><div class="progress"><div style="width:10%">10%</div></div></td></tr></table>
        <div class="page"><a href="?page=20">末页</a></div>
      `, 'text/html');

      let savedCache: any = null;
      const ctx = {
        store: {
          get: vi.fn().mockImplementation(() => Promise.resolve(savedCache)),
          set: vi.fn().mockImplementation((k, v) => { savedCache = v; return Promise.resolve(); }),
          remove: vi.fn()
        },
        http: {
          text: vi.fn(),
          document: vi.fn().mockResolvedValue(mockPageWithPage20),
          json: vi.fn()
        },
        url: new URL('https://psnine.com'),
        report: vi.fn(),
        settings: { ...defaultSettings }
      } as unknown as Context;

      const res = await syncUserGameProgress(ctx, 'user_a', 1);
      // Because page=2 is missing (only page=20 exists without next/下一页), it finishes as full!
      expect(res.status).toBe('full');
      expect(savedCache.syncCursorPage).toBe(1);
    });
  });

  describe('6. P03: Difficulty Sort Semantics (从难到易 vs 从易到难)', () => {
    it('sorts lower percentage first when descending (从难到易), higher percentage first when ascending (从易到难)', () => {
      const rHard = document.createElement('tr');
      rHard.innerHTML = `<td class="twoge"><em>5.00%完美</em></td>`;
      const rEasy = document.createElement('tr');
      rEasy.innerHTML = `<td class="twoge"><em>80.00%完美</em></td>`;
      const rUnrated = document.createElement('tr');
      rUnrated.innerHTML = `<td class="twoge"></td>`;

      // Hardest first: rHard (5%) < rEasy (80%)
      const sortedHardest = sortGameRowsByDifficulty([rEasy, rHard, rUnrated], true);
      expect(sortedHardest[0]).toBe(rHard);
      expect(sortedHardest[1]).toBe(rEasy);
      expect(sortedHardest[2]).toBe(rUnrated); // Unrated at bottom

      // Easiest first: rEasy (80%) > rHard (5%)
      const sortedEasiest = sortGameRowsByDifficulty([rEasy, rHard, rUnrated], false);
      expect(sortedEasiest[0]).toBe(rEasy);
      expect(sortedEasiest[1]).toBe(rHard);
      expect(sortedEasiest[2]).toBe(rUnrated);
    });
  });

  describe('7. P09: Bare /psngame/:id redirect', () => {
    it('redirects bare /psngame/46507 preserving query/hash, but preserves existing psnid', async () => {
      const replaceSpy = vi.fn();
      const ctx: Context = {
        document,
        window: { location: { replace: replaceSpy } } as unknown as Window,
        url: new URL('https://psnine.com/psngame/46507?filter=all#tips'),
        settings: { ...defaultSettings, redirectToMine: true },
        store: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), remove: vi.fn() },
        http: { text: vi.fn(), document: vi.fn(), json: vi.fn() },
        userId: 'alice',
        onContent: vi.fn().mockReturnValue(() => {}),
        report: vi.fn()
      };

      await mountGames(ctx);
      expect(replaceSpy).toHaveBeenCalledWith('https://psnine.com/psngame/46507?filter=all&psnid=alice#tips');
    });
  });
});
