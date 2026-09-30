import { Settings, defaultSettings, Store } from './types';

export const SETTINGS_KEY = 'settings:v1';
export const LEGACY_STORAGE_KEY = 'psnine-night-mode-CSS-settings';
export const THEME_MIRROR_KEY = 'psnine_next:theme_mirror';

/**
 * Deep clones default settings to prevent any runtime object or array mutations
 * from polluting the immutable global defaultSettings.
 */
export function cloneDefaultSettings(): Settings {
  return JSON.parse(JSON.stringify(defaultSettings));
}

/**
 * Constructs a storage key without duplicating prefixes.
 * If key already starts with prefix (e.g. psnine_next:progress:123), returns key unchanged.
 * Otherwise returns prefix + key (e.g. psnine_next:settings:v1).
 */
export function makeStoreKey(prefix: string, key: string): string {
  if (key.startsWith(prefix)) {
    return key;
  }
  return prefix + key;
}

export function safeGetLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
      const testKey = '__psnine_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch {
    // Restricted or quota error
  }
  return null;
}

export type StorageBackend = 'GM_V4' | 'GM_CLASSIC' | 'LOCAL_STORAGE' | 'MEMORY';

/**
 * Probes and selects the initial storage backend.
 */
export function selectStorageBackend(): StorageBackend {
  try {
    if (typeof GM !== 'undefined' && typeof GM.getValue === 'function' && typeof GM.setValue === 'function') {
      return 'GM_V4';
    }
  } catch {}

  try {
    if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
      return 'GM_CLASSIC';
    }
  } catch {}

  if (safeGetLocalStorage() !== null) {
    return 'LOCAL_STORAGE';
  }

  return 'MEMORY';
}

/**
 * Creates a Store implementation bound to a consistent fallback chain:
 * GM_V4 -> GM_CLASSIC -> LOCAL_STORAGE -> MEMORY.
 * Maintains session memory cache and deletion tombstones so data remains strictly
 * consistent during runtime downgrades and is never shadowed by stale underlying layers.
 */
