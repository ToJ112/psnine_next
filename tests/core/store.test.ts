import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createStore,
  validateSettings,
  loadAndMigrateSettings,
  makeStoreKey,
  cloneDefaultSettings,
  SETTINGS_KEY,
  LEGACY_STORAGE_KEY
} from '../../src/core/store';
import { defaultSettings } from '../../src/core/types';
import { mountSettingsUI } from '../../src/core/settings-ui';
import { createContext } from '../../src/core/context';
import { createHttpClient } from '../../src/core/http';

describe('Store and Settings validation & migration', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (global as any).GM;
    delete (global as any).GM_getValue;
    delete (global as any).GM_setValue;
    delete (global as any).GM_deleteValue;
  });

  afterEach(() => {
    delete (global as any).GM;
    delete (global as any).GM_getValue;
    delete (global as any).GM_setValue;
    delete (global as any).GM_deleteValue;
    vi.restoreAllMocks();
  });

  describe('makeStoreKey prevents duplicate prefixing', () => {
    it('appends prefix only when not already present', () => {
      expect(makeStoreKey('psnine_next:', 'settings:v1')).toBe('psnine_next:settings:v1');
      expect(makeStoreKey('psnine_next:', 'psnine_next:progress:123')).toBe('psnine_next:progress:123');
      expect(makeStoreKey('psnine_next:', 'psnine_next:settings:v1')).toBe('psnine_next:settings:v1');
      expect(makeStoreKey('custom:', 'key')).toBe('custom:key');
      expect(makeStoreKey('custom:', 'custom:key')).toBe('custom:key');
    });
  });

  describe('defaultSettings immutability and schema validation', () => {
    it('never pollutes defaultSettings when validating null, empty, or mutating returned settings', () => {
      const initialHighlightIDCount = defaultSettings.highlightSpecificID.length;
      const initialExchangeRatesKeys = Object.keys(defaultSettings.exchangeRates).length;

      const sNull = validateSettings(null);
      sNull.highlightSpecificID.push('hacker_id');
      sNull.exchangeRates['USD'] = 9.99;
      (sNull as any).newProperty = 'test';

      expect(defaultSettings.highlightSpecificID.length).toBe(initialHighlightIDCount);
      expect(defaultSettings.highlightSpecificID).not.toContain('hacker_id');
      expect(Object.keys(defaultSettings.exchangeRates).length).toBe(initialExchangeRatesKeys);

      const sEmpty = validateSettings({});
      sEmpty.blockList.push('banned_user');
      sEmpty.exchangeRates['HKD'] = 1.0;

      expect(defaultSettings.blockList).toEqual([]);
      expect(Object.keys(defaultSettings.exchangeRates).length).toBe(initialExchangeRatesKeys);
    });

    it('validates corrupted/empty input to safe defaults with correct contracts', () => {
      const s1 = validateSettings(null);
      expect(s1).toEqual(defaultSettings);
      expect(s1.autoPaging).toBe(0);
      expect(typeof s1.autoPaging).toBe('number');
      expect(s1.BattleInfoUpdateInterval).toBe(3600000);
      expect(s1.exchangeRates).toEqual({});
      expect(s1.autoNightMode).toBe('SYSTEM');
      expect(s1.platinumGlow).toBe(false);
      expect(s1.autoPagingInHomepage).toBe(true);
      expect(s1.expandCollapsedSubcomments).toBe(true);

      const s2 = validateSettings({
        autoPaging: '3', // string number
        filterNonePlatinumAlpha: '0.5',
        hotTagThreshold: '30',
        autoNightMode: { value: 'TIME', enum: ['SYSTEM', 'TIME', 'OFF'] }, // legacy object
        blockList: 'user1, user2', // legacy comma-separated string
        BattleInfoUpdateInterval: 30, // less than 60000ms clamp min -> 60000
        exchangeRates: { HKD: 0.93 }
      });

      expect(s2.autoPaging).toBe(3);
      expect(s2.filterNonePlatinumAlpha).toBe(0.5);
      expect(s2.hotTagThreshold).toBe(30);
      expect(s2.autoNightMode).toBe('TIME');
      expect(s2.blockList).toEqual(['user1', 'user2']);
      expect(s2.BattleInfoUpdateInterval).toBe(60000); // correctly clamped to 60000ms min
      expect(s2.exchangeRates).toEqual({ HKD: 0.93 });
    });
  });

  describe('Legacy migration', () => {
    it('migrates legacy localStorage settings and converts legacy boolean autoPaging', async () => {
      const legacy = {
        hoverUnmark: false,
        autoPaging: true, // legacy boolean
        filterNonePlatinumAlpha: '0.4',
        nightMode: true,
        blockList: ['badUser']
      };
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

      const store = createStore();
      const migrated = await loadAndMigrateSettings(store);

      expect(migrated.hoverUnmark).toBe(false);
      expect(migrated.autoPaging).toBe(1); // converted to 1 page
      expect(migrated.filterNonePlatinumAlpha).toBe(0.4);
      expect(migrated.nightMode).toBe(true);
      expect(migrated.blockList).toEqual(['badUser']);

      const saved = await store.get(SETTINGS_KEY, null);
      expect(saved).not.toBeNull();
    });
  });

  describe('Fault injection, backend downgrade & data consistency', () => {
    it('preserves GM session writes when GM fails on subsequent get, never overridden by stale localStorage', async () => {
      // Put a stale old value in localStorage
      localStorage.setItem('psnine_next:target_key', JSON.stringify('stale_local_value'));

      let gmBroken = false;
      const gmStorage = new Map<string, any>();
      (global as any).GM = {
        getValue: vi.fn().mockImplementation(async (k: string) => {
          if (gmBroken) throw new Error('GM get broken');
          return gmStorage.get(k);
        }),
        setValue: vi.fn().mockImplementation(async (k: string, v: any) => {
          if (gmBroken) throw new Error('GM set broken');
          gmStorage.set(k, v);
        }),
        deleteValue: vi.fn().mockImplementation(async (k: string) => {
          gmStorage.delete(k);
        })
      };

      const store = createStore();
      expect(store.backend).toBe('GM_V4');

      // Write value via GM
      await store.set('target_key', 'fresh_gm_value');

      // Break GM so subsequent get must downgrade to LOCAL_STORAGE
      gmBroken = true;

      // When downgraded to LOCAL_STORAGE, must return 'fresh_gm_value', NOT 'stale_local_value'!
      const val = await store.get('target_key', null);
      expect(val).toBe('fresh_gm_value');
    });

    it('preserves values from successful GM get when GM later fails', async () => {
      let gmFails = false;
      (global as any).GM = {
        getValue: vi.fn().mockImplementation(async () => {
          if (gmFails) throw new Error('GM suddenly failed');
          return 'remote_val_1';
        }),
        setValue: vi.fn().mockResolvedValue(undefined),
        deleteValue: vi.fn().mockResolvedValue(undefined)
      };

      const store = createStore();
      // Successful initial read caches session value
      const val1 = await store.get('remote_key', null);
      expect(val1).toBe('remote_val_1');

      // GM fails later
      gmFails = true;
      const val2 = await store.get('remote_key', null);
      expect(val2).toBe('remote_val_1');
    });

    it('handles missing GM.deleteValue by clearing lower layers and maintaining tombstone', async () => {
      (global as any).GM = {
        getValue: vi.fn().mockResolvedValue(undefined),
        setValue: vi.fn().mockResolvedValue(undefined),
        // deleteValue is undefined!
      };
      // Put a stale value in localStorage
      localStorage.setItem('psnine_next:del_key', JSON.stringify('stale_del_val'));

      const store = createStore();
      await store.remove('del_key');

      // Must return fallback, NOT resurrect stale value!
      const val = await store.get('del_key', 'fallback_val');
      expect(val).toBe('fallback_val');
      expect(localStorage.getItem('psnine_next:del_key')).toBeNull();
    });

    it('returns fallback for a single corrupted JSON key in localStorage without downgrading backend to MEMORY', async () => {
      const store = createStore();
      expect(store.backend).toBe('LOCAL_STORAGE');

      // Valid key
      await store.set('valid_key', { ok: true });
      // Inject corrupted JSON into a single key
      localStorage.setItem('psnine_next:corrupt_key', '{bad_json:true');

      // Reading corrupted key returns fallback
      const corruptVal = await store.get('corrupt_key', 'safe_fallback');
      expect(corruptVal).toBe('safe_fallback');

      // Store backend MUST STILL be LOCAL_STORAGE (not downgraded to MEMORY)!
      expect(store.backend).toBe('LOCAL_STORAGE');

      // Valid key is still readable
      const validVal = await store.get('valid_key', null);
      expect(validVal).toEqual({ ok: true });
    });

    it('downgrades from failing LOCAL_STORAGE to MEMORY on quota exceeded and maintains read/write/remove consistency', async () => {
      const store = createStore();
      expect(store.backend).toBe('LOCAL_STORAGE');

      await store.set('key_before_failure', 'initial_val');

      // Inject quota exceeded error into localStorage.setItem
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      await store.set('key_after_failure', 'new_memory_val');
      expect(store.backend).toBe('MEMORY');

      const val2 = await store.get('key_after_failure', null);
      expect(val2).toBe('new_memory_val');

      await store.set('key_before_failure', 'updated_in_memory');
      const val1 = await store.get('key_before_failure', null);
      expect(val1).toBe('updated_in_memory');

      await store.remove('key_before_failure');
      const removedVal1 = await store.get('key_before_failure', 'fallback');
      expect(removedVal1).toBe('fallback');
    });
  });

  describe('Settings UI memory mode notice', () => {
    it('displays warning notice in settings panel when store is in MEMORY mode', () => {
      document.body.innerHTML = '';
      const memoryStore = {
        backend: 'MEMORY' as const,
        async get<T>(_k: string, fb: T): Promise<T> { return fb; },
        async set<T>(_k: string, _v: T): Promise<void> {},
        async remove(_k: string): Promise<void> {}
      };

      const ctx = createContext({
        document,
        window,
        settings: cloneDefaultSettings(),
        store: memoryStore,
        http: createHttpClient(),
      });

      mountSettingsUI(ctx);

      const gearBtn = document.getElementById('psnine-settings-gear') as HTMLButtonElement;
      expect(gearBtn).not.toBeNull();
      gearBtn.click();

      const warningBanner = document.querySelector('.psnine-settings-memory-warning, [data-psnine-next="memory-warning"]');
      expect(warningBanner).not.toBeNull();
      expect(warningBanner?.textContent).toContain('当前运行在内存临时存储模式');
    });
  });
});