export function createStore(prefix = 'psnine_next:'): Store {
  let activeBackend = selectStorageBackend();
  const memoryMap = new Map<string, unknown>();
  const memoryDeleted = new Set<string>();

  // Helper to downgrade backend when a catastrophic error occurs
  const downgradeBackend = (failedBackend: StorageBackend) => {
    if (activeBackend !== failedBackend) return;

    if (failedBackend === 'GM_V4') {
      try {
        if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
          activeBackend = 'GM_CLASSIC';
          return;
        }
      } catch {}
      activeBackend = safeGetLocalStorage() !== null ? 'LOCAL_STORAGE' : 'MEMORY';
    } else if (failedBackend === 'GM_CLASSIC') {
      activeBackend = safeGetLocalStorage() !== null ? 'LOCAL_STORAGE' : 'MEMORY';
    } else if (failedBackend === 'LOCAL_STORAGE') {
      activeBackend = 'MEMORY';
    }
  };

  const storeObj: Store = {
    get backend() {
      return activeBackend;
    },

    async get<T>(key: string, fallback: T): Promise<T> {
      const fullKey = makeStoreKey(prefix, key);

      // Check deletion tombstone: if deleted in this session, never return stale data
      if (memoryDeleted.has(fullKey)) {
        return fallback;
      }

      while (true) {
        if (activeBackend === 'GM_V4') {
          try {
            const val = await GM.getValue(fullKey, undefined);
            if (val !== undefined && val !== null) {
              memoryMap.set(fullKey, val); // Cache session read
              return val as T;
            }
            // If already set in session memoryMap, prefer session value over missing GM key
            if (memoryMap.has(fullKey)) {
              return memoryMap.get(fullKey) as T;
            }
            return fallback;
          } catch {
            downgradeBackend('GM_V4');
            continue; // Retry with downgraded backend
          }
        }

        if (activeBackend === 'GM_CLASSIC') {
          try {
            const val = await Promise.resolve(GM_getValue(fullKey, undefined));
            if (val !== undefined && val !== null) {
              memoryMap.set(fullKey, val);
              return val as T;
            }
            if (memoryMap.has(fullKey)) {
              return memoryMap.get(fullKey) as T;
            }
            return fallback;
          } catch {
            downgradeBackend('GM_CLASSIC');
            continue;
          }
        }

        if (activeBackend === 'LOCAL_STORAGE') {
          // If value was set or read in this session before downgrade, preserve it!
          if (memoryMap.has(fullKey)) {
            return memoryMap.get(fullKey) as T;
          }

          const storage = safeGetLocalStorage();
          if (storage) {
            let item: string | null = null;
            try {
              item = storage.getItem(fullKey);
            } catch {
              downgradeBackend('LOCAL_STORAGE');
              continue;
            }

            if (item !== null) {
              try {
                const parsed = JSON.parse(item);
                memoryMap.set(fullKey, parsed);
                return parsed as T;
              } catch {
                // Bad JSON for one single key: return fallback for this key without downgrading backend!
                return fallback;
              }
            }
            return fallback;
          } else {
            downgradeBackend('LOCAL_STORAGE');
            continue;
          }
        }

        // MEMORY backend
        if (memoryDeleted.has(fullKey)) {
          return fallback;
        }
        if (memoryMap.has(fullKey)) {
          return memoryMap.get(fullKey) as T;
        }
        const storage = safeGetLocalStorage();
        if (storage) {
          try {
            const item = storage.getItem(fullKey);
            if (item !== null) {
              const parsed = JSON.parse(item);
              memoryMap.set(fullKey, parsed);
              return parsed as T;
            }
          } catch {}
        }
        return fallback;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const fullKey = makeStoreKey(prefix, key);
      // Keep in memory map so data persists if downgraded later and avoids stale shadowing
      memoryDeleted.delete(fullKey);
      memoryMap.set(fullKey, value);

      while (true) {
        if (activeBackend === 'GM_V4') {
          try {
            await GM.setValue(fullKey, value);
            break;
          } catch {
            downgradeBackend('GM_V4');
            continue;
          }
        }

        if (activeBackend === 'GM_CLASSIC') {
          try {
            await Promise.resolve(GM_setValue(fullKey, value));
            break;
          } catch {
            downgradeBackend('GM_CLASSIC');
            continue;
          }
        }

        if (activeBackend === 'LOCAL_STORAGE') {
          const storage = safeGetLocalStorage();
          if (storage) {
            try {
              storage.setItem(fullKey, JSON.stringify(value));
              break;
            } catch {
              downgradeBackend('LOCAL_STORAGE');
              continue;
            }
          } else {
            downgradeBackend('LOCAL_STORAGE');
            continue;
          }
        }

        // MEMORY backend succeeds immediately
        break;
      }

      // Explicit minimal theme mirror: ONLY mirrors night mode keys to localStorage for document-start FOUC elimination
      if (key === SETTINGS_KEY && typeof value === 'object' && value !== null) {
        const s = value as Partial<Settings>;
        const mirror = {
          nightMode: Boolean(s.nightMode),
          autoNightMode: s.autoNightMode || 'SYSTEM',
          nightStart: s.nightStart ?? 19,
          nightEnd: s.nightEnd ?? 7
        };
        const storage = safeGetLocalStorage();
        if (storage) {
          try {
            storage.setItem(THEME_MIRROR_KEY, JSON.stringify(mirror));
          } catch {}
        }
      }
    },

    async remove(key: string): Promise<void> {
      const fullKey = makeStoreKey(prefix, key);
      memoryMap.delete(fullKey);
      memoryDeleted.add(fullKey);

      while (true) {
        if (activeBackend === 'GM_V4') {
          try {
            if (typeof GM.deleteValue === 'function') {
              await GM.deleteValue(fullKey);
            } else if (typeof GM.setValue === 'function') {
              await GM.setValue(fullKey, undefined);
            }
            // Clean up lower layer as well to prevent stale resurrection
            safeGetLocalStorage()?.removeItem(fullKey);
            break;
          } catch {
            downgradeBackend('GM_V4');
            continue;
          }
        }

        if (activeBackend === 'GM_CLASSIC') {
          try {
            if (typeof GM_deleteValue === 'function') {
              await Promise.resolve(GM_deleteValue(fullKey));
            } else if (typeof GM_setValue === 'function') {
              await Promise.resolve(GM_setValue(fullKey, undefined));
            }
            safeGetLocalStorage()?.removeItem(fullKey);
            break;
          } catch {
            downgradeBackend('GM_CLASSIC');
            continue;
          }
        }

        if (activeBackend === 'LOCAL_STORAGE') {
          const storage = safeGetLocalStorage();
          if (storage) {
            try {
              storage.removeItem(fullKey);
              break;
            } catch {
              downgradeBackend('LOCAL_STORAGE');
              continue;
            }
          } else {
            downgradeBackend('LOCAL_STORAGE');
            continue;
          }
        }

        break;
      }

      if (key === SETTINGS_KEY) {
        const storage = safeGetLocalStorage();
        if (storage) {
          try {
            storage.removeItem(THEME_MIRROR_KEY);
          } catch {}
        }
      }
    }
  };

  return storeObj;
}

/**
 * Validates and sanitizes raw settings input against schema.
 * Replaces invalid/missing fields with safe deep-cloned defaults.
 * Guarantees that mutating the returned Settings object or its nested properties
 * will NEVER pollute defaultSettings.
 */
export function validateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') {
    return cloneDefaultSettings();
  }

  const r = raw as Record<string, unknown>;
  const defaults = cloneDefaultSettings();
  const s: Settings = cloneDefaultSettings();

  const toBool = (val: unknown, fallback: boolean): boolean => {
    return typeof val === 'boolean' ? val : (val === 'true' ? true : (val === 'false' ? false : fallback));
  };

  const toNum = (val: unknown, fallback: number, min = -Infinity, max = Infinity): number => {
    const num = typeof val === 'number' ? val : (typeof val === 'string' ? parseFloat(val) : NaN);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };

  const toStr = (val: unknown, fallback: string): string => {
    return typeof val === 'string' ? val : fallback;
  };

  const toStringArray = (val: unknown, fallback: string[]): string[] => {
    if (Array.isArray(val)) {
      return val.filter(x => typeof x === 'string' || typeof x === 'number').map(x => String(x).trim()).filter(Boolean);
    }
    if (typeof val === 'string') {
      return val.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [...fallback];
  };

  s.hoverUnmark = toBool(r.hoverUnmark, defaults.hoverUnmark);
  s.autoCheckIn = toBool(r.autoCheckIn, defaults.autoCheckIn);

  if (typeof r.autoPaging === 'boolean') {
    s.autoPaging = r.autoPaging ? 1 : 0;
  } else {
    s.autoPaging = Math.max(0, Math.floor(toNum(r.autoPaging, defaults.autoPaging, 0, 100)));
  }

  s.autoPagingInHomepage = toBool(r.autoPagingInHomepage, defaults.autoPagingInHomepage);
  s.replyTraceback = toBool(r.replyTraceback, defaults.replyTraceback);
  s.highlightBack = toStr(r.highlightBack, defaults.highlightBack);
  s.highlightFront = toStr(r.highlightFront, defaults.highlightFront);
  s.highlightSpecificID = toStringArray(r.highlightSpecificID, defaults.highlightSpecificID);
  s.highlightSpecificBack = toStr(r.highlightSpecificBack, defaults.highlightSpecificBack);
  s.highlightSpecificFront = toStr(r.highlightSpecificFront, defaults.highlightSpecificFront);
  s.blockList = toStringArray(r.blockList, defaults.blockList);
  s.blockWordsList = toStringArray(r.blockWordsList, defaults.blockWordsList);
  s.newQaStatus = toBool(r.newQaStatus, defaults.newQaStatus);
  s.hoverHomepage = toBool(r.hoverHomepage, defaults.hoverHomepage);
  s.foldTrophySummary = toBool(r.foldTrophySummary, defaults.foldTrophySummary);
  s.foldTrophyChart = toBool(r.foldTrophyChart, defaults.foldTrophyChart);
  s.platinumGlow = toBool(r.platinumGlow, defaults.platinumGlow);
  s.filterNonePlatinumAlpha = toNum(r.filterNonePlatinumAlpha, defaults.filterNonePlatinumAlpha, 0, 1);
  s.hotTagThreshold = Math.max(1, Math.floor(toNum(r.hotTagThreshold, defaults.hotTagThreshold, 1, 9999)));
  s.nightMode = toBool(r.nightMode, defaults.nightMode);

  if (r.autoNightMode === 'SYSTEM' || r.autoNightMode === 'TIME' || r.autoNightMode === 'OFF') {
    s.autoNightMode = r.autoNightMode;
  } else if (typeof r.autoNightMode === 'object' && r.autoNightMode !== null && 'value' in r.autoNightMode) {
    const val = String((r.autoNightMode as { value: unknown }).value).toUpperCase();
    s.autoNightMode = (val === 'SYSTEM' || val === 'TIME' || val === 'OFF') ? val : defaults.autoNightMode;
  } else if (typeof r.autoNightMode === 'boolean') {
    s.autoNightMode = r.autoNightMode ? 'SYSTEM' : 'OFF';
  } else {
    s.autoNightMode = defaults.autoNightMode;
  }

  s.removeHeaderInBattle = toBool(r.removeHeaderInBattle, defaults.removeHeaderInBattle);
  s.listPostsByNew = toBool(r.listPostsByNew, defaults.listPostsByNew);
  s.showAllQAAnswers = toBool(r.showAllQAAnswers, defaults.showAllQAAnswers);
  s.listQAAnswersByNew = toBool(r.listQAAnswersByNew, defaults.listQAAnswersByNew);
  s.showHiddenQASubReply = toBool(r.showHiddenQASubReply, defaults.showHiddenQASubReply);
  s.fixTextLinks = toBool(r.fixTextLinks, defaults.fixTextLinks);
  s.fixD7VGLinks = toBool(r.fixD7VGLinks, defaults.fixD7VGLinks);
  s.fixHTTPLinks = toBool(r.fixHTTPLinks, defaults.fixHTTPLinks);
  s.referGameVariants = toBool(r.referGameVariants, defaults.referGameVariants);
  s.preferSearchForFindingVariants = toBool(r.preferSearchForFindingVariants, defaults.preferSearchForFindingVariants);
  s.expandCollapsedSubcomments = toBool(r.expandCollapsedSubcomments, defaults.expandCollapsedSubcomments);
  s.showGameProgressInBattle = toBool(r.showGameProgressInBattle, defaults.showGameProgressInBattle);

  s.BattleInfoUpdateInterval = Math.max(60000, Math.floor(toNum(r.BattleInfoUpdateInterval, defaults.BattleInfoUpdateInterval)));

  s.redirectToMine = toBool(r.redirectToMine, defaults.redirectToMine);
  s.currencyConversion = toBool(r.currencyConversion, defaults.currencyConversion);

  if (r.exchangeRates && typeof r.exchangeRates === 'object') {
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.exchangeRates as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(n) && n > 0) rates[k] = n;
    }
    s.exchangeRates = rates;
  } else {
    s.exchangeRates = {};
  }

  s.exchangeRateDate = toStr(r.exchangeRateDate, defaults.exchangeRateDate);
  s.blockWordsRegex = toBool(r.blockWordsRegex, defaults.blockWordsRegex);
  s.nightStart = Math.floor(toNum(r.nightStart, defaults.nightStart, 0, 23));
  s.nightEnd = Math.floor(toNum(r.nightEnd, defaults.nightEnd, 0, 23));
  s.showReplyControls = toBool(r.showReplyControls, defaults.showReplyControls);

  return s;
}

/**
 * Migrates legacy localStorage settings into modern Store under SETTINGS_KEY.
 */
export async function loadAndMigrateSettings(store: Store): Promise<Settings> {
  const existing = await store.get<unknown>(SETTINGS_KEY, null);
  if (existing !== null && typeof existing === 'object') {
    return validateSettings(existing);
  }

  const storage = safeGetLocalStorage();
  if (storage) {
    try {
      const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        const migrated = validateSettings(parsed);
        await store.set(SETTINGS_KEY, migrated);
        return migrated;
      }
    } catch {}
  }

  const fresh = cloneDefaultSettings();
  await store.set(SETTINGS_KEY, fresh);
  return fresh;
}
