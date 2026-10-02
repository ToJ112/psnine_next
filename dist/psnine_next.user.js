// ==UserScript==
// @name         PSNINE Next (PSN中文网功能增强)
// @namespace    https://github.com/ToJ112/psnine_next
// @version      1.0.5
// @description  现代化重构版 PSN中文网功能增强脚本，深度适配桌面 Tampermonkey 与 iOS Safari Stay
// @author       ToJ112, swsoyee, InfinityLoop, mordom0404, Nathaniel-Wu, JayusTree, aesct
// @match        https://psnine.com/*
// @match        https://www.psnine.com/*
// @match        https://*.psnine.com/*
// @match        http://psnine.com/*
// @match        http://www.psnine.com/*
// @match        http://*.psnine.com/*
// @match        https://d7vg.com/*
// @match        https://www.d7vg.com/*
// @match        https://*.d7vg.com/*
// @match        http://d7vg.com/*
// @match        http://www.d7vg.com/*
// @match        http://*.d7vg.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

"use strict";
(() => {
  // src/core/context.ts
  function extractVerifiedUserId(doc) {
    try {
      const cookie = doc.cookie || "";
      const cookieMatch = cookie.match(/(?:^|;\s*)__Psnine_psnid=([A-Za-z0-9_-]+)/);
      if (cookieMatch && cookieMatch[1]) return cookieMatch[1];
      const myUserIdNode = doc.querySelector("div.nav-user > button.auth-user > span.name");
      if (myUserIdNode && myUserIdNode.textContent?.trim()) {
        return myUserIdNode.textContent.trim();
      }
      const userMenuA = doc.querySelector('.user-menu-list a[href*="/psnid/"], .site-nav .user a[href*="/psnid/"], .nav-user a[href*="/psnid/"]');
      if (userMenuA) {
        const href = userMenuA.getAttribute("href") || "";
        const m = href.match(/\/psnid\/([A-Za-z0-9_-]+)/);
        if (m && m[1]) return m[1];
      }
      const oldA = doc.querySelector("ul.r li.dropdown ul li a");
      if (oldA && oldA.href) {
        const m = oldA.href.match(/\/psnid\/([A-Za-z0-9_-]+)/);
        if (m && m[1]) return m[1];
      }
    } catch {
    }
    return null;
  }
  function createContext(options) {
    const { document: doc, window: win, settings, store, http } = options;
    let parsedUrl;
    try {
      parsedUrl = new URL(win.location.href);
    } catch {
      parsedUrl = new URL("https://psnine.com/");
    }
    const userId = extractVerifiedUserId(doc);
    const reportedErrors = [];
    const contentSubscribers = /* @__PURE__ */ new Set();
    let observer = null;
    let pendingNodes = /* @__PURE__ */ new Set();
    let rafId = null;
    const flushPending = () => {
      rafId = null;
      if (pendingNodes.size === 0 || contentSubscribers.size === 0) {
        pendingNodes.clear();
        return;
      }
      const nodesToProcess = Array.from(pendingNodes);
      pendingNodes.clear();
      for (const node of nodesToProcess) {
        if (!node.isConnected) continue;
        if (node instanceof HTMLElement) {
          if (node.hasAttribute("data-psnine-next") || node.closest("[data-psnine-next]")) {
            continue;
          }
        }
        for (const subscriber of contentSubscribers) {
          try {
            subscriber(node);
          } catch (err) {
            reportError("onContent", err);
          }
        }
      }
    };
    const ensureObserver = () => {
      if (observer || typeof MutationObserver === "undefined") return;
      observer = new MutationObserver((mutations) => {
        let hasValidAddition = false;
        for (const mut of mutations) {
          if (mut.type === "childList") {
            for (let i = 0; i < mut.addedNodes.length; i++) {
              const added = mut.addedNodes[i];
              if (added.nodeType === Node.ELEMENT_NODE) {
                const el = added;
                if (el.hasAttribute("data-psnine-next") || el.closest?.("[data-psnine-next]")) {
                  continue;
                }
                pendingNodes.add(el);
                hasValidAddition = true;
              }
            }
          }
        }
        if (hasValidAddition && rafId === null) {
          rafId = win.requestAnimationFrame ? win.requestAnimationFrame(flushPending) : win.setTimeout(flushPending, 16);
        }
      });
      if (doc.body) {
        observer.observe(doc.body, { childList: true, subtree: true });
      } else {
        doc.addEventListener("DOMContentLoaded", () => {
          if (doc.body && observer) {
            observer.observe(doc.body, { childList: true, subtree: true });
          }
        }, { once: true });
      }
    };
    const reportError = (feature, error) => {
      reportedErrors.push({ feature, error });
      if (typeof console !== "undefined" && console.error) {
        console.error(`[psnine_next][${feature}]`, error);
      }
    };
    return {
      document: doc,
      window: win,
      url: parsedUrl,
      settings,
      store,
      http,
      userId,
      onContent(fn) {
        contentSubscribers.add(fn);
        ensureObserver();
        return () => {
          contentSubscribers.delete(fn);
          if (contentSubscribers.size === 0 && observer) {
            observer.disconnect();
            observer = null;
          }
        };
      },
      report(feature, error) {
        reportError(feature, error);
      }
    };
  }

  // src/core/types.ts
  var defaultSettings = {
    hoverUnmark: true,
    autoCheckIn: false,
    // Default false for safety per implementation plan
    autoPaging: 0,
    autoPagingInHomepage: true,
    replyTraceback: true,
    highlightBack: "#3890ff",
    highlightFront: "#ffffff",
    highlightSpecificID: ["mechille", "sai8808", "jimmyleo", "jimmyleohk", "monica_zjl"],
    highlightSpecificBack: "#d9534f",
    highlightSpecificFront: "#ffffff",
    blockList: [],
    blockWordsList: [],
    newQaStatus: true,
    hoverHomepage: true,
    foldTrophySummary: false,
    foldTrophyChart: false,
    platinumGlow: false,
    filterNonePlatinumAlpha: 0.2,
    hotTagThreshold: 20,
    nightMode: false,
    autoNightMode: "SYSTEM",
    removeHeaderInBattle: false,
    listPostsByNew: false,
    showAllQAAnswers: false,
    listQAAnswersByNew: false,
    showHiddenQASubReply: false,
    // Strictly align with upstream default false
    fixTextLinks: true,
    fixD7VGLinks: true,
    fixHTTPLinks: true,
    referGameVariants: true,
    preferSearchForFindingVariants: false,
    expandCollapsedSubcomments: true,
    showGameProgressInBattle: true,
    BattleInfoUpdateInterval: 36e5,
    redirectToMine: true,
    currencyConversion: true,
    exchangeRates: {},
    exchangeRateDate: "",
    blockWordsRegex: false,
    nightStart: 19,
    nightEnd: 7,
    showReplyControls: false
  };

  // src/core/store.ts
  var SETTINGS_KEY = "settings:v1";
  var LEGACY_STORAGE_KEY = "psnine-night-mode-CSS-settings";
  var THEME_MIRROR_KEY = "psnine_next:theme_mirror";
  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(defaultSettings));
  }
  function makeStoreKey(prefix, key) {
    if (key.startsWith(prefix)) {
      return key;
    }
    return prefix + key;
  }
  function safeGetLocalStorage() {
    try {
      if (typeof window !== "undefined" && "localStorage" in window && window.localStorage !== null) {
        const testKey = "__psnine_storage_probe__";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
        return window.localStorage;
      }
    } catch {
    }
    return null;
  }
  function selectStorageBackend() {
    try {
      if (typeof GM !== "undefined" && typeof GM.getValue === "function" && typeof GM.setValue === "function") {
        return "GM_V4";
      }
    } catch {
    }
    try {
      if (typeof GM_getValue === "function" && typeof GM_setValue === "function") {
        return "GM_CLASSIC";
      }
    } catch {
    }
    if (safeGetLocalStorage() !== null) {
      return "LOCAL_STORAGE";
    }
    return "MEMORY";
  }
  function createStore(prefix = "psnine_next:") {
    let activeBackend = selectStorageBackend();
    const memoryMap = /* @__PURE__ */ new Map();
    const memoryDeleted = /* @__PURE__ */ new Set();
    const downgradeBackend = (failedBackend) => {
      if (activeBackend !== failedBackend) return;
      if (failedBackend === "GM_V4") {
        try {
          if (typeof GM_getValue === "function" && typeof GM_setValue === "function") {
            activeBackend = "GM_CLASSIC";
            return;
          }
        } catch {
        }
        activeBackend = safeGetLocalStorage() !== null ? "LOCAL_STORAGE" : "MEMORY";
      } else if (failedBackend === "GM_CLASSIC") {
        activeBackend = safeGetLocalStorage() !== null ? "LOCAL_STORAGE" : "MEMORY";
      } else if (failedBackend === "LOCAL_STORAGE") {
        activeBackend = "MEMORY";
      }
    };
    const storeObj = {
      get backend() {
        return activeBackend;
      },
      async get(key, fallback) {
        const fullKey = makeStoreKey(prefix, key);
        if (memoryDeleted.has(fullKey)) {
          return fallback;
        }
        while (true) {
          if (activeBackend === "GM_V4") {
            try {
              const val = await GM.getValue(fullKey, void 0);
              if (val !== void 0 && val !== null) {
                memoryMap.set(fullKey, val);
                return val;
              }
              if (memoryMap.has(fullKey)) {
                return memoryMap.get(fullKey);
              }
              return fallback;
            } catch {
              downgradeBackend("GM_V4");
              continue;
            }
          }
          if (activeBackend === "GM_CLASSIC") {
            try {
              const val = await Promise.resolve(GM_getValue(fullKey, void 0));
              if (val !== void 0 && val !== null) {
                memoryMap.set(fullKey, val);
                return val;
              }
              if (memoryMap.has(fullKey)) {
                return memoryMap.get(fullKey);
              }
              return fallback;
            } catch {
              downgradeBackend("GM_CLASSIC");
              continue;
            }
          }
          if (activeBackend === "LOCAL_STORAGE") {
            if (memoryMap.has(fullKey)) {
              return memoryMap.get(fullKey);
            }
            const storage2 = safeGetLocalStorage();
            if (storage2) {
              let item = null;
              try {
                item = storage2.getItem(fullKey);
              } catch {
                downgradeBackend("LOCAL_STORAGE");
                continue;
              }
              if (item !== null) {
                try {
                  const parsed = JSON.parse(item);
                  memoryMap.set(fullKey, parsed);
                  return parsed;
                } catch {
                  return fallback;
                }
              }
              return fallback;
            } else {
              downgradeBackend("LOCAL_STORAGE");
              continue;
            }
          }
          if (memoryDeleted.has(fullKey)) {
            return fallback;
          }
          if (memoryMap.has(fullKey)) {
            return memoryMap.get(fullKey);
          }
          const storage = safeGetLocalStorage();
          if (storage) {
            try {
              const item = storage.getItem(fullKey);
              if (item !== null) {
                const parsed = JSON.parse(item);
                memoryMap.set(fullKey, parsed);
                return parsed;
              }
            } catch {
            }
          }
          return fallback;
        }
      },
      async set(key, value) {
        const fullKey = makeStoreKey(prefix, key);
        memoryDeleted.delete(fullKey);
        memoryMap.set(fullKey, value);
        while (true) {
          if (activeBackend === "GM_V4") {
            try {
              await GM.setValue(fullKey, value);
              break;
            } catch {
              downgradeBackend("GM_V4");
              continue;
            }
          }
          if (activeBackend === "GM_CLASSIC") {
            try {
              await Promise.resolve(GM_setValue(fullKey, value));
              break;
            } catch {
              downgradeBackend("GM_CLASSIC");
              continue;
            }
          }
          if (activeBackend === "LOCAL_STORAGE") {
            const storage = safeGetLocalStorage();
            if (storage) {
              try {
                storage.setItem(fullKey, JSON.stringify(value));
                break;
              } catch {
                downgradeBackend("LOCAL_STORAGE");
                continue;
              }
            } else {
              downgradeBackend("LOCAL_STORAGE");
              continue;
            }
          }
          break;
        }
        if (key === SETTINGS_KEY && typeof value === "object" && value !== null) {
          const s = value;
          const mirror = {
            nightMode: Boolean(s.nightMode),
            autoNightMode: s.autoNightMode || "SYSTEM",
            nightStart: s.nightStart ?? 19,
            nightEnd: s.nightEnd ?? 7
          };
          const storage = safeGetLocalStorage();
          if (storage) {
            try {
              storage.setItem(THEME_MIRROR_KEY, JSON.stringify(mirror));
            } catch {
            }
          }
        }
      },
      async remove(key) {
        const fullKey = makeStoreKey(prefix, key);
        memoryMap.delete(fullKey);
        memoryDeleted.add(fullKey);
        while (true) {
          if (activeBackend === "GM_V4") {
            try {
              if (typeof GM.deleteValue === "function") {
                await GM.deleteValue(fullKey);
              } else if (typeof GM.setValue === "function") {
                await GM.setValue(fullKey, void 0);
              }
              safeGetLocalStorage()?.removeItem(fullKey);
              break;
            } catch {
              downgradeBackend("GM_V4");
              continue;
            }
          }
          if (activeBackend === "GM_CLASSIC") {
            try {
              if (typeof GM_deleteValue === "function") {
                await Promise.resolve(GM_deleteValue(fullKey));
              } else if (typeof GM_setValue === "function") {
                await Promise.resolve(GM_setValue(fullKey, void 0));
              }
              safeGetLocalStorage()?.removeItem(fullKey);
              break;
            } catch {
              downgradeBackend("GM_CLASSIC");
              continue;
            }
          }
          if (activeBackend === "LOCAL_STORAGE") {
            const storage = safeGetLocalStorage();
            if (storage) {
              try {
                storage.removeItem(fullKey);
                break;
              } catch {
                downgradeBackend("LOCAL_STORAGE");
                continue;
              }
            } else {
              downgradeBackend("LOCAL_STORAGE");
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
            } catch {
            }
          }
        }
      }
    };
    return storeObj;
  }
  function validateSettings(raw) {
    if (!raw || typeof raw !== "object") {
      return cloneDefaultSettings();
    }
    const r = raw;
    const defaults = cloneDefaultSettings();
    const s = cloneDefaultSettings();
    const toBool = (val, fallback) => {
      return typeof val === "boolean" ? val : val === "true" ? true : val === "false" ? false : fallback;
    };
    const toNum = (val, fallback, min = -Infinity, max = Infinity) => {
      const num = typeof val === "number" ? val : typeof val === "string" ? parseFloat(val) : NaN;
      if (!Number.isFinite(num)) return fallback;
      return Math.max(min, Math.min(max, num));
    };
    const toStr = (val, fallback) => {
      return typeof val === "string" ? val : fallback;
    };
    const toStringArray = (val, fallback) => {
      if (Array.isArray(val)) {
        return val.filter((x) => typeof x === "string" || typeof x === "number").map((x) => String(x).trim()).filter(Boolean);
      }
      if (typeof val === "string") {
        return val.split(",").map((item) => item.trim()).filter(Boolean);
      }
      return [...fallback];
    };
    s.hoverUnmark = toBool(r.hoverUnmark, defaults.hoverUnmark);
    s.autoCheckIn = toBool(r.autoCheckIn, defaults.autoCheckIn);
    if (typeof r.autoPaging === "boolean") {
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
    if (r.autoNightMode === "SYSTEM" || r.autoNightMode === "TIME" || r.autoNightMode === "OFF") {
      s.autoNightMode = r.autoNightMode;
    } else if (typeof r.autoNightMode === "object" && r.autoNightMode !== null && "value" in r.autoNightMode) {
      const val = String(r.autoNightMode.value).toUpperCase();
      s.autoNightMode = val === "SYSTEM" || val === "TIME" || val === "OFF" ? val : defaults.autoNightMode;
    } else if (typeof r.autoNightMode === "boolean") {
      s.autoNightMode = r.autoNightMode ? "SYSTEM" : "OFF";
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
    s.BattleInfoUpdateInterval = Math.max(6e4, Math.floor(toNum(r.BattleInfoUpdateInterval, defaults.BattleInfoUpdateInterval)));
    s.redirectToMine = toBool(r.redirectToMine, defaults.redirectToMine);
    s.currencyConversion = toBool(r.currencyConversion, defaults.currencyConversion);
    if (r.exchangeRates && typeof r.exchangeRates === "object") {
      const rates = {};
      for (const [k, v] of Object.entries(r.exchangeRates)) {
        const n = typeof v === "number" ? v : parseFloat(String(v));
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
  async function loadAndMigrateSettings(store) {
    const existing = await store.get(SETTINGS_KEY, null);
    if (existing !== null && typeof existing === "object") {
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
      } catch {
      }
    }
    const fresh = cloneDefaultSettings();
    await store.set(SETTINGS_KEY, fresh);
    return fresh;
  }

  // src/core/http.ts
  function createHttpClient(currentOrigin = "https://psnine.com") {
    const textCache = /* @__PURE__ */ new Map();
    const inFlightText = /* @__PURE__ */ new Map();
    const maxConcurrency = 2;
    let activeRequests = 0;
    const queue = [];
    let currentOriginParsed;
    try {
      currentOriginParsed = new URL(currentOrigin);
    } catch {
      currentOriginParsed = new URL("https://psnine.com");
    }
    const acquire = (signal) => {
      if (signal?.aborted) {
        return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
      }
      if (activeRequests < maxConcurrency) {
        activeRequests++;
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const item = { resolve, reject, signal };
        if (signal) {
          item.onAbort = () => {
            const idx = queue.indexOf(item);
            if (idx > -1) {
              queue.splice(idx, 1);
            }
            reject(new DOMException("The operation was aborted.", "AbortError"));
          };
          signal.addEventListener("abort", item.onAbort, { once: true });
        }
        queue.push(item);
      });
    };
    const release = () => {
      activeRequests--;
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        if (next.signal && next.onAbort) {
          next.signal.removeEventListener("abort", next.onAbort);
        }
        if (next.signal?.aborted) {
          continue;
        }
        activeRequests++;
        next.resolve();
        return;
      }
    };
    const validateUrl = (urlStr, requestType) => {
      let parsed;
      try {
        parsed = new URL(urlStr, currentOriginParsed.href);
      } catch {
        throw new Error(`[HttpClient] Invalid URL: ${urlStr}`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`[HttpClient] Protocol not allowed: ${parsed.protocol}`);
      }
      if (parsed.username !== "" || parsed.password !== "") {
        throw new Error(`[HttpClient] Embedded credentials not allowed in URL`);
      }
      const isSameOrigin = parsed.origin === currentOriginParsed.origin;
      const isFrankfurterOrigin = parsed.origin === "https://api.frankfurter.dev";
      if (requestType === "document" || requestType === "text") {
        if (!isSameOrigin) {
          throw new Error(`[HttpClient] Cross-origin document fetch not allowed: ${parsed.origin}`);
        }
      } else if (requestType === "json") {
        if (!isSameOrigin && !isFrankfurterOrigin) {
          throw new Error(`[HttpClient] Disallowed external JSON endpoint: ${parsed.origin}`);
        }
      }
      return parsed;
    };
    const fetchRawText = async (validatedUrl, options) => {
      const normalizedUrl = validatedUrl.href;
      const now = Date.now();
      const ttl = options?.ttl ?? 0;
      const canDeduplicate = !options?.signal;
      if (options?.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      if (ttl > 0 && textCache.has(normalizedUrl)) {
        const entry = textCache.get(normalizedUrl);
        if (entry.expires > now) {
          return entry.rawText;
        }
        textCache.delete(normalizedUrl);
      }
      if (canDeduplicate && inFlightText.has(normalizedUrl)) {
        return inFlightText.get(normalizedUrl);
      }
      const task = (async () => {
        await acquire(options?.signal);
        try {
          if (options?.signal?.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
          }
          const controller = new AbortController();
          const timeoutMs = 15e3;
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          let abortHandler;
          if (options?.signal) {
            abortHandler = () => controller.abort();
            options.signal.addEventListener("abort", abortHandler, { once: true });
          }
          try {
            const res = await fetch(normalizedUrl, {
              signal: controller.signal,
              credentials: "same-origin"
            });
            if (!res.ok) {
              throw new Error(`[HttpClient] HTTP ${res.status}: ${normalizedUrl}`);
            }
            const text = await res.text();
            if (ttl > 0) {
              textCache.set(normalizedUrl, { rawText: text, expires: now + ttl });
            }
            return text;
          } finally {
            clearTimeout(timer);
            if (options?.signal && abortHandler) {
              options.signal.removeEventListener("abort", abortHandler);
            }
          }
        } finally {
          release();
          if (canDeduplicate) {
            inFlightText.delete(normalizedUrl);
          }
        }
      })();
      if (canDeduplicate) {
        inFlightText.set(normalizedUrl, task);
      }
      return task;
    };
    const sanitizeDocument = (doc, baseUrl) => {
      const dangerousTags = ["script", "iframe", "object", "embed", "base", "meta", "form", "applet", "style", "link"];
      for (const tag of dangerousTags) {
        const elements = doc.querySelectorAll(tag);
        elements.forEach((el) => {
          if (tag === "meta") {
            if (el.hasAttribute("http-equiv") || el.getAttribute("name")?.toLowerCase() === "refresh") {
              el.remove();
            }
          } else {
            el.remove();
          }
        });
      }
      const isMaliciousUrl = (rawUrl) => {
        const clean = rawUrl.replace(/[\u0000-\u0020\u007F-\u009F\s]/g, "").toLowerCase();
        if (clean.startsWith("javascript:") || clean.startsWith("vbscript:")) {
          return true;
        }
        if (clean.startsWith("data:")) {
          if (clean.startsWith("data:image/svg+xml")) {
            return true;
          }
          if (!clean.startsWith("data:image/png") && !clean.startsWith("data:image/jpeg") && !clean.startsWith("data:image/jpg") && !clean.startsWith("data:image/webp") && !clean.startsWith("data:image/gif")) {
            return true;
          }
        }
        return false;
      };
      const toAbsoluteUrl = (rel) => {
        try {
          return new URL(rel, baseUrl).href;
        } catch {
          return rel;
        }
      };
      const sanitizeSrcset = (srcsetVal) => {
        const candidates = srcsetVal.split(",");
        const cleanedCandidates = [];
        for (const cand of candidates) {
          const trimmed = cand.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/\s+/);
          const urlPart = parts[0];
          const descriptor = parts.slice(1).join(" ");
          if (isMaliciousUrl(urlPart)) {
            continue;
          }
          const absUrl = toAbsoluteUrl(urlPart);
          cleanedCandidates.push(descriptor ? `${absUrl} ${descriptor}` : absUrl);
        }
        return cleanedCandidates.join(", ");
      };
      const all = doc.querySelectorAll("*");
      all.forEach((el) => {
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          const val = attr.value;
          if (name.startsWith("on")) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (name === "srcdoc" || name === "action" || name === "formaction" || name.endsWith(":href")) {
            if (name !== "href") {
              el.removeAttribute(attr.name);
              continue;
            }
          }
          if (name === "srcset") {
            const cleaned = sanitizeSrcset(val);
            if (cleaned) {
              el.setAttribute(attr.name, cleaned);
            } else {
              el.removeAttribute(attr.name);
            }
            continue;
          }
          if (name === "href" || name === "src" || name === "poster" || name === "data" || name === "background") {
            if (isMaliciousUrl(val)) {
              el.removeAttribute(attr.name);
            } else {
              el.setAttribute(attr.name, toAbsoluteUrl(val));
            }
          }
        }
      });
      return doc;
    };
    return {
      async text(urlStr, options) {
        const validatedUrl = validateUrl(urlStr, "text");
        return fetchRawText(validatedUrl, options);
      },
      async document(urlStr, options) {
        const validatedUrl = validateUrl(urlStr, "document");
        const rawText = await fetchRawText(validatedUrl, options);
        const parser = new DOMParser();
        const rawDoc = parser.parseFromString(rawText, "text/html");
        return sanitizeDocument(rawDoc, validatedUrl);
      },
      async json(urlStr, options) {
        const validatedUrl = validateUrl(urlStr, "json");
        const rawText = await fetchRawText(validatedUrl, options);
        return JSON.parse(rawText);
      }
    };
  }

  // src/styles/index.ts
  var ICONS = {
    gear: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    checkCircle: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#28a745"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
    coins: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f39c12"><path d="M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5zm0 2c4.42 0 8 1.79 8 3s-3.58 3-8 3-8-1.79-8-3 3.58-3 8-3zm0 16c-4.42 0-8-1.79-8-3v-2.22c1.78 1.34 4.67 2.22 8 2.22s6.22-.88 8-2.22V17c0 1.21-3.58 3-8 3zm0-5c-4.42 0-8-1.79-8-3v-2.22c1.78 1.34 4.67 2.22 8 2.22s6.22-.88 8-2.22V12c0 1.21-3.58 3-8 3z"/></svg>`,
    arrowDown: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>`
  };
  var CORE_STYLES = `
/* psnine_next Core Base Tokens & Styles (aligned with PSNINE v2) */
:root {
  --p9n-bg: var(--c-bg, #f4f6fa);
  --p9n-surface: var(--c-card, #ffffff);
  --p9n-surface-alt: var(--c-bg, #f8fafc);
  --p9n-text: var(--c-text, #1f2937);
  --p9n-muted: var(--c-text-2, #5f6b7a);
  --p9n-border: var(--c-line, #ccd6dd);
  --p9n-link: var(--c-brand, #1966c2);
  --p9n-primary: #1d4ed8;
  --p9n-radius-sm: var(--r-sm, 4px);
  --p9n-radius-md: var(--r-md, 8px);
}

[data-psnine-next]:where(:not(.psnine-nav-settings-link)) {
  box-sizing: border-box;
}

/* Base button styling */
.psnine-btn,
[data-psnine-next] button:where(:not(.psnine-settings-close)),
button[data-psnine-next]:where(:not(.psnine-settings-close)) {
  color: var(--p9n-text);
  background-color: var(--p9n-surface);
  border: 1px solid var(--p9n-border);
  padding: 6px 14px;
  font-size: 14px;
  border-radius: var(--p9n-radius-sm, 6px);
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.psnine-btn.psnine-btn-primary,
[data-psnine-next] button.psnine-btn-primary,
button[data-psnine-next].psnine-btn-primary {
  color: #ffffff !important;
  background-color: var(--p9n-primary) !important;
  border-color: var(--p9n-primary) !important;
}

.psnine-btn.psnine-btn-danger,
[data-psnine-next] button.psnine-btn-danger,
button[data-psnine-next].psnine-btn-danger {
  color: #e74c3c !important;
  background-color: var(--p9n-surface) !important;
  border-color: #e74c3c !important;
}

/* Floating Action Buttons (.float-btn native style) */
#psnine-settings-gear,
#psnine-scrollbottom {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  width: 44px;
  height: 44px;
  padding: 0 !important;
  border-radius: var(--r-md, var(--p9n-radius-md, 8px)) !important;
  background-color: var(--c-card, var(--p9n-surface)) !important;
  color: var(--c-text-2, var(--p9n-muted)) !important;
  border: 1px solid var(--c-line, var(--p9n-border)) !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 40 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  touch-action: manipulation;
  box-sizing: border-box;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
#psnine-settings-gear {
  bottom: max(20px, env(safe-area-inset-bottom));
}
#psnine-scrollbottom {
  bottom: calc(max(20px, env(safe-area-inset-bottom)) + 52px);
}
#psnine-settings-gear:hover,
#psnine-scrollbottom:hover {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-link) !important;
  border-color: var(--p9n-link) !important;
}

/* When merged into native .float-layer */
.float-layer > #psnine-settings-gear,
.float-layer > #psnine-scrollbottom {
  position: static !important;
  width: 46px !important;
  height: 46px !important;
  min-width: 46px !important;
  min-height: 46px !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: var(--r-md, 8px) !important;
  box-shadow: none !important;
}
@media (min-width: 769px) {
  .float-layer > #psnine-settings-gear,
  .float-layer > #psnine-scrollbottom {
    width: 52px !important;
    height: 52px !important;
    min-width: 52px !important;
    min-height: 52px !important;
  }
}

/* Nav menu trigger cursor */
.psnine-nav-settings-btn,
a.psnine-nav-settings-link {
  cursor: pointer;
  touch-action: manipulation;
}

/* Settings Modal Backdrop & Dialog */
.psnine-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  box-sizing: border-box;
  overflow: hidden;
}
.psnine-settings-dialog {
  background: var(--p9n-surface);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-md, 12px);
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  box-sizing: border-box;
}
.psnine-settings-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--p9n-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
}
.psnine-settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--p9n-text);
}
.psnine-settings-close {
  background: transparent !important;
  border: none !important;
  cursor: pointer;
  color: var(--p9n-muted) !important;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--p9n-radius-sm, 6px);
}
.psnine-settings-close:hover {
  color: var(--p9n-text) !important;
  background: rgba(128, 128, 128, 0.15) !important;
}
.psnine-settings-body {
  padding: 14px 16px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}
.psnine-settings-section {
  border-bottom: 1px solid var(--p9n-border);
  margin-bottom: 8px;
}
.psnine-settings-section[open] {
  margin-bottom: 12px;
}
.psnine-settings-summary {
  font-size: 15px;
  font-weight: 600;
  color: var(--p9n-link);
  padding: 10px 0;
  cursor: pointer;
  user-select: none;
}
.psnine-settings-summary:hover {
  color: var(--p9n-text);
}
.psnine-settings-summary:focus {
  outline: none;
}
.psnine-settings-summary:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 2px;
  border-radius: var(--p9n-radius-sm, 4px);
}
.psnine-settings-section-body {
  padding: 2px 0 8px 0;
}
.psnine-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--p9n-border);
  min-height: 44px;
  box-sizing: border-box;
  gap: 12px;
}
.psnine-settings-row > .psnine-settings-label,
.psnine-settings-row > label:where(:not(.psnine-switch)) {
  font-size: 14px;
  font-weight: 500;
  flex: 1 1 auto;
  min-width: 0;
  color: var(--p9n-text);
  padding-right: 8px;
  line-height: 1.4;
}
.psnine-settings-row input[type="text"],
.psnine-settings-row input[type="number"],
.psnine-settings-row select,
.psnine-settings-row textarea {
  font-size: 16px !important;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-sm, 6px);
  background: var(--p9n-surface);
  color: var(--p9n-text);
  box-sizing: border-box;
  max-width: 220px;
}
#psnine-setting-theme-mode {
  font-size: 16px !important;
  min-height: 40px;
  padding: 8px 12px;
  background: var(--p9n-surface);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-sm, 6px);
}
.psnine-settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
}
.psnine-settings-memory-warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: var(--p9n-radius-sm, 6px);
  font-size: 13px;
  line-height: 1.5;
}
.psnine-settings-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--p9n-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--p9n-surface-alt);
  flex: 0 0 auto;
  gap: 12px;
}
.psnine-settings-footer .psnine-btn {
  min-height: 44px !important;
  min-width: 80px;
  padding: 8px 18px !important;
  font-size: 16px !important;
  font-weight: 500;
  border-radius: var(--p9n-radius-md, 8px) !important;
}

/* iOS-Style Toggle Switch */
.psnine-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 48px !important;
  height: 44px !important;
  flex: 0 0 48px !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box;
  cursor: pointer;
  touch-action: manipulation;
}
.psnine-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
}
.psnine-slider {
  position: absolute;
  cursor: pointer;
  top: 8px;
  left: 0;
  width: 48px;
  height: 28px;
  background-color: var(--p9n-border);
  transition: background-color 0.25s ease;
  border-radius: 28px;
  box-sizing: border-box;
}
.psnine-slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: transform 0.25s ease;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.psnine-switch input:checked + .psnine-slider {
  background-color: #2ecc71;
}
.psnine-switch input:checked + .psnine-slider:before {
  transform: translateX(20px);
}
.psnine-switch input:focus-visible + .psnine-slider {
  outline: 2px solid var(--p9n-link);
  outline-offset: 2px;
}

/* Floor Number & Author Badges */
.psnine-floor-badge {
  display: inline-block;
  font-size: 12px;
  color: var(--p9n-muted);
  margin-right: 6px;
  user-select: none;
}

/* Game List Progress Badge (P06: Neutral, Accessible Contrast >= 4.5:1) */
.psnine-game-list-progress-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 500;
  border-radius: var(--p9n-radius-sm, 4px);
  background-color: var(--p9n-surface-alt, #f4f6fa);
  color: var(--p9n-text, #1f2937);
  border: 1px solid var(--p9n-border, #ccd6dd);
  margin-left: 6px;
  vertical-align: middle;
  box-sizing: border-box;
}

/* Game List & Profile Action Buttons (Neutral Outline, Contrast >= 4.5:1, Touch >= 44px) */
.psnine-sync-btn,
.psnine-to-mine-btn,
#psnine-to-mine-trophy-btn,
.psnine-difficulty-sort-btn,
#psnine-difficulty-sort-btn,
.psnine-ondemand-progress-btn,
.psnine-variant-btn,
.psnine-cross-tip-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 44px !important;
  border-radius: var(--p9n-radius-md, 8px) !important;
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border: 1px solid var(--p9n-border) !important;
  text-decoration: none !important;
  touch-action: manipulation !important;
  box-sizing: border-box !important;
  transition: all 0.15s ease;
}

.psnine-sync-btn {
  padding: 8px 16px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
}

.psnine-to-mine-btn,
#psnine-to-mine-trophy-btn {
  padding: 6px 14px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  margin-left: 8px !important;
}

.psnine-difficulty-sort-btn,
#psnine-difficulty-sort-btn {
  padding: 6px 14px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  margin: 6px 0 !important;
  cursor: pointer !important;
}

.psnine-ondemand-progress-btn {
  padding: 4px 10px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  border-radius: var(--p9n-radius-sm, 4px) !important;
  color: var(--p9n-link) !important;
  cursor: pointer !important;
  margin-left: 6px !important;
}

.psnine-variant-btn,
.psnine-cross-tip-btn {
  padding: 6px 12px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  border-radius: var(--p9n-radius-sm, 6px) !important;
  color: var(--p9n-link) !important;
}

.psnine-sync-btn:hover,
.psnine-to-mine-btn:hover,
#psnine-to-mine-trophy-btn:hover,
.psnine-difficulty-sort-btn:hover,
#psnine-difficulty-sort-btn:hover,
.psnine-ondemand-progress-btn:hover,
.psnine-variant-btn:hover,
.psnine-cross-tip-btn:hover {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-link) !important;
  border-color: var(--p9n-link) !important;
  text-decoration: none !important;
}

.psnine-author-badge {
  display: inline-block;
  background: var(--p9n-link);
  color: #ffffff;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: var(--p9n-radius-sm, 4px);
  margin-left: 5px;
  vertical-align: middle;
}

/* Reply Traceback Card */
.psnine-traceback-card {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--p9n-surface-alt);
  border-left: 3px solid var(--p9n-link);
  border-radius: var(--p9n-radius-sm, 4px);
  font-size: 13px;
}
.psnine-traceback-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--p9n-text);
  margin-bottom: 4px;
}
.psnine-traceback-content {
  color: var(--p9n-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Hot Tag */
.psnine-hot-badge {
  display: inline-block;
  background: #e74c3c;
  color: #fff;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: bold;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: middle;
}

/* Q&A Status Icons */
.psnine-qa-status {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  vertical-align: middle;
}

/* Trophy Module V2 Native Card & Outline Pill Styles */
.psnine-trophy-panel,
#psnine-trophy-stats-panel {
  background-color: var(--p9n-surface);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-md, 8px);
  padding: 14px 16px;
  margin: 12px 0;
  box-sizing: border-box;
}

.psnine-trophy-overview-top {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}

.psnine-trophy-card-hd,
#psnine-trophy-header-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--p9n-text);
}
.psnine-trophy-title-text {
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}
.psnine-trophy-completion,
#psnine-trophy-header-counts {
  white-space: nowrap;
  font-size: 12px;
  color: var(--p9n-muted);
  font-weight: normal;
}
#psnine-trophy-completion-badge {
  font-size: 11px;
  font-weight: normal;
  line-height: 1.4;
  color: var(--p9n-muted);
}

.psnine-trophy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 12px;
}

.psnine-trophy-action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* Trophy Tips Compact Trigger, Popup Menu & Jump Highlight (Matches native .o_btn) */
#psnine-trophy-tips-trigger,
button#psnine-trophy-tips-trigger,
.o_btn.psnine-trophy-tips-btn {
  display: inline-block !important;
  margin: 0 !important;
  width: 52px !important;
  min-height: 24px !important;
  height: 24px !important;
  padding: 2px 4px !important;
  font-size: 12px !important;
  line-height: 17px !important;
  border-radius: 15px !important;
  border: 1px solid darkslategray !important;
  border-color: darkslategray !important;
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  cursor: pointer !important;
  text-align: center !important;
  box-sizing: border-box !important;
  outline: none !important;
  vertical-align: middle !important;
}
#psnine-trophy-tips-trigger:focus-visible,
button#psnine-trophy-tips-trigger:focus-visible,
.o_btn.psnine-trophy-tips-btn:focus-visible {
  outline: 2px solid var(--p9n-link, #1966c2) !important;
  outline-offset: 1px !important;
}
#psnine-trophy-tips-menu {
  background-color: var(--p9n-surface);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-md, 8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.psnine-tip-jump-target {
  background-color: var(--p9n-surface-alt, #f8fafc) !important;
  outline: 2px solid var(--p9n-link, #1966c2) !important;
  outline-offset: -2px !important;
  transition: background-color 0.25s ease, outline 0.25s ease;
}
@media (prefers-reduced-motion: reduce) {
  .psnine-tip-jump-target {
    transition: none !important;
  }
}
html[data-theme="dark"] .psnine-tip-jump-target {
  background-color: var(--p9n-surface-alt, #202c3a) !important;
  outline: 2px solid var(--p9n-link, #70b8ff) !important;
}

/* Neutral outline pill button */
.psnine-trophy-pill-btn,
.psnine-pill-btn,
.psnine-trophy-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 18px;
  border: 1px solid var(--p9n-border);
  background-color: var(--p9n-surface);
  color: var(--p9n-text);
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
  text-decoration: none;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.psnine-trophy-pill-btn:hover:not(:disabled),
.psnine-pill-btn:hover:not(:disabled),
.psnine-trophy-toolbar button:hover:not(:disabled) {
  background-color: var(--p9n-surface-alt);
  border-color: var(--p9n-link);
  color: var(--p9n-link);
}
.psnine-trophy-pill-btn.active,
.psnine-trophy-pill-btn[aria-pressed="true"],
.psnine-pill-btn.active,
.psnine-trophy-toolbar button.active,
.psnine-trophy-toolbar button[aria-pressed="true"] {
  background-color: var(--p9n-surface-alt);
  border-color: var(--p9n-link);
  color: var(--p9n-link);
  font-weight: 600;
}
.psnine-trophy-pill-btn.danger,
.psnine-trophy-pill-btn.psnine-btn-danger,
.psnine-trophy-toolbar button.danger,
.psnine-trophy-toolbar button.psnine-btn-danger {
  color: #e74c3c !important;
  border-color: #e74c3c !important;
  background-color: var(--p9n-surface) !important;
}
.psnine-trophy-pill-btn:disabled,
.psnine-pill-btn:disabled,
.psnine-trophy-toolbar button:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  pointer-events: none;
}

/* Trophy Charts grid & sections */
.psnine-trophy-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin: 10px 0;
}
.psnine-trophy-chart-section {
  padding: 12px 0;
  border: none;
  border-top: 1px solid var(--p9n-border);
  border-radius: 0;
  background-color: transparent;
  color: var(--p9n-text);
  box-sizing: border-box;
}

/* Trophy Icon thumbnail chip */
.psnine-trophy-chip,
.psnine-trophy-icon-chip {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: var(--p9n-radius-sm, 4px);
  border: 1px solid var(--p9n-border);
  background-color: transparent !important;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  box-sizing: border-box;
}
.psnine-trophy-chip.earned,
.psnine-trophy-icon-chip.earned,
.psnine-trophy-icon-chip[style*="#28a745"],
.psnine-trophy-icon-chip[style*="rgb(40, 167, 69)"] {
  border-color: #28a745 !important;
  opacity: 1 !important;
}
.psnine-trophy-chip.unearned,
.psnine-trophy-icon-chip.unearned {
  opacity: 0.6;
}

/* Trophy Preview Card */
.psnine-trophy-preview-card,
#psnine-trophy-preview-card {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: var(--p9n-surface-alt);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-sm, 6px);
  font-size: 12px;
  color: var(--p9n-text);
  box-sizing: border-box;
}

/* Trophy Tip Row */
.psnine-trophy-tip-row {
  padding: 10px 14px;
  background-color: var(--p9n-surface-alt);
  border-bottom: 1px solid var(--p9n-border);
  color: var(--p9n-text);
  font-size: 12px;
}

/* Filtered Tip Reveal Button */
.psnine-trophy-filtered-btn,
.psnine-filtered-tip-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  background-color: var(--p9n-surface);
  color: var(--p9n-muted);
  font-size: 11px;
  border-radius: var(--p9n-radius-sm, 4px);
  border: 1px dashed var(--p9n-border);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}

/* Trophy Navigation Dropmenu (Keeps sort dropdown, filter buttons, and Tips on one row) */
ul.dropmenu.psnine-trophy-nav-dropmenu,
ul.dropmenu[data-psnine-trophy-nav="true"] {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li,
ul.dropmenu[data-psnine-trophy-nav="true"] > li {
  float: none !important;
  display: inline-flex !important;
  align-items: center !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"],
ul.dropmenu[data-psnine-trophy-nav="true"] > li.dropdown[data-psnine-trophy-sort-dropdown="true"] {
  min-width: 0 !important;
  flex: 0 1 auto !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"],
ul.dropmenu[data-psnine-trophy-nav="true"] > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"] {
  display: inline-block !important;
  max-width: 100% !important;
  min-width: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  vertical-align: middle !important;
  height: 36px !important;
  line-height: 36px !important;
  box-sizing: border-box !important;
}
@media (max-width: 480px) {
  ul.dropmenu.psnine-trophy-nav-dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"],
  ul.dropmenu[data-psnine-trophy-nav="true"] > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"] {
    max-width: 105px !important;
  }
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li:not(.dropdown),
ul.dropmenu[data-psnine-trophy-nav="true"] > li:not(.dropdown) {
  flex-shrink: 0 !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu .o_btn:not(#psnine-trophy-tips-trigger),
ul.dropmenu[data-psnine-trophy-nav="true"] .o_btn:not(#psnine-trophy-tips-trigger) {
  margin: 0 4px !important;
}

/* Native Sort Dropdown */
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] {
  position: relative;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"] {
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] {
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  display: none;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"]:not([data-psnine-dropdown-state="closed"]).hover > ul[data-psnine-trophy-sort-menu="true"],
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"].psnine-dropdown-open > ul[data-psnine-trophy-sort-menu="true"],
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"][data-psnine-dropdown-state="open"] > ul[data-psnine-trophy-sort-menu="true"] {
  display: block !important;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"][data-psnine-dropdown-state="closed"] > ul[data-psnine-trophy-sort-menu="true"] {
  display: none !important;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a {
  color: #dbe4ee !important;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li[data-psnine-sort-item] > a {
  cursor: pointer;
  touch-action: manipulation;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff !important;
  text-decoration: none;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a.current,
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a[data-psnine-sort-active="true"] {
  background-color: rgba(56, 144, 255, 0.24) !important;
  color: #ffffff !important;
  font-weight: 600;
  text-decoration: none;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: -2px;
}

/* Spoiler Bar (.mark) Light Mode Rules (G04) */
.mark {
  background-color: #2c3e50 !important;
  color: #2c3e50 !important;
  border-radius: 2px;
  cursor: pointer;
  user-select: none;
  padding: 1px 4px;
}
.mark.unmasked,
.mark.pinned {
  color: #ffffff !important;
  user-select: text;
}
.mark strong,
.mark b,
.mark em,
.mark i,
.mark a,
.mark a:visited,
.mark span,
.mark [style*="color"],
.mark * {
  color: inherit !important;
  background-color: transparent !important;
}
`;
  var DARK_THEME_STYLES = `
/* psnine_next Dark Theme Tokens */
html[data-theme="dark"],
body[data-theme="dark"],
html[data-theme="dark"] body {
  --p9n-bg: var(--c-bg, #10151d);
  --p9n-surface: var(--c-card, #1a222d);
  --p9n-surface-alt: var(--c-bg, #202c3a);
  --p9n-text: var(--c-text, #e6ebf2);
  --p9n-muted: var(--c-text-2, #a8b3c2);
  --p9n-border: var(--c-line, #3b4859);
  --p9n-link: var(--c-brand, #91bdff);
  --p9n-primary: #1d4ed8;
}

/* Page Background & Base Text (scoped with html[data-theme="dark"]) */
html[data-theme="dark"] body.bg,
html[data-theme="dark"] body[data-theme="dark"],
html[data-theme="dark"] body,
body[data-theme="dark"] {
  background-color: #10151d !important;
  color: #e6ebf2 !important;
}

/* Floating Action Buttons in Dark Mode */
html[data-theme="dark"] #psnine-settings-gear,
html[data-theme="dark"] #psnine-scrollbottom {
  padding: 0 !important;
  background-color: var(--c-card, var(--p9n-surface)) !important;
  color: var(--c-text-2, var(--p9n-muted)) !important;
  border: 1px solid var(--c-line, var(--p9n-border)) !important;
  border-radius: var(--r-md, var(--p9n-radius-md, 8px)) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

html[data-theme="dark"] .float-layer > #psnine-settings-gear,
html[data-theme="dark"] .float-layer > #psnine-scrollbottom {
  position: static !important;
  background-color: var(--c-card, var(--p9n-surface)) !important;
  color: var(--c-text-2, var(--p9n-muted)) !important;
  border: 1px solid var(--c-line, var(--p9n-border)) !important;
  box-shadow: none !important;
}

/* Structural Panels & Containers */
html[data-theme="dark"] .box,
html[data-theme="dark"] .content,
html[data-theme="dark"] .header,
html[data-theme="dark"] .footer,
html[data-theme="dark"] .dropdown ul,
html[data-theme="dark"] .mobile-nav-panel {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Navigation (.inav) */
html[data-theme="dark"] .inav {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .inav li a {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .inav li.current,
html[data-theme="dark"] .inav li.current a {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-text) !important;
}

/* Pagination (.page li a) */
html[data-theme="dark"] .page li a {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-link) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .page li.current a {
  background-color: var(--p9n-primary) !important;
  color: #ffffff !important;
  border-color: var(--p9n-primary) !important;
}

/* Lists and Tables */
html[data-theme="dark"] .list,
html[data-theme="dark"] table.list,
html[data-theme="dark"] .sonlist {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .list li,
html[data-theme="dark"] .sonlist li,
html[data-theme="dark"] table.list tr,
html[data-theme="dark"] table.list td:where(:not(.t1):not(.t2):not(.t3):not(.t4)),
html[data-theme="dark"] table.list th,
html[data-theme="dark"] .box .post {
  background-color: transparent !important;
  color: var(--p9n-text) !important;
  border-bottom: 1px solid var(--p9n-border) !important;
}
html[data-theme="dark"] .list li:hover,
html[data-theme="dark"] table.list tr:hover {
  background-color: var(--p9n-surface-alt) !important;
}

/* Trophy Grade Cell Backgrounds (preserve t1/t2/t3/t4 grade colors) */
html[data-theme="dark"] table.list td.t1,
html[data-theme="dark"] .t1 {
  background-color: #3b4d71 !important;
}
html[data-theme="dark"] table.list td.t2,
html[data-theme="dark"] .t2 {
  background-color: #5c4528 !important;
}
html[data-theme="dark"] table.list td.t3,
html[data-theme="dark"] .t3 {
  background-color: #4a4f57 !important;
}
html[data-theme="dark"] table.list td.t4,
html[data-theme="dark"] .t4 {
  background-color: #5a3826 !important;
}
html[data-theme="dark"] table.list td.t1 a,
html[data-theme="dark"] table.list td.t2 a,
html[data-theme="dark"] table.list td.t3 a,
html[data-theme="dark"] table.list td.t4 a {
  color: #ffffff !important;
}

/* Known pale yellow inline table in .content (.tbl) */
html[data-theme="dark"] .content table.tbl,
html[data-theme="dark"] .content table.tbl tr,
html[data-theme="dark"] .content table.tbl td,
html[data-theme="dark"] .content table.tbl th,
html[data-theme="dark"] table.tbl,
html[data-theme="dark"] table.tbl tr,
html[data-theme="dark"] table.tbl td,
html[data-theme="dark"] table.tbl th {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Typography */
html[data-theme="dark"] h1,
html[data-theme="dark"] h2,
html[data-theme="dark"] h3,
html[data-theme="dark"] .text-strong {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] strong:where(:not([class*="alert-"]):not([class*="alert-"] *)),
html[data-theme="dark"] b:where(:not([class*="alert-"]):not([class*="alert-"] *)) {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] em:where(:not([class*="alert-"]):not([class*="alert-"] *)) {
  color: var(--p9n-muted) !important;
}

/* Generic links: Exclude native navs/headers, semantic grade text, buttons, and inline-colored links */
html[data-theme="dark"] a:where(:not(.btn):not(.text-platinum):not(.text-gold):not(.text-silver):not(.text-bronze):not([style*="color"]):not(.mobile-nav-panel *):not(.user-menu-list *):not(.site-nav *):not(#header *):not(.header *):not(#pcmenu *)) {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] a:visited:where(:not(.btn):not(.text-platinum):not(.text-gold):not(.text-silver):not(.text-bronze):not([style*="color"]):not(.mobile-nav-panel *):not(.user-menu-list *):not(.site-nav *):not(#header *):not(.header *):not(#pcmenu *)) {
  color: #c4b5fd !important;
}

/* Semantic Trophy Rarity Colors */
html[data-theme="dark"] .text-platinum,
html[data-theme="dark"] a.text-platinum {
  color: #70b8ff !important;
}
html[data-theme="dark"] .text-gold,
html[data-theme="dark"] a.text-gold {
  color: #ffd166 !important;
}
html[data-theme="dark"] .text-silver,
html[data-theme="dark"] a.text-silver {
  color: #d1d5db !important;
}
html[data-theme="dark"] .text-bronze,
html[data-theme="dark"] a.text-bronze {
  color: #f4a261 !important;
}

html[data-theme="dark"] .psnnode {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-text) !important;
}

/* Form Controls (exclude color and checkbox) */
html[data-theme="dark"] input[type="text"],
html[data-theme="dark"] input[type="number"],
html[data-theme="dark"] input[type="search"],
html[data-theme="dark"] input[type="password"],
html[data-theme="dark"] textarea,
html[data-theme="dark"] select {
  background-color: var(--p9n-bg) !important;
  color: var(--p9n-text) !important;
  border: 1px solid var(--p9n-border) !important;
}

/* Spoiler Bar (.mark) Dark Mode Rules (G04) */
html[data-theme="dark"] .mark {
  background-color: #3b4859 !important;
  color: #3b4859 !important;
  cursor: pointer;
  user-select: none;
  border-radius: 2px;
  padding: 1px 4px;
}
html[data-theme="dark"] .mark.unmasked,
html[data-theme="dark"] .mark.pinned {
  color: #ffffff !important;
  user-select: text;
}
html[data-theme="dark"] .mark strong,
html[data-theme="dark"] .mark b,
html[data-theme="dark"] .mark em,
html[data-theme="dark"] .mark i,
html[data-theme="dark"] .mark a,
html[data-theme="dark"] .mark a:visited,
html[data-theme="dark"] .mark span,
html[data-theme="dark"] .mark [style*="color"],
html[data-theme="dark"] .mark * {
  color: inherit !important;
  background-color: transparent !important;
}

/* Semantic Alert Badges in Dark Mode (Tips, Like counts, Status markers) */
html[data-theme="dark"] .alert-success,
html[data-theme="dark"] em.alert-success,
html[data-theme="dark"] span.alert-success {
  background-color: #1e4620 !important;
  color: #75b798 !important;
  border-color: #2b6a38 !important;
}
html[data-theme="dark"] .alert-info,
html[data-theme="dark"] em.alert-info,
html[data-theme="dark"] span.alert-info {
  background-color: #0d3c61 !important;
  color: #6ea8fe !important;
  border-color: #1a5c96 !important;
}
html[data-theme="dark"] .alert-warning,
html[data-theme="dark"] em.alert-warning,
html[data-theme="dark"] span.alert-warning {
  background-color: #4d3800 !important;
  color: #ffda6a !important;
  border-color: #7a5a00 !important;
}
html[data-theme="dark"] .alert-danger,
html[data-theme="dark"] .alert-error,
html[data-theme="dark"] em.alert-danger,
html[data-theme="dark"] em.alert-error,
html[data-theme="dark"] span.alert-danger,
html[data-theme="dark"] span.alert-error {
  background-color: #491217 !important;
  color: #ea868f !important;
  border-color: #721c24 !important;
}

/* Ensure b/em/strong inside alert badges inherit high-contrast badge text */
html[data-theme="dark"] [class*="alert-"] b,
html[data-theme="dark"] [class*="alert-"] em,
html[data-theme="dark"] [class*="alert-"] strong,
html[data-theme="dark"] .alert-success b,
html[data-theme="dark"] .alert-success em,
html[data-theme="dark"] .alert-success strong,
html[data-theme="dark"] .alert-info b,
html[data-theme="dark"] .alert-info em,
html[data-theme="dark"] .alert-info strong,
html[data-theme="dark"] .alert-warning b,
html[data-theme="dark"] .alert-warning em,
html[data-theme="dark"] .alert-warning strong,
html[data-theme="dark"] .alert-danger b,
html[data-theme="dark"] .alert-danger em,
html[data-theme="dark"] .alert-danger strong,
html[data-theme="dark"] .alert-error b,
html[data-theme="dark"] .alert-error em,
html[data-theme="dark"] .alert-error strong {
  color: inherit !important;
}

/* Settings Modal Dark Mode */
html[data-theme="dark"] .psnine-settings-dialog {
  background: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-header {
  border-color: var(--p9n-border) !important;
  background: var(--p9n-surface) !important;
}
html[data-theme="dark"] .psnine-settings-footer {
  border-color: var(--p9n-border) !important;
  background: var(--p9n-bg) !important;
}
html[data-theme="dark"] .psnine-settings-section {
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-summary {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-settings-summary:hover {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-settings-summary:focus-visible {
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: 2px;
}
html[data-theme="dark"] .psnine-settings-row {
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-row > .psnine-settings-label,
html[data-theme="dark"] .psnine-settings-row > label:where(:not(.psnine-switch)) {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-settings-row input,
html[data-theme="dark"] .psnine-settings-row select,
html[data-theme="dark"] .psnine-settings-row textarea {
  background: var(--p9n-bg) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-memory-warning {
  background: #332701 !important;
  color: #ffd875 !important;
  border-color: #665005 !important;
}

/* Generic Button Contrast in Dark Mode (Exclude custom status/chip/filter buttons) */
html[data-theme="dark"] [data-psnine-next] button:where(:not(.psnine-btn-primary):not(.psnine-btn-danger):not(.psnine-settings-close):not(.psnine-trophy-icon-chip):not(.psnine-trophy-chip):not(.psnine-score-filter-chip):not(#psnine-clear-score-filter-btn):not(#psnine-toggle-best-deal-btn):not(#psnine-toggle-cny-btn):not(.psnine-battle-bell-btn):not(#psnine-scrollbottom):not(#psnine-settings-gear):not(.psnine-filtered-tip-btn):not(.psnine-trophy-pill-btn)),
html[data-theme="dark"] button[data-psnine-next]:where(:not(.psnine-btn-primary):not(.psnine-btn-danger):not(.psnine-settings-close):not(.psnine-trophy-icon-chip):not(.psnine-trophy-chip):not(.psnine-score-filter-chip):not(#psnine-clear-score-filter-btn):not(#psnine-toggle-best-deal-btn):not(#psnine-toggle-cny-btn):not(.psnine-battle-bell-btn):not(#psnine-scrollbottom):not(#psnine-settings-gear):not(.psnine-filtered-tip-btn):not(.psnine-trophy-pill-btn)),
html[data-theme="dark"] .psnine-btn:where(:not(.psnine-btn-primary):not(.psnine-btn-danger)) {
  color: var(--p9n-text) !important;
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-btn.psnine-btn-primary,
html[data-theme="dark"] [data-psnine-next] button.psnine-btn-primary,
html[data-theme="dark"] button[data-psnine-next].psnine-btn-primary {
  color: #ffffff !important;
  background-color: var(--p9n-primary) !important;
  border-color: var(--p9n-primary) !important;
}
html[data-theme="dark"] .psnine-btn.psnine-btn-danger,
html[data-theme="dark"] [data-psnine-next] button.psnine-btn-danger,
html[data-theme="dark"] button[data-psnine-next].psnine-btn-danger {
  color: #ff6b6b !important;
  background-color: var(--p9n-surface-alt) !important;
  border-color: #ff6b6b !important;
}
html[data-theme="dark"] .psnine-settings-close {
  color: var(--p9n-muted) !important;
  background: transparent !important;
}
html[data-theme="dark"] .psnine-settings-close:hover {
  color: var(--p9n-text) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

/* Trophy Module Dark Mode */
html[data-theme="dark"] #psnine-trophy-tips-menu {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}
html[data-theme="dark"] #psnine-trophy-tips-trigger,
html[data-theme="dark"] button#psnine-trophy-tips-trigger,
html[data-theme="dark"] .o_btn.psnine-trophy-tips-btn {
  border: 1px solid darkslategray !important;
  border-color: darkslategray !important;
  color: var(--p9n-text) !important;
  background-color: var(--p9n-surface) !important;
}
html[data-theme="dark"] .psnine-trophy-panel {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-card-hd {
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-chart-section {
  background-color: transparent !important;
  border: none !important;
  border-top: 1px solid var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn,
html[data-theme="dark"] .psnine-pill-btn,
html[data-theme="dark"] .psnine-trophy-toolbar button {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn:hover:not(:disabled),
html[data-theme="dark"] .psnine-pill-btn:hover:not(:disabled),
html[data-theme="dark"] .psnine-trophy-toolbar button:hover:not(:disabled) {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-link) !important;
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn.active,
html[data-theme="dark"] .psnine-trophy-pill-btn[aria-pressed="true"],
html[data-theme="dark"] .psnine-pill-btn.active,
html[data-theme="dark"] .psnine-trophy-toolbar button.active,
html[data-theme="dark"] .psnine-trophy-toolbar button[aria-pressed="true"] {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-link) !important;
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn.danger,
html[data-theme="dark"] .psnine-trophy-pill-btn.psnine-btn-danger,
html[data-theme="dark"] .psnine-trophy-toolbar button.danger,
html[data-theme="dark"] .psnine-trophy-toolbar button.psnine-btn-danger {
  color: #ff6b6b !important;
  border-color: #ff6b6b !important;
  background-color: var(--p9n-surface) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn:disabled,
html[data-theme="dark"] .psnine-pill-btn:disabled,
html[data-theme="dark"] .psnine-trophy-toolbar button:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
}
html[data-theme="dark"] .psnine-trophy-preview-card,
html[data-theme="dark"] #psnine-trophy-preview-card {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-filtered-btn,
html[data-theme="dark"] .psnine-filtered-tip-btn {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-muted) !important;
}

/* Custom Status & Filter Buttons in Dark Mode */
/* 1. Trophy Icon Chip (Preserve earned green border) */
html[data-theme="dark"] .psnine-trophy-chip,
html[data-theme="dark"] .psnine-trophy-icon-chip {
  background-color: transparent !important;
}
html[data-theme="dark"] .psnine-trophy-chip.earned,
html[data-theme="dark"] .psnine-trophy-icon-chip.earned,
html[data-theme="dark"] .psnine-trophy-icon-chip[style*="#28a745"],
html[data-theme="dark"] .psnine-trophy-icon-chip[style*="rgb(40, 167, 69)"] {
  border-color: #28a745 !important;
}

/* 2. Review Score Filter Chip (Preserve selected orange status) */
html[data-theme="dark"] .psnine-score-filter-chip {
  background-color: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  color: var(--p9n-muted) !important;
}
html[data-theme="dark"] .psnine-score-filter-chip[style*="#ff9800"],
html[data-theme="dark"] .psnine-score-filter-chip[style*="rgb(255, 152, 0)"] {
  background-color: #ff9800 !important;
  border-color: #ff9800 !important;
  color: #ffffff !important;
}
html[data-theme="dark"] #psnine-clear-score-filter-btn {
  border-color: #ff9800 !important;
  background-color: rgba(255, 152, 0, 0.15) !important;
  color: #ffb74d !important;
}

/* 3. Deal Best Only Toggle Button (Preserve active red state) */
html[data-theme="dark"] #psnine-toggle-best-deal-btn {
  background-color: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] #psnine-toggle-best-deal-btn[style*="#da314b"],
html[data-theme="dark"] #psnine-toggle-best-deal-btn[style*="rgb(218, 49, 75)"] {
  background-color: #da314b !important;
  border-color: #da314b !important;
  color: #ffffff !important;
}

/* 4. Deal CNY Toggle Button (Preserve active green state) */
html[data-theme="dark"] #psnine-toggle-cny-btn {
  background-color: rgba(40, 167, 69, 0.15) !important;
  border: 1px solid #28a745 !important;
  color: #51cf66 !important;
}

/* 5. Battle Bell Monitor Button (Preserve active amber/gold state) */
html[data-theme="dark"] .psnine-battle-bell-btn {
  background-color: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  color: var(--p9n-muted) !important;
}
html[data-theme="dark"] .psnine-battle-bell-btn[style*="245, 159, 0"],
html[data-theme="dark"] .psnine-battle-bell-btn[style*="#f59f00"] {
  background-color: rgba(245, 159, 0, 0.2) !important;
  border-color: #f59f00 !important;
  color: #fbbf24 !important;
}

/* Toggle Switch Slider in Dark Mode */
html[data-theme="dark"] .psnine-slider {
  background-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-switch input:checked + .psnine-slider {
  background-color: #2ecc71 !important;
}

/* Traceback in Dark Mode */
html[data-theme="dark"] .psnine-traceback-card {
  background: var(--p9n-surface-alt) !important;
}
html[data-theme="dark"] .psnine-traceback-header {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-traceback-content {
  color: var(--p9n-muted) !important;
}

/* Plugin Panels & Low Contrast Container Fixes */
html[data-theme="dark"] #psnine-trophy-stats-panel,
html[data-theme="dark"] #psnine-trophy-preview-card,
html[data-theme="dark"] #psnine-enhanced-reviews-panel,
html[data-theme="dark"] #psnine-deals-controls-bar,
html[data-theme="dark"] #psnine-price-chart-container,
html[data-theme="dark"] #psnine-game-variants-section,
html[data-theme="dark"] #psnine-cross-version-tips-section {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Muted labels & counts in plugin panels */
html[data-theme="dark"] #psnine-trophy-header-counts,
html[data-theme="dark"] #psnine-fx-status,
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color:#666"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color: #666"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color:#888"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color: #888"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color:#555"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color: #555"],
html[data-theme="dark"] #psnine-trophy-preview-card [style*="color:#666"],
html[data-theme="dark"] #psnine-trophy-preview-card [style*="color: #666"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color:#666"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color: #666"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color:#888"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color: #888"],
html[data-theme="dark"] #psnine-deals-controls-bar [style*="color:#666"],
html[data-theme="dark"] #psnine-deals-controls-bar [style*="color: #666"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color:#666"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color: #666"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color:#888"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color: #888"],
html[data-theme="dark"] #psnine-game-variants-section [style*="color:#666"],
html[data-theme="dark"] #psnine-game-variants-section [style*="color: #666"],
html[data-theme="dark"] #psnine-cross-version-tips-section [style*="color:#666"],
html[data-theme="dark"] #psnine-cross-version-tips-section [style*="color: #666"] {
  color: var(--p9n-muted) !important;
}

/* Game List Progress Badge in Dark Mode */
html[data-theme="dark"] .psnine-game-list-progress-badge {
  background-color: var(--p9n-surface-alt, #202c3a) !important;
  color: var(--p9n-text, #e6ebf2) !important;
  border-color: var(--p9n-border, #3b4859) !important;
}

`;

  // src/features/global.ts
  function isDarkActive(ctx) {
    const { settings, window: win } = ctx;
    if (settings.autoNightMode === "SYSTEM") {
      if (typeof win.matchMedia === "function") {
        return win.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      return Boolean(settings.nightMode);
    }
    if (settings.autoNightMode === "TIME") {
      const hour = (/* @__PURE__ */ new Date()).getHours();
      const start = settings.nightStart ?? 19;
      const end = settings.nightEnd ?? 7;
      if (start > end) {
        return hour >= start || hour < end;
      } else {
        return hour >= start && hour < end;
      }
    }
    return Boolean(settings.nightMode);
  }
  function applyTheme(ctx) {
    const { document: doc } = ctx;
    const dark = isDarkActive(ctx);
    let styleEl = doc.getElementById("nightModeStyle");
    if (dark) {
      if (!styleEl) {
        styleEl = doc.createElement("style");
        styleEl.id = "nightModeStyle";
        styleEl.setAttribute("data-psnine-next", "theme");
        styleEl.textContent = DARK_THEME_STYLES;
        (doc.head || doc.documentElement).appendChild(styleEl);
      }
      if (doc.documentElement.getAttribute("data-theme") !== "dark") {
        doc.documentElement.setAttribute("data-theme", "dark");
      }
      if (doc.body && doc.body.getAttribute("data-theme") !== "dark") {
        doc.body.setAttribute("data-theme", "dark");
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
      if (doc.documentElement.hasAttribute("data-theme")) {
        doc.documentElement.removeAttribute("data-theme");
      }
      if (doc.body && doc.body.hasAttribute("data-theme")) {
        doc.body.removeAttribute("data-theme");
      }
    }
  }
  function enhanceMasks(ctx, root) {
    const { settings } = ctx;
    const marks = [];
    if (root instanceof Element && root.classList.contains("mark") && !root.hasAttribute("data-psnine-mask-ready")) {
      marks.push(root);
    }
    marks.push(...Array.from(root.querySelectorAll(".mark:not([data-psnine-mask-ready])")));
    marks.forEach((mark) => {
      mark.setAttribute("data-psnine-mask-ready", "true");
      mark.setAttribute("tabindex", "0");
      mark.setAttribute("title", settings.hoverUnmark ? "\u60AC\u6D6E\u6216\u70B9\u51FB\u63ED\u793A\u5267\u900F" : "\u70B9\u51FB\u63ED\u793A\u5267\u900F");
      if (settings.hoverUnmark) {
        mark.addEventListener("mouseenter", () => mark.classList.add("unmasked"));
        mark.addEventListener("mouseleave", () => {
          if (!mark.classList.contains("pinned")) {
            mark.classList.remove("unmasked");
          }
        });
      }
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        if (mark.classList.contains("pinned")) {
          mark.classList.remove("pinned");
          mark.classList.remove("unmasked");
        } else {
          mark.classList.add("pinned");
          mark.classList.add("unmasked");
        }
      });
      mark.addEventListener("keydown", (e) => {
        const keyboardEvent = e;
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          mark.classList.toggle("unmasked");
        }
      });
    });
  }
  function integrateFloatingLayer(doc) {
    const floatLayer = doc.querySelector(".float-layer");
    if (!floatLayer) return;
    const scrollBottomBtn = doc.getElementById("psnine-scrollbottom");
    if (scrollBottomBtn && scrollBottomBtn.parentElement !== floatLayer) {
      scrollBottomBtn.classList.add("float-btn");
      floatLayer.appendChild(scrollBottomBtn);
    }
    const gearBtn = doc.getElementById("psnine-settings-gear");
    if (gearBtn && gearBtn.parentElement !== floatLayer) {
      gearBtn.classList.add("float-btn");
      floatLayer.appendChild(gearBtn);
    }
  }
  function mountScrollBottom(ctx) {
    const { document: doc, window: win } = ctx;
    let btn = doc.getElementById("psnine-scrollbottom");
    if (!btn) {
      btn = doc.createElement("button");
      btn.id = "psnine-scrollbottom";
      btn.setAttribute("data-psnine-next", "scrollbottom");
      btn.setAttribute("type", "button");
      btn.setAttribute("title", "\u6EDA\u52A8\u5230\u5E95\u90E8");
      btn.setAttribute("aria-label", "\u6EDA\u52A8\u5230\u5E95\u90E8");
      btn.innerHTML = ICONS.arrowDown;
      btn.addEventListener("click", () => {
        const target = doc.getElementById("comment") || doc.querySelector(".content.pb10 textarea");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          win.scrollTo({ top: doc.body.scrollHeight, behavior: "smooth" });
        }
      });
      doc.body.appendChild(btn);
    }
    integrateFloatingLayer(doc);
  }
  function getShanghaiDateString() {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return formatter.format(/* @__PURE__ */ new Date());
    } catch {
      return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
  }
  async function handleAutoCheckIn(ctx) {
    const { document: doc, settings, store, userId } = ctx;
    if (!settings.autoCheckIn || !userId) return;
    const shanghaiDate = getShanghaiDateString();
    const attemptKey = `checkin_attempt:${userId}:${shanghaiDate}`;
    const alreadyAttempted = await store.get(attemptKey, false);
    if (alreadyAttempted) return;
    const signBtn = doc.querySelector('.float-btn.sign, a.yuan[href*="signin"], .nav-user a.yuan');
    if (signBtn) {
      const text = (signBtn.textContent || "").trim();
      if (text.includes("\u7B7E") && !text.includes("\u5DF2\u7B7E") && !signBtn.classList.contains("signed")) {
        await store.set(attemptKey, true);
        signBtn.click();
      }
    }
  }
  function fixLinks(ctx, root) {
    const { document: doc, settings, url: currentUrl } = ctx;
    const allAnchors = [];
    if (root instanceof HTMLAnchorElement) allAnchors.push(root);
    allAnchors.push(...Array.from(root.querySelectorAll("a[href]")));
    allAnchors.forEach((a) => {
      const rawHref = a.getAttribute("href");
      if (!rawHref) return;
      let parsed;
      try {
        parsed = new URL(rawHref, currentUrl);
      } catch {
        return;
      }
      const host = parsed.hostname.toLowerCase();
      if (settings.fixD7VGLinks && (host === "d7vg.com" || host === "www.d7vg.com")) {
        parsed.hostname = "psnine.com";
        if (settings.fixHTTPLinks) {
          parsed.protocol = "https:";
        }
        a.setAttribute("href", parsed.href);
        return;
      }
      if (settings.fixHTTPLinks && (host === "psnine.com" || host === "www.psnine.com")) {
        if (parsed.protocol === "http:") {
          parsed.protocol = "https:";
          a.setAttribute("href", parsed.href);
        }
      }
    });
    if (settings.fixTextLinks) {
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('a, script, style, textarea, input, pre, code, [contenteditable="true"], [data-psnine-next]')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const urlRegex = /(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-zA-Z0-9/])/g;
      const nodesToReplace = [];
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        if (urlRegex.test(textNode.nodeValue || "")) {
          nodesToReplace.push(textNode);
        }
        urlRegex.lastIndex = 0;
      }
      nodesToReplace.forEach((node) => {
        const text = node.nodeValue || "";
        const fragment = doc.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
          }
          const matchedUrl = match[0];
          const a = doc.createElement("a");
          a.href = matchedUrl;
          a.textContent = matchedUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          fragment.appendChild(a);
          lastIndex = match.index + matchedUrl.length;
        }
        if (lastIndex < text.length) {
          fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
        }
        node.replaceWith(fragment);
      });
    }
  }
  function applyNewestDefaultSort(ctx) {
    const { settings, url, window: win } = ctx;
    const isGeneList = url.pathname === "/gene" || url.pathname === "/gene/";
    const isQaList = url.pathname === "/qa" || url.pathname === "/qa/";
    if ((isGeneList || isQaList) && settings.listPostsByNew) {
      if (!url.searchParams.has("ob")) {
        const targetUrl = new URL(url.href);
        targetUrl.searchParams.set("ob", "date");
        win.location.replace(targetUrl.href);
      }
    }
  }
  var mountGlobal = (ctx) => {
    applyTheme(ctx);
    let themeObserver = null;
    if (typeof MutationObserver !== "undefined" && ctx.document.documentElement) {
      themeObserver = new MutationObserver(() => {
        const shouldBeDark = isDarkActive(ctx);
        const htmlTheme = ctx.document.documentElement.getAttribute("data-theme");
        const bodyTheme = ctx.document.body ? ctx.document.body.getAttribute("data-theme") : null;
        const hasStyle = Boolean(ctx.document.getElementById("nightModeStyle"));
        if (shouldBeDark) {
          if (htmlTheme !== "dark" || ctx.document.body && bodyTheme !== "dark" || !hasStyle) {
            applyTheme(ctx);
          }
        } else {
          if (htmlTheme !== null || bodyTheme !== null || hasStyle) {
            applyTheme(ctx);
          }
        }
      });
      themeObserver.observe(ctx.document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });
      if (ctx.document.body) {
        themeObserver.observe(ctx.document.body, {
          attributes: true,
          attributeFilter: ["data-theme"]
        });
      }
    }
    let mediaWatcher = null;
    const onMediaChange = () => applyTheme(ctx);
    if (typeof ctx.window.matchMedia === "function") {
      mediaWatcher = ctx.window.matchMedia("(prefers-color-scheme: dark)");
      if (mediaWatcher.addEventListener) {
        mediaWatcher.addEventListener("change", onMediaChange);
      } else if ("addListener" in mediaWatcher) {
        mediaWatcher.addListener(onMediaChange);
      }
    }
    const timer = ctx.window.setInterval(() => {
      if (ctx.settings.autoNightMode === "TIME") {
        applyTheme(ctx);
      }
    }, 6e4);
    enhanceMasks(ctx, ctx.document);
    mountScrollBottom(ctx);
    fixLinks(ctx, ctx.document.body || ctx.document);
    applyNewestDefaultSort(ctx);
    handleAutoCheckIn(ctx).catch((err) => ctx.report("autoCheckIn", err));
    const unsubs = ctx.onContent((root) => {
      enhanceMasks(ctx, root);
      fixLinks(ctx, root);
      integrateFloatingLayer(ctx.document);
    });
    return () => {
      unsubs();
      if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
      }
      ctx.window.clearInterval(timer);
      if (mediaWatcher) {
        if (mediaWatcher.removeEventListener) {
          mediaWatcher.removeEventListener("change", onMediaChange);
        } else if ("removeListener" in mediaWatcher) {
          mediaWatcher.removeListener(onMediaChange);
        }
      }
    };
  };

  // src/core/settings-ui.ts
  function resolveThemeMode(s) {
    if (s.autoNightMode === "SYSTEM") return "SYSTEM";
    if (s.autoNightMode === "TIME") return "TIME";
    if (s.autoNightMode === "OFF") {
      return s.nightMode ? "DARK" : "LIGHT";
    }
    return s.nightMode ? "DARK" : "SYSTEM";
  }
  function mountSettingsUI(ctx) {
    const { document: doc, window: win, store } = ctx;
    let previouslyFocused = null;
    let modalBackdrop = null;
    let onKeyDownHandler = null;
    let isSaving = false;
    let gearBtn = doc.getElementById("psnine-settings-gear");
    if (!gearBtn) {
      gearBtn = doc.createElement("button");
      gearBtn.id = "psnine-settings-gear";
      gearBtn.setAttribute("data-psnine-next", "gear");
      gearBtn.setAttribute("type", "button");
      gearBtn.setAttribute("title", "PSNINE \u8BBE\u7F6E");
      gearBtn.setAttribute("aria-label", "PSNINE \u8BBE\u7F6E");
      gearBtn.innerHTML = ICONS.gear;
      (doc.body || doc.documentElement).appendChild(gearBtn);
    }
    const injectNavMenu = () => {
      const targets = doc.querySelectorAll(".user-menu-list, .mobile-nav-panel nav, .nav-user .dropdown ul, .header .dropdown ul");
      targets.forEach((target) => {
        if (target.querySelector("[data-psnine-settings-trigger]")) {
          return;
        }
        const a = doc.createElement("a");
        a.href = "#";
        a.setAttribute("role", "button");
        a.setAttribute("data-psnine-next", "nav-link");
        a.setAttribute("data-psnine-settings-trigger", "true");
        a.className = "psnine-nav-settings-btn psnine-nav-settings-link";
        a.textContent = "\u63D2\u4EF6\u8BBE\u7F6E";
        const handleTrigger = (e) => {
          e.preventDefault();
          openSettingsModal();
        };
        a.addEventListener("click", handleTrigger);
        a.addEventListener("keydown", (e) => {
          if (e.key === " " || e.key === "Enter") {
            handleTrigger(e);
          }
        });
        if (target.tagName === "UL" || target.tagName === "OL") {
          const item = doc.createElement("li");
          item.setAttribute("data-psnine-next", "nav-item");
          item.appendChild(a);
          target.appendChild(item);
        } else {
          target.appendChild(a);
        }
      });
    };
    injectNavMenu();
    ctx.onContent(() => injectNavMenu());
    const closeSettingsModal = (force = false) => {
      if (isSaving && !force) return;
      if (modalBackdrop) {
        if (onKeyDownHandler) {
          doc.removeEventListener("keydown", onKeyDownHandler);
          onKeyDownHandler = null;
        }
        modalBackdrop.remove();
        modalBackdrop = null;
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          try {
            previouslyFocused.focus();
          } catch {
          }
        }
      }
    };
    const openSettingsModal = () => {
      if (modalBackdrop) return;
      isSaving = false;
      previouslyFocused = doc.activeElement;
      modalBackdrop = doc.createElement("div");
      modalBackdrop.className = "psnine-modal-backdrop";
      modalBackdrop.setAttribute("data-psnine-next", "modal");
      modalBackdrop.addEventListener("click", (e) => {
        if (isSaving) return;
        if (e.target === modalBackdrop) {
          closeSettingsModal();
        }
      });
      const dialog = doc.createElement("div");
      dialog.className = "psnine-settings-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "psnine-settings-title");
      const header = doc.createElement("div");
      header.className = "psnine-settings-header";
      header.innerHTML = `
      <h2 id="psnine-settings-title">PSNINE \u8BBE\u7F6E</h2>
      <button class="psnine-settings-close" type="button" aria-label="\u5173\u95ED\u8BBE\u7F6E\u9762\u677F">${ICONS.close}</button>
    `;
      const closeBtn = header.querySelector(".psnine-settings-close");
      closeBtn.addEventListener("click", () => {
        if (isSaving) return;
        closeSettingsModal();
      });
      const body = doc.createElement("div");
      body.className = "psnine-settings-body";
      if (store.backend === "MEMORY") {
        const banner = doc.createElement("div");
        banner.className = "psnine-settings-memory-warning";
        banner.setAttribute("data-psnine-next", "memory-warning");
        banner.textContent = "\u63D0\u793A\uFF1A\u5F53\u524D\u8FD0\u884C\u5728\u5185\u5B58\u4E34\u65F6\u5B58\u50A8\u6A21\u5F0F\uFF08\u6301\u4E45\u5316\u5B58\u50A8\u53D7\u9650\uFF09\uFF0C\u9875\u9762\u5237\u65B0\u540E\u4FEE\u6539\u7684\u8BBE\u7F6E\u53EF\u80FD\u4F1A\u4E22\u5931\u3002";
        body.appendChild(banner);
      }
      const current = { ...ctx.settings };
      let idCounter = 0;
      const createRow = (label, inputEl, inputId) => {
        const row = doc.createElement("div");
        row.className = "psnine-settings-row";
        const lbl = doc.createElement("label");
        lbl.className = "psnine-settings-label";
        lbl.htmlFor = inputId;
        lbl.textContent = label;
        row.appendChild(lbl);
        row.appendChild(inputEl);
        return row;
      };
      const createSection = (title, defaultOpen = false) => {
        const details = doc.createElement("details");
        details.className = "psnine-settings-section";
        if (defaultOpen) {
          details.open = true;
        }
        const summary = doc.createElement("summary");
        summary.className = "psnine-settings-summary";
        summary.textContent = title;
        details.appendChild(summary);
        const sectionBody = doc.createElement("div");
        sectionBody.className = "psnine-settings-section-body";
        details.appendChild(sectionBody);
        return { details, body: sectionBody };
      };
      const createSwitch = (key, label) => {
        const id = `psnine-setting-${key}-${++idCounter}`;
        const wrapper = doc.createElement("label");
        wrapper.className = "psnine-switch";
        wrapper.htmlFor = id;
        const checkbox = doc.createElement("input");
        checkbox.id = id;
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(current[key]);
        checkbox.addEventListener("change", () => {
          current[key] = checkbox.checked;
        });
        const slider = doc.createElement("span");
        slider.className = "psnine-slider";
        wrapper.appendChild(checkbox);
        wrapper.appendChild(slider);
        return createRow(label, wrapper, id);
      };
      const createNumberInput = (key, label, min = 0, max = 9999, step = 1) => {
        const id = `psnine-setting-${key}-${++idCounter}`;
        const input = doc.createElement("input");
        input.id = id;
        input.type = "number";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(current[key] ?? 0);
        input.addEventListener("change", () => {
          const val = parseFloat(input.value);
          if (!isNaN(val)) {
            current[key] = val;
          }
        });
        return createRow(label, input, id);
      };
      const createTextInput = (key, label) => {
        const id = `psnine-setting-${key}-${++idCounter}`;
        const input = doc.createElement("input");
        input.id = id;
        input.type = "text";
        const rawVal = current[key];
        input.value = Array.isArray(rawVal) ? rawVal.join(", ") : String(rawVal ?? "");
        input.addEventListener("change", () => {
          if (Array.isArray(current[key])) {
            current[key] = input.value.split(",").map((s) => s.trim()).filter(Boolean);
          } else {
            current[key] = input.value;
          }
        });
        return createRow(label, input, id);
      };
      const createColorInput = (key, label) => {
        const id = `psnine-setting-${key}-${++idCounter}`;
        const input = doc.createElement("input");
        input.id = id;
        input.type = "text";
        input.value = String(current[key] ?? "");
        input.addEventListener("change", () => {
          current[key] = input.value;
        });
        return createRow(label, input, id);
      };
      const s1 = createSection("1. \u5916\u89C2\u4E3B\u9898\u4E0E\u57FA\u7840", true);
      const initialThemeMode = resolveThemeMode(current);
      const themeSelect = doc.createElement("select");
      themeSelect.id = "psnine-setting-theme-mode";
      themeSelect.className = "psnine-settings-select";
      const themeOptions = [
        { label: "\u8DDF\u968F\u7CFB\u7EDF", value: "SYSTEM" },
        { label: "\u6D45\u8272", value: "LIGHT" },
        { label: "\u6DF1\u8272", value: "DARK" },
        { label: "\u5B9A\u65F6", value: "TIME" }
      ];
      for (const opt of themeOptions) {
        const optEl = doc.createElement("option");
        optEl.value = opt.value;
        optEl.textContent = opt.label;
        if (initialThemeMode === opt.value) {
          optEl.selected = true;
        }
        themeSelect.appendChild(optEl);
      }
      const startRow = createNumberInput("nightStart", "\u6DF1\u8272\u6A21\u5F0F\u5F00\u59CB\u5C0F\u65F6 (0~23)", 0, 23);
      const endRow = createNumberInput("nightEnd", "\u6DF1\u8272\u6A21\u5F0F\u7ED3\u675F\u5C0F\u65F6 (0~23)", 0, 23);
      const updateScheduleVisibility = (mode) => {
        const isTime = mode === "TIME";
        startRow.style.display = isTime ? "" : "none";
        startRow.hidden = !isTime;
        endRow.style.display = isTime ? "" : "none";
        endRow.hidden = !isTime;
      };
      themeSelect.addEventListener("change", () => {
        const mode = themeSelect.value;
        if (mode === "SYSTEM") {
          current.autoNightMode = "SYSTEM";
          current.nightMode = false;
        } else if (mode === "TIME") {
          current.autoNightMode = "TIME";
        } else if (mode === "DARK") {
          current.autoNightMode = "OFF";
          current.nightMode = true;
        } else if (mode === "LIGHT") {
          current.autoNightMode = "OFF";
          current.nightMode = false;
        }
        updateScheduleVisibility(mode);
      });
      updateScheduleVisibility(initialThemeMode);
      s1.body.appendChild(createRow("\u5916\u89C2", themeSelect, "psnine-setting-theme-mode"));
      s1.body.appendChild(startRow);
      s1.body.appendChild(endRow);
      s1.body.appendChild(createSwitch("hoverUnmark", "\u9ED1\u6761\u5267\u900F\u60AC\u6D6E/\u70B9\u51FB\u53CD\u767D"));
      body.appendChild(s1.details);
      const s2 = createSection("2. \u793E\u533A\u4E92\u52A8\u4E0E\u56DE\u5E16", false);
      s2.body.appendChild(createSwitch("replyTraceback", "\u697C\u5C42 @\u56DE\u590D\u5185\u5BB9\u56DE\u6EAF"));
      s2.body.appendChild(createSwitch("showReplyControls", "\u697C\u5C42\u56DE\u590D\u6309\u94AE\u5E38\u663E (\u5173\u95ED\u5219\u60AC\u6D6E\u663E\u793A)"));
      s2.body.appendChild(createSwitch("hoverHomepage", "\u5934\u50CF\u60AC\u6D6E/\u8F7B\u89E6\u5C55\u793A\u7528\u6237\u5361\u7247"));
      s2.body.appendChild(createColorInput("highlightBack", "\u697C\u4E3B\u9AD8\u4EAE\u80CC\u666F\u989C\u8272"));
      s2.body.appendChild(createColorInput("highlightFront", "\u697C\u4E3B\u9AD8\u4EAE\u6587\u5B57\u989C\u8272"));
      s2.body.appendChild(createTextInput("highlightSpecificID", "\u7279\u522B\u5173\u6CE8/\u7BA1\u7406\u9AD8\u4EAE\u7528\u6237ID (\u9017\u53F7\u5206\u9694)"));
      s2.body.appendChild(createColorInput("highlightSpecificBack", "\u7279\u5B9A\u7528\u6237\u9AD8\u4EAE\u80CC\u666F\u989C\u8272"));
      s2.body.appendChild(createColorInput("highlightSpecificFront", "\u7279\u5B9A\u7528\u6237\u9AD8\u4EAE\u6587\u5B57\u989C\u8272"));
      s2.body.appendChild(createNumberInput("hotTagThreshold", "\u70ED\u95E8\u8BDD\u9898\u56DE\u5E16\u9608\u503C", 1, 999));
      s2.body.appendChild(createSwitch("expandCollapsedSubcomments", "\u89C6\u53E3\u5185\u81EA\u52A8\u5C55\u5F00\u5B50\u8BC4\u8BBA"));
      body.appendChild(s2.details);
      const s3 = createSection("3. \u95EE\u7B54\u4E13\u533A", false);
      s3.body.appendChild(createSwitch("newQaStatus", "\u95EE\u7B54\u72B6\u6001\u56FE\u6807\u4E0E\u94DC\u677F\u60AC\u8D4F\u5C55\u793A"));
      s3.body.appendChild(createSwitch("showHiddenQASubReply", "\u5C55\u5F00\u95EE\u7B54\u6298\u53E0\u7684\u5B50\u56DE\u590D"));
      s3.body.appendChild(createSwitch("listQAAnswersByNew", "\u95EE\u7B54\u7B54\u6848\u6309\u6700\u65B0\u4F18\u5148\u6392\u5E8F"));
      s3.body.appendChild(createSwitch("showAllQAAnswers", "\u5168\u91CF\u8F7D\u5165\u6240\u6709\u95EE\u7B54\u56DE\u7B54"));
      body.appendChild(s3.details);
      const s4 = createSection("4. \u5C4F\u853D\u4E0E\u8FC7\u6EE4", false);
      s4.body.appendChild(createTextInput("blockList", "\u7528\u6237\u9ED1\u540D\u5355\u5217\u8868 (\u9017\u53F7\u5206\u9694)"));
      s4.body.appendChild(createTextInput("blockWordsList", "\u5173\u952E\u8BCD\u5C4F\u853D\u5217\u8868 (\u9017\u53F7\u5206\u9694)"));
      s4.body.appendChild(createSwitch("blockWordsRegex", "\u5C4F\u853D\u8BCD\u542F\u7528\u6B63\u5219\u8868\u8FBE\u5F0F"));
      body.appendChild(s4.details);
      const s5 = createSection("5. \u6E38\u620F\u3001\u5956\u676F\u4E0E\u7EA6\u6218", false);
      s5.body.appendChild(createSwitch("redirectToMine", "\u6E38\u620F\u9875\u81EA\u52A8\u8DF3\u8F6C\u81F3\u6211\u7684\u5956\u676F"));
      s5.body.appendChild(createNumberInput("filterNonePlatinumAlpha", "\u65E0\u767D\u91D1\u6E38\u620F\u5361\u7247\u900F\u660E\u5EA6 (0~1)", 0, 1, 0.05));
      s5.body.appendChild(createSwitch("platinumGlow", "\u767D\u91D1\u5956\u676F\u53D1\u5149\u5149\u6655\u7279\u6548"));
      s5.body.appendChild(createSwitch("referGameVariants", "\u5173\u8054\u6E38\u620F\u591A\u7248\u672C\u4FE1\u606F"));
      s5.body.appendChild(createSwitch("preferSearchForFindingVariants", "\u4F18\u5148\u641C\u7D22\u67E5\u627E\u540C\u6B3E\u7248\u672C"));
      s5.body.appendChild(createSwitch("removeHeaderInBattle", "\u7EA6\u6218\u9875\u9762\u9690\u85CF\u53D1\u8D77\u4EBA\u5934\u50CF"));
      s5.body.appendChild(createSwitch("showGameProgressInBattle", "\u7EA6\u6218\u9875\u9762\u5C55\u793A\u6211\u7684\u6E38\u620F\u5B8C\u6210\u5EA6"));
      s5.body.appendChild(createNumberInput("BattleInfoUpdateInterval", "\u7EA6\u6218\u4FE1\u606F\u5237\u65B0\u95F4\u9694 (\u6BEB\u79D2)", 6e4, 864e5, 6e4));
      body.appendChild(s5.details);
      const s6 = createSection("6. \u7FFB\u9875\u4E0E\u81EA\u52A8\u5316", false);
      s6.body.appendChild(createNumberInput("autoPaging", "\u5217\u8868\u81EA\u52A8\u5411\u540E\u7FFB\u9875\u6570 (0 \u4E3A\u5173\u95ED)", 0, 50));
      s6.body.appendChild(createSwitch("autoPagingInHomepage", "\u4E2A\u4EBA\u4E3B\u9875\u6E38\u620F\u5217\u8868\u81EA\u52A8\u7FFB\u9875"));
      s6.body.appendChild(createSwitch("listPostsByNew", "\u673A\u56E0\u5217\u8868\u9ED8\u8BA4\u6309\u6700\u65B0\u6392\u5E8F"));
      s6.body.appendChild(createSwitch("autoCheckIn", "\u6BCF\u65E5\u6253\u5F00\u7F51\u7AD9\u81EA\u52A8\u7B7E\u5230\u6253\u5361"));
      body.appendChild(s6.details);
      const s7 = createSection("7. \u94FE\u63A5\u4FEE\u590D\u4E0E\u6570\u6298\u6C47\u7387", false);
      s7.body.appendChild(createSwitch("fixTextLinks", "\u7EAF\u6587\u672C\u94FE\u63A5\u81EA\u52A8\u8F6C\u6362\u4E3A\u53EF\u70B9\u51FB\u8D85\u94FE\u63A5"));
      s7.body.appendChild(createSwitch("fixD7VGLinks", "\u65E7\u7248 D7VG \u57DF\u540D\u94FE\u63A5\u81EA\u52A8\u4FEE\u590D"));
      s7.body.appendChild(createSwitch("fixHTTPLinks", "\u7AD9\u5185\u94FE\u63A5\u81EA\u52A8\u5347\u7EA7\u81F3 HTTPS"));
      s7.body.appendChild(createSwitch("currencyConversion", "\u6570\u6298\u5916\u5E01\u6298\u7B97\u4EBA\u6C11\u5E01\u5C55\u793A"));
      s7.body.appendChild(createTextInput("exchangeRateDate", "\u6C47\u7387\u6709\u6548\u57FA\u51C6\u65E5\u671F (\u624B\u586B\uFF0C\u5982 2026-09-30)"));
      const ratesId = `psnine-setting-exchangeRates-${++idCounter}`;
      const ratesInput = doc.createElement("textarea");
      ratesInput.id = ratesId;
      ratesInput.className = "psnine-settings-textarea";
      ratesInput.value = JSON.stringify(current.exchangeRates || {}, null, 2);
      ratesInput.addEventListener("change", () => {
        try {
          const parsed = JSON.parse(ratesInput.value);
          if (typeof parsed === "object" && parsed !== null) {
            current.exchangeRates = parsed;
          }
        } catch {
        }
      });
      s7.body.appendChild(createRow("\u81EA\u5B9A\u4E49\u6C47\u7387\u8868 (JSON \u683C\u5F0F)", ratesInput, ratesId));
      body.appendChild(s7.details);
      const s8 = createSection("8. \u914D\u7F6E\u7BA1\u7406", false);
      const manageActions = doc.createElement("div");
      manageActions.className = "psnine-settings-actions";
      const exportBtn = doc.createElement("button");
      exportBtn.className = "psnine-btn";
      exportBtn.type = "button";
      exportBtn.textContent = "\u5BFC\u51FA\u914D\u7F6E";
      exportBtn.addEventListener("click", () => {
        const jsonStr = JSON.stringify(ctx.settings, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);
        const a = doc.createElement("a");
        a.href = blobUrl;
        a.download = `psnine-settings-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
      const importBtn = doc.createElement("button");
      importBtn.className = "psnine-btn";
      importBtn.type = "button";
      importBtn.textContent = "\u5BFC\u5165\u914D\u7F6E";
      importBtn.addEventListener("click", () => {
        if (isSaving) return;
        const input = doc.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
          if (isSaving) return;
          const file = input.files?.[0];
          if (file) {
            try {
              const text = await file.text();
              const parsed = JSON.parse(text);
              const validated = validateSettings(parsed);
              isSaving = true;
              saveBtn.disabled = true;
              cancelBtn.disabled = true;
              closeBtn.disabled = true;
              await store.set(SETTINGS_KEY, validated);
              Object.assign(ctx.settings, validated);
              try {
                applyTheme(ctx);
              } catch {
              }
              win.alert("\u914D\u7F6E\u5BFC\u5165\u6210\u529F\uFF01\u9875\u9762\u5373\u5C06\u5237\u65B0\u3002");
              closeSettingsModal(true);
              win.location.reload();
            } catch {
              isSaving = false;
              saveBtn.disabled = false;
              cancelBtn.disabled = false;
              closeBtn.disabled = false;
              win.alert("\u914D\u7F6E\u6587\u4EF6\u683C\u5F0F\u9519\u8BEF\uFF0C\u65E0\u6CD5\u89E3\u6790\uFF01");
            }
          }
        });
        input.click();
      });
      const resetBtn = doc.createElement("button");
      resetBtn.className = "psnine-btn psnine-btn-danger";
      resetBtn.type = "button";
      resetBtn.textContent = "\u6062\u590D\u9ED8\u8BA4";
      resetBtn.addEventListener("click", async () => {
        if (isSaving) return;
        if (win.confirm("\u786E\u5B9A\u5C06\u6240\u6709\u8BBE\u7F6E\u6062\u590D\u4E3A\u9ED8\u8BA4\u503C\u5417\uFF1F")) {
          isSaving = true;
          saveBtn.disabled = true;
          cancelBtn.disabled = true;
          closeBtn.disabled = true;
          try {
            await store.set(SETTINGS_KEY, defaultSettings);
            Object.assign(ctx.settings, defaultSettings);
            try {
              applyTheme(ctx);
            } catch {
            }
            closeSettingsModal(true);
            win.location.reload();
          } catch (err) {
            isSaving = false;
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            closeBtn.disabled = false;
            win.alert("\u6062\u590D\u9ED8\u8BA4\u8BBE\u7F6E\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1A" + (err instanceof Error ? err.message : String(err)));
          }
        }
      });
      manageActions.appendChild(exportBtn);
      manageActions.appendChild(importBtn);
      manageActions.appendChild(resetBtn);
      s8.body.appendChild(manageActions);
      body.appendChild(s8.details);
      const footer = doc.createElement("div");
      footer.className = "psnine-settings-footer";
      const saveBtn = doc.createElement("button");
      saveBtn.className = "psnine-btn psnine-btn-primary";
      saveBtn.type = "button";
      saveBtn.textContent = "\u4FDD\u5B58\u914D\u7F6E";
      const cancelBtn = doc.createElement("button");
      cancelBtn.className = "psnine-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "\u53D6\u6D88";
      saveBtn.addEventListener("click", async () => {
        if (isSaving) return;
        isSaving = true;
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        closeBtn.disabled = true;
        const originalSaveText = saveBtn.textContent;
        saveBtn.textContent = "\u4FDD\u5B58\u4E2D...";
        try {
          const validated = validateSettings(current);
          await store.set(SETTINGS_KEY, validated);
          Object.assign(ctx.settings, validated);
          try {
            applyTheme(ctx);
          } catch {
          }
          closeSettingsModal(true);
          win.location.reload();
        } catch (err) {
          isSaving = false;
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
          closeBtn.disabled = false;
          saveBtn.textContent = originalSaveText;
          win.alert("\u4FDD\u5B58\u8BBE\u7F6E\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1A" + (err instanceof Error ? err.message : String(err)));
        }
      });
      cancelBtn.addEventListener("click", () => {
        if (isSaving) return;
        closeSettingsModal();
      });
      footer.appendChild(saveBtn);
      footer.appendChild(cancelBtn);
      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      modalBackdrop.appendChild(dialog);
      (doc.body || doc.documentElement).appendChild(modalBackdrop);
      onKeyDownHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (isSaving) return;
          closeSettingsModal();
          return;
        }
        if (isSaving) {
          e.preventDefault();
          return;
        }
        if (e.key === "Tab") {
          const focusable = Array.from(dialog.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
          )).filter((el) => {
            return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
          });
          if (focusable.length === 0) {
            e.preventDefault();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (doc.activeElement === first || !dialog.contains(doc.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (doc.activeElement === last || !dialog.contains(doc.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };
      doc.addEventListener("keydown", onKeyDownHandler);
      closeBtn.focus();
    };
    if (!gearBtn.hasAttribute("data-psnine-bound")) {
      gearBtn.setAttribute("data-psnine-bound", "true");
      gearBtn.addEventListener("click", openSettingsModal);
    }
  }

  // src/core/dom.ts
  var REASONS_ATTR = "data-psnine-hidden-reasons";
  var NATIVE_HIDDEN_ATTR = "data-psnine-native-hidden";
  var ORIGINAL_DISPLAY_ATTR = "data-psnine-original-display";
  function setHidden(node, reason, hidden) {
    if (!node || !node.getAttribute) return;
    if (!node.hasAttribute(NATIVE_HIDDEN_ATTR)) {
      const isNativelyHidden = node.hidden || node.style && node.style.display === "none";
      node.setAttribute(NATIVE_HIDDEN_ATTR, isNativelyHidden ? "true" : "false");
      if (node.style && node.style.display && node.style.display !== "none") {
        node.setAttribute(ORIGINAL_DISPLAY_ATTR, node.style.display);
      }
    }
    const existingStr = node.getAttribute(REASONS_ATTR) || "";
    const reasons = new Set(existingStr.split(",").map((s) => s.trim()).filter(Boolean));
    if (hidden) {
      reasons.add(reason);
    } else {
      reasons.delete(reason);
    }
    if (reasons.size > 0) {
      node.setAttribute(REASONS_ATTR, Array.from(reasons).join(","));
      node.hidden = true;
      node.style.display = "none";
    } else {
      node.removeAttribute(REASONS_ATTR);
      const wasNativelyHidden = node.getAttribute(NATIVE_HIDDEN_ATTR) === "true";
      if (!wasNativelyHidden) {
        node.hidden = false;
        const origDisplay = node.getAttribute(ORIGINAL_DISPLAY_ATTR);
        if (origDisplay) {
          node.style.display = origDisplay;
        } else {
          node.style.removeProperty("display");
        }
      }
    }
  }
  function getHiddenReasons(node) {
    if (!node || !node.getAttribute) return [];
    const existingStr = node.getAttribute(REASONS_ATTR) || "";
    return existingStr.split(",").map((s) => s.trim()).filter(Boolean);
  }
  function isHiddenByReason(node, reason) {
    const reasons = getHiddenReasons(node);
    if (!reason) return reasons.length > 0;
    return reasons.includes(reason);
  }

  // src/features/community.ts
  function queryAllIncludingSelf(root, selector) {
    const list = [];
    if (root instanceof Element && root.matches(selector)) {
      list.push(root);
    }
    list.push(...Array.from(root.querySelectorAll(selector)));
    return list;
  }
  function getPageAuthor(doc, url) {
    const isTopic = url.pathname.startsWith("/topic/");
    const isGene = url.pathname.startsWith("/gene/");
    const isTrade = url.pathname.startsWith("/trade/");
    if (!isTopic && !isGene && !isTrade) return null;
    const pd10Header = doc.querySelector(".pd10");
    if (pd10Header && pd10Header.querySelector("h1")) {
      const authorLink = pd10Header.querySelector('.meta a[itemprop="author"], .meta a[href*="/psnid/"], .meta a.psnnode');
      if (authorLink && authorLink.textContent) {
        return authorLink.textContent.trim().toLowerCase();
      }
    }
    const headerAuthor = doc.querySelector('.header .meta a[itemprop="author"], .header .meta a[href*="/psnid/"], .header .meta a.psnnode');
    if (headerAuthor && headerAuthor.textContent) {
      return headerAuthor.textContent.trim().toLowerCase();
    }
    const postAuthor = doc.querySelector('.post .meta a[itemprop="author"]');
    if (postAuthor && postAuthor.textContent) {
      return postAuthor.textContent.trim().toLowerCase();
    }
    return null;
  }
  function applyUserHighlights(ctx, root) {
    const { document: doc, settings, url } = ctx;
    const authorId = getPageAuthor(doc, url);
    const specificIds = new Set((settings.highlightSpecificID || []).map((id) => id.toLowerCase().trim()));
    const userLinks = queryAllIncludingSelf(root, 'a.psnnode, .meta a[href*="/psnid/"]');
    userLinks.forEach((link) => {
      if (link.closest('[data-psnine-next="chrome"]')) return;
      const rawId = (link.textContent || "").trim().replace(/^@/, "");
      const lowerId = rawId.toLowerCase();
      if (!lowerId) return;
      if (authorId && lowerId === authorId && !link.parentElement?.querySelector(".psnine-author-badge")) {
        const badge = doc.createElement("span");
        badge.className = "psnine-author-badge";
        badge.setAttribute("data-psnine-next", "chrome");
        badge.textContent = "\u697C\u4E3B";
        badge.style.setProperty("background-color", settings.highlightBack || "#3890ff", "important");
        badge.style.setProperty("color", settings.highlightFront || "#ffffff", "important");
        badge.style.setProperty("padding", "1px 4px", "important");
        badge.style.setProperty("margin-left", "4px", "important");
        badge.style.setProperty("border-radius", "3px", "important");
        badge.style.setProperty("font-size", "11px", "important");
        link.after(badge);
      }
      if (specificIds.has(lowerId)) {
        link.style.setProperty("background-color", settings.highlightSpecificBack || "#d9534f", "important");
        link.style.setProperty("color", settings.highlightSpecificFront || "#ffffff", "important");
        link.style.setProperty("padding", "1px 5px", "important");
        link.style.setProperty("border-radius", "4px", "important");
      }
    });
  }
  function applyFloorNumbers(doc, root) {
    const allMainPosts = Array.from(doc.querySelectorAll(".post, ul.list > li:not(.sonlist li)"));
    let maxMainFloor = 0;
    allMainPosts.forEach((post) => {
      const badge = post.querySelector(":scope > .ml64 > .meta .psnine-floor-badge, :scope > .meta .psnine-floor-badge, :scope > div > .meta .psnine-floor-badge");
      if (badge && badge.textContent) {
        const num = parseInt(badge.textContent.replace("#", ""), 10);
        if (!isNaN(num) && num > maxMainFloor) {
          maxMainFloor = num;
        }
      }
    });
    allMainPosts.forEach((post) => {
      const meta = post.querySelector(":scope > .ml64 > .meta, :scope > .meta, :scope > div > .meta");
      if (meta && !meta.querySelector(".psnine-floor-badge")) {
        maxMainFloor++;
        post.setAttribute("data-psnine-floor", String(maxMainFloor));
        const badge = doc.createElement("span");
        badge.className = "psnine-floor-badge";
        badge.setAttribute("data-psnine-next", "chrome");
        badge.textContent = `#${maxMainFloor}`;
        badge.style.cssText = "color:#95a5a6; font-size:12px; margin-right:6px; font-weight:600;";
        meta.prepend(badge);
      }
      const mainFloorNum = post.getAttribute("data-psnine-floor") || post.querySelector(".psnine-floor-badge")?.textContent?.replace("#", "") || "1";
      const subLis = Array.from(post.querySelectorAll("ul.sonlist > li"));
      subLis.forEach((subLi, subIdx) => {
        const subMeta = subLi.querySelector(".meta");
        if (subMeta && !subMeta.querySelector(".psnine-subfloor-badge")) {
          const subfloorNum = `${mainFloorNum}-${subIdx + 1}`;
          subLi.setAttribute("data-psnine-subfloor", subfloorNum);
          const subBadge = doc.createElement("span");
          subBadge.className = "psnine-subfloor-badge";
          subBadge.setAttribute("data-psnine-next", "chrome");
          subBadge.textContent = `#${subfloorNum}`;
          subBadge.style.cssText = "color:#bdc3c7; font-size:11px; margin-right:4px;";
          subMeta.prepend(subBadge);
        }
      });
    });
  }
  function applyReplyTraceback(ctx, root) {
    if (!ctx.settings.replyTraceback) return;
    const { document: doc } = ctx;
    const allPosts = Array.from(doc.querySelectorAll(".post, ul.list > li:not(.sonlist li)"));
    allPosts.forEach((post, postIdx) => {
      const content = post.querySelector(".content");
      if (!content) return;
      const mentionLinks = queryAllIncludingSelf(content, 'a[href*="/psnid/"]:not([data-psnine-trace-bound])');
      mentionLinks.forEach((link) => {
        link.setAttribute("data-psnine-trace-bound", "true");
        const text = (link.textContent || "").trim();
        if (!text.startsWith("@")) return;
        const targetUser = text.replace(/^@/, "").toLowerCase();
        if (!targetUser) return;
        let matchedPost = null;
        for (let i = postIdx - 1; i >= 0; i--) {
          const prevPost = allPosts[i];
          const prevAuthor = prevPost.querySelector('.meta a.psnnode, .meta a[href*="/psnid/"]')?.textContent?.trim().toLowerCase();
          if (prevAuthor === targetUser) {
            matchedPost = prevPost;
            break;
          }
        }
        if (matchedPost) {
          const prevContentEl = matchedPost.querySelector(".content");
          const prevFloor = matchedPost.querySelector(".psnine-floor-badge")?.textContent || "";
          const avatarImgEl = matchedPost.querySelector('img[src*="avatar"], .post a.l img, a.l img');
          const card = doc.createElement("div");
          card.className = "psnine-traceback-card";
          card.setAttribute("data-psnine-next", "chrome");
          card.setAttribute("tabindex", "0");
          card.setAttribute("role", "button");
          card.setAttribute("title", "\u70B9\u51FB\u5E73\u6ED1\u8DF3\u8F6C\u5230\u5BF9\u5E94\u697C\u5C42");
          const header = doc.createElement("div");
          header.className = "psnine-traceback-header";
          if (avatarImgEl && avatarImgEl.src) {
            const avatar = doc.createElement("img");
            avatar.src = avatarImgEl.src;
            avatar.width = 16;
            avatar.height = 16;
            avatar.style.borderRadius = "50%";
            avatar.style.marginRight = "4px";
            header.appendChild(avatar);
          }
          const titleText = doc.createElement("span");
          titleText.textContent = `${text} ${prevFloor}`;
          header.appendChild(titleText);
          card.appendChild(header);
          const contentBody = doc.createElement("div");
          contentBody.className = "psnine-traceback-content";
          if (prevContentEl) {
            const clonedContent = prevContentEl.cloneNode(true);
            clonedContent.querySelectorAll(".psnine-traceback-card").forEach((c) => c.remove());
            clonedContent.querySelectorAll("[data-psnine-mask-ready]").forEach((m) => {
              m.removeAttribute("data-psnine-mask-ready");
              m.classList.remove("unmasked", "pinned");
            });
            contentBody.appendChild(clonedContent);
            enhanceMasks(ctx, contentBody);
          }
          card.appendChild(contentBody);
          const jumpToTarget = (e) => {
            const target = e.target;
            if (target && target.closest("a, button, input, .mark, .psnine-mask-ready")) {
              return;
            }
            e.stopPropagation();
            matchedPost?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (matchedPost instanceof HTMLElement) {
              matchedPost.style.outline = "2px solid #3498db";
              setTimeout(() => {
                matchedPost.style.outline = "";
              }, 1500);
            }
          };
          card.addEventListener("click", jumpToTarget);
          card.addEventListener("keydown", (e) => {
            const kb = e;
            if (kb.key === "Enter" || kb.key === " ") {
              const target = e.target;
              if (target && target.closest("a, button, input, .mark")) return;
              kb.preventDefault();
              jumpToTarget(e);
            }
          });
          link.after(card);
        }
      });
    });
  }
  function applyReplyControlsVisibility(ctx, root) {
    const { settings, window: win } = ctx;
    const isTouchDevice = typeof win.matchMedia === "function" && win.matchMedia("(pointer: coarse)").matches;
    const replyLinks = queryAllIncludingSelf(root, ".post .meta > span.r > a, ul.list > li .meta > span.r > a, .post a.r, ul.list > li a.r");
    replyLinks.forEach((link) => {
      if (isTouchDevice) {
        link.style.opacity = "1";
        return;
      }
      if (!settings.showReplyControls) {
        if (link.getAttribute("data-psnine-reply-control-ready")) return;
        link.setAttribute("data-psnine-reply-control-ready", "true");
        link.style.transition = "opacity 0.2s";
        link.style.opacity = "0";
        const parent = link.closest(".post, li");
        if (parent) {
          parent.addEventListener("mouseenter", () => {
            link.style.opacity = "1";
          });
          parent.addEventListener("mouseleave", () => {
            link.style.opacity = "0";
          });
          parent.addEventListener("focusin", () => {
            link.style.opacity = "1";
          });
          parent.addEventListener("focusout", () => {
            link.style.opacity = "0";
          });
        }
      } else {
        link.style.opacity = "1";
      }
    });
  }
  function applyBlocklist(ctx, root) {
    const { settings } = ctx;
    const blockedUsers = new Set((settings.blockList || []).map((u) => u.toLowerCase().trim()).filter(Boolean));
    if (blockedUsers.size === 0) return;
    const candidateContainers = queryAllIncludingSelf(root, ".post, ul.list > li:not(.sonlist li), .touchclick, table.list tr, .topic-row");
    candidateContainers.forEach((container) => {
      const authorEl = container.querySelector('.meta > a.psnnode, .meta a.psnnode:first-child, .meta a[href*="/psnid/"]:first-child, .author a, td:first-child a.psnnode');
      if (!authorEl) return;
      const author = (authorEl.textContent || "").trim().replace(/^@/, "").toLowerCase();
      const hrefAuthor = (authorEl.getAttribute("href")?.match(/\/psnid\/([a-zA-Z0-9_-]+)/)?.[1] || "").toLowerCase();
      if (blockedUsers.has(author) || blockedUsers.has(hrefAuthor)) {
        setHidden(container, "blocklist", true);
      }
    });
    const subcomments = queryAllIncludingSelf(root, "ul.sonlist > li");
    subcomments.forEach((subLi) => {
      const authorEl = subLi.querySelector('.meta > a.psnnode, a.psnnode:first-child, a[href*="/psnid/"]:first-child');
      if (!authorEl) return;
      const author = (authorEl.textContent || "").trim().replace(/^@/, "").toLowerCase();
      const hrefAuthor = (authorEl.getAttribute("href")?.match(/\/psnid\/([a-zA-Z0-9_-]+)/)?.[1] || "").toLowerCase();
      if (blockedUsers.has(author) || blockedUsers.has(hrefAuthor)) {
        setHidden(subLi, "blocklist", true);
      }
    });
    const sonlists = queryAllIncludingSelf(root, "ul.sonlist");
    sonlists.forEach((sonlist) => {
      const children = Array.from(sonlist.querySelectorAll(":scope > li"));
      const allHidden = children.length > 0 && children.every((li) => isHiddenByReason(li, "blocklist"));
      if (allHidden) {
        const markWrapper = sonlist.closest(".sonlistmark");
        if (markWrapper) {
          setHidden(markWrapper, "blocklist", true);
        } else {
          setHidden(sonlist, "blocklist", true);
        }
      }
    });
  }
  function applyKeywordFilter(ctx, root) {
    const { settings, document: doc } = ctx;
    const keywords = (settings.blockWordsList || []).map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) return;
    let regexes = [];
    if (settings.blockWordsRegex) {
      for (const k of keywords) {
        try {
          regexes.push(new RegExp(k, "i"));
        } catch {
          regexes.push(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
        }
      }
    }
    const subcomments = queryAllIncludingSelf(root, "ul.sonlist > li");
    subcomments.forEach((subLi) => {
      if (subLi.hasAttribute("data-psnine-keyword-checked")) return;
      subLi.setAttribute("data-psnine-keyword-checked", "true");
      const text = extractOwnText(subLi);
      const matched = testKeyword(text, keywords, regexes, settings.blockWordsRegex);
      if (matched) {
        setHidden(subLi, "keyword-block", true);
        const placeholder = createPlaceholder("li", matched, doc, subLi);
        subLi.before(placeholder);
      }
    });
    const items = queryAllIncludingSelf(root, ".post, ul.list > li:not(.sonlist li), .topic-row, table.list tr");
    items.forEach((item) => {
      if (item.hasAttribute("data-psnine-keyword-checked")) return;
      item.setAttribute("data-psnine-keyword-checked", "true");
      const text = extractOwnText(item, true);
      const matched = testKeyword(text, keywords, regexes, settings.blockWordsRegex);
      if (matched) {
        setHidden(item, "keyword-block", true);
        const tag = item.tagName.toLowerCase();
        const placeholder = createPlaceholder(tag === "tr" ? "tr" : tag === "li" ? "li" : "div", matched, doc, item);
        item.before(placeholder);
      }
    });
  }
  function testKeyword(text, keywords, regexes, isRegex) {
    if (isRegex) {
      for (const r of regexes) {
        if (r.test(text)) return r.source;
      }
    } else {
      const lower = text.toLowerCase();
      for (const k of keywords) {
        if (lower.includes(k.toLowerCase())) return k;
      }
    }
    return null;
  }
  function extractOwnText(el, excludeSonlist = false) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("[data-psnine-next]").forEach((c) => c.remove());
    if (excludeSonlist) {
      clone.querySelectorAll("ul.sonlist, .sonlistmark").forEach((s) => s.remove());
    }
    return clone.textContent || "";
  }
  function createPlaceholder(type, keyword, doc, originalEl) {
    if (type === "tr") {
      const tr = doc.createElement("tr");
      tr.className = "psnine-keyword-placeholder-row";
      tr.setAttribute("data-psnine-next", "chrome");
      const td = doc.createElement("td");
      td.setAttribute("colspan", "100%");
      td.style.cssText = "padding:6px 12px; background:rgba(0,0,0,0.03); color:#7f8c8d; font-size:12px;";
      const btn2 = doc.createElement("button");
      btn2.type = "button";
      btn2.style.cssText = "background:none; border:none; color:inherit; font:inherit; cursor:pointer; text-decoration:underline;";
      btn2.textContent = `[\u5DF2\u5C4F\u853D] \u8BE5\u884C\u5305\u542B\u5173\u952E\u8BCD "${keyword}" (\u70B9\u51FB\u67E5\u770B)`;
      btn2.addEventListener("click", (e) => {
        e.stopPropagation();
        setHidden(originalEl, "keyword-block", false);
        tr.remove();
      });
      td.appendChild(btn2);
      tr.appendChild(td);
      return tr;
    }
    const el = doc.createElement(type);
    el.className = "psnine-keyword-placeholder";
    el.setAttribute("data-psnine-next", "chrome");
    el.style.cssText = "padding:8px 12px; margin:4px 0; background:rgba(0,0,0,0.04); font-size:12px; color:#7f8c8d; border-radius:4px;";
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.style.cssText = "background:none; border:none; color:inherit; font:inherit; cursor:pointer; text-decoration:underline;";
    btn.textContent = `[\u5DF2\u5C4F\u853D] \u8BE5\u5185\u5BB9\u5305\u542B\u5173\u952E\u8BCD "${keyword}" (\u70B9\u51FB\u67E5\u770B)`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setHidden(originalEl, "keyword-block", false);
      el.remove();
    });
    el.appendChild(btn);
    return el;
  }
  function setupAvatarProfileCards(ctx, root) {
    if (!ctx.settings.hoverHomepage) return () => {
    };
    const { document: doc, http, url: currentUrl } = ctx;
    let activeCard = null;
    let activeAbortCtrl = null;
    let hideTimer = null;
    let showTimer = null;
    const closeActiveCard = () => {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (activeAbortCtrl) {
        activeAbortCtrl.abort();
        activeAbortCtrl = null;
      }
      if (activeCard) {
        activeCard.remove();
        activeCard = null;
      }
    };
    const scheduleHide = () => {
      if (showTimer) clearTimeout(showTimer);
      hideTimer = window.setTimeout(closeActiveCard, 350);
    };
    const cancelHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const showProfileCard = async (username, anchorEl) => {
      cancelHide();
      if (activeCard) {
        closeActiveCard();
      }
      activeAbortCtrl = new AbortController();
      const abortSignal = activeAbortCtrl.signal;
      const card = doc.createElement("div");
      card.className = "psnine-profile-card";
      card.setAttribute("data-psnine-next", "chrome");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", `${username} \u7684\u4E2A\u4EBA\u8D44\u6599`);
      card.style.cssText = "position:fixed; z-index:10000; background:#fff; color:#333; padding:12px; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,0.25); min-width:240px; max-width:320px; font-size:12px; border:1px solid #ddd;";
      card.addEventListener("mouseenter", cancelHide);
      card.addEventListener("mouseleave", scheduleHide);
      const loadingText = doc.createElement("div");
      loadingText.textContent = `\u6B63\u5728\u8F7D\u5165 ${username} \u7684\u8D44\u6599...`;
      card.appendChild(loadingText);
      doc.body.appendChild(card);
      activeCard = card;
      const rect = anchorEl.getBoundingClientRect();
      const cardHeight = 160;
      const cardWidth = 280;
      const top = Math.min(window.innerHeight - cardHeight - 10, Math.max(10, rect.bottom + 6));
      const left = Math.min(window.innerWidth - cardWidth - 10, Math.max(10, rect.left));
      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
      try {
        const profileUrl = new URL(`/psnid/${username}`, currentUrl.origin).href;
        const userDoc = await http.document(profileUrl, { ttl: 6e4, signal: abortSignal });
        if (abortSignal.aborted || card !== activeCard) return;
        card.innerHTML = "";
        const userHeader = doc.createElement("div");
        userHeader.style.cssText = "font-weight:bold; font-size:15px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;";
        const nameSpan = doc.createElement("span");
        nameSpan.textContent = username;
        userHeader.appendChild(nameSpan);
        const closeBtn = doc.createElement("button");
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", "\u5173\u95ED\u8D44\u6599\u5361\u7247");
        closeBtn.style.cssText = "background:none; border:none; cursor:pointer; color:#95a5a6; font-size:16px; padding:0 4px;";
        closeBtn.innerHTML = ICONS.close;
        closeBtn.addEventListener("click", closeActiveCard);
        userHeader.appendChild(closeBtn);
        card.appendChild(userHeader);
        const levelEl = userDoc.querySelector(".psninfo .text-level");
        const levelText = levelEl ? levelEl.textContent?.trim() : null;
        const rankEl = userDoc.querySelector(".psninfo .text-rank");
        const rankText = rankEl ? rankEl.textContent?.trim() : null;
        if (levelText || rankText) {
          const statsRow = doc.createElement("div");
          statsRow.style.cssText = "display:flex; gap:10px; align-items:center; margin-bottom:6px;";
          if (levelText) {
            const lvlSpan = doc.createElement("span");
            lvlSpan.style.cssText = "color:#f39c12; font-weight:bold; font-size:13px;";
            lvlSpan.textContent = levelText;
            statsRow.appendChild(lvlSpan);
          }
          if (rankText) {
            const rankSpan = doc.createElement("span");
            rankSpan.style.cssText = "color:#7f8c8d; font-size:11px;";
            rankSpan.textContent = `\u6392\u540D #${rankText}`;
            statsRow.appendChild(rankSpan);
          }
          card.appendChild(statsRow);
        }
        const psntrophyEl = userDoc.querySelector(".psntrophy");
        if (psntrophyEl) {
          const trophyRow = doc.createElement("div");
          trophyRow.style.cssText = "background:#f8f9fa; border-radius:4px; padding:4px 8px; margin:6px 0; font-size:11px; display:flex; gap:8px;";
          trophyRow.textContent = psntrophyEl.textContent?.trim() || "";
          card.appendChild(trophyRow);
        }
        const linkRow = doc.createElement("div");
        linkRow.style.cssText = "margin-top:8px; text-align:right; border-top:1px solid #f0f0f0; padding-top:6px;";
        const profileLink = doc.createElement("a");
        profileLink.href = profileUrl;
        profileLink.textContent = "\u8BBF\u95EE\u4E2A\u4EBA\u4E3B\u9875 \xBB";
        profileLink.style.cssText = "color:#3498db; font-size:11px; text-decoration:none; font-weight:600;";
        linkRow.appendChild(profileLink);
        card.appendChild(linkRow);
        const newRect = card.getBoundingClientRect();
        if (newRect.bottom > window.innerHeight) {
          card.style.top = `${Math.max(10, window.innerHeight - newRect.height - 10)}px`;
        }
      } catch {
        if (!abortSignal.aborted && card === activeCard) {
          card.textContent = "\u8D44\u6599\u52A0\u8F7D\u5931\u8D25";
        }
      }
    };
    const avatars = queryAllIncludingSelf(root, 'a.psnnode[href*="/psnid/"], a.l[href*="/psnid/"], .meta a[href*="/psnid/"]');
    avatars.forEach((link) => {
      if (link.getAttribute("data-psnine-card-ready")) return;
      link.setAttribute("data-psnine-card-ready", "true");
      const match = link.getAttribute("href")?.match(/\/psnid\/([a-zA-Z0-9_-]+)/);
      const username = match?.[1];
      if (!username) return;
      link.addEventListener("mouseenter", () => {
        cancelHide();
        showTimer = window.setTimeout(() => showProfileCard(username, link), 500);
      });
      link.addEventListener("mouseleave", scheduleHide);
      const triggerBtn = doc.createElement("button");
      triggerBtn.className = "psnine-profile-trigger";
      triggerBtn.setAttribute("data-psnine-next", "chrome");
      triggerBtn.type = "button";
      triggerBtn.style.cssText = "background:none; border:none; padding:0 2px; cursor:pointer; color:#7f8c8d; font-size:10px; vertical-align:middle;";
      triggerBtn.setAttribute("title", "\u67E5\u770B\u4E2A\u4EBA\u5361\u7247");
      triggerBtn.setAttribute("aria-label", `\u67E5\u770B ${username} \u8D44\u6599\u5361\u7247`);
      triggerBtn.textContent = "\u{1F464}";
      triggerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (activeCard) {
          closeActiveCard();
        } else {
          showProfileCard(username, triggerBtn);
        }
      });
      triggerBtn.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeActiveCard();
        }
      });
      link.after(triggerBtn);
    });
    return () => {
      closeActiveCard();
    };
  }
  function applyHotTags(ctx, root) {
    const { settings, document: doc } = ctx;
    const threshold = settings.hotTagThreshold ?? 20;
    const topics = queryAllIncludingSelf(root, ".topic-row, .list > li, table.list tr");
    topics.forEach((topic) => {
      const replyCountEl = topic.querySelector(".replies, a.rep, td.twoge em");
      let count = 0;
      if (replyCountEl && replyCountEl.textContent) {
        const parsed = parseInt(replyCountEl.textContent.trim(), 10);
        if (!isNaN(parsed)) count = parsed;
      } else {
        const metaSpan = topic.querySelector(".meta, span.r");
        if (metaSpan && metaSpan.textContent) {
          const match = metaSpan.textContent.match(/(\d+)\s*(?:条|回|回复)/);
          if (match && match[1]) {
            count = parseInt(match[1], 10);
          }
        }
      }
      if (count >= threshold && !topic.querySelector(".psnine-hot-badge")) {
        const titleLink = topic.querySelector(".title a, p.title a, td.title a, h4 a");
        if (titleLink) {
          const badge = doc.createElement("span");
          badge.className = "psnine-hot-badge";
          badge.setAttribute("data-psnine-next", "chrome");
          badge.textContent = "HOT";
          badge.style.cssText = "background:#e74c3c; color:#fff; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:3px; margin-left:6px; vertical-align:middle;";
          titleLink.after(badge);
        }
      }
    });
  }
  function applyQaStatusIcons(ctx, root) {
    if (!ctx.settings.newQaStatus || !ctx.url.pathname.startsWith("/qa")) return;
    const { document: doc } = ctx;
    const qaItems = queryAllIncludingSelf(root, "ul.list > li, .list > li");
    qaItems.forEach((node) => {
      const titleLink = node.querySelector("div.ml64 > p.title.font16 > a, .title a, p.title a");
      if (!titleLink || node.querySelector(".psnine-qa-status")) return;
      const statusSpan = node.querySelector("div.meta > .r > span:nth-child(2), .meta span.r span:last-child");
      const statusText = statusSpan ? statusSpan.textContent?.trim() : node.textContent || "";
      const wrapper = doc.createElement("span");
      wrapper.className = "psnine-qa-status";
      wrapper.setAttribute("data-psnine-next", "chrome");
      if (statusText?.includes("\u5DF2\u89E3\u51B3") || node.querySelector(".fa-check-circle")) {
        wrapper.innerHTML = `${ICONS.checkCircle} <span style="font-size:11px; color:#28a745; margin-right:4px;">\u5DF2\u89E3\u51B3</span>`;
        titleLink.before(wrapper);
      } else if (statusText?.includes("\u89E3\u51B3\u4E2D")) {
        wrapper.innerHTML = `<span style="font-size:11px; color:#3498db; font-weight:600; margin-right:4px;">[\u89E3\u51B3\u4E2D]</span>`;
        titleLink.before(wrapper);
      } else if (statusText?.includes("\u672A\u56DE\u7B54")) {
        wrapper.innerHTML = `<span style="font-size:11px; color:#95a5a6; margin-right:4px;">[\u672A\u56DE\u7B54]</span>`;
        titleLink.before(wrapper);
      }
      const rewardSpan = node.querySelector("div.meta > .r > span:nth-child(1), .meta span.r");
      if (rewardSpan && rewardSpan.textContent) {
        const match = rewardSpan.textContent.match(/悬赏(\d+)铜/);
        if (match && match[1] && !node.querySelector(".psnine-qa-bounty")) {
          const count = parseInt(match[1], 10);
          let color = "#7f8c8d";
          if (count > 30) color = "#f39c12";
          else if (count === 10) color = "#d35400";
          const bounty = doc.createElement("span");
          bounty.className = "psnine-qa-bounty";
          bounty.setAttribute("data-psnine-next", "chrome");
          bounty.style.cssText = "margin-left:6px; vertical-align:middle;";
          bounty.innerHTML = `${ICONS.coins} <span style="font-size:11px; color:${color}; font-weight:bold;">${count}</span>`;
          titleLink.after(bounty);
        }
      }
    });
  }
  function sortQAAnswersByNew(ctx, root) {
    if (!ctx.settings.listQAAnswersByNew || !ctx.url.pathname.startsWith("/qa/")) return;
    let answersContainer = null;
    if (root instanceof Element) {
      if (root.matches("ul.list:not(.sonlist)")) {
        answersContainer = root;
      } else {
        answersContainer = root.closest("ul.list:not(.sonlist)") || root.querySelector("ul.list:not(.sonlist)");
      }
    }
    if (!answersContainer) {
      answersContainer = ctx.document.querySelector("div.box.mt20 > ul.list:not(.sonlist), ul.list:not(.sonlist)");
    }
    if (!answersContainer) return;
    const answers = Array.from(answersContainer.querySelectorAll(":scope > li"));
    if (answers.length <= 1) return;
    let maxOrder = 0;
    answers.forEach((a) => {
      const existing = a.getAttribute("data-psnine-qa-orig-order");
      if (existing) {
        maxOrder = Math.max(maxOrder, parseInt(existing, 10));
      }
    });
    answers.forEach((a) => {
      if (!a.hasAttribute("data-psnine-qa-orig-order")) {
        maxOrder++;
        a.setAttribute("data-psnine-qa-orig-order", String(maxOrder));
      }
    });
    const sorted = [...answers].sort((a, b) => {
      const orderA = parseInt(a.getAttribute("data-psnine-qa-orig-order") || "0", 10);
      const orderB = parseInt(b.getAttribute("data-psnine-qa-orig-order") || "0", 10);
      return orderB - orderA;
    });
    const needsReorder = answers.some((el, idx) => el !== sorted[idx]);
    if (needsReorder) {
      sorted.forEach((a) => answersContainer.appendChild(a));
    }
  }
  function applyReverseSubReply(ctx, root) {
    const isTargetRoute = /(\/trophy\/\d+)|(\/psngame\/\d+\/comment)|(\/psnid\/.+?\/comment)/.test(ctx.url.pathname);
    if (!isTargetRoute) return;
    const blocks = [];
    if (root instanceof Element) {
      if (root.matches("div.sonlistmark")) {
        blocks.push(root);
      } else {
        const closest = root.closest("div.sonlistmark");
        if (closest) blocks.push(closest);
      }
    }
    blocks.push(...Array.from(root.querySelectorAll("div.sonlistmark")));
    blocks.forEach((block) => {
      const sonlist = block.querySelector(".sonlist");
      if (!sonlist) return;
      const items = Array.from(sonlist.querySelectorAll(":scope > li"));
      if (items.length <= 1) return;
      let maxSubOrder = 0;
      items.forEach((li) => {
        const ord = li.getAttribute("data-psnine-sub-order");
        if (ord) maxSubOrder = Math.max(maxSubOrder, parseInt(ord, 10));
      });
      items.forEach((li) => {
        if (!li.hasAttribute("data-psnine-sub-order")) {
          maxSubOrder++;
          li.setAttribute("data-psnine-sub-order", String(maxSubOrder));
        }
      });
      const sorted = [...items].sort((a, b) => {
        const ordA = parseInt(a.getAttribute("data-psnine-sub-order") || "0", 10);
        const ordB = parseInt(b.getAttribute("data-psnine-sub-order") || "0", 10);
        return ordB - ordA;
      });
      const needsReorder = items.some((el, idx) => el !== sorted[idx]);
      if (needsReorder) {
        sorted.forEach((li, i) => {
          li.style.borderTop = i === 0 ? "none" : "";
          sonlist.appendChild(li);
        });
      }
    });
  }
  function setupQaSubReplyExpansion(ctx, root) {
    if (!ctx.settings.showHiddenQASubReply || !ctx.url.pathname.startsWith("/qa/")) return;
    const buttons = queryAllIncludingSelf(root, "div.btn.btn-white.font12, .sonlistmark div.btn");
    buttons.forEach((btn) => {
      if (btn.hasAttribute("data-psnine-clicked")) return;
      const text = (btn.textContent || "").trim();
      if (/(查看|展开|余下|条回复)/.test(text)) {
        btn.setAttribute("data-psnine-clicked", "true");
        btn.click();
      }
    });
  }
  function setupViewportSubcommentsExpansion(ctx, root) {
    if (!ctx.settings.expandCollapsedSubcomments) return () => {
    };
    const isGameComment = ctx.url.pathname.includes("/psngame/") && ctx.url.pathname.includes("/comment");
    const isTrophy = ctx.url.pathname.startsWith("/trophy/");
    if (!isGameComment && !isTrophy) return () => {
    };
    const activeObservers = [];
    const commentMetas = queryAllIncludingSelf(root, "div.meta:not(.pb10)");
    commentMetas.forEach((meta) => {
      const subLink = meta.querySelector("span.r > a:last-of-type");
      if (!subLink) return;
      const text = (subLink.textContent || "").trim();
      if (!/^评论\(\d+\)/.test(text)) return;
      const parentLi = subLink.closest("li");
      if (parentLi && parentLi.querySelector("div.sonlistmark.ml64.mt10 > ul.sonlist > li")) {
        return;
      }
      if (subLink.hasAttribute("data-psnine-auto-expanded")) return;
      subLink.setAttribute("data-psnine-auto-expanded", "true");
      if (typeof IntersectionObserver !== "undefined") {
        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              subLink.click();
              obs.disconnect();
            }
          });
        }, { threshold: 0.1 });
        observer.observe(subLink);
        activeObservers.push(observer);
      }
    });
    return () => {
      activeObservers.forEach((obs) => obs.disconnect());
    };
  }
  var mountCommunity = (ctx) => {
    const cleanups = [];
    const enhance = (root) => {
      applyUserHighlights(ctx, root);
      applyFloorNumbers(ctx.document, root);
      applyReplyTraceback(ctx, root);
      applyReplyControlsVisibility(ctx, root);
      applyBlocklist(ctx, root);
      applyKeywordFilter(ctx, root);
      const cardCleanup = setupAvatarProfileCards(ctx, root);
      if (cardCleanup) cleanups.push(cardCleanup);
      applyHotTags(ctx, root);
      applyQaStatusIcons(ctx, root);
      sortQAAnswersByNew(ctx, root);
      applyReverseSubReply(ctx, root);
      setupQaSubReplyExpansion(ctx, root);
      const subCleanup = setupViewportSubcommentsExpansion(ctx, root);
      if (subCleanup) cleanups.push(subCleanup);
    };
    enhance(ctx.document.body || ctx.document);
    const unsubs = ctx.onContent((root) => {
      enhance(root);
    });
    return () => {
      unsubs();
      cleanups.forEach((c) => {
        try {
          c();
        } catch {
        }
      });
      cleanups.length = 0;
    };
  };

  // src/features/editor.ts
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function parseBBCode(rawText) {
    let html = escapeHtml(rawText);
    html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
    html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>");
    html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
    html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<del>$1</del>");
    html = html.replace(/\[(mask|mark)\]([\s\S]*?)\[\/\1\]/gi, '<span class="mark">$2</span>');
    html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align:center;">$1</div>');
    html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, "<blockquote>$1</blockquote>");
    html = html.replace(/\[color=([a-zA-Z#0-9]+)\]([\s\S]*?)\[\/color\]/gi, (match, color, content) => {
      if (/^[a-zA-Z]+$|^#[0-9a-fA-F]{3,6}$/.test(color)) {
        return `<span style="color:${color}">${content}</span>`;
      }
      return content;
    });
    html = html.replace(/\[img\](https?:\/\/[^\s<>"']+)\[\/img\]/gi, '<img src="$1" style="max-width:100%; border-radius:4px;">');
    html = html.replace(/\[url=(https?:\/\/[^\s<>"']+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
    html = html.replace(/\[url\](https?:\/\/[^\s<>"']+)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\r?\n/g, "<br>");
    return html;
  }
  function setupGeneWordCount(ctx, root) {
    const isGeneRoute = ctx.url.pathname.includes("/set/gene") || ctx.url.pathname.endsWith("/gene/new");
    const geneForm = root.querySelector('form[action*="/gene"], form#form-gene') || (isGeneRoute ? root.querySelector("form") : null);
    if (!geneForm) return;
    const textarea = geneForm.querySelector('textarea[name="content"], textarea#content');
    if (!textarea || textarea.getAttribute("data-psnine-gene-ready")) return;
    textarea.setAttribute("data-psnine-gene-ready", "true");
    const container = ctx.document.createElement("div");
    container.className = "psnine-gene-count-box";
    container.setAttribute("data-psnine-next", "chrome");
    container.style.cssText = "margin-top:6px; font-size:13px; color:#7f8c8d; font-weight:500;";
    textarea.after(container);
    const submitBtn = geneForm.querySelector('input[type="submit"], button[type="submit"]');
    const maxLimit = 600;
    let isOverLimit = false;
    const updateCount = () => {
      const cleanText = textarea.value.replace(/[\r\n]/g, "");
      const len = cleanText.length;
      isOverLimit = len > maxLimit;
      if (isOverLimit) {
        container.style.color = "#e74c3c";
        container.style.fontWeight = "bold";
        container.textContent = `\u673A\u56E0\u5B57\u6570: ${len} / ${maxLimit} (\u5DF2\u8D85\u9650\uFF0C\u65E0\u6CD5\u53D1\u8868)`;
      } else {
        container.style.color = "#7f8c8d";
        container.style.fontWeight = "500";
        container.textContent = `\u673A\u56E0\u5B57\u6570: ${len} / ${maxLimit}`;
      }
    };
    geneForm.addEventListener("submit", (e) => {
      if (isOverLimit) {
        e.preventDefault();
        e.stopPropagation();
        ctx.window.alert?.("\u673A\u56E0\u5B57\u6570\u8D85\u8FC7 600 \u5B57\u9650\u5236\uFF0C\u65E0\u6CD5\u53D1\u8868\uFF01");
      }
    }, true);
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        if (isOverLimit) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    }
    textarea.addEventListener("input", updateCount);
    updateCount();
  }
  function setupBBCodePreview(ctx, root) {
    const textarea = root.querySelector('textarea#content, textarea[name="content"]');
    if (!textarea || textarea.getAttribute("data-psnine-preview-ready")) return;
    textarea.setAttribute("data-psnine-preview-ready", "true");
    const previewBox = ctx.document.createElement("div");
    previewBox.id = "psnine-bbcode-preview";
    previewBox.setAttribute("data-psnine-next", "chrome");
    previewBox.style.cssText = "margin-top:10px; padding:12px; border:1px dashed #ccd6dd; border-radius:6px; min-height:40px; word-wrap:break-word; word-break:break-word; display:none;";
    const previewHeader = ctx.document.createElement("div");
    previewHeader.textContent = "\u5B9E\u65F6\u9884\u89C8 (BBCode)";
    previewHeader.style.cssText = "font-size:12px; color:#7f8c8d; font-weight:bold; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;";
    previewBox.appendChild(previewHeader);
    const previewContent = ctx.document.createElement("div");
    previewContent.className = "content";
    previewBox.appendChild(previewContent);
    textarea.after(previewBox);
    const updatePreview = () => {
      const val = textarea.value.trim();
      if (val.length === 0) {
        previewBox.style.display = "none";
        previewContent.innerHTML = "";
      } else {
        previewBox.style.display = "block";
        previewContent.innerHTML = parseBBCode(val);
        enhanceMasks(ctx, previewContent);
      }
    };
    textarea.addEventListener("input", updatePreview);
    if (textarea.value.trim().length > 0) {
      updatePreview();
    }
  }
  var mountEditor = (ctx) => {
    const enhance = (root) => {
      setupGeneWordCount(ctx, root);
      setupBBCodePreview(ctx, root);
    };
    enhance(ctx.document.body || ctx.document);
    const unsubs = ctx.onContent((root) => {
      enhance(root);
    });
    return () => {
      unsubs();
    };
  };

  // src/features/paging.ts
  function isSafeNextPageUrl(candidateUrl, currentUrl, allowedPath) {
    try {
      const parsed = new URL(candidateUrl, currentUrl.href);
      if (parsed.origin !== currentUrl.origin) return false;
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      const path = parsed.pathname.toLowerCase();
      if (path.startsWith("/set/") || path.startsWith("/signin") || path.startsWith("/trade/")) {
        return false;
      }
      const currentPath = (allowedPath || currentUrl.pathname).toLowerCase().replace(/\/$/, "");
      const cleanPath = path.replace(/\/$/, "");
      if (cleanPath !== currentPath) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  function getNextPageUrl(doc, currentUrl) {
    const pageAnchors = Array.from(doc.querySelectorAll('.page a, ul.page a, a[rel="next"], .page a.next'));
    for (const a of pageAnchors) {
      const text = (a.textContent || "").trim();
      if (text === "\u4E0B\u4E00\u9875" || text === ">" || text === "\xBB" || a.classList.contains("next") || a.getAttribute("rel") === "next") {
        const rawHref = a.getAttribute("href");
        if (rawHref && !rawHref.startsWith("javascript:") && rawHref !== "#") {
          if (isSafeNextPageUrl(rawHref, currentUrl)) {
            const parsed = new URL(rawHref, currentUrl.href);
            parsed.hash = "";
            return parsed.href;
          }
        }
      }
    }
    const currentItem = doc.querySelector(".page .current, ul.page li.current, .page li.active, ul.page li.active");
    if (currentItem) {
      const currentNum = parseInt(currentItem.textContent?.trim() || "0", 10);
      const parentLi = currentItem.closest("li") || currentItem;
      let nextSibling = parentLi.nextElementSibling;
      while (nextSibling) {
        if (nextSibling.classList.contains("disabled")) {
          nextSibling = nextSibling.nextElementSibling;
          continue;
        }
        const a = nextSibling.querySelector("a") || (nextSibling.tagName.toLowerCase() === "a" ? nextSibling : null);
        if (a) {
          const rawHref = a.getAttribute("href");
          if (rawHref && !rawHref.startsWith("javascript:") && rawHref !== "#") {
            const targetNum = parseInt(a.textContent?.trim() || "0", 10);
            if (!isNaN(currentNum) && !isNaN(targetNum) && targetNum > 0 && targetNum <= currentNum) {
              nextSibling = nextSibling.nextElementSibling;
              continue;
            }
            if (isSafeNextPageUrl(rawHref, currentUrl)) {
              const parsed = new URL(rawHref, currentUrl.href);
              parsed.hash = "";
              return parsed.href;
            }
          }
        }
        nextSibling = nextSibling.nextElementSibling;
      }
    }
    return null;
  }
  function getListContainer(doc, currentUrl) {
    const path = currentUrl.pathname;
    if (path.includes("/psngame/") && path.includes("/comment")) {
      const ul = doc.querySelector("div.box > ul.list:not(.sonlist), ul.list:not(.sonlist)");
      if (ul) return { container: ul, itemSelector: ":scope > li" };
      return null;
    }
    if (path === "/psngame" || path === "/psngame/" || /^\/psngame(?:\?.*)?$/.test(path + currentUrl.search)) {
      const plainTable = doc.querySelector("table.list tbody, table.list") || Array.from(doc.querySelectorAll("table")).find((t) => !t.classList.contains("tbl") && t.querySelector('a[href*="/psngame/"]'));
      if (plainTable) {
        const tbody = plainTable.querySelector("tbody") || plainTable;
        return { container: tbody, itemSelector: "tr" };
      }
    }
    if (path.startsWith("/dd")) {
      const ul = doc.querySelector("ul.dd_ul, ul.dd_box_ul, ul.list");
      if (ul) return { container: ul, itemSelector: ":scope > li" };
    }
    if (path.startsWith("/psnid/")) {
      const table = doc.querySelector("table.list tbody, table.list") || Array.from(doc.querySelectorAll("table")).find((t) => !t.classList.contains("tbl") && t.querySelector('a[href*="/psngame/"]'));
      if (table) {
        const tbody = table.querySelector("tbody") || table;
        return { container: tbody, itemSelector: "tr" };
      }
      const ul = doc.querySelector("ul.list:not(.sonlist)");
      if (ul) return { container: ul, itemSelector: ":scope > li" };
    }
    if (path.startsWith("/gene") || path.startsWith("/qa") || path.startsWith("/battle") || path.startsWith("/topic")) {
      const table = doc.querySelector("table.list tbody, table.list");
      if (table) {
        const tbody = table.querySelector("tbody") || table;
        return { container: tbody, itemSelector: "tr" };
      }
      const ul = doc.querySelector("ul.list:not(.sonlist), .genelist, .topiclist");
      if (ul) return { container: ul, itemSelector: ":scope > li" };
    }
    return null;
  }
  function getItemSignature(item) {
    if (item.id) return `id:${item.id}`;
    const dealLink = item.querySelector('.dd_title a[href*="/dd/"], a[href*="/dd/"]');
    if (dealLink) {
      const href = dealLink.getAttribute("href");
      if (href) return `deal:${href}`;
    }
    const gameLink = item.querySelector('td:first-child a[href*="/psngame/"], .title a[href*="/psngame/"]');
    if (gameLink) {
      const href = gameLink.getAttribute("href");
      if (href) return `game:${href}`;
    }
    const mainTitleLink = item.querySelector(".title a, p.title a, td.title a, h4 a");
    if (mainTitleLink) {
      const href = mainTitleLink.getAttribute("href");
      if (href) return `title:${href}`;
    }
    const floorAnchor = item.querySelector('a[name^="comment-"], a[name^="post-"], a[href*="#comment-"], a[href*="#post-"]');
    if (floorAnchor) {
      const name = floorAnchor.getAttribute("name") || floorAnchor.getAttribute("href");
      if (name) return `anchor:${name}`;
    }
    const clone = item.cloneNode(true);
    clone.querySelectorAll("[data-psnine-next]").forEach((c) => c.remove());
    const author = clone.querySelector('.meta a.psnnode, .meta a[href*="/psnid/"], .author a')?.textContent?.trim() || "";
    const timestamp = clone.querySelector(".meta .h-p, .meta .date, .time")?.textContent?.trim() || "";
    const textSample = (clone.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
    return `item:${author}:${timestamp}:${textSample}`;
  }
  function setupAutoPagination(ctx) {
    const { document: doc, window: win, url, settings, http } = ctx;
    const isHomepage = url.pathname.startsWith("/psnid/") && !url.pathname.includes("/comment");
    if (isHomepage && !settings.autoPagingInHomepage) {
      return () => {
      };
    }
    if (url.pathname.startsWith("/qa/") && settings.showAllQAAnswers) {
      return () => {
      };
    }
    const maxPages = settings.autoPaging ?? 0;
    if (maxPages <= 0) {
      return () => {
      };
    }
    let isMounted = true;
    let pagesLoaded = 0;
    let isLoading = false;
    let hasMore = true;
    let isStoppedByUser = false;
    let abortCtrl = null;
    const visitedUrls = /* @__PURE__ */ new Set();
    const cleanCurrentUrl = new URL(url.href);
    cleanCurrentUrl.hash = "";
    visitedUrls.add(cleanCurrentUrl.href);
    let nextUrl = getNextPageUrl(doc, url);
    let allowedPath = void 0;
    if (!nextUrl && isHomepage) {
      const allGamesLink = doc.querySelector(
        'a[href*="/psnid/"][href$="/psngame"], a[href*="/psngame"][href*="/psnid/"]'
      );
      if (allGamesLink) {
        const rawHref = allGamesLink.getAttribute("href");
        if (rawHref) {
          try {
            const parsed = new URL(rawHref, url.href);
            if (parsed.origin === url.origin) {
              allowedPath = parsed.pathname;
              nextUrl = parsed.href;
            }
          } catch {
          }
        }
      }
    }
    const containerInfo = getListContainer(doc, url);
    if (!containerInfo || !nextUrl) {
      return () => {
      };
    }
    const controlBar = doc.createElement("div");
    controlBar.id = "psnine-pagination-indicator";
    controlBar.setAttribute("data-psnine-next", "chrome");
    controlBar.style.cssText = "text-align:center; padding:16px; font-size:13px; color:#7f8c8d; display:none; user-select:none;";
    const statusText = doc.createElement("span");
    statusText.textContent = "\u6B63\u5728\u52A0\u8F7D\u4E0B\u4E00\u9875...";
    controlBar.appendChild(statusText);
    const stopBtn = doc.createElement("button");
    stopBtn.className = "psnine-btn";
    stopBtn.style.cssText = "margin-left:12px; font-size:12px; padding:2px 8px; min-height:24px; min-width:auto; cursor:pointer;";
    stopBtn.textContent = "\u505C\u6B62\u7FFB\u9875";
    stopBtn.addEventListener("click", () => {
      isStoppedByUser = true;
      if (abortCtrl) {
        abortCtrl.abort();
        abortCtrl = null;
      }
      controlBar.style.display = "none";
    });
    controlBar.appendChild(stopBtn);
    const paginationBar = doc.querySelector(".page, ul.page");
    if (paginationBar) {
      paginationBar.before(controlBar);
    } else {
      containerInfo.container.after(controlBar);
    }
    const loadNextPage = async () => {
      if (isLoading || !hasMore || !nextUrl || isStoppedByUser || !isMounted) return;
      if (maxPages > 0 && pagesLoaded >= maxPages) {
        controlBar.style.display = "block";
        statusText.innerHTML = `<span style="cursor:pointer; color:#3498db; text-decoration:underline;">\u5DF2\u52A0\u8F7D\u9884\u8BBE ${pagesLoaded} \u9875\uFF0C\u70B9\u51FB\u7EE7\u7EED\u52A0\u8F7D\u4E0B\u4E00\u9875</span>`;
        statusText.onclick = () => {
          statusText.onclick = null;
          pagesLoaded = 0;
          loadNextPage();
        };
        return;
      }
      const normalizedTarget = new URL(nextUrl, url.href);
      normalizedTarget.hash = "";
      if (visitedUrls.has(normalizedTarget.href)) {
        hasMore = false;
        controlBar.style.display = "none";
        return;
      }
      isLoading = true;
      controlBar.style.display = "block";
      statusText.textContent = `\u6B63\u5728\u81EA\u52A8\u52A0\u8F7D\u7B2C ${pagesLoaded + 1} \u9875...`;
      abortCtrl = new AbortController();
      const thisCtrl = abortCtrl;
      try {
        const targetUrlToFetch = normalizedTarget.href;
        const nextPageDoc = await http.document(targetUrlToFetch, { signal: thisCtrl.signal });
        if (thisCtrl.signal.aborted || isStoppedByUser || !isMounted) {
          return;
        }
        visitedUrls.add(targetUrlToFetch);
        const targetParsedUrl = new URL(targetUrlToFetch);
        const newContainerInfo = getListContainer(nextPageDoc, targetParsedUrl);
        if (!newContainerInfo) {
          hasMore = false;
          controlBar.style.display = "none";
          return;
        }
        const newItems = Array.from(newContainerInfo.container.querySelectorAll(newContainerInfo.itemSelector));
        if (newItems.length === 0) {
          hasMore = false;
          controlBar.style.display = "none";
          return;
        }
        const existingItems = Array.from(containerInfo.container.querySelectorAll(containerInfo.itemSelector));
        const existingSignatures = new Set(existingItems.map(getItemSignature));
        let appendedCount = 0;
        for (const item of newItems) {
          const sig = getItemSignature(item);
          if (existingSignatures.has(sig)) {
            continue;
          }
          existingSignatures.add(sig);
          const imported = doc.importNode(item, true);
          containerInfo.container.appendChild(imported);
          appendedCount++;
        }
        pagesLoaded++;
        nextUrl = getNextPageUrl(nextPageDoc, targetParsedUrl);
        if (!nextUrl) {
          hasMore = false;
          controlBar.style.display = "none";
        } else if (maxPages > 0 && pagesLoaded >= maxPages) {
          statusText.innerHTML = `<span style="cursor:pointer; color:#3498db; text-decoration:underline;">\u5DF2\u52A0\u8F7D\u9884\u8BBE ${pagesLoaded} \u9875\uFF0C\u70B9\u51FB\u7EE7\u7EED\u52A0\u8F7D\u4E0B\u4E00\u9875</span>`;
          statusText.onclick = () => {
            statusText.onclick = null;
            pagesLoaded = 0;
            loadNextPage();
          };
        } else {
          controlBar.style.display = "none";
        }
      } catch (err) {
        if (err?.name === "AbortError" || thisCtrl.signal.aborted) return;
        statusText.innerHTML = `<span style="color:#e74c3c; cursor:pointer;">\u52A0\u8F7D\u5931\u8D25\uFF0C\u70B9\u51FB\u91CD\u8BD5</span>`;
        statusText.onclick = () => {
          statusText.onclick = null;
          loadNextPage();
        };
        ctx.report("autoPaging", err);
      } finally {
        isLoading = false;
        if (abortCtrl === thisCtrl) {
          abortCtrl = null;
        }
      }
    };
    const onScroll = () => {
      if (isLoading || !hasMore || isStoppedByUser || !isMounted) return;
      const scrollBottom = win.scrollY + win.innerHeight;
      const triggerOffset = doc.body.scrollHeight - 600;
      if (scrollBottom >= triggerOffset) {
        loadNextPage();
      }
    };
    win.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      isMounted = false;
      win.removeEventListener("scroll", onScroll);
      if (abortCtrl) abortCtrl.abort();
      controlBar.remove();
    };
  }
  function setupLoadAllQAAnswers(ctx) {
    const { document: doc, url, settings, http } = ctx;
    if (!url.pathname.startsWith("/qa/")) return () => {
    };
    const paginationBar = doc.querySelector(".page, ul.page");
    const answersList = doc.querySelector("ul.list:not(.sonlist), div.box.mt20 > ul.list");
    if (!paginationBar || !answersList) return () => {
    };
    let btn = doc.getElementById("psnine-load-all-qa");
    if (btn) return () => {
    };
    btn = doc.createElement("button");
    btn.id = "psnine-load-all-qa";
    btn.className = "psnine-btn";
    btn.setAttribute("data-psnine-next", "chrome");
    btn.style.cssText = "margin:10px 0; font-size:12px; cursor:pointer; padding:4px 10px;";
    btn.textContent = "\u8F7D\u5165\u5168\u90E8\u7B54\u6848";
    paginationBar.before(btn);
    let isCancelled = false;
    let activeAbortCtrl = null;
    const maxPagesPerBatch = 20;
    const visited = /* @__PURE__ */ new Set();
    const initialUrl = new URL(url.href);
    initialUrl.hash = "";
    visited.add(initialUrl.href);
    let currentNext = getNextPageUrl(doc, url);
    const fetchRemainingPages = async () => {
      if (activeAbortCtrl) {
        activeAbortCtrl.abort();
        activeAbortCtrl = null;
        btn.textContent = "\u5DF2\u505C\u6B62\u8F7D\u5165 (\u70B9\u51FB\u7EE7\u7EED)";
        return;
      }
      if (!currentNext) {
        btn.textContent = "\u5DF2\u8F7D\u5165\u5168\u90E8\u56DE\u7B54";
        btn.disabled = true;
        if (paginationBar) paginationBar.style.display = "none";
        return;
      }
      const currentCtrl = new AbortController();
      activeAbortCtrl = currentCtrl;
      const signal = currentCtrl.signal;
      btn.textContent = "\u6B63\u5728\u5168\u91CF\u8F7D\u5165\u56DE\u7B54... (\u70B9\u51FB\u505C\u6B62)";
      let pagesCount = 0;
      const existingSignatures = new Set(
        Array.from(answersList.querySelectorAll(":scope > li")).map(getItemSignature)
      );
      try {
        while (currentNext && !visited.has(currentNext) && !signal.aborted && !isCancelled && pagesCount < maxPagesPerBatch) {
          const nextDoc = await http.document(currentNext, { signal });
          if (signal.aborted || isCancelled || activeAbortCtrl !== currentCtrl) {
            return;
          }
          visited.add(currentNext);
          pagesCount++;
          const newAnswers = Array.from(nextDoc.querySelectorAll("ul.list > li:not(.sonlist li)"));
          for (const li of newAnswers) {
            const sig = getItemSignature(li);
            if (existingSignatures.has(sig)) continue;
            existingSignatures.add(sig);
            answersList.appendChild(doc.importNode(li, true));
          }
          currentNext = getNextPageUrl(nextDoc, new URL(currentNext));
        }
        if (signal.aborted || isCancelled) {
          btn.textContent = "\u5DF2\u505C\u6B62\u8F7D\u5165 (\u70B9\u51FB\u7EE7\u7EED)";
          return;
        }
        if (!currentNext) {
          btn.textContent = "\u5DF2\u8F7D\u5165\u5168\u90E8\u56DE\u7B54";
          btn.disabled = true;
          if (paginationBar) paginationBar.style.display = "none";
        } else {
          btn.textContent = `\u5DF2\u8F7D\u5165\u524D ${pagesCount} \u9875\u56DE\u7B54\uFF0C\u70B9\u51FB\u7EE7\u7EED\u8F7D\u5165\u540E\u7EED`;
          if (paginationBar) paginationBar.style.display = "";
        }
      } catch (err) {
        if (err?.name === "AbortError" || signal.aborted) {
          btn.textContent = "\u5DF2\u505C\u6B62\u8F7D\u5165 (\u70B9\u51FB\u7EE7\u7EED)";
          return;
        }
        btn.textContent = "\u90E8\u5206\u7B54\u6848\u8F7D\u5165\u5931\u8D25\uFF0C\u70B9\u51FB\u91CD\u8BD5";
        ctx.report("showAllQAAnswers", err);
      } finally {
        if (activeAbortCtrl === currentCtrl) {
          activeAbortCtrl = null;
        }
      }
    };
    btn.addEventListener("click", fetchRemainingPages);
    if (settings.showAllQAAnswers) {
      fetchRemainingPages().catch((err) => ctx.report("showAllQAAnswers", err));
    }
    return () => {
      isCancelled = true;
      if (activeAbortCtrl) {
        activeAbortCtrl.abort();
        activeAbortCtrl = null;
      }
      btn?.remove();
    };
  }
  var mountPaging = (ctx) => {
    const cleanupAutoPaging = setupAutoPagination(ctx);
    const cleanupAllQA = setupLoadAllQAAnswers(ctx);
    return () => {
      cleanupAutoPaging();
      cleanupAllQA();
    };
  };

  // src/features/reviews.ts
  var SHANGHAI_OFFSET_MS = 8 * 3600 * 1e3;
  function isLeapYear(year) {
    return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
  }
  function getDaysInMonth(year, month) {
    if (month < 1 || month > 12) return 0;
    if (month === 2) {
      return isLeapYear(year) ? 29 : 28;
    }
    if (month === 4 || month === 6 || month === 9 || month === 11) {
      return 30;
    }
    return 31;
  }
  function getShanghaiDateParts(ms) {
    const d = new Date(ms + SHANGHAI_OFFSET_MS);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      // 1-12
      day: d.getUTCDate(),
      // 1-31
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes()
    };
  }
  function getShanghaiMonday(timestamp) {
    const d = new Date(timestamp + SHANGHAI_OFFSET_MS);
    const day = d.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const date = d.getUTCDate() - diffToMonday;
    return Date.UTC(year, month, date) - SHANGHAI_OFFSET_MS;
  }
  function parseP9Timestamp(text, nowMs = Date.now()) {
    const clean = text.trim();
    if (!clean) return null;
    if (clean.includes("\u521A\u521A")) {
      return nowMs;
    }
    const nowSh = getShanghaiDateParts(nowMs);
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
    const mdMatch = clean.match(/(?:^|[^\d])(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
    if (mdMatch) {
      const month = parseInt(mdMatch[1], 10);
      const day = parseInt(mdMatch[2], 10);
      const hour = parseInt(mdMatch[3], 10);
      const min = parseInt(mdMatch[4], 10);
      let year = nowSh.year;
      if (month > nowSh.month + 1) {
        year -= 1;
      }
      const maxDays = getDaysInMonth(year, month);
      if (month < 1 || month > 12 || day < 1 || day > maxDays || hour < 0 || hour > 23 || min < 0 || min > 59) {
        return null;
      }
      return Date.UTC(year, month - 1, day, hour - 8, min);
    }
    const dayMatch = clean.match(/(\d+)\s*天前/);
    if (dayMatch) {
      const d = parseInt(dayMatch[1], 10);
      if (isNaN(d) || d < 0) return null;
      return nowMs - d * 86400 * 1e3;
    }
    const hourMatch = clean.match(/(\d+)\s*小时前/);
    if (hourMatch) {
      const h = parseInt(hourMatch[1], 10);
      if (isNaN(h) || h < 0) return null;
      return nowMs - h * 3600 * 1e3;
    }
    const minMatch = clean.match(/(\d+)\s*分钟前/);
    if (minMatch) {
      const m = parseInt(minMatch[1], 10);
      if (isNaN(m) || m < 0) return null;
      return nowMs - m * 60 * 1e3;
    }
    const relDayMatch = clean.match(/(今天|昨天|前天)(?:\s*(\d{1,2}):(\d{1,2}))?/);
    if (relDayMatch) {
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
      let baseSh;
      if (relDayMatch[1] === "\u4ECA\u5929") {
        baseSh = nowSh;
      } else if (relDayMatch[1] === "\u6628\u5929") {
        baseSh = getShanghaiDateParts(nowMs - 86400 * 1e3);
      } else {
        baseSh = getShanghaiDateParts(nowMs - 2 * 86400 * 1e3);
      }
      if (hasTime) {
        return Date.UTC(baseSh.year, baseSh.month - 1, baseSh.day, h - 8, m);
      }
      if (relDayMatch[1] === "\u4ECA\u5929") return nowMs;
      if (relDayMatch[1] === "\u6628\u5929") return nowMs - 86400 * 1e3;
      return nowMs - 2 * 86400 * 1e3;
    }
    return null;
  }
  function getISOWeekInfo(timestamp) {
    const date = new Date(timestamp + SHANGHAI_OFFSET_MS);
    const day = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - day + 3);
    const firstThursday = date.getTime();
    date.setUTCMonth(0, 4);
    const dayOfWeek = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayOfWeek + 3);
    const weekNumber = 1 + Math.round((firstThursday - date.getTime()) / (7 * 864e5));
    const isoYear = new Date(firstThursday).getUTCFullYear();
    const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, "0")}`;
    return { year: isoYear, week: weekNumber, weekKey };
  }
  var TIME_REGEX = /\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{1,2})?|\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{1,2}|\d+\s*(?:天|小时|分钟)前|刚刚|(?:今天|昨天|前天)(?:\s+\d{1,2}:\d{1,2})?/;
  function extractReviewItems(doc) {
    const items = [];
    const commentElements = doc.querySelectorAll("ul.list > li, div.post");
    commentElements.forEach((el) => {
      const htmlEl = el;
      if (htmlEl.hasAttribute("data-psnine-next")) return;
      if (htmlEl.closest(".sonlist, .sonlistmark")) return;
      const mainContainer = htmlEl.querySelector(".ml64") || htmlEl;
      const ownMetas = Array.from(mainContainer.querySelectorAll(".meta")).filter(
        (m) => !m.closest(".sonlist, .sonlistmark")
      );
      let score = null;
      for (const meta of ownMetas) {
        const scoreSpan = meta.querySelector("span.alert-success, em.alert-success");
        if (scoreSpan) {
          const text = scoreSpan.textContent || "";
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
        const pScore = mainContainer.querySelector("p.text-success b");
        if (pScore && !pScore.closest(".sonlist, .sonlistmark")) {
          const text = pScore.textContent || "";
          const m = text.match(/评分\s*(\d+)/) || text.match(/^(\d+)$/);
          if (m) {
            const val = parseInt(m[1], 10);
            if (val >= 1 && val <= 10) score = val;
          }
        }
      }
      let timestamp = null;
      let timeStr = "";
      for (const meta of ownMetas) {
        const text = meta.textContent || "";
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
  function calculateReviewStats(items) {
    const scoredItems = items.filter((it) => it.score !== null);
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
    const itemsWithTime = scoredItems.filter((it) => it.timestamp !== null).sort((a, b) => a.timestamp - b.timestamp);
    const missingTimeCount = scoredItems.length - itemsWithTime.length;
    const cumulativeTrend = [];
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
    const weeklyHeatmap = [];
    if (itemsWithTime.length > 0) {
      const weekCountMap = /* @__PURE__ */ new Map();
      for (const it of itemsWithTime) {
        const { weekKey } = getISOWeekInfo(it.timestamp);
        weekCountMap.set(weekKey, (weekCountMap.get(weekKey) || 0) + 1);
      }
      const firstMonday = getShanghaiMonday(itemsWithTime[0].timestamp);
      const lastMonday = getShanghaiMonday(itemsWithTime[itemsWithTime.length - 1].timestamp);
      const ONE_WEEK_MS = 7 * 864e5;
      let curTime = firstMonday;
      const visitedWeeks = /* @__PURE__ */ new Set();
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
  function calculateGaussianPdf(x, mean, stdDev) {
    if (stdDev <= 1e-5) {
      return Math.abs(x - mean) < 0.5 ? 1 : 0;
    }
    const exponent = -((x - mean) * (x - mean)) / (2 * stdDev * stdDev);
    return 1 / (stdDev * Math.sqrt(2 * Math.PI)) * Math.exp(exponent);
  }
  function renderScoreDistributionSvg(stats, showNormalCurve, activeFilterScore) {
    const { distribution, maxScoreBucket, average, stdDev, scoredCount } = stats;
    if (scoredCount === 0) {
      return '<div class="psnine-empty-chart" style="padding:10px;color:#888;">\u6682\u65E0\u6709\u6548\u8BC4\u5206\u6837\u672C</div>';
    }
    const svgWidth = 460;
    const svgHeight = 200;
    const margin = { top: 20, right: 30, bottom: 35, left: 35 };
    const innerWidth = svgWidth - margin.left - margin.right;
    const innerHeight = svgHeight - margin.top - margin.bottom;
    const maxCount = Math.max(1, Math.max(...distribution));
    const barWidth = innerWidth / 10;
    let barsHtml = "";
    for (let s = 1; s <= 10; s++) {
      const count = distribution[s - 1];
      const barHeight = count / maxCount * innerHeight;
      const x = margin.left + (s - 1) * barWidth + 4;
      const y = margin.top + innerHeight - barHeight;
      const isMax = s === maxScoreBucket;
      const isSelected = activeFilterScore === s;
      const color = isSelected ? "#ff9800" : isMax ? "#da314b" : "#3890ff";
      const opacity = activeFilterScore === null || isSelected ? "1" : "0.35";
      barsHtml += `
      <g class="score-bar-group" data-score="${s}" style="cursor:pointer;" tabindex="0" role="button" aria-label="${s}\u5206: ${count}\u4EBA">
        <rect x="${x}" y="${y}" width="${barWidth - 8}" height="${Math.max(2, barHeight)}" rx="2" fill="${color}" fill-opacity="${opacity}">
          <title>${s}\u5206: ${count}\u4EBA (${(count / scoredCount * 100).toFixed(1)}%)</title>
        </rect>
        <text x="${x + (barWidth - 8) / 2}" y="${margin.top + innerHeight + 16}" text-anchor="middle" font-size="11" fill="currentColor">${s}</text>
        ${count > 0 ? `<text x="${x + (barWidth - 8) / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.8">${count}</text>` : ""}
      </g>
    `;
    }
    let normalCurveHtml = "";
    if (showNormalCurve && scoredCount > 1) {
      const points = [];
      const samples = 40;
      let maxPdf = 0;
      for (let i = 0; i <= samples; i++) {
        const xScore = 1 + i / samples * 9;
        const pdf = calculateGaussianPdf(xScore, average, stdDev);
        if (pdf > maxPdf) maxPdf = pdf;
      }
      if (maxPdf > 0 && !isNaN(maxPdf)) {
        for (let i = 0; i <= samples; i++) {
          const xScore = 1 + i / samples * 9;
          const pdf = calculateGaussianPdf(xScore, average, stdDev);
          const xPos = margin.left + (xScore - 1) * barWidth + (barWidth - 8) / 2;
          const yPos = margin.top + innerHeight - pdf / maxPdf * innerHeight;
          if (!isNaN(xPos) && !isNaN(yPos)) {
            points.push(`${xPos.toFixed(1)},${yPos.toFixed(1)}`);
          }
        }
        if (points.length > 1) {
          normalCurveHtml = `<polyline points="${points.join(" ")}" fill="none" stroke="#4caf50" stroke-width="2" stroke-dasharray="4,2" />`;
        }
      }
    }
    return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="psnine-score-svg" style="width:100%;height:auto;max-height:220px;user-select:none;font-family:inherit;">
      <desc>\u8BC4\u8BBA\u8BC4\u5206\u5206\u5E03\u76F4\u65B9\u56FE\uFF0C\u6A2A\u8F74\u4E3A1-10\u5206\uFF0C\u7EB5\u8F74\u4E3A\u8BC4\u4EF7\u4EBA\u6570</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      ${barsHtml}
      ${normalCurveHtml}
    </svg>
  `;
  }
  function renderTrendSvg(stats) {
    const { cumulativeTrend, missingTimeCount } = stats;
    if (cumulativeTrend.length < 2) {
      return '<div class="psnine-empty-chart" style="padding:10px;color:#888;">\u9700\u81F3\u5C11 2 \u6761\u6709\u6548\u65F6\u95F4\u6837\u672C\u751F\u6210\u8D70\u52BF\u56FE</div>';
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
    const points = [];
    const len = cumulativeTrend.length;
    for (let i = 0; i < len; i++) {
      const x = margin.left + (cumulativeTrend[i].time - firstTime) / timeSpan * innerWidth;
      const y = margin.top + innerHeight - (cumulativeTrend[i].cumAvg - minAvg) / ySpan * innerHeight;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const firstDate = new Date(firstTime + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
    const lastDate = new Date(lastTime + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
    return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="psnine-trend-svg" style="width:100%;height:auto;max-height:220px;user-select:none;font-family:inherit;">
      <desc>\u7D2F\u8BA1\u5747\u5206\u8D70\u52BF\u6298\u7EBF\u56FE\uFF0C\u4ECE ${firstDate} \u81F3 ${lastDate}</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <text x="${margin.left - 5}" y="${margin.top + 5}" text-anchor="end" font-size="10" fill="currentColor">${maxAvg}</text>
      <text x="${margin.left - 5}" y="${margin.top + innerHeight}" text-anchor="end" font-size="10" fill="currentColor">${minAvg}</text>
      <text x="${margin.left}" y="${margin.top + innerHeight + 16}" text-anchor="start" font-size="10" fill="currentColor">${firstDate}</text>
      <text x="${margin.left + innerWidth}" y="${margin.top + innerHeight + 16}" text-anchor="end" font-size="10" fill="currentColor">${lastDate}</text>
      <polyline points="${points.join(" ")}" fill="none" stroke="#3890ff" stroke-width="2.5" />
      <circle cx="${points[points.length - 1].split(",")[0]}" cy="${points[points.length - 1].split(",")[1]}" r="4" fill="#da314b">
        <title>\u5F53\u524D\u5747\u5206: ${cumulativeTrend[len - 1].cumAvg}</title>
      </circle>
    </svg>
    <details style="margin-top:4px;font-size:11px;color:#666;">
      <summary style="cursor:pointer;">\u67E5\u770B\u8D70\u52BF\u6570\u636E\u8868\u683C</summary>
      <div style="max-height:100px;overflow-y:auto;margin-top:4px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="border-bottom:1px solid #ddd;"><th style="text-align:left;">\u65E5\u671F</th><th style="text-align:right;">\u5F53\u6761\u8BC4\u5206</th><th style="text-align:right;">\u7D2F\u8BA1\u5747\u5206</th></tr>
          </thead>
          <tbody>
            ${cumulativeTrend.slice(-15).map((t) => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.05);"><td style="text-align:left;">${new Date(t.time + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10)}</td><td style="text-align:right;">${t.score}\u5206</td><td style="text-align:right;font-weight:500;">${t.cumAvg}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </details>
    ${missingTimeCount > 0 ? `<div style="font-size:11px;color:#888;text-align:right;padding-right:10px;margin-top:2px;">\u6CE8\uFF1A${missingTimeCount} \u6761\u8BC4\u4EF7\u65E0\u6709\u6548\u65F6\u95F4\u6233\u672A\u7EB3\u5165\u8D8B\u52BF</div>` : ""}
  `;
  }
  function renderWeeklyHeatmapSvg(stats) {
    const { weeklyHeatmap, scoredCount, missingTimeCount } = stats;
    if (weeklyHeatmap.length === 0) {
      return '<div class="psnine-empty-chart" style="padding:10px;color:#888;">\u6682\u65E0\u65F6\u95F4\u6570\u636E</div>';
    }
    const svgWidth = 460;
    const svgHeight = 180;
    const margin = { top: 15, right: 20, bottom: 35, left: 30 };
    const innerWidth = svgWidth - margin.left - margin.right;
    const innerHeight = svgHeight - margin.top - margin.bottom;
    const maxWeeklyCount = Math.max(1, Math.max(...weeklyHeatmap.map((w) => w.count)));
    const totalWeeks = weeklyHeatmap.length;
    const colWidth = innerWidth / totalWeeks;
    let barsHtml = "";
    for (let i = 0; i < totalWeeks; i++) {
      const w = weeklyHeatmap[i];
      const barHeight = w.count / maxWeeklyCount * innerHeight;
      const x = margin.left + i * colWidth;
      const y = margin.top + innerHeight - barHeight;
      barsHtml += `
      <rect x="${x + 1}" y="${y}" width="${Math.max(1, colWidth - 2)}" height="${Math.max(1, barHeight)}" fill="#20c997">
        <title>${w.weekKey}: ${w.count}\u6761\u8BC4\u8BBA</title>
      </rect>
    `;
    }
    const sampleCount = scoredCount - missingTimeCount;
    return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="psnine-weekly-svg" style="width:100%;height:auto;max-height:200px;user-select:none;font-family:inherit;">
      <desc>\u6BCF\u5468\u8BC4\u8BBA\u70ED\u5EA6\u67F1\u72B6\u56FE\uFF0C\u5305\u542B\u8DE8\u5E74\u7A7A\u5468</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <text x="${margin.left}" y="${margin.top + innerHeight + 16}" text-anchor="start" font-size="10" fill="currentColor">${weeklyHeatmap[0].weekKey}</text>
      <text x="${margin.left + innerWidth}" y="${margin.top + innerHeight + 16}" text-anchor="end" font-size="10" fill="currentColor">${weeklyHeatmap[totalWeeks - 1].weekKey}</text>
      <text x="${margin.left - 5}" y="${margin.top + 6}" text-anchor="end" font-size="10" fill="currentColor">${maxWeeklyCount}</text>
      ${barsHtml}
    </svg>
    <details style="margin-top:4px;font-size:11px;color:#666;">
      <summary style="cursor:pointer;">\u67E5\u770B\u6BCF\u5468\u70ED\u5EA6\u6570\u636E\u8868\u683C (${sampleCount} \u6761\u65F6\u95F4\u6837\u672C / ${totalWeeks} \u5468)</summary>
      <div style="max-height:100px;overflow-y:auto;margin-top:4px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="border-bottom:1px solid #ddd;"><th style="text-align:left;">\u5468 (ISO)</th><th style="text-align:right;">\u8BC4\u8BBA\u6570</th></tr>
          </thead>
          <tbody>
            ${weeklyHeatmap.map((w) => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.05);"><td style="text-align:left;">${w.weekKey}</td><td style="text-align:right;font-weight:500;">${w.count}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
  }
  var mountReviews = (ctx) => {
    const { document: doc, url, onContent, report } = ctx;
    if (!/^\/psngame\/\d+\/comment\/?$/.test(url.pathname)) {
      return;
    }
    try {
      let showNormalCurve = true;
      let activeFilterScore = null;
      let activeSubTab = "dist";
      let reviewItems = [];
      const containerId = "psnine-enhanced-reviews-panel";
      const applyFilterToItems = () => {
        for (const item of reviewItems) {
          if (activeFilterScore === null) {
            setHidden(item.element, "score-filter", false);
          } else {
            setHidden(item.element, "score-filter", item.score !== activeFilterScore);
          }
        }
      };
      const renderPanel = () => {
        reviewItems = extractReviewItems(doc);
        if (reviewItems.length === 0) return;
        const stats = calculateReviewStats(reviewItems);
        let container = doc.getElementById(containerId);
        if (!container) {
          container = doc.createElement("div");
          container.id = containerId;
          container.setAttribute("data-psnine-next", "true");
          container.style.cssText = "margin:15px 0;padding:12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.08);border-radius:8px;box-sizing:border-box;";
          const target = doc.querySelector("div.min-inner.mt40 div.box, .box");
          if (target) {
            const list = target.querySelector("ul.list");
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
            <span>\u{1F4CA} \u73A9\u5BB6\u8BC4\u6D4B\u4E0E\u5747\u5206\u7EDF\u8BA1</span>
            <span class="alert-success pd5" style="border-radius:4px;font-size:12px;padding:2px 8px;background:#5cb85c;color:#fff;">
              \u5747\u5206 ${stats.average} (${stats.scoredCount}\u4EBA\u6253\u5206 / \u5171${stats.totalLoaded}\u6761)
            </span>
          </div>
          <div data-psnine-next="true" style="display:flex;align-items:center;gap:6px;font-size:12px;">
            <button type="button" id="psnine-toggle-tab-btn" data-psnine-next="true" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;background:transparent;cursor:pointer;font-size:12px;">
              ${activeSubTab === "dist" ? "\u5207\u6362: \u6BCF\u5468\u70ED\u5EA6" : "\u5207\u6362: \u8BC4\u5206\u5206\u5E03"}
            </button>
            <button type="button" id="psnine-toggle-gaussian-btn" data-psnine-next="true" style="padding:4px 8px;border-radius:4px;border:1px solid #ccc;background:transparent;cursor:pointer;font-size:12px;">
              ${showNormalCurve ? "\u6B63\u6001\u66F2\u7EBF: \u5F00" : "\u6B63\u6001\u66F2\u7EBF: \u5173"}
            </button>
            ${activeFilterScore !== null ? `
              <button type="button" id="psnine-clear-score-filter-btn" data-psnine-next="true" style="padding:4px 8px;border-radius:4px;border:1px solid #ff9800;background:rgba(255,152,0,0.1);color:#e65100;cursor:pointer;font-weight:500;">
                \u6E05\u9664 ${activeFilterScore}\u5206 \u7B5B\u9009
              </button>
            ` : ""}
          </div>
        </div>

        <div data-psnine-next="true" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;align-items:center;">
          <span style="font-size:12px;color:#666;">\u5FEB\u6377\u5206\u6BB5\u7B5B\u9009:</span>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => {
          const count = stats.distribution[s - 1];
          const isSel = activeFilterScore === s;
          return `
              <button type="button" class="psnine-score-filter-chip" data-psnine-next="true" data-score="${s}" style="padding:2px 6px;font-size:11px;border-radius:3px;border:1px solid ${isSel ? "#ff9800" : "#ddd"};background:${isSel ? "#ff9800" : "rgba(0,0,0,0.03)"};color:${isSel ? "#fff" : "inherit"};cursor:pointer;">
                ${s}\u5206 (${count})
              </button>
            `;
        }).join("")}
        </div>

        <div data-psnine-next="true" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;">
          <div data-psnine-next="true" style="background:rgba(255,255,255,0.03);border-radius:6px;padding:8px;border:1px solid rgba(0,0,0,0.04);">
            <div style="font-size:12px;font-weight:500;margin-bottom:4px;color:#666;">
              ${activeSubTab === "dist" ? `\u8BC4\u5206\u5206\u5E03\u76F4\u65B9\u56FE ${showNormalCurve ? "(\u542B\u6B63\u6001\u62DF\u5408)" : ""}` : "\u6BCF\u5468\u8BC4\u5206\u70ED\u5EA6\u8D8B\u52BF (\u542B\u7A7A\u5468\u8865\u96F6)"}
            </div>
            <div id="psnine-score-dist-container" data-psnine-next="true">
              ${activeSubTab === "dist" ? renderScoreDistributionSvg(stats, showNormalCurve, activeFilterScore) : renderWeeklyHeatmapSvg(stats)}
            </div>
          </div>
          <div data-psnine-next="true" style="background:rgba(255,255,255,0.03);border-radius:6px;padding:8px;border:1px solid rgba(0,0,0,0.04);">
            <div style="font-size:12px;font-weight:500;margin-bottom:4px;color:#666;">\u7D2F\u8BA1\u5747\u5206\u8D70\u52BF</div>
            <div id="psnine-trend-container" data-psnine-next="true">${renderTrendSvg(stats)}</div>
          </div>
        </div>
      `;
        const tabBtn = doc.getElementById("psnine-toggle-tab-btn");
        if (tabBtn) {
          tabBtn.onclick = () => {
            activeSubTab = activeSubTab === "dist" ? "weekly" : "dist";
            renderPanel();
          };
        }
        const gaussianBtn = doc.getElementById("psnine-toggle-gaussian-btn");
        if (gaussianBtn) {
          gaussianBtn.onclick = () => {
            showNormalCurve = !showNormalCurve;
            renderPanel();
          };
        }
        const clearFilterBtn = doc.getElementById("psnine-clear-score-filter-btn");
        if (clearFilterBtn) {
          clearFilterBtn.onclick = () => {
            applyScoreFilter(null);
          };
        }
        container.querySelectorAll(".score-bar-group, .psnine-score-filter-chip").forEach((el) => {
          const btn = el;
          const trigger = () => {
            const s = parseInt(btn.getAttribute("data-score") || "0", 10);
            if (s >= 1 && s <= 10) {
              applyScoreFilter(activeFilterScore === s ? null : s);
            }
          };
          btn.onclick = trigger;
          btn.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              trigger();
            }
          };
        });
        applyFilterToItems();
      };
      const applyScoreFilter = (score) => {
        activeFilterScore = score;
        renderPanel();
      };
      renderPanel();
      const unsubscribe = onContent((root) => {
        if (root instanceof HTMLElement) {
          if (root.hasAttribute("data-psnine-next") || root.closest?.("[data-psnine-next]")) {
            return;
          }
          const isOrContainsReview = root.matches?.("ul.list > li, div.post") || root.querySelector?.("ul.list > li, div.post") !== null;
          if (!isOrContainsReview) {
            return;
          }
        }
        const freshItems = extractReviewItems(doc);
        if (freshItems.length === reviewItems.length && freshItems.every((it, i) => it.element === reviewItems[i]?.element && it.score === reviewItems[i]?.score && it.timestamp === reviewItems[i]?.timestamp)) {
          return;
        }
        renderPanel();
      });
      return () => {
        unsubscribe();
        const container = doc.getElementById(containerId);
        if (container) container.remove();
        for (const it of reviewItems) {
          setHidden(it.element, "score-filter", false);
        }
      };
    } catch (err) {
      report("reviews", err);
    }
  };

  // src/features/trophies.ts
  var SHANGHAI_OFFSET_MS2 = 8 * 3600 * 1e3;
  function extractTrophyType(row) {
    const tCell = row.querySelector("td.t1, td.t2, td.t3, td.t4");
    if (tCell) {
      if (tCell.classList.contains("t1")) return "platinum";
      if (tCell.classList.contains("t2")) return "gold";
      if (tCell.classList.contains("t3")) return "silver";
      if (tCell.classList.contains("t4")) return "bronze";
    }
    const text = row.textContent || "";
    if (row.querySelector(".text-platinum") || text.includes("\u767D\u91D1")) return "platinum";
    if (row.querySelector(".text-gold") || text.includes("\u91D1\u676F") || text.includes("\uFF08\u91D1\uFF09")) return "gold";
    if (row.querySelector(".text-silver") || text.includes("\u94F6\u676F") || text.includes("\uFF08\u94F6\uFF09")) return "silver";
    return "bronze";
  }
  function parseRarityPercent(td) {
    if (!td) return 100;
    const text = td.textContent || "";
    const m = text.match(/([\d.]+)%/);
    return m ? parseFloat(m[1]) : 100;
  }
  function parseTrophyRows(doc, isPersonalPage) {
    const items = [];
    const tables = doc instanceof Element && doc.matches("table.list") ? [doc] : Array.from(doc.querySelectorAll("table.list"));
    tables.forEach((tbl) => {
      const tableEl = tbl;
      const rows = Array.from(tableEl.querySelectorAll("tr")).filter(
        (r) => r.classList.contains("trophy") || r.id && !isNaN(Number(r.id))
      );
      let maxPersistentSeq = -1;
      rows.forEach((r) => {
        if (r.hasAttribute("data-psnine-orig-seq")) {
          const val = parseInt(r.getAttribute("data-psnine-orig-seq") || "0", 10);
          if (!isNaN(val) && val > maxPersistentSeq) {
            maxPersistentSeq = val;
          }
        }
      });
      rows.forEach((r, idx) => {
        const row = r;
        if (row.classList.contains("psnine-inline-tip-row") || row.hasAttribute("data-psnine-next")) return;
        let originalIndex;
        if (row.hasAttribute("data-psnine-orig-seq")) {
          originalIndex = parseInt(row.getAttribute("data-psnine-orig-seq") || "0", 10);
        } else {
          if (maxPersistentSeq === -1) {
            originalIndex = idx;
            maxPersistentSeq = idx;
          } else {
            maxPersistentSeq++;
            originalIndex = maxPersistentSeq;
          }
          row.setAttribute("data-psnine-orig-seq", String(originalIndex));
        }
        const link = row.querySelector('td:nth-child(2) a[href*="/trophy/"], td:not(:first-child) a[href*="/trophy/"]');
        const href = link?.href || link?.getAttribute("href") || "";
        const mId = href.match(/\/trophy\/(\d+)/);
        const trophyId = mId ? mId[1] : `seq_${originalIndex}`;
        const name = link?.textContent?.trim() || "\u5956\u676F";
        const descEl = row.querySelector("td.pd15 p, td:nth-child(2) div.text-strong, td:nth-child(2) em.mt10, td div.mt10, td p:last-child");
        const description = descEl?.textContent?.trim() || "";
        const img = row.querySelector("img.imgbg, img");
        const iconSrc = img?.getAttribute("src") || "";
        const type = extractTrophyType(row);
        const rarityTd = row.querySelector("td.twoge, td:last-child");
        const rarityPercent = parseRarityPercent(rarityTd);
        let status = "unknown";
        let earnedTimestamp = null;
        let earnedTimeStr = "";
        if (isPersonalPage) {
          const timeEm = row.querySelector("em.alert-success.pd5.r, em.lh180.alert-success.pd5.r, em.alert-success.r");
          const hasEarnedImg = row.querySelector("img.imgbg.earned, img.earned") !== null;
          if (timeEm || hasEarnedImg) {
            status = "earned";
            if (timeEm) {
              const clone = timeEm.cloneNode(true);
              clone.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
              const rawTime = clone.textContent?.trim() || "";
              const tipsYear = timeEm.getAttribute("tips") || "";
              const yMatch = tipsYear.match(/(\d{4})/);
              const yearStr = yMatch ? `${yMatch[1]}-` : "";
              earnedTimeStr = `${yearStr}${rawTime}`;
              earnedTimestamp = parseP9Timestamp(earnedTimeStr);
            }
          } else {
            status = "unearned";
          }
        }
        let tipsCount = 0;
        const tipsBadge = row.querySelector("em.alert-success:not(.r), em.alert-success b");
        if (tipsBadge) {
          const b = tipsBadge.querySelector("b") || tipsBadge;
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
  function sortTrophiesInTable(table, trophies, mode) {
    const tableTrophies = trophies.filter((t) => t.table === table);
    const tbody = table.querySelector("tbody") || table;
    const sorted = [...tableTrophies].sort((a, b) => {
      if (mode === "initial" || mode === "xmb") {
        return a.originalIndex - b.originalIndex;
      }
      if (mode === "time-desc") {
        if (a.earnedTimestamp === null && b.earnedTimestamp === null) return 0;
        if (a.earnedTimestamp === null) return 1;
        if (b.earnedTimestamp === null) return -1;
        return b.earnedTimestamp - a.earnedTimestamp;
      }
      if (mode === "time-asc") {
        if (a.earnedTimestamp === null && b.earnedTimestamp === null) return 0;
        if (a.earnedTimestamp === null) return 1;
        if (b.earnedTimestamp === null) return -1;
        return a.earnedTimestamp - b.earnedTimestamp;
      }
      if (mode === "rarity-asc") {
        return a.rarityPercent - b.rarityPercent;
      }
      if (mode === "rarity-desc") {
        return b.rarityPercent - a.rarityPercent;
      }
      if (mode === "type-desc") {
        const typeRank = { platinum: 1, gold: 2, silver: 3, bronze: 4 };
        return typeRank[a.type] - typeRank[b.type];
      }
      if (mode === "type-asc") {
        const typeRank = { platinum: 1, gold: 2, silver: 3, bronze: 4 };
        return typeRank[b.type] - typeRank[a.type];
      }
      return 0;
    });
    const desiredNodes = [];
    sorted.forEach((item) => {
      desiredNodes.push(item.row);
      const tipRow = table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${item.trophyId}"]`);
      if (tipRow) {
        desiredNodes.push(tipRow);
      }
    });
    const desiredSet = new Set(desiredNodes);
    const currentNodes = Array.from(tbody.children).filter((el) => desiredSet.has(el));
    const alreadyOrdered = currentNodes.length === desiredNodes.length && desiredNodes.every((node, idx) => currentNodes[idx] === node) && sorted.every((item) => {
      const tipRow = table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${item.trophyId}"]`);
      return !tipRow || item.row.nextElementSibling === tipRow;
    });
    if (alreadyOrdered) return;
    desiredNodes.forEach((node) => {
      tbody.appendChild(node);
    });
  }
  var activeHighlight = {
    timer: null,
    row: null,
    origTabIndex: null
  };
  function clearTrophyRowHighlight() {
    if (activeHighlight.timer) {
      clearTimeout(activeHighlight.timer);
      activeHighlight.timer = null;
    }
    if (activeHighlight.row) {
      activeHighlight.row.classList.remove("psnine-tip-jump-target");
      activeHighlight.row.removeAttribute("data-psnine-highlight");
      if (activeHighlight.origTabIndex === null) {
        activeHighlight.row.removeAttribute("tabindex");
      } else {
        activeHighlight.row.setAttribute("tabindex", activeHighlight.origTabIndex);
      }
      activeHighlight.row = null;
      activeHighlight.origTabIndex = null;
    }
  }
  function applyTrophyRowHighlight(row, win) {
    clearTrophyRowHighlight();
    const origTabIndex = row.getAttribute("tabindex");
    activeHighlight.row = row;
    activeHighlight.origTabIndex = origTabIndex;
    row.classList.add("psnine-tip-jump-target");
    row.setAttribute("data-psnine-highlight", "true");
    row.setAttribute("tabindex", "-1");
    try {
      row.focus({ preventScroll: true });
    } catch {
      row.focus();
    }
    activeHighlight.timer = (win.setTimeout || setTimeout)(() => {
      clearTrophyRowHighlight();
    }, 1500);
  }
  function bindInlineTipTrophyLinks(root, getTrophies, win, doc, currentOrigin) {
    const origin = currentOrigin || (win.location ? win.location.origin : "https://psnine.com");
    const links = root.querySelectorAll('a[href*="/trophy/"]');
    links.forEach((a) => {
      const rawHref = a.getAttribute("href") || "";
      if (!rawHref) return;
      let targetUrl;
      try {
        targetUrl = new URL(rawHref, origin);
      } catch {
        return;
      }
      if (targetUrl.origin !== origin) {
        return;
      }
      const m = targetUrl.pathname.match(/^\/trophy\/(\d+)\/?$/);
      if (!m) return;
      if (targetUrl.hash) return;
      const targetTrophyId = m[1];
      const liveTrophies = getTrophies();
      const targetItem = liveTrophies.find((t) => t.trophyId === targetTrophyId);
      if (!targetItem) {
        return;
      }
      if (a.getAttribute("data-psnine-tip-jump") === "true") return;
      a.setAttribute("data-psnine-tip-jump", "true");
      a.setAttribute("data-psnine-internal-link", "true");
      a.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
          return;
        }
        const freshList = getTrophies();
        const freshItem = freshList.find((t) => t.trophyId === targetTrophyId);
        if (!freshItem || !freshItem.row || freshItem.row.isConnected === false || doc.contains && !doc.contains(freshItem.row)) {
          return;
        }
        e.preventDefault();
        const targetRow = freshItem.row;
        const activeFilterBtn = doc.querySelector("ul.dropmenu .own.select, .o_btn.own.select, ul.dropmenu .unown.select, .o_btn.unown.select");
        if (activeFilterBtn && (targetRow.style.display === "none" || targetRow.hasAttribute("data-psnine-native-sync-hidden"))) {
          activeFilterBtn.click();
        } else if (targetRow.style.display === "none" && targetRow.hasAttribute("data-psnine-native-sync-hidden")) {
          targetRow.style.removeProperty("display");
          targetRow.removeAttribute("data-psnine-native-sync-hidden");
        }
        if (typeof targetRow.scrollIntoView === "function") {
          targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        applyTrophyRowHighlight(targetRow, win);
      });
    });
  }
  var mountTrophies = async (ctx) => {
    const { document: doc, window: win, url, settings, store, userId, onContent, report } = ctx;
    const isTrophyListPage = url.pathname.includes("/psngame/") && !url.pathname.includes("/comment");
    const isTrophyDetailPage = url.pathname.includes("/trophy/");
    const isGuideTopicPage = url.pathname.includes("/topic/") || url.pathname.includes("/node/guide");
    let isActive = true;
    try {
      if (isTrophyDetailPage) {
        const applyT14Textareas = (root = doc) => {
          const textareas = root instanceof Element && root.matches("textarea") ? [root] : Array.from(root.querySelectorAll("textarea"));
          textareas.forEach((ta) => {
            if (!ta.getAttribute("data-psnine-t14-ready")) {
              ta.setAttribute("data-psnine-t14-ready", "true");
              ta.setAttribute("style", `${ta.getAttribute("style") || ""};resize:vertical !important;font-size:16px !important;min-height:80px !important;box-sizing:border-box !important;`);
            }
          });
        };
        applyT14Textareas(doc);
        const tipsList = doc.querySelector("ul.list");
        let isLikesSorted = false;
        const parseTipLikes = (li) => {
          const directMetas = Array.from(li.querySelectorAll(":scope > .ml64 > .meta, :scope > .meta, :scope > div > .meta")).filter((m) => !m.closest(".sonlist") && m.closest("li") === li);
          for (const meta of directMetas) {
            const upLink = meta.querySelector('a[onclick*="up_tip"], a.btn-up, em.alert-success');
            if (upLink) {
              const m = upLink.textContent?.match(/(\d+)/);
              if (m) return parseInt(m[1], 10);
            }
          }
          const upLinks = Array.from(li.querySelectorAll('a[onclick*="up_tip"], a.btn-up, em.alert-success')).filter((a) => !a.closest(".sonlist") && a.closest("li") === li);
          for (const a of upLinks) {
            const m = a.textContent?.match(/(\d+)/);
            if (m) return parseInt(m[1], 10);
          }
          return 0;
        };
        const updateT13Tips = () => {
          if (!tipsList) return;
          const directLis = Array.from(tipsList.querySelectorAll(":scope > li"));
          if (directLis.length === 0) return;
          let maxSeq = -1;
          directLis.forEach((li) => {
            if (li.hasAttribute("data-psnine-orig-seq")) {
              const val = parseInt(li.getAttribute("data-psnine-orig-seq") || "0", 10);
              if (!isNaN(val) && val > maxSeq) maxSeq = val;
            }
          });
          directLis.forEach((li, idx) => {
            if (!li.hasAttribute("data-psnine-orig-seq")) {
              if (maxSeq === -1) {
                maxSeq = idx;
                li.setAttribute("data-psnine-orig-seq", String(idx));
              } else {
                maxSeq++;
                li.setAttribute("data-psnine-orig-seq", String(maxSeq));
              }
            }
          });
          const targetOrder = [...directLis].sort((a, b) => {
            const seqA = parseInt(a.getAttribute("data-psnine-orig-seq") || "0", 10);
            const seqB = parseInt(b.getAttribute("data-psnine-orig-seq") || "0", 10);
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
            targetOrder.forEach((li) => tipsList.appendChild(li));
          }
        };
        if (tipsList && !doc.getElementById("psnine-sort-tips-by-likes-btn")) {
          updateT13Tips();
          const sortBtn = doc.createElement("button");
          sortBtn.id = "psnine-sort-tips-by-likes-btn";
          sortBtn.type = "button";
          sortBtn.setAttribute("data-psnine-next", "true");
          sortBtn.style.cssText = "padding:4px 8px;font-size:12px;border-radius:4px;border:1px solid #3890ff;background:transparent;color:#3890ff;cursor:pointer;margin-bottom:8px;";
          sortBtn.textContent = "\u{1F525} \u6309\u201C\u9876\u201D\u6570\u70ED\u5EA6\u6392\u5E8FTips";
          sortBtn.onclick = () => {
            isLikesSorted = !isLikesSorted;
            sortBtn.textContent = isLikesSorted ? "\u{1F504} \u6062\u590D\u9ED8\u8BA4\u6392\u5E8F" : "\u{1F525} \u6309\u201C\u9876\u201D\u6570\u70ED\u5EA6\u6392\u5E8FTips";
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
      if (isGuideTopicPage && userId) {
        const pageAbortController = new AbortController();
        const gameCache = /* @__PURE__ */ new Map();
        const fetchGameData = (gid) => {
          if (gameCache.has(gid)) {
            return gameCache.get(gid);
          }
          const p = (async () => {
            try {
              const targetUrl = new URL(`/psngame/${gid}?psnid=${userId}`, ctx.url.origin).href;
              const gameDoc = await ctx.http.document(targetUrl, { ttl: 6e5, signal: pageAbortController.signal });
              if (!isActive || pageAbortController.signal.aborted) return null;
              const trophyRows = Array.from(gameDoc.querySelectorAll("table.list tr.trophy, tr.trophy, table.list tr[id]")).filter((r) => r.querySelector('a[href*="/trophy/"]') !== null);
              const hasUserLink = Array.from(gameDoc.querySelectorAll('a[href*="/psnid/"]')).some((a) => (a.getAttribute("href") || "").toLowerCase().includes(`/psnid/${userId.toLowerCase()}`));
              const hasEarnedMarker = gameDoc.querySelector("tr.trophy img.earned, tr.trophy .imgbg.earned, tr.trophy em.alert-success.r, img.earned") !== null;
              const verifiedPersonal = (hasUserLink || hasEarnedMarker) && trophyRows.length > 0;
              const knownSet = /* @__PURE__ */ new Set();
              const earnedSet = /* @__PURE__ */ new Set();
              trophyRows.forEach((tr) => {
                const a = tr.querySelector('a[href*="/trophy/"]');
                const tm = a?.getAttribute("href")?.match(/\/trophy\/(\d+)/);
                if (tm) {
                  const id = tm[1];
                  knownSet.add(id);
                  const isEarned = tr.querySelector("img.earned, img.imgbg.earned, em.alert-success.r") !== null;
                  if (isEarned) earnedSet.add(id);
                }
              });
              return { verifiedPersonal, knownSet, earnedSet };
            } catch (err) {
              if (!pageAbortController.signal.aborted) {
                report("guide_trophies_sync", err);
              }
              return null;
            }
          })();
          gameCache.set(gid, p);
          return p;
        };
        const annotateArticleTrophies = async () => {
          const articleContainer = doc.querySelector(".post .content, .post, article, .page_content, .min-inner");
          const rootToSearch = articleContainer || doc;
          const trophyLinks = Array.from(rootToSearch.querySelectorAll('a[href*="/trophy/"]'));
          if (trophyLinks.length === 0) return;
          const linksToProcess = [];
          const neededGids = /* @__PURE__ */ new Set();
          for (const a of trophyLinks) {
            if (a.hasAttribute("data-psnine-badge-bound")) continue;
            const href = a.href || a.getAttribute("href") || "";
            const m = href.match(/\/trophy\/(\d+)/);
            if (m) {
              const tId = m[1];
              const gid = tId.length > 3 ? tId.slice(0, -3) : tId;
              linksToProcess.push({ a, tId, gid });
              neededGids.add(gid);
            }
          }
          if (linksToProcess.length === 0) return;
          for (const gid of neededGids) {
            fetchGameData(gid);
          }
          for (const item of linksToProcess) {
            if (item.a.hasAttribute("data-psnine-badge-bound")) continue;
            const gameData = await fetchGameData(item.gid);
            if (!isActive || pageAbortController.signal.aborted) return;
            item.a.setAttribute("data-psnine-badge-bound", "true");
            let badgeText = "\u2753 \u72B6\u6001\u672A\u77E5";
            let bg = "#6c757d";
            let fg = "#fff";
            if (gameData && gameData.verifiedPersonal) {
              if (gameData.earnedSet.has(item.tId)) {
                badgeText = "\u2705 \u5DF2\u83B7\u5F97";
                bg = "#28a745";
                fg = "#fff";
              } else if (gameData.knownSet.has(item.tId)) {
                badgeText = "\u23F3 \u672A\u83B7\u5F97";
                bg = "#ffc107";
                fg = "#000";
              }
            }
            const badge = doc.createElement("span");
            badge.className = "psnine-guide-trophy-badge";
            badge.setAttribute("data-psnine-next", "true");
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
      if (isTrophyListPage) {
        const pageAbortController = new AbortController();
        let batchAbortController = null;
        const activeManualControllers = /* @__PURE__ */ new Map();
        const isPersonalPage = url.searchParams.has("psnid");
        let currentSortMode = null;
        let cleanupNativeSortDropdown = null;
        let cleanupNativeFilterSync = null;
        let closeTipsMenu = null;
        let closeNativeSortMenu = null;
        let cleanupTipsToolbar = null;
        let isBatchRunning = false;
        const applyActiveSortToTables = (mode) => {
          doc.querySelectorAll("table.list").forEach((tbl) => {
            sortTrophiesInTable(tbl, currentTrophies, mode);
          });
        };
        const ensureNativeSortDropdown = () => {
          const candidates = Array.from(doc.querySelectorAll("ul.dropmenu > li.dropdown"));
          let targetDropdown = null;
          for (const li of candidates) {
            const dropdownLi2 = li;
            const trigger2 = dropdownLi2.querySelector(":scope > a");
            const submenu2 = dropdownLi2.querySelector(":scope > ul");
            if (!trigger2 || !submenu2) continue;
            const nativeLinks = Array.from(submenu2.querySelectorAll(":scope > li > a"));
            const obs = /* @__PURE__ */ new Set();
            for (const a of nativeLinks) {
              if (a.hasAttribute("data-psnine-sort")) continue;
              const rawHref = a.getAttribute("href") || "";
              if (!rawHref || rawHref.startsWith("javascript:")) continue;
              try {
                const u = new URL(rawHref, url.href);
                if (u.origin !== url.origin || u.pathname !== url.pathname) continue;
                const ob = u.searchParams.get("ob");
                if (ob === "trophyid" || ob === "type" || ob === "rarity") {
                  obs.add(ob);
                }
              } catch {
              }
            }
            if (obs.has("trophyid") && obs.has("type") && obs.has("rarity")) {
              targetDropdown = { dropdownLi: dropdownLi2, trigger: trigger2, submenu: submenu2 };
              break;
            }
          }
          if (!targetDropdown) return;
          const { dropdownLi, trigger, submenu } = targetDropdown;
          if (dropdownLi.getAttribute("data-psnine-trophy-sort-dropdown") === "true" && submenu.querySelector('[data-psnine-sort="type-asc"]')) {
            return;
          }
          cleanupNativeSortDropdown?.();
          const confirmedUl = dropdownLi.closest("ul.dropmenu");
          if (confirmedUl) {
            confirmedUl.classList.add("psnine-trophy-nav-dropmenu");
            confirmedUl.setAttribute("data-psnine-trophy-nav", "true");
          }
          const origHadHover = dropdownLi.classList.contains("hover");
          const origDropdownAttr = dropdownLi.getAttribute("data-psnine-trophy-sort-dropdown");
          const origTriggerAttr = trigger.getAttribute("data-psnine-trophy-sort-trigger");
          const origAriaHaspopup = trigger.getAttribute("aria-haspopup");
          const origAriaExpanded = trigger.getAttribute("aria-expanded");
          const origTriggerText = trigger.textContent;
          const origTitle = trigger.getAttribute("title");
          const origMenuAttr = submenu.getAttribute("data-psnine-trophy-sort-menu");
          const origNativeLinks = Array.from(submenu.querySelectorAll(":scope > li > a"));
          const origCurrentNativeLinks = new Set(
            origNativeLinks.filter((a) => a.classList.contains("current"))
          );
          dropdownLi.setAttribute("data-psnine-trophy-sort-dropdown", "true");
          trigger.setAttribute("data-psnine-trophy-sort-trigger", "true");
          trigger.setAttribute("aria-haspopup", "menu");
          trigger.setAttribute("aria-expanded", "false");
          trigger.setAttribute("title", origTriggerText || "");
          submenu.setAttribute("data-psnine-trophy-sort-menu", "true");
          let isDropdownOpen = false;
          const setDropdownOpen = (open, restoreFocus = false) => {
            isDropdownOpen = open;
            if (open) {
              closeTipsMenu?.();
              dropdownLi.classList.add("psnine-dropdown-open", "hover");
              dropdownLi.setAttribute("data-psnine-dropdown-open", "true");
              dropdownLi.setAttribute("data-psnine-dropdown-state", "open");
              trigger.setAttribute("aria-expanded", "true");
            } else {
              dropdownLi.classList.remove("psnine-dropdown-open", "hover");
              dropdownLi.removeAttribute("data-psnine-dropdown-open");
              dropdownLi.setAttribute("data-psnine-dropdown-state", "closed");
              trigger.setAttribute("aria-expanded", "false");
              if (restoreFocus) {
                trigger.focus();
              }
            }
          };
          closeNativeSortMenu = () => setDropdownOpen(false, false);
          const extraItems = [
            ...isPersonalPage ? [
              { mode: "time-desc", label: "\u83B7\u5F97\u65F6\u95F4\uFF08\u65B0\u2192\u65E7\uFF09" },
              { mode: "time-asc", label: "\u83B7\u5F97\u65F6\u95F4\uFF08\u65E7\u2192\u65B0\uFF09" }
            ] : [],
            { mode: "type-asc", label: "\u7C7B\u578B\uFF08\u94DC\u2192\u767D\u91D1\uFF09" },
            { mode: "rarity-desc", label: "\u5B8C\u7F8E\u7387\uFF08\u9AD8\u2192\u4F4E\uFF09" }
          ];
          const createdLis = [];
          const itemCleanups = [];
          const selectLocalSort = (mode, label, restoreFocus) => {
            currentSortMode = mode;
            trigger.textContent = label;
            trigger.setAttribute("title", label);
            submenu.querySelectorAll(":scope > li > a").forEach((el) => {
              if (el.getAttribute("data-psnine-sort") === mode) {
                el.classList.add("current");
                el.setAttribute("data-psnine-sort-active", "true");
              } else {
                el.classList.remove("current");
                el.removeAttribute("data-psnine-sort-active");
              }
            });
            applyActiveSortToTables(mode);
            setDropdownOpen(false, restoreFocus);
          };
          for (const item of extraItems) {
            const li = doc.createElement("li");
            li.setAttribute("data-psnine-next", "true");
            li.setAttribute("data-psnine-sort-item", item.mode);
            const a = doc.createElement("a");
            a.href = "javascript:void(0)";
            a.setAttribute("data-psnine-next", "true");
            a.setAttribute("data-psnine-sort", item.mode);
            a.textContent = item.label;
            const onItemClick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              selectLocalSort(item.mode, item.label, false);
            };
            const onItemKeyDown = (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                selectLocalSort(item.mode, item.label, true);
              }
            };
            a.addEventListener("click", onItemClick);
            a.addEventListener("keydown", onItemKeyDown);
            itemCleanups.push(() => {
              a.removeEventListener("click", onItemClick);
              a.removeEventListener("keydown", onItemKeyDown);
            });
            li.appendChild(a);
            submenu.appendChild(li);
            createdLis.push(li);
          }
          const onTriggerClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropdownOpen(!isDropdownOpen);
          };
          const onTriggerKeyDown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setDropdownOpen(!isDropdownOpen);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              setDropdownOpen(true);
              const firstLink = submenu.querySelector(":scope > li > a");
              firstLink?.focus();
            } else if (e.key === "Escape") {
              if (isDropdownOpen || dropdownLi.classList.contains("hover")) {
                e.preventDefault();
                e.stopPropagation();
                setDropdownOpen(false, true);
              }
            }
          };
          const onDropdownKeyDown = (e) => {
            if (e.key === "Escape") {
              if (isDropdownOpen || dropdownLi.classList.contains("hover") || dropdownLi.contains(doc.activeElement)) {
                e.preventDefault();
                e.stopPropagation();
                setDropdownOpen(false, true);
              }
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              const links = Array.from(submenu.querySelectorAll(":scope > li > a"));
              const idx = links.indexOf(doc.activeElement);
              if (idx !== -1 && links.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                const nextIdx = e.key === "ArrowDown" ? (idx + 1) % links.length : (idx - 1 + links.length) % links.length;
                links[nextIdx]?.focus();
              }
            }
          };
          const onDropdownPointerEnter = (e) => {
            if (e.pointerType === "mouse" && !isDropdownOpen && dropdownLi.getAttribute("data-psnine-dropdown-state") === "closed") {
              dropdownLi.removeAttribute("data-psnine-dropdown-state");
            }
          };
          const onDropdownFocusOut = (e) => {
            const nextTarget = e.relatedTarget;
            if (nextTarget && !dropdownLi.contains(nextTarget)) {
              setDropdownOpen(false, false);
            } else if (!nextTarget && doc.activeElement && doc.activeElement !== doc.body && !dropdownLi.contains(doc.activeElement)) {
              setDropdownOpen(false, false);
            }
          };
          const onDocClick = (e) => {
            if (!isDropdownOpen && !dropdownLi.classList.contains("hover")) return;
            const target = e.target;
            if (target && !dropdownLi.contains(target)) {
              setDropdownOpen(false, false);
            }
          };
          const onDocKeyDown = (e) => {
            if (e.key !== "Escape") return;
            if (dropdownLi.contains(doc.activeElement)) {
              e.preventDefault();
              setDropdownOpen(false, true);
            } else if (isDropdownOpen || dropdownLi.classList.contains("hover")) {
              setDropdownOpen(false, false);
            }
          };
          trigger.addEventListener("click", onTriggerClick);
          trigger.addEventListener("keydown", onTriggerKeyDown);
          dropdownLi.addEventListener("keydown", onDropdownKeyDown);
          dropdownLi.addEventListener("pointerenter", onDropdownPointerEnter);
          dropdownLi.addEventListener("focusout", onDropdownFocusOut);
          doc.addEventListener("click", onDocClick);
          doc.addEventListener("keydown", onDocKeyDown);
          cleanupNativeSortDropdown = () => {
            closeNativeSortMenu = null;
            trigger.removeEventListener("click", onTriggerClick);
            trigger.removeEventListener("keydown", onTriggerKeyDown);
            dropdownLi.removeEventListener("keydown", onDropdownKeyDown);
            dropdownLi.removeEventListener("pointerenter", onDropdownPointerEnter);
            dropdownLi.removeEventListener("focusout", onDropdownFocusOut);
            doc.removeEventListener("click", onDocClick);
            doc.removeEventListener("keydown", onDocKeyDown);
            itemCleanups.forEach((fn) => fn());
            createdLis.forEach((li) => li.remove());
            dropdownLi.classList.remove("psnine-dropdown-open");
            if (origHadHover) dropdownLi.classList.add("hover");
            else dropdownLi.classList.remove("hover");
            dropdownLi.removeAttribute("data-psnine-dropdown-open");
            dropdownLi.removeAttribute("data-psnine-dropdown-state");
            if (origDropdownAttr === null) dropdownLi.removeAttribute("data-psnine-trophy-sort-dropdown");
            else dropdownLi.setAttribute("data-psnine-trophy-sort-dropdown", origDropdownAttr);
            if (origTriggerAttr === null) trigger.removeAttribute("data-psnine-trophy-sort-trigger");
            else trigger.setAttribute("data-psnine-trophy-sort-trigger", origTriggerAttr);
            if (origAriaHaspopup === null) trigger.removeAttribute("aria-haspopup");
            else trigger.setAttribute("aria-haspopup", origAriaHaspopup);
            if (origAriaExpanded === null) trigger.removeAttribute("aria-expanded");
            else trigger.setAttribute("aria-expanded", origAriaExpanded);
            trigger.textContent = origTriggerText;
            if (origTitle === null) trigger.removeAttribute("title");
            else trigger.setAttribute("title", origTitle);
            origNativeLinks.forEach((a) => {
              if (origCurrentNativeLinks.has(a)) a.classList.add("current");
              else a.classList.remove("current");
            });
            if (origMenuAttr === null) submenu.removeAttribute("data-psnine-trophy-sort-menu");
            else submenu.setAttribute("data-psnine-trophy-sort-menu", origMenuAttr);
            if (confirmedUl) {
              confirmedUl.classList.remove("psnine-trophy-nav-dropmenu");
              confirmedUl.removeAttribute("data-psnine-trophy-nav");
            }
          };
        };
        let currentTrophies = [];
        let observedOwnBtn = null;
        let observedUnownBtn = null;
        let nativeFilterClassObserver = null;
        let docFilterClickBound = false;
        const getNativeFilterControls = () => {
          const ownBtn = doc.querySelector('ul.dropmenu .own, .o_btn.own, [onclick*="getOwn"]');
          const unownBtn = doc.querySelector('ul.dropmenu .unown, .o_btn.unown, [onclick*="getUnOwn"]');
          return { ownBtn, unownBtn };
        };
        const getNativeFilterMode = () => {
          const { ownBtn, unownBtn } = getNativeFilterControls();
          if (ownBtn?.classList.contains("select")) return "earned";
          if (unownBtn?.classList.contains("select")) return "unearned";
          return "all";
        };
        const isTrophyRowEarned = (t) => {
          return t.status === "earned" || t.row.querySelector(".earned") !== null;
        };
        const isTrophyRowFilteredOut = (t) => {
          const nativeMode = getNativeFilterMode();
          const isEarned = isTrophyRowEarned(t);
          const shouldHideByNativeMode = nativeMode === "earned" && !isEarned || nativeMode === "unearned" && isEarned;
          return shouldHideByNativeMode || t.row.style.display === "none" || t.row.hidden;
        };
        const syncNativeFilter = () => {
          if (!isActive) return;
          const nativeMode = getNativeFilterMode();
          currentTrophies.forEach((t) => {
            const isEarned = isTrophyRowEarned(t);
            const shouldHideByNativeMode = nativeMode === "earned" && !isEarned || nativeMode === "unearned" && isEarned;
            if (shouldHideByNativeMode) {
              if (t.row.style.display !== "none") {
                t.row.style.display = "none";
                t.row.setAttribute("data-psnine-native-sync-hidden", "true");
              }
            } else if (t.row.getAttribute("data-psnine-native-sync-hidden") === "true") {
              t.row.removeAttribute("data-psnine-native-sync-hidden");
              if (t.row.style.display === "none") {
                t.row.style.removeProperty("display");
              }
            }
            const rowIsHidden = shouldHideByNativeMode || t.row.style.display === "none" || t.row.hidden;
            const tipRow = t.table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${t.trophyId}"]`);
            if (tipRow && isHiddenByReason(tipRow, "trophy-status-filter") !== rowIsHidden) {
              setHidden(tipRow, "trophy-status-filter", rowIsHidden);
            }
          });
        };
        const onDocNativeFilterClick = (e) => {
          if (!isActive) return;
          const target = e.target;
          if (!target) return;
          const { ownBtn, unownBtn } = getNativeFilterControls();
          const hitOwn = ownBtn ? ownBtn === target || ownBtn.contains(target) : false;
          const hitUnown = unownBtn ? unownBtn === target || unownBtn.contains(target) : false;
          if (!hitOwn && !hitUnown) return;
          syncNativeFilter();
          queueMicrotask(() => {
            if (isActive) syncNativeFilter();
          });
        };
        const ensureNativeFilterSync = () => {
          if (!docFilterClickBound) {
            doc.addEventListener("click", onDocNativeFilterClick);
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
                nativeFilterClassObserver.observe(ownBtn, { attributes: true, attributeFilter: ["class"] });
              }
              if (unownBtn && unownBtn !== ownBtn) {
                nativeFilterClassObserver.observe(unownBtn, { attributes: true, attributeFilter: ["class"] });
              }
            }
          }
          cleanupNativeFilterSync = () => {
            if (docFilterClickBound) {
              doc.removeEventListener("click", onDocNativeFilterClick);
              docFilterClickBound = false;
            }
            nativeFilterClassObserver?.disconnect();
            nativeFilterClassObserver = null;
            observedOwnBtn = null;
            observedUnownBtn = null;
            doc.querySelectorAll("tr.psnine-inline-tip-row").forEach((tipRow) => {
              if (isHiddenByReason(tipRow, "trophy-status-filter")) {
                setHidden(tipRow, "trophy-status-filter", false);
              }
            });
            doc.querySelectorAll('tr[data-psnine-native-sync-hidden="true"]').forEach((row) => {
              row.removeAttribute("data-psnine-native-sync-hidden");
              if (row.style.display === "none") {
                row.style.removeProperty("display");
              }
            });
          };
        };
        const enhanceTrophyPage = () => {
          currentTrophies = parseTrophyRows(doc, isPersonalPage);
          if (currentTrophies.length === 0) return;
          ensureNativeSortDropdown();
          ensureNativeFilterSync();
          doc.getElementById("psnine-trophy-stats-panel")?.remove();
          let tipsToolbar = doc.getElementById("psnine-trophy-tips-toolbar");
          if (!tipsToolbar) {
            const sortDropdown = doc.querySelector('[data-psnine-trophy-sort-dropdown="true"]');
            const ownBtn = doc.querySelector('ul.dropmenu .own, .o_btn.own, [onclick*="getOwn"]');
            const confirmedUl = sortDropdown?.closest("ul.dropmenu") || ownBtn?.closest("ul.dropmenu") || null;
            if (confirmedUl) {
              confirmedUl.classList.add("psnine-trophy-nav-dropmenu");
              confirmedUl.setAttribute("data-psnine-trophy-nav", "true");
              tipsToolbar = doc.createElement("li");
              tipsToolbar.id = "psnine-trophy-tips-toolbar";
              tipsToolbar.setAttribute("data-psnine-next", "true");
              tipsToolbar.className = "psnine-trophy-toolbar";
              tipsToolbar.style.cssText = "position:relative;float:none;margin:0 0 0 10px;height:36px;display:inline-flex;align-items:center;vertical-align:middle;flex-shrink:0;";
              confirmedUl.appendChild(tipsToolbar);
            } else {
              tipsToolbar = doc.createElement("div");
              tipsToolbar.id = "psnine-trophy-tips-toolbar";
              tipsToolbar.setAttribute("data-psnine-next", "true");
              tipsToolbar.className = "psnine-trophy-toolbar";
              tipsToolbar.style.cssText = "position:relative;display:inline-flex;align-items:center;margin:6px 0;";
              const target = doc.querySelector(".main, .box.pd10, .min-inner");
              const firstTbl = doc.querySelector("table.list");
              if (firstTbl && firstTbl.parentElement) {
                firstTbl.parentElement.insertBefore(tipsToolbar, firstTbl);
              } else if (target) {
                target.appendChild(tipsToolbar);
              }
            }
          }
          if (!tipsToolbar.hasChildNodes()) {
            tipsToolbar.innerHTML = `
            <button type="button" id="psnine-trophy-tips-trigger" class="o_btn psnine-trophy-tips-btn" data-psnine-next="true" aria-expanded="false" aria-controls="psnine-trophy-tips-menu" aria-haspopup="menu" style="display:inline-block;margin:0;width:52px;min-height:24px;height:24px;padding:2px 4px;font-size:12px;line-height:17px;border-radius:15px;border:1px solid darkslategray;background:var(--p9n-surface,#fff);color:var(--p9n-text,#333);cursor:pointer;touch-action:manipulation;box-sizing:border-box;outline:none;text-align:center;">Tips \u25BE</button>
            <div id="psnine-trophy-tips-menu" class="psnine-trophy-action-group psnine-trophy-menu" data-psnine-next="true" hidden style="position:absolute;top:100%;left:0;z-index:998;margin-top:4px;padding:6px;background:var(--p9n-surface,#fff);border:1px solid var(--p9n-border,#ccd6dd);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:none;flex-direction:column;gap:6px;white-space:nowrap;max-width:calc(100vw - 24px);box-sizing:border-box;">
              <button type="button" id="psnine-batch-load-all-tips-btn" class="psnine-trophy-pill-btn" data-psnine-next="true" style="display:inline-flex;align-items:center;justify-content:center;padding:4px 12px;font-size:12px;line-height:18px;min-height:28px;border-radius:14px;border:1px solid var(--p9n-border,#ccd6dd);background:var(--p9n-surface,#fff);color:var(--p9n-text,#333);cursor:pointer;white-space:nowrap;box-sizing:border-box;">
                \u5C55\u5F00\u6240\u6709Tips
              </button>
              <button type="button" id="psnine-batch-load-unearned-tips-btn" class="psnine-trophy-pill-btn" data-psnine-next="true"${!isPersonalPage ? ' disabled title="\u516C\u5F00\u9875\u9762\u65E0\u6CD5\u786E\u8BA4\u83B7\u5F97\u72B6\u6001\uFF0C\u8BF7\u8BBF\u95EE\u4E2A\u4EBA\u5956\u676F\u9875\u4F7F\u7528\u6B64\u529F\u80FD"' : ""} style="display:inline-flex;align-items:center;justify-content:center;padding:4px 12px;font-size:12px;line-height:18px;min-height:28px;border-radius:14px;border:1px solid var(--p9n-border,#ccd6dd);background:var(--p9n-surface,#fff);color:var(--p9n-text,#333);cursor:pointer;white-space:nowrap;box-sizing:border-box;">
                \u5C55\u5F00\u672A\u83B7Tips
              </button>
              <button type="button" id="psnine-stop-batch-tips-btn" class="psnine-trophy-pill-btn danger" data-psnine-next="true" style="display:none;align-items:center;justify-content:center;padding:4px 12px;font-size:12px;line-height:18px;min-height:28px;border-radius:14px;border:1px solid #e74c3c;background:var(--p9n-surface,#fff);color:#e74c3c;cursor:pointer;white-space:nowrap;box-sizing:border-box;">
                \u505C\u6B62\u52A0\u8F7D
              </button>
            </div>
          `;
            const trigger = doc.getElementById("psnine-trophy-tips-trigger");
            const menu = doc.getElementById("psnine-trophy-tips-menu");
            let isMenuOpen = false;
            const setMenuOpen = (open, restoreFocus = false) => {
              isMenuOpen = open;
              if (trigger && menu) {
                if (open) {
                  closeNativeSortMenu?.();
                  trigger.setAttribute("aria-expanded", "true");
                  menu.removeAttribute("hidden");
                  menu.style.display = "flex";
                  menu.style.left = "0";
                  menu.style.right = "auto";
                  const rect = menu.getBoundingClientRect();
                  if (rect.right > (win.innerWidth || 390) - 8) {
                    menu.style.left = "auto";
                    menu.style.right = "0";
                  }
                } else {
                  trigger.setAttribute("aria-expanded", "false");
                  menu.setAttribute("hidden", "");
                  menu.style.display = "none";
                  if (restoreFocus) {
                    trigger.focus();
                  }
                }
              }
            };
            closeTipsMenu = () => setMenuOpen(false, false);
            const onTriggerClick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(!isMenuOpen);
            };
            const onTriggerKeyDown = (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(!isMenuOpen);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(true);
                const firstBtn = menu?.querySelector("button:not([disabled])");
                firstBtn?.focus();
              } else if (e.key === "Escape") {
                if (isMenuOpen) {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false, true);
                }
              }
            };
            const onMenuKeyDown = (e) => {
              if (e.key === "Escape" && isMenuOpen) {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false, true);
              }
            };
            const onDocClick = (e) => {
              if (!isMenuOpen) return;
              const target = e.target;
              if (target && !tipsToolbar?.contains(target)) {
                setMenuOpen(false, false);
              }
            };
            const onDocKeyDownForTips = (e) => {
              if (e.key === "Escape" && isMenuOpen) {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false, true);
              }
            };
            const onToolbarFocusOut = (e) => {
              const nextTarget = e.relatedTarget;
              if (nextTarget && !tipsToolbar?.contains(nextTarget)) {
                setMenuOpen(false, false);
              }
            };
            trigger?.addEventListener("click", onTriggerClick);
            trigger?.addEventListener("keydown", onTriggerKeyDown);
            menu?.addEventListener("keydown", onMenuKeyDown);
            doc.addEventListener("click", onDocClick);
            doc.addEventListener("keydown", onDocKeyDownForTips);
            tipsToolbar.addEventListener("focusout", onToolbarFocusOut);
            cleanupTipsToolbar = () => {
              trigger?.removeEventListener("click", onTriggerClick);
              trigger?.removeEventListener("keydown", onTriggerKeyDown);
              menu?.removeEventListener("keydown", onMenuKeyDown);
              doc.removeEventListener("click", onDocClick);
              doc.removeEventListener("keydown", onDocKeyDownForTips);
              tipsToolbar?.removeEventListener("focusout", onToolbarFocusOut);
              clearTrophyRowHighlight();
            };
            const runBatchQueue = async (unearnedOnly) => {
              if (isBatchRunning) return;
              isBatchRunning = true;
              batchAbortController = new AbortController();
              const batchAllBtn2 = doc.getElementById("psnine-batch-load-all-tips-btn");
              const batchUnearnedBtn2 = doc.getElementById("psnine-batch-load-unearned-tips-btn");
              const stopBtn2 = doc.getElementById("psnine-stop-batch-tips-btn");
              if (batchAllBtn2) batchAllBtn2.style.display = "none";
              if (batchUnearnedBtn2) batchUnearnedBtn2.style.display = "none";
              if (stopBtn2) stopBtn2.style.display = "inline-block";
              const targets = currentTrophies.filter((t) => t.tipsCount > 0 && (!unearnedOnly || t.status === "unearned"));
              for (const t of targets) {
                if (!isActive || batchAbortController.signal.aborted) break;
                const existing = t.table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${t.trophyId}"]`);
                if (!existing) {
                  await toggleInlineTips(t, batchAbortController.signal);
                  if (!isActive || batchAbortController.signal.aborted) break;
                  try {
                    await new Promise((resolve, reject) => {
                      let timer = null;
                      const onAbort = () => {
                        if (timer) clearTimeout(timer);
                        batchAbortController?.signal.removeEventListener("abort", onAbort);
                        reject(new Error("aborted"));
                      };
                      timer = setTimeout(() => {
                        batchAbortController?.signal.removeEventListener("abort", onAbort);
                        resolve();
                      }, 300);
                      batchAbortController?.signal.addEventListener("abort", onAbort, { once: true });
                    });
                  } catch {
                    break;
                  }
                }
              }
              if (stopBtn2) stopBtn2.style.display = "none";
              if (batchAllBtn2) batchAllBtn2.style.display = "inline-block";
              if (batchUnearnedBtn2) batchUnearnedBtn2.style.display = "inline-block";
              isBatchRunning = false;
            };
            const batchAllBtn = doc.getElementById("psnine-batch-load-all-tips-btn");
            if (batchAllBtn) batchAllBtn.onclick = () => runBatchQueue(false);
            const batchUnearnedBtn = doc.getElementById("psnine-batch-load-unearned-tips-btn");
            if (batchUnearnedBtn && isPersonalPage) batchUnearnedBtn.onclick = () => runBatchQueue(true);
            const stopBtn = doc.getElementById("psnine-stop-batch-tips-btn");
            if (stopBtn) {
              stopBtn.onclick = () => {
                batchAbortController?.abort();
                stopBtn.style.display = "none";
                if (batchAllBtn) batchAllBtn.style.display = "inline-block";
                if (batchUnearnedBtn) batchUnearnedBtn.style.display = "inline-block";
              };
            }
          } else if (currentSortMode !== null) {
            applyActiveSortToTables(currentSortMode);
          }
          syncNativeFilter();
          currentTrophies.forEach((t) => {
            const tipsBadge = t.row.querySelector("em.alert-success:not(.r)");
            if (tipsBadge && !tipsBadge.classList.contains("psnine-bound-tip")) {
              tipsBadge.classList.add("psnine-bound-tip");
              tipsBadge.style.cursor = "pointer";
              tipsBadge.setAttribute("role", "button");
              tipsBadge.setAttribute("tabindex", "0");
              tipsBadge.setAttribute("title", "\u70B9\u51FB\u5728\u4E0B\u65B9\u5185\u8054\u5C55\u5F00\u672C\u5956\u676FTips (\u952E\u76D8\u53EF\u56DE\u8F66)");
              const triggerHandler = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await toggleInlineTips(t);
              };
              tipsBadge.onclick = triggerHandler;
              tipsBadge.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  triggerHandler(e);
                }
              };
            }
          });
        };
        const toggleInlineTips = async (t, customSignal) => {
          const existingTipRow = t.table.querySelector(`tr.psnine-inline-tip-row[data-for-trophy="${t.trophyId}"]`);
          if (existingTipRow) {
            if (activeManualControllers.has(t.trophyId) && !customSignal) {
              activeManualControllers.get(t.trophyId).abort();
              activeManualControllers.delete(t.trophyId);
              existingTipRow.remove();
              return;
            }
            const isH = isHiddenByReason(existingTipRow, "inline-tip-toggle");
            setHidden(existingTipRow, "inline-tip-toggle", !isH);
            return;
          }
          let requestSignal;
          let manualCtrl = null;
          let onPageAbort = null;
          if (customSignal) {
            requestSignal = customSignal;
          } else {
            manualCtrl = new AbortController();
            activeManualControllers.set(t.trophyId, manualCtrl);
            requestSignal = manualCtrl.signal;
            onPageAbort = () => manualCtrl?.abort();
            pageAbortController.signal.addEventListener("abort", onPageAbort, { once: true });
          }
          const tipRow = doc.createElement("tr");
          tipRow.className = "psnine-inline-tip-row";
          tipRow.setAttribute("data-psnine-next", "true");
          tipRow.setAttribute("data-for-trophy", t.trophyId);
          if (isTrophyRowFilteredOut(t)) {
            setHidden(tipRow, "trophy-status-filter", true);
          }
          const td = doc.createElement("td");
          td.setAttribute("colspan", "4");
          td.setAttribute("data-psnine-next", "true");
          td.style.cssText = "padding:10px 15px;background:var(--p9n-surface-alt,#f8fafc);border-bottom:1px solid var(--p9n-border,#ccd6dd);color:var(--p9n-text,inherit);";
          const loadingDiv = doc.createElement("div");
          loadingDiv.setAttribute("data-psnine-next", "true");
          loadingDiv.style.cssText = "font-size:12px;color:var(--p9n-muted,#5f6b7a);";
          loadingDiv.textContent = `\u23F3 \u6B63\u5728\u52A0\u8F7D\u5956\u676F Tips (#${t.trophyId})...`;
          td.appendChild(loadingDiv);
          tipRow.appendChild(td);
          t.row.after(tipRow);
          try {
            const targetUrl = new URL(`/trophy/${t.trophyId}`, ctx.url.origin).href;
            const tipDoc = await ctx.http.document(targetUrl, { ttl: 6e5, signal: requestSignal });
            if (!isActive || requestSignal.aborted) {
              tipRow.remove();
              return;
            }
            td.innerHTML = "";
            const listEl = tipDoc.querySelector("ul.list");
            const directLis = listEl ? Array.from(listEl.querySelectorAll(":scope > li")) : [];
            const tipNodes = directLis.length > 0 ? directLis : Array.from(tipDoc.querySelectorAll("ul.list > li, div.content"));
            if (tipNodes.length === 0) {
              const emptyMsg = doc.createElement("div");
              emptyMsg.setAttribute("data-psnine-next", "true");
              emptyMsg.style.cssText = "font-size:12px;color:var(--p9n-muted,#5f6b7a);";
              emptyMsg.textContent = "\u6682\u65E0\u53EF\u7528 Tips";
              td.appendChild(emptyMsg);
              return;
            }
            const container = doc.createElement("div");
            container.setAttribute("data-psnine-next", "true");
            container.style.cssText = "max-height:280px;overflow-y:auto;";
            const topBar = doc.createElement("div");
            topBar.setAttribute("data-psnine-next", "true");
            topBar.style.cssText = "font-size:12px;font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;";
            const countSpan = doc.createElement("span");
            countSpan.textContent = `\u{1F4A1} \u5956\u676F Tips (${tipNodes.length}\u6761):`;
            topBar.appendChild(countSpan);
            const fullLink = doc.createElement("a");
            fullLink.setAttribute("data-psnine-next", "true");
            fullLink.href = targetUrl;
            fullLink.target = "_blank";
            fullLink.style.cssText = "font-size:11px;color:#3890ff;text-decoration:none;";
            fullLink.textContent = "\u524D\u5F80\u5956\u676F\u5B8C\u6574\u9875 \u2197";
            topBar.appendChild(fullLink);
            container.appendChild(topBar);
            const blockedUsers = new Set(settings.blockList.map((u) => u.toLowerCase().trim()));
            tipNodes.forEach((liNode) => {
              const authorA = liNode.querySelector(':scope > .meta a[href*="/psnid/"], :scope > div > .meta a[href*="/psnid/"], :scope > .ml64 > .meta a[href*="/psnid/"], a.psnnode');
              const authorHref = authorA?.getAttribute("href") || "";
              const mAuthor = authorHref.match(/\/psnid\/([^/?#]+)/);
              const authorId = (mAuthor ? mAuthor[1] : authorA?.textContent?.trim() || "").toLowerCase();
              const authorDisplay = authorA?.textContent?.trim() || authorId || "\u533F\u540D\u73A9\u5BB6";
              const contentEl = liNode.querySelector(":scope > .content, :scope > div > .content, :scope > .ml64 > .content, .content");
              const rawContentText = contentEl?.textContent || "";
              const isBlockedAuthor = authorId ? blockedUsers.has(authorId) : false;
              let isBlockedWord = false;
              let blockedReasonWord = "";
              for (const word of settings.blockWordsList) {
                if (settings.blockWordsRegex) {
                  try {
                    const reg = new RegExp(word, "i");
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
              const itemDiv = doc.createElement("div");
              itemDiv.setAttribute("data-psnine-next", "true");
              itemDiv.style.cssText = "margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed var(--p9n-border,#ccd6dd);font-size:12px;";
              if (isBlockedAuthor || isBlockedWord) {
                const placeholderBtn = doc.createElement("button");
                placeholderBtn.type = "button";
                placeholderBtn.setAttribute("data-psnine-next", "true");
                placeholderBtn.className = "psnine-filtered-tip-btn";
                placeholderBtn.style.cssText = "display:block;width:100%;text-align:left;padding:4px 8px;background:var(--p9n-surface-alt,#f8fafc);color:var(--p9n-muted,#5f6b7a);font-size:11px;border-radius:3px;border:1px dashed var(--p9n-border,#ccd6dd);cursor:pointer;user-select:none;";
                placeholderBtn.textContent = `\u{1F6AB} \u8BC4\u8BBA\u5DF2\u8FC7\u6EE4 (${isBlockedAuthor ? `\u9ED1\u540D\u5355\u7528\u6237 ${authorDisplay}` : `\u5C4F\u853D\u8BCD: ${blockedReasonWord}`}) - \u70B9\u51FB\u63ED\u793A\u5185\u5BB9`;
                const hiddenBody = doc.createElement("div");
                hiddenBody.setAttribute("data-psnine-next", "true");
                hiddenBody.style.display = "none";
                hiddenBody.style.marginTop = "4px";
                placeholderBtn.onclick = () => {
                  const isH = hiddenBody.style.display === "none";
                  hiddenBody.style.display = isH ? "block" : "none";
                  placeholderBtn.textContent = isH ? `\u{1F441}\uFE0F \u8BC4\u8BBA\u5DF2\u63ED\u793A (${authorDisplay}) - \u70B9\u51FB\u91CD\u65B0\u6298\u53E0` : `\u{1F6AB} \u8BC4\u8BBA\u5DF2\u8FC7\u6EE4 (${authorDisplay}) - \u70B9\u51FB\u63ED\u793A\u5185\u5BB9`;
                };
                itemDiv.appendChild(placeholderBtn);
                itemDiv.appendChild(hiddenBody);
                if (contentEl) {
                  const clone = contentEl.cloneNode(true);
                  clone.querySelectorAll("script, form").forEach((s) => s.remove());
                  const markEls = (clone.classList?.contains("mark") ? [clone] : []).concat(
                    Array.from(clone.querySelectorAll(".mark"))
                  );
                  markEls.forEach((m) => {
                    m.removeAttribute("data-psnine-mask-ready");
                    m.classList.remove("unmasked", "pinned");
                  });
                  bindInlineTipTrophyLinks(clone, () => currentTrophies, win, doc, url.origin);
                  hiddenBody.appendChild(clone);
                  enhanceMasks(ctx, hiddenBody);
                }
              } else {
                const directMetas = Array.from(liNode.querySelectorAll(":scope > .ml64 > .meta, :scope > .meta, :scope > div > .meta")).filter((m) => !m.closest(".sonlist") && m.closest("li") === liNode);
                const bottomMeta = directMetas.length > 1 ? directMetas[directMetas.length - 1] : directMetas[0] || null;
                const dateSpan = bottomMeta?.querySelector('.h-p, span[class*="date"], span.time') || liNode.querySelector(":scope > .meta .h-p, :scope > div > .meta .h-p");
                const timeStr = dateSpan?.textContent?.trim() || "";
                const likeBtn = bottomMeta?.querySelector('a[onclick*="up_tip"], a.btn-up, em.alert-success') || liNode.querySelector(':scope > .meta a[onclick*="up_tip"], :scope > div > .meta a[onclick*="up_tip"], a[onclick*="up_tip"]');
                let likes = null;
                if (likeBtn) {
                  const likesMatch = likeBtn.textContent?.match(/(\d+)/);
                  if (likesMatch) {
                    likes = parseInt(likesMatch[1], 10);
                  } else if (likeBtn.textContent && (likeBtn.textContent.includes("\u8D5E") || likeBtn.textContent.includes("\u9876"))) {
                    likes = 0;
                  }
                }
                const metaLine = doc.createElement("div");
                metaLine.setAttribute("data-psnine-next", "true");
                metaLine.style.cssText = "display:flex;justify-content:space-between;color:var(--p9n-muted,#5f6b7a);font-size:11px;margin-bottom:2px;";
                const authorSpan = doc.createElement("span");
                authorSpan.style.cssText = "font-weight:500;color:#3890ff;";
                authorSpan.textContent = authorDisplay;
                if (authorId) {
                  authorSpan.title = `PSNID: ${authorId}`;
                  authorSpan.setAttribute("data-psnid", authorId);
                }
                metaLine.appendChild(authorSpan);
                const timeLikesSpan = doc.createElement("span");
                if (likes !== null && likes > 0) {
                  timeLikesSpan.textContent = timeStr ? `${timeStr} | \u{1F44D} ${likes}` : `\u{1F44D} ${likes}`;
                } else {
                  timeLikesSpan.textContent = timeStr;
                }
                metaLine.appendChild(timeLikesSpan);
                itemDiv.appendChild(metaLine);
                if (contentEl) {
                  const bodyDiv = doc.createElement("div");
                  bodyDiv.setAttribute("data-psnine-next", "true");
                  bodyDiv.style.cssText = "line-height:1.5;";
                  const clone = contentEl.cloneNode(true);
                  clone.querySelectorAll("script, form").forEach((s) => s.remove());
                  const markEls = (clone.classList?.contains("mark") ? [clone] : []).concat(
                    Array.from(clone.querySelectorAll(".mark"))
                  );
                  markEls.forEach((m) => {
                    m.removeAttribute("data-psnine-mask-ready");
                    m.classList.remove("unmasked", "pinned");
                  });
                  bindInlineTipTrophyLinks(clone, () => currentTrophies, win, doc, url.origin);
                  bodyDiv.appendChild(clone);
                  enhanceMasks(ctx, bodyDiv);
                  itemDiv.appendChild(bodyDiv);
                }
              }
              container.appendChild(itemDiv);
            });
            td.appendChild(container);
          } catch (err) {
            if (!isActive || requestSignal.aborted || err?.name === "AbortError" || err?.message === "aborted") {
              tipRow.remove();
              return;
            }
            td.innerHTML = "";
            const errDiv = doc.createElement("div");
            errDiv.setAttribute("data-psnine-next", "true");
            errDiv.style.cssText = "font-size:12px;color:#e03131;";
            const errMsg = doc.createElement("span");
            errMsg.textContent = "\u274C \u52A0\u8F7D Tips \u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3002";
            errDiv.appendChild(errMsg);
            const retryBtn = doc.createElement("button");
            retryBtn.type = "button";
            retryBtn.setAttribute("data-psnine-next", "true");
            retryBtn.style.cssText = "margin-left:8px;padding:2px 6px;border:1px solid var(--p9n-border,#ccd6dd);border-radius:3px;cursor:pointer;";
            retryBtn.textContent = "\u91CD\u8BD5";
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
                pageAbortController.signal.removeEventListener("abort", onPageAbort);
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
          cleanupTipsToolbar?.();
          cleanupTipsToolbar = null;
          cleanupNativeSortDropdown?.();
          cleanupNativeSortDropdown = null;
          cleanupNativeFilterSync?.();
          cleanupNativeFilterSync = null;
          clearTrophyRowHighlight();
          pageAbortController.abort();
          batchAbortController?.abort();
          activeManualControllers.forEach((ctrl) => ctrl.abort());
          activeManualControllers.clear();
          unsubscribe();
        };
      }
    } catch (err) {
      report("trophies", err);
    }
  };

  // src/features/games.ts
  var VARIANTS_CACHE_PREFIX = "psnine_next:variants:";
  var ONE_DAY_MS = 24 * 3600 * 1e3;
  var INITIAL_SYNC_INTERVAL = 3600 * 1e3;
  var MAX_SYNC_INTERVAL = 24 * 3600 * 1e3;
  var userMutationQueues = /* @__PURE__ */ new Map();
  async function mutateUserProgress(store, userId, mutator) {
    const currentPromise = userMutationQueues.get(userId) || Promise.resolve({});
    const nextPromise = currentPromise.catch(() => {
    }).then(async () => {
      const progressKey = `psnine_next:progress:${userId}`;
      const rawCache = await store.get(progressKey, null);
      const valid = validateUserProgressData(rawCache, userId);
      const result = await mutator(valid);
      const updated = result || valid;
      await store.set(progressKey, updated);
      return updated;
    }).finally(() => {
      if (userMutationQueues.get(userId) === nextPromise) {
        userMutationQueues.delete(userId);
      }
    });
    userMutationQueues.set(userId, nextPromise);
    return nextPromise;
  }
  function validateUserProgressData(raw, expectedUserId) {
    const fallback = {
      userId: expectedUserId,
      games: {},
      lastFullSync: 0,
      nextRefresh: 0,
      refreshInterval: INITIAL_SYNC_INTERVAL,
      syncCursorPage: 1,
      syncStatus: "idle"
    };
    if (!raw || typeof raw !== "object") return fallback;
    const data = raw;
    if (data.userId !== expectedUserId) return fallback;
    const validGames = {};
    if (data.games && typeof data.games === "object") {
      for (const [gid, rec] of Object.entries(data.games)) {
        if (!/^\d+$/.test(gid)) continue;
        if (rec && typeof rec === "object" && typeof rec.percent === "number" && Number.isFinite(rec.percent) && rec.percent >= 0 && rec.percent <= 100 && typeof rec.platinum === "boolean" && typeof rec.updatedAt === "number" && Number.isFinite(rec.updatedAt) && rec.updatedAt > 0) {
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
      lastFullSync: typeof data.lastFullSync === "number" && Number.isFinite(data.lastFullSync) && data.lastFullSync > 0 ? data.lastFullSync : 0,
      nextRefresh: typeof data.nextRefresh === "number" && Number.isFinite(data.nextRefresh) && data.nextRefresh > 0 ? data.nextRefresh : 0,
      refreshInterval: typeof data.refreshInterval === "number" && Number.isFinite(data.refreshInterval) && data.refreshInterval >= INITIAL_SYNC_INTERVAL ? data.refreshInterval : INITIAL_SYNC_INTERVAL,
      syncCursorPage: typeof data.syncCursorPage === "number" && Number.isInteger(data.syncCursorPage) && data.syncCursorPage >= 1 ? data.syncCursorPage : 1,
      syncStatus: data.syncStatus === "partial" || data.syncStatus === "full" || data.syncStatus === "error" ? data.syncStatus : "idle"
    };
  }
  function normalizeGameTitle(title) {
    return (title || "").replace(/(^(\s*《\s*)+)|((\s*》\s*)+$)/g, "").replace(/\s*[（(]VR2?(\s*可选)?[）)]\s*$/gi, "").replace(/\s*Trophies\s*$/gi, "").replace(/^(?:\[|【|\()?(?:PSVITA|PSVR2?|PSPC|PS[345V]|PC)(?:\]|】|\))?\s*/i, "").replace(/\s*(中文)?(奖杯列表|测评评分|约战|问答|主题|游列)\s*$/i, "").replace(/[《》〈〉「」『』""'']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function extractGameId(urlStr) {
    const m = urlStr.match(/\/psngame\/(\d+)/);
    return m ? m[1] : null;
  }
  function isExplicitlyNoPlatinum(row) {
    const platSpan = row.querySelector(".text-platinum");
    if (platSpan) {
      const text = platSpan.textContent?.trim() || "";
      if (text === "\u767D0" || text === "0") return true;
      return false;
    }
    const em = row.querySelector("td.pd1015 em, td.title em, td em, .meta em");
    if (em) {
      const emText = em.textContent || "";
      if (emText.includes("\u91D1") && !emText.includes("\u767D")) {
        return true;
      }
    }
    return false;
  }
  function isPluginNode(el) {
    for (let cur = el; cur; cur = cur.parentElement) {
      if (cur.hasAttribute("data-psnine-next") || typeof cur.className === "string" && cur.className.includes("psnine-")) {
        return true;
      }
    }
    return false;
  }
  function getTextExcludingPluginNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return isPluginNode(node.parentElement) ? "" : node.textContent || "";
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      if (isPluginNode(el)) {
        return "";
      }
      let res = "";
      node.childNodes.forEach((child) => {
        res += getTextExcludingPluginNodes(child);
      });
      return res;
    }
    return "";
  }
  function extractElementProgressPercent(el) {
    if (!el || isPluginNode(el)) return null;
    const htmlEl = el;
    if (htmlEl.style && typeof htmlEl.style.width === "string" && htmlEl.style.width.trim()) {
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
    const styleAttr = el.getAttribute("style");
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
    const text = getTextExcludingPluginNodes(el).trim();
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
  function hasOfficialGameProgress(tr) {
    const progDiv = Array.from(tr.querySelectorAll(".progress-bar, .progress > div, div.progress")).find((el) => !isPluginNode(el));
    if (!progDiv) return false;
    const innerBar = Array.from(progDiv.querySelectorAll("div")).find((el) => !isPluginNode(el)) ?? null;
    const pct = extractElementProgressPercent(innerBar) ?? extractElementProgressPercent(progDiv);
    return pct !== null && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  }
  function parseGameRowProgress(tr) {
    const gameA = tr.querySelector('a[href*="/psngame/"]');
    if (!gameA) return null;
    const gid = extractGameId(gameA.href || gameA.getAttribute("href") || "");
    if (!gid) return null;
    let percent = null;
    const progDiv = Array.from(tr.querySelectorAll(".progress-bar, .progress > div, div.progress, .progress")).find((el) => !isPluginNode(el));
    if (progDiv) {
      const innerBar = Array.from(progDiv.querySelectorAll("div")).find((el) => !isPluginNode(el)) ?? null;
      percent = extractElementProgressPercent(innerBar) ?? extractElementProgressPercent(progDiv);
    }
    const platSpan = tr.querySelector(".text-platinum");
    const platText = platSpan ? getTextExcludingPluginNodes(platSpan).trim() : "";
    const hasPlatImg = tr.querySelector('img.earned[src*="platinum"]') !== null;
    const isPlatEarned = hasPlatImg || platSpan !== null && !platText.includes("\u767D0") && (platText.includes("\u767D1") || platText === "1");
    return { gameId: gid, percent, platinum: isPlatEarned };
  }
  function parseGameDifficulty(td) {
    if (!td) return -1;
    const text = td.textContent?.trim() || "";
    if (text.includes("\u73A9\u8FC7") || text.includes("\u8017\u65F6") || text.includes("\u6B21\u6570")) {
      return -1;
    }
    const em = td.querySelector("em");
    const emText = em?.textContent?.trim() || text;
    const m = emText.match(/([\d,.]+)\s*(?:%|点|难度|分)?/);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val)) return val;
    }
    return -1;
  }
  function sortGameRowsByDifficulty(rows, hardestFirst = true) {
    return [...rows].sort((a, b) => {
      const findDiffTd = (row) => {
        const twoges = row.querySelectorAll("td.twoge");
        for (const td of Array.from(twoges)) {
          const t = td.textContent || "";
          if (!t.includes("\u73A9\u8FC7") && !t.includes("\u8017\u65F6") && !t.includes("\u6B21\u6570")) {
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
      return hardestFirst ? valA - valB : valB - valA;
    });
  }
  function findMatchingTrophyAcrossVersions(sourceTrophy, targetVersionTrophies) {
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
  async function syncUserGameProgress(ctx, verifiedUserId, maxPages = 3) {
    let updatedCount = 0;
    let hasChanges = false;
    let finalStatus = "idle";
    await mutateUserProgress(ctx.store, verifiedUserId, async (cache) => {
      const startPage = cache.syncCursorPage || 1;
      let hasNextPage = true;
      let hasError = false;
      for (let batch = 0; batch < maxPages; batch++) {
        const curPage = startPage + batch;
        try {
          const pageUrl = new URL(`/psnid/${verifiedUserId}/psngame?page=${curPage}`, ctx.url.origin).href;
          const pageDoc = await ctx.http.document(pageUrl, { ttl: 3e5 });
          const isLoginOrError = pageDoc.querySelector('form[action*="login"], form[action*="signin"], input[type="password"], .alert-error, .alert-danger, .error-page') !== null || /登录|错误|Error|404|500/.test(pageDoc.title);
          if (isLoginOrError) {
            hasError = true;
            break;
          }
          const normUserId = verifiedUserId.toLowerCase();
          const expectedUserPath = `/psnid/${normUserId}`;
          const hasVerifiedAccount = Array.from(pageDoc.querySelectorAll('a[href*="/psnid/"], .psnzz a, .psninfo a')).some((a) => {
            const href = a.getAttribute("href") || "";
            try {
              const u = new URL(href, pageUrl);
              const p = u.pathname.replace(/\/+$/, "").toLowerCase();
              return p === expectedUserPath || p === `${expectedUserPath}/psngame`;
            } catch {
              return false;
            }
          }) || pageDoc.querySelector(".psnzz, .psninfo") !== null && pageDoc.querySelector(`a[href*="/psnid/${normUserId}"]`) !== null;
          const pageText = pageDoc.body ? pageDoc.body.textContent || "" : "";
          const isExplicitEmpty = /没有.*游戏|暂无.*游戏|暂无数据|没有找到/.test(pageText);
          const rows = pageDoc.querySelectorAll("table tr");
          if (rows.length === 0) {
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
            if (hasVerifiedAccount && isExplicitEmpty) {
              hasNextPage = false;
              break;
            }
            hasError = true;
            break;
          }
          let foundNextLink = false;
          const paginationLinks = pageDoc.querySelectorAll('.page a, a.next, a[href*="page="]');
          for (const a of Array.from(paginationLinks)) {
            const href = a.getAttribute("href") || "";
            if (!href || href === "#" || href.startsWith("javascript:")) continue;
            try {
              const nextUrl = new URL(href, pageUrl);
              if (nextUrl.origin !== ctx.url.origin) continue;
              const expectedPath = `/psnid/${normUserId}/psngame`;
              const actualPath = nextUrl.pathname.replace(/\/+$/, "").toLowerCase();
              if (actualPath !== expectedPath) continue;
              const pageParam = nextUrl.searchParams.get("page");
              if (pageParam && /^\d+$/.test(pageParam) && parseInt(pageParam, 10) === curPage + 1) {
                foundNextLink = true;
                break;
              }
            } catch {
            }
          }
          if (!foundNextLink) {
            hasNextPage = false;
            break;
          }
        } catch (err) {
          hasError = true;
          ctx.report("progress_sync_page", err);
          break;
        }
      }
      if (hasError) {
        cache.syncStatus = "error";
        finalStatus = "error";
        cache.nextRefresh = Date.now() + 15 * 60 * 1e3;
      } else if (!hasNextPage) {
        cache.syncStatus = "full";
        finalStatus = "full";
        cache.syncCursorPage = 1;
        cache.lastFullSync = Date.now();
      } else {
        cache.syncStatus = "partial";
        finalStatus = "partial";
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
  async function resolveGameVariants(ctx, gid, doc, preferSearch = false) {
    const cacheKey = `${VARIANTS_CACHE_PREFIX}${gid}`;
    const cached = await ctx.store.get(cacheKey, null);
    if (cached && Date.now() - cached.timestamp < ONE_DAY_MS && Array.isArray(cached.variants) && cached.variants.length > 0) {
      return cached.variants;
    }
    const variantsMap = /* @__PURE__ */ new Map();
    const tryMetadata = async () => {
      let metaLink = doc.querySelector('.side a[href*="/game/"]');
      let metaHref = metaLink?.href || metaLink?.getAttribute("href") || "";
      if (!metaHref) {
        try {
          const mainDoc = await ctx.http.document(new URL(`/psngame/${gid}`, ctx.url.origin).href, { ttl: ONE_DAY_MS });
          metaLink = mainDoc.querySelector('.side a[href*="/game/"]');
          metaHref = metaLink?.href || metaLink?.getAttribute("href") || "";
        } catch {
        }
      }
      if (metaHref) {
        try {
          const metaDoc = await ctx.http.document(new URL(metaHref, ctx.url.origin).href, { ttl: ONE_DAY_MS });
          const darklistLis = metaDoc.querySelectorAll(".min-inner > ul.darklist > li, ul.darklist > li");
          darklistLis.forEach((li) => {
            const links = Array.from(li.querySelectorAll('a[href*="/psngame/"]'));
            const platform = li.querySelector("span.r")?.textContent?.trim() || "";
            links.forEach((a) => {
              const vid = extractGameId(a.href || a.getAttribute("href") || "");
              if (vid && vid !== gid) {
                const text = a.textContent?.trim() || "";
                if (!variantsMap.has(vid) || !variantsMap.get(vid).title && text) {
                  variantsMap.set(vid, {
                    gameId: vid,
                    platform,
                    region: "",
                    title: text
                  });
                }
              }
            });
          });
        } catch (err) {
          ctx.report("meta_variants", err);
        }
      }
    };
    const trySearch = async () => {
      let rawTitle = doc.querySelector("h1, .box h1")?.textContent || "";
      let normTitle = normalizeGameTitle(rawTitle);
      if (!normTitle || ctx.url.pathname.includes("/trophy/")) {
        try {
          const parentGameDoc = await ctx.http.document(new URL(`/psngame/${gid}`, ctx.url.origin).href, { ttl: ONE_DAY_MS });
          rawTitle = parentGameDoc.querySelector("h1, .box h1")?.textContent || "";
          normTitle = normalizeGameTitle(rawTitle);
        } catch {
        }
      }
      if (!normTitle) return;
      try {
        const searchUrl = new URL(`/psngame?title=${encodeURIComponent(normTitle)}`, ctx.url.origin).href;
        const searchDoc = await ctx.http.document(searchUrl, { ttl: ONE_DAY_MS });
        searchDoc.querySelectorAll("td.pd1015, td.title").forEach((cell) => {
          const link = cell.querySelector('a[href*="/psngame/"]');
          const vid = extractGameId(link?.href || link?.getAttribute("href") || "");
          if (vid && vid !== gid) {
            const text = link?.textContent?.trim() || "";
            if (normalizeGameTitle(text) === normTitle) {
              const platform = cell.querySelector('span.r, span[class*="pf_"]')?.textContent?.trim() || "";
              if (!variantsMap.has(vid) || !variantsMap.get(vid).title && text) {
                variantsMap.set(vid, {
                  gameId: vid,
                  platform,
                  region: "",
                  title: text
                });
              }
            }
          }
        });
      } catch (err) {
        ctx.report("search_variants", err);
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
  var mountGames = async (ctx) => {
    const { document: doc, url, settings, store, userId, onContent, report } = ctx;
    let isActive = true;
    const abortController = new AbortController();
    const subscriptions = [];
    const isGameListPage = (url.pathname === "/psngame" || /^\/psngame\/page\/\d+/.test(url.pathname)) && !/^\/psngame\/\d+/.test(url.pathname);
    const isSingleGamePage = /^\/psngame\/\d+/.test(url.pathname);
    const isProfilePage = /^\/psnid\/[^/]+/.test(url.pathname);
    const isTrophyDetailPage = /^\/trophy\/\d+/.test(url.pathname);
    const pathParts = url.pathname.split("/");
    const profileId = isProfilePage ? pathParts[2] || "" : "";
    const isBareProfile = isProfilePage && (url.pathname === `/psnid/${profileId}` || url.pathname === `/psnid/${profileId}/`);
    const isMyProfile = Boolean(userId && profileId && userId.toLowerCase() === profileId.toLowerCase());
    try {
      const styleId = "psnine-enhanced-games-style";
      if (!doc.getElementById(styleId)) {
        const style = doc.createElement("style");
        style.id = styleId;
        style.setAttribute("data-psnine-next", "true");
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
        .psnine-game-list-progress-badge {
          display: inline-block !important;
          padding: 1px 6px !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          font-weight: 500 !important;
          border-radius: var(--p9n-radius-sm, 4px) !important;
          background-color: var(--p9n-surface-alt, #f4f6fa) !important;
          color: var(--p9n-text, #1f2937) !important;
          border: 1px solid var(--p9n-border, #ccd6dd) !important;
          margin-left: 6px !important;
          vertical-align: middle !important;
          box-sizing: border-box !important;
        }
        html[data-theme="dark"] .psnine-game-list-progress-badge {
          background-color: var(--p9n-surface-alt, #202c3a) !important;
          color: var(--p9n-text, #e6ebf2) !important;
          border-color: var(--p9n-border, #3b4859) !important;
        }
      `;
        doc.head.appendChild(style);
        doc.querySelectorAll("span.pf_pspc").forEach((tag) => {
          tag.closest("tr")?.querySelectorAll("img.imgbgnb").forEach((img) => img.removeAttribute("height"));
        });
      }
      let myProgress = {
        userId: userId || "",
        games: {},
        lastFullSync: 0,
        nextRefresh: 0,
        refreshInterval: INITIAL_SYNC_INTERVAL,
        syncCursorPage: 1,
        syncStatus: "idle"
      };
      if (userId) {
        const progressKey = `psnine_next:progress:${userId}`;
        const rawCache = await store.get(progressKey, null);
        myProgress = validateUserProgressData(rawCache, userId);
        if (Date.now() >= myProgress.nextRefresh) {
          syncUserGameProgress(ctx, userId).then(() => {
            if (!isActive || abortController.signal.aborted) return;
            store.get(progressKey, null).then((freshRaw) => {
              if (!isActive || abortController.signal.aborted) return;
              myProgress = validateUserProgressData(freshRaw, userId);
              refreshGameListBadgesAndBackgrounds();
            });
          }).catch((err) => report("bg_sync", err));
        }
      }
      const refreshGameListBadgesAndBackgrounds = () => {
        if (isProfilePage && !isMyProfile) {
          doc.querySelectorAll(".psnine-game-list-progress-badge").forEach((el) => el.remove());
          doc.querySelectorAll(".psnine-ondemand-progress-btn").forEach((el) => el.remove());
          return;
        }
        doc.querySelectorAll("table tr").forEach((tr) => {
          const gameA = tr.querySelector('a[href*="/psngame/"]');
          if (!gameA) return;
          const gid = extractGameId(gameA.href || gameA.getAttribute("href") || "");
          if (!gid) return;
          const row = tr;
          const hasOfficial = hasOfficialGameProgress(tr);
          if (hasOfficial) {
            row.querySelector(".psnine-game-list-progress-badge")?.remove();
            row.querySelector(".psnine-ondemand-progress-btn")?.remove();
            const rec2 = myProgress.games[gid];
            const parsed = parseGameRowProgress(tr);
            const isPlat = parsed?.platinum ?? rec2?.platinum ?? false;
            if (settings.platinumGlow && isPlat) {
              const coverImg = row.querySelector("img");
              if (coverImg) coverImg.classList.add("psnine-platinum-glow");
            }
            return;
          }
          const rec = myProgress.games[gid];
          if (!rec) return;
          row.querySelector(".psnine-ondemand-progress-btn")?.remove();
          let badge = row.querySelector(".psnine-game-list-progress-badge");
          if (!badge) {
            badge = doc.createElement("span");
            badge.className = "psnine-game-list-progress-badge";
            badge.setAttribute("data-psnine-next", "true");
            gameA.parentElement?.appendChild(badge);
          }
          badge.textContent = `${rec.percent}%`;
          if (settings.platinumGlow && rec.platinum) {
            const coverImg = row.querySelector("img");
            if (coverImg) coverImg.classList.add("psnine-platinum-glow");
          }
        });
      };
      if (isProfilePage) {
        if (isBareProfile) {
          const syncBtnId = "psnine-sync-psn-btn-group";
          if (!doc.getElementById(syncBtnId)) {
            const profileDataArea = doc.querySelector(".psnzz .inner, .psnbtnright form, .psninfo, .min-inner .box.pd10, .main > div.box");
            if (profileDataArea) {
              const group = doc.createElement("div");
              group.id = syncBtnId;
              group.setAttribute("data-psnine-next", "true");
              group.style.cssText = "display:inline-flex;flex-wrap:wrap;gap:8px;margin:8px 0;vertical-align:middle;max-width:100%;box-sizing:border-box;";
              const upbaseA = doc.createElement("a");
              upbaseA.setAttribute("data-psnine-next", "true");
              upbaseA.href = `https://psnine.com/psnid/${profileId}/upbase`;
              upbaseA.className = "psnine-btn psnine-sync-btn";
              upbaseA.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;font-size:13px;font-weight:500;border-radius:var(--p9n-radius-md,8px);background-color:var(--p9n-surface);color:var(--p9n-text);border:1px solid var(--p9n-border);text-decoration:none;touch-action:manipulation;box-sizing:border-box;";
              upbaseA.textContent = "\u{1F504} \u7B49\u7EA7\u540C\u6B65";
              group.appendChild(upbaseA);
              const upgameA = doc.createElement("a");
              upgameA.setAttribute("data-psnine-next", "true");
              upgameA.href = `https://psnine.com/psnid/${profileId}/upgame`;
              upgameA.className = "psnine-btn psnine-sync-btn";
              upgameA.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;font-size:13px;font-weight:500;border-radius:var(--p9n-radius-md,8px);background-color:var(--p9n-surface);color:var(--p9n-text);border:1px solid var(--p9n-border);text-decoration:none;touch-action:manipulation;box-sizing:border-box;";
              upgameA.textContent = "\u{1F3AE} \u6E38\u620F\u540C\u6B65";
              group.appendChild(upgameA);
              profileDataArea.appendChild(group);
            }
          }
        }
        if (isMyProfile && userId) {
          const scrapeTime = Date.now();
          const parsedVisibleRows = {};
          doc.querySelectorAll("table tr").forEach((tr) => {
            const parsed = parseGameRowProgress(tr);
            if (!parsed || parsed.percent === null) return;
            parsedVisibleRows[parsed.gameId] = {
              gameId: parsed.gameId,
              percent: parsed.percent,
              platinum: parsed.platinum,
              updatedAt: scrapeTime
            };
            if (settings.platinumGlow && parsed.platinum) {
              const coverImg = tr.querySelector("img");
              if (coverImg) coverImg.classList.add("psnine-platinum-glow");
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
              return cache;
            });
            myProgress = freshCache;
          }
        }
        if (isActive && !abortController.signal.aborted) {
          refreshGameListBadgesAndBackgrounds();
        }
        subscriptions.push(onContent(() => {
          if (isActive) refreshGameListBadgesAndBackgrounds();
        }));
      }
      if (isGameListPage) {
        let isHardestFirst = true;
        const enhanceGameList = () => {
          refreshGameListBadgesAndBackgrounds();
          const tables = doc.querySelectorAll("table");
          tables.forEach((table) => {
            table.querySelectorAll("tr").forEach((r) => {
              const row = r;
              if (isExplicitlyNoPlatinum(row)) {
                row.style.opacity = `${settings.filterNonePlatinumAlpha}`;
              }
              const gameA = row.querySelector('a[href*="/psngame/"]');
              if (gameA && userId) {
                const gid = extractGameId(gameA.href || gameA.getAttribute("href") || "");
                if (gid && !myProgress.games[gid]) {
                  const coverImg = row.querySelector("td.pd15 img, td.pdd15 img, img.imgbgnb");
                  if (coverImg && !coverImg.hasAttribute("data-psnine-demand-bound")) {
                    coverImg.setAttribute("data-psnine-demand-bound", "true");
                    let demandBtn = row.querySelector(".psnine-ondemand-progress-btn");
                    if (!demandBtn) {
                      demandBtn = doc.createElement("button");
                      demandBtn.type = "button";
                      demandBtn.className = "psnine-btn psnine-ondemand-progress-btn";
                      demandBtn.setAttribute("data-psnine-next", "true");
                      demandBtn.setAttribute("aria-label", "\u67E5\u8BE2\u4E2A\u4EBA\u8FDB\u5EA6");
                      demandBtn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:var(--p9n-radius-sm,4px);border:1px solid var(--p9n-border);background-color:var(--p9n-surface);color:var(--p9n-link);cursor:pointer;margin-left:6px;touch-action:manipulation;box-sizing:border-box;";
                      demandBtn.textContent = "\u{1F50D} \u67E5\u8FDB\u5EA6";
                      gameA.parentElement?.appendChild(demandBtn);
                    }
                    let isLoading = false;
                    const fetchOnDemand = async () => {
                      if (!isActive || abortController.signal.aborted || isLoading || myProgress.games[gid]) return;
                      isLoading = true;
                      if (demandBtn) demandBtn.textContent = "\u23F3 \u67E5\u8BE2\u4E2D...";
                      try {
                        const targetUrl = new URL(`/psngame/${gid}?psnid=${userId}`, ctx.url.origin).href;
                        const gameDoc = await ctx.http.document(targetUrl, { ttl: 6e5, signal: abortController.signal });
                        if (!isActive || abortController.signal.aborted) return;
                        const trophyRows = gameDoc.querySelectorAll("tr.trophy, table.list tr[id]");
                        if (trophyRows.length === 0) {
                          throw new Error("No trophies found (login required or invalid page)");
                        }
                        let isPlat = false;
                        const platRow = Array.from(trophyRows).find((tr) => extractTrophyType(tr) === "platinum");
                        if (platRow) {
                          isPlat = platRow.querySelector("img.earned, img.imgbg.earned, em.alert-success.r") !== null;
                        }
                        const userAnchor = gameDoc.querySelector(`.main p a[href*="/psnid/${userId}"], .box p a[href*="/psnid/${userId}"]`);
                        const hasEarnedMarker = gameDoc.querySelector("tr.trophy img.earned, tr.trophy .imgbg.earned, tr.trophy em.alert-success.r, img.earned");
                        if (!userAnchor && !hasEarnedMarker && trophyRows.length > 0) {
                          throw new Error("Not an authentic personal trophy page for user");
                        }
                        let earnedPoints = 0;
                        let totalPoints = 0;
                        trophyRows.forEach((tr) => {
                          const type = extractTrophyType(tr);
                          const weight = type === "bronze" ? 15 : type === "silver" ? 30 : type === "gold" ? 90 : 0;
                          if (weight > 0) {
                            totalPoints += weight;
                            const isEarned = tr.querySelector("img.earned, img.imgbg.earned, em.alert-success.r") !== null;
                            if (isEarned) {
                              earnedPoints += weight;
                            }
                          }
                        });
                        let pct = totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 100) : 0;
                        const mainProgBar = gameDoc.querySelector(".main .progress-bar, .main .progress > div, .box.pd10 .progress > div, .main div.progress");
                        if (mainProgBar) {
                          const innerBar = mainProgBar.querySelector("div");
                          const officialPct = extractElementProgressPercent(innerBar) ?? extractElementProgressPercent(mainProgBar);
                          if (officialPct !== null) {
                            pct = officialPct;
                          }
                        }
                        if (!isActive || abortController.signal.aborted) return;
                        const rec = {
                          gameId: gid,
                          percent: pct,
                          platinum: isPlat,
                          updatedAt: Date.now()
                        };
                        await mutateUserProgress(store, userId, (cache) => {
                          if (!isActive || abortController.signal.aborted) {
                            const abortErr = new Error("Aborted");
                            abortErr.name = "AbortError";
                            throw abortErr;
                          }
                          cache.games[gid] = rec;
                          return cache;
                        });
                        if (!isActive || abortController.signal.aborted) return;
                        myProgress.games[gid] = rec;
                        refreshGameListBadgesAndBackgrounds();
                      } catch (err) {
                        isLoading = false;
                        if (!isActive || abortController.signal.aborted || err?.name === "AbortError") return;
                        if (demandBtn) {
                          demandBtn.textContent = "\u274C \u91CD\u8BD5";
                          demandBtn.style.color = "#c92a2a";
                          demandBtn.style.borderColor = "#c92a2a";
                        }
                        report("demand_progress", err);
                      }
                    };
                    const onMouseEnter = () => {
                      fetchOnDemand();
                    };
                    const onTouchStart = () => {
                      fetchOnDemand();
                    };
                    const onClick = (e) => {
                      e.preventDefault();
                      fetchOnDemand();
                    };
                    const onKeyDown = (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fetchOnDemand();
                      }
                    };
                    coverImg.addEventListener("mouseenter", onMouseEnter);
                    coverImg.addEventListener("touchstart", onTouchStart);
                    demandBtn.addEventListener("click", onClick);
                    demandBtn.addEventListener("keydown", onKeyDown);
                    subscriptions.push(() => {
                      coverImg.removeEventListener("mouseenter", onMouseEnter);
                      coverImg.removeEventListener("touchstart", onTouchStart);
                      demandBtn?.removeEventListener("click", onClick);
                      demandBtn?.removeEventListener("keydown", onKeyDown);
                    });
                  }
                }
              }
            });
            if (!doc.getElementById("psnine-difficulty-sort-btn")) {
              const navOrHeader = doc.querySelector(".inav, .dropmenu, .box.pd10, .page-header");
              if (navOrHeader) {
                const sortBtn = doc.createElement("button");
                sortBtn.id = "psnine-difficulty-sort-btn";
                sortBtn.className = "psnine-btn psnine-difficulty-sort-btn";
                sortBtn.type = "button";
                sortBtn.setAttribute("data-psnine-next", "true");
                sortBtn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 14px;font-size:13px;font-weight:500;border-radius:var(--p9n-radius-md,8px);border:1px solid var(--p9n-border);background-color:var(--p9n-surface);color:var(--p9n-text);cursor:pointer;margin:6px 0;touch-action:manipulation;box-sizing:border-box;";
                sortBtn.textContent = "\u{1F4CA} \u6309\u96BE\u5EA6\u6392\u5E8F (\u4ECE\u96BE\u5230\u6613)";
                sortBtn.onclick = () => {
                  const currentRows = Array.from(table.querySelectorAll("tr")).filter(
                    (r) => r.querySelector('a[href*="/psngame/"]') && (r.querySelector("td.pd1015") || r.querySelector("td.pd15") || r.querySelector("td.pdd15"))
                  );
                  isHardestFirst = !isHardestFirst;
                  sortBtn.textContent = isHardestFirst ? "\u{1F4CA} \u6309\u96BE\u5EA6\u6392\u5E8F (\u4ECE\u96BE\u5230\u6613)" : "\u{1F4CA} \u6309\u96BE\u5EA6\u6392\u5E8F (\u4ECE\u6613\u5230\u96BE)";
                  const sortedRows = sortGameRowsByDifficulty(currentRows, isHardestFirst);
                  const tbody = table.querySelector("tbody") || table;
                  sortedRows.forEach((r) => tbody.appendChild(r));
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
      if (isSingleGamePage) {
        const gid = extractGameId(url.pathname);
        const isBareGameTrophyPage = /^\/psngame\/\d+\/?$/.test(url.pathname);
        if (gid && isBareGameTrophyPage) {
          const hasPsnid = url.searchParams.has("psnid");
          const existingPsnid = url.searchParams.get("psnid");
          if (userId && settings.redirectToMine && (!hasPsnid || existingPsnid === userId)) {
            const targetUrl = new URL(url.href);
            targetUrl.searchParams.set("psnid", userId);
            if (!hasPsnid) {
              ctx.window.location.replace(targetUrl.href);
            }
            let toMineBtn = doc.getElementById("psnine-to-mine-trophy-btn");
            if (!toMineBtn) {
              const inav = doc.querySelector("ul.inav, .main > ul.inav, .box.pd10");
              if (inav) {
                toMineBtn = doc.createElement("a");
                toMineBtn.id = "psnine-to-mine-trophy-btn";
                toMineBtn.className = "psnine-btn psnine-to-mine-btn";
                toMineBtn.setAttribute("data-psnine-next", "true");
                toMineBtn.setAttribute("href", targetUrl.href);
                toMineBtn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 14px;font-size:13px;font-weight:500;border-radius:var(--p9n-radius-md,8px);background-color:var(--p9n-surface);color:var(--p9n-text);border:1px solid var(--p9n-border);text-decoration:none;margin-left:8px;touch-action:manipulation;box-sizing:border-box;";
                toMineBtn.textContent = "\u{1F3C6} \u5207\u6362\u81F3\u6211\u7684\u5956\u676F\u8FDB\u5EA6";
                inav.appendChild(toMineBtn);
              }
            }
          }
        }
        if (gid && settings.referGameVariants && !doc.getElementById("psnine-game-variants-section")) {
          resolveGameVariants(ctx, gid, doc, settings.preferSearchForFindingVariants).then((variants) => {
            if (!isActive || variants.length === 0 || doc.getElementById("psnine-game-variants-section")) return;
            const variantsDiv = doc.createElement("div");
            variantsDiv.id = "psnine-game-variants-section";
            variantsDiv.setAttribute("data-psnine-next", "true");
            variantsDiv.style.cssText = "margin:12px 0;padding:10px 14px;background-color:var(--p9n-surface-alt);border:1px solid var(--p9n-border);border-radius:var(--p9n-radius-md,8px);color:var(--p9n-text);box-sizing:border-box;";
            const subPageMatch = url.pathname.match(/\/psngame\/\d+(\/[^/?#]+)/);
            const subPath = subPageMatch ? subPageMatch[1] : "";
            const heading = doc.createElement("div");
            heading.setAttribute("data-psnine-next", "true");
            heading.style.cssText = "font-weight:600;font-size:13px;margin-bottom:6px;";
            heading.textContent = "\u{1F3AE} \u672C\u6E38\u620F\u5176\u4ED6\u7248\u672C/\u5E73\u53F0\u5173\u8054\uFF1A";
            variantsDiv.appendChild(heading);
            const btnContainer = doc.createElement("div");
            btnContainer.setAttribute("data-psnine-next", "true");
            btnContainer.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;";
            variants.forEach((v) => {
              const a = doc.createElement("a");
              a.className = "psnine-btn psnine-variant-btn";
              a.setAttribute("data-psnine-next", "true");
              a.href = new URL(`/psngame/${v.gameId}${subPath}${url.search}`, ctx.url.origin).href;
              a.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 12px;font-size:13px;font-weight:500;border-radius:var(--p9n-radius-sm,6px);background-color:var(--p9n-surface);color:var(--p9n-link);text-decoration:none;border:1px solid var(--p9n-border);touch-action:manipulation;box-sizing:border-box;";
              const platformPrefix = v.platform ? `[${v.platform}] ` : "";
              a.textContent = `${platformPrefix}${v.title || "\u7248\u672C"} (#${v.gameId})`;
              btnContainer.appendChild(a);
            });
            variantsDiv.appendChild(btnContainer);
            const targetBar = doc.querySelector(".main > ul.inav, .inav, .box.pd10");
            if (targetBar && targetBar.parentElement) {
              targetBar.parentElement.insertBefore(variantsDiv, targetBar.nextSibling);
            }
          }).catch((err) => report("variants_resolve", err));
        }
      }
      if (isTrophyDetailPage && settings.referGameVariants && !doc.getElementById("psnine-cross-version-tips-section")) {
        const currentTrophyMatch = url.pathname.match(/\/trophy\/(\d+)/);
        if (currentTrophyMatch) {
          const currentTrophyId = currentTrophyMatch[1];
          const gameLink = doc.querySelector('a[href*="/psngame/"]');
          const gid = gameLink ? extractGameId(gameLink.href || "") : null;
          if (gid) {
            const h1Text = doc.querySelector("h1")?.textContent?.trim() || "";
            const nameMatch = h1Text.match(/《([^》]+)》奖杯/);
            const trophyName = nameMatch ? nameMatch[1] : h1Text.replace(/奖杯.*$/, "").trim();
            const descEl = doc.querySelector(".box.pd5 em, .box.pd10 em, td.title em, .text-strong");
            const trophyDesc = descEl?.textContent?.trim() || "";
            const sourceTrophy = { trophyId: currentTrophyId, name: trophyName, description: trophyDesc };
            resolveGameVariants(ctx, gid, doc, settings.preferSearchForFindingVariants).then(async (variants) => {
              if (!isActive || variants.length === 0) return;
              for (const variant of variants) {
                try {
                  const variantGameDoc = await ctx.http.document(new URL(`/psngame/${variant.gameId}`, ctx.url.origin).href, { ttl: ONE_DAY_MS });
                  const targetTrophies = [];
                  variantGameDoc.querySelectorAll("tr.trophy, table.list tr[id]").forEach((tr) => {
                    const a = tr.querySelector('td:nth-child(2) > a, td:nth-child(2) a[href*="/trophy/"], a[href*="/trophy/"]');
                    if (!a) return;
                    const tm = (a.href || a.getAttribute("href") || "").match(/\/trophy\/(\d+)/);
                    if (tm) {
                      const tName = a.textContent?.trim() || "";
                      const tDesc = tr.querySelector("td:nth-child(2) em, .text-strong, div.mt10")?.textContent?.trim() || "";
                      targetTrophies.push({ trophyId: tm[1], name: tName, description: tDesc });
                    }
                  });
                  const matched = findMatchingTrophyAcrossVersions(sourceTrophy, targetTrophies);
                  if (matched && isActive) {
                    let crossDiv = doc.getElementById("psnine-cross-version-tips-section");
                    if (!crossDiv) {
                      crossDiv = doc.createElement("div");
                      crossDiv.id = "psnine-cross-version-tips-section";
                      crossDiv.setAttribute("data-psnine-next", "true");
                      crossDiv.style.cssText = "margin:12px 0;padding:10px 14px;background-color:var(--p9n-surface-alt);border:1px solid var(--p9n-border);border-radius:var(--p9n-radius-md,8px);color:var(--p9n-text);box-sizing:border-box;";
                      const header = doc.createElement("div");
                      header.setAttribute("data-psnine-next", "true");
                      header.style.cssText = "font-weight:600;font-size:13px;margin-bottom:6px;";
                      header.textContent = "\u{1F3AE} \u8BE5\u6E38\u620F\u5176\u4ED6\u7248\u672C\u7684\u5956\u676FTips\uFF1A";
                      crossDiv.appendChild(header);
                      const contentArea = doc.querySelector(".main, .box.pd10, .min-inner");
                      contentArea?.insertBefore(crossDiv, contentArea.firstChild);
                    }
                    const linkA = doc.createElement("a");
                    linkA.className = "psnine-btn psnine-cross-tip-btn";
                    linkA.setAttribute("data-psnine-next", "true");
                    linkA.href = new URL(`/trophy/${matched.trophyId}`, ctx.url.origin).href;
                    linkA.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 12px;margin-right:8px;font-size:13px;font-weight:500;border-radius:var(--p9n-radius-sm,6px);background-color:var(--p9n-surface);color:var(--p9n-link);border:1px solid var(--p9n-border);text-decoration:none;touch-action:manipulation;box-sizing:border-box;";
                    linkA.textContent = `${variant.title || `\u7248\u672C #${variant.gameId}`} \u7684Tips (#${matched.trophyId}) \u2197`;
                    crossDiv.appendChild(linkA);
                  }
                } catch (err) {
                  report("cross_trophy_tips", err);
                }
              }
            }).catch((err) => report("resolve_variants_for_tips", err));
          }
        }
      }
      return () => {
        isActive = false;
        abortController.abort();
        subscriptions.forEach((unsub) => unsub());
        doc.querySelectorAll(".psnine-game-list-progress-badge").forEach((el) => el.remove());
      };
    } catch (err) {
      report("games", err);
    }
  };

  // src/features/deals.ts
  var ONE_DAY_MS2 = 24 * 3600 * 1e3;
  var MAX_FRESHNESS_MS = 7 * ONE_DAY_MS2;
  function escapeXml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function getTodayShanghaiString(now = /* @__PURE__ */ new Date()) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(now);
  }
  function isValidFxDate(dateStr, now = /* @__PURE__ */ new Date()) {
    if (!dateStr || typeof dateStr !== "string") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const parts = dateStr.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isValidCalendarDate(y, m, d)) return false;
    const todayStr = getTodayShanghaiString(now);
    if (dateStr > todayStr) {
      return false;
    }
    return true;
  }
  function isValidCalendarDate(year, month1Based, day) {
    if (year < 1990 || year > 2100) return false;
    if (month1Based < 1 || month1Based > 12) return false;
    if (day < 1 || day > 31) return false;
    const d = new Date(Date.UTC(year, month1Based - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month1Based && d.getUTCDate() === day;
  }
  function getDiscountColor(percent) {
    if (percent <= 0) return "#868e96";
    if (percent < 30) return "#4dabf7";
    if (percent < 50) return "#20c997";
    if (percent < 70) return "#fd7e14";
    if (percent < 85) return "#fa5252";
    return "#e03131";
  }
  function parsePrice(el) {
    if (!el) return null;
    const text = el.textContent?.trim() || "";
    if (!text) return null;
    if (/免费/.test(text)) return 0;
    const m = text.match(/[\d,]+(?:\.\d+)?/);
    if (!m) return null;
    const num = parseFloat(m[0].replace(/,/g, ""));
    return Number.isFinite(num) ? num : null;
  }
  function parseDateRange(text) {
    const clean = text.trim();
    const m = clean.match(/(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})日\s*~\s*(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})日/);
    if (m) {
      let y1 = m[1] ? parseInt(m[1], 10) : (/* @__PURE__ */ new Date()).getFullYear();
      if (y1 < 100) y1 += 2e3;
      const mo1 = parseInt(m[2], 10);
      const d1 = parseInt(m[3], 10);
      let y2 = m[4] ? parseInt(m[4], 10) : y1;
      if (y2 < 100) y2 += 2e3;
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
      const sStr = `${y1}-${mo1.toString().padStart(2, "0")}-${d1.toString().padStart(2, "0")}`;
      const eStr = `${y2}-${mo2.toString().padStart(2, "0")}-${d2.toString().padStart(2, "0")}`;
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
      const sStr = `${y1}-${mo1.toString().padStart(2, "0")}-${d1.toString().padStart(2, "0")}`;
      const eStr = `${y2}-${mo2.toString().padStart(2, "0")}-${d2.toString().padStart(2, "0")}`;
      return { start: sStr, end: eStr, startTime, endTime };
    }
    return null;
  }
  function convertToCny(foreignAmount, currency, ratesData, fallbackRates = {}, fallbackDate = "", now = /* @__PURE__ */ new Date()) {
    if (typeof foreignAmount !== "number" || !Number.isFinite(foreignAmount) || foreignAmount < 0) {
      return null;
    }
    const curr = currency.toUpperCase().trim();
    if (curr === "CNY" || curr === "CN" || curr === "RMB") {
      return {
        convertedAmount: foreignAmount,
        formattedCny: `\xA5${foreignAmount.toFixed(2)}`,
        sourceDate: "\u65E0\u9700\u6362\u7B97",
        sourceName: "\u539F\u5E01\u79CD\u4EBA\u6C11\u5E01",
        isStaleOrFallback: false,
        isExpired: false,
        badgeText: "(\u65E0\u9700\u6362\u7B97)",
        titleText: "\u539F\u5E01\u79CD\u4EBA\u6C11\u5E01"
      };
    }
    let ratePerCny;
    let sourceDate = "";
    let sourceName = "Frankfurter API";
    let isStaleOrFallback = false;
    let isExpired = false;
    if (ratesData) {
      if (ratesData.base === "CNY" && isValidFxDate(ratesData.date, now) && ratesData.rates && typeof ratesData.rates === "object") {
        const r = ratesData.rates[curr];
        if (typeof r === "number" && Number.isFinite(r) && r > 0) {
          ratePerCny = r;
          sourceDate = ratesData.date;
          const rateMs = (/* @__PURE__ */ new Date(ratesData.date + "T00:00:00Z")).getTime();
          if (now.getTime() - rateMs > MAX_FRESHNESS_MS) {
            isExpired = true;
            isStaleOrFallback = true;
          }
        }
      }
    }
    if (!ratePerCny && fallbackRates && typeof fallbackRates === "object") {
      if (isValidFxDate(fallbackDate, now)) {
        const fRate = fallbackRates[curr];
        if (typeof fRate === "number" && Number.isFinite(fRate) && fRate > 0) {
          const rateMs = (/* @__PURE__ */ new Date(fallbackDate + "T00:00:00Z")).getTime();
          const expired = now.getTime() - rateMs > MAX_FRESHNESS_MS;
          const converted2 = Number((foreignAmount * fRate).toFixed(2));
          const badgeText2 = expired ? `(\u7EA6 \xA5${converted2.toFixed(2)} [\u5DF2\u8FC7\u671F])` : `(\u7EA6 \xA5${converted2.toFixed(2)})`;
          const titleText2 = expired ? `\u6C47\u7387\u6765\u6E90: \u7528\u6237\u8BBE\u7F6E\u6C47\u7387 (${fallbackDate} \u5DF2\u8FC7\u671F)` : `\u6C47\u7387\u6765\u6E90: \u7528\u6237\u8BBE\u7F6E\u6C47\u7387 (${fallbackDate})`;
          return {
            convertedAmount: converted2,
            formattedCny: `\xA5${converted2.toFixed(2)}`,
            sourceDate: fallbackDate,
            sourceName: "\u7528\u6237\u8BBE\u7F6E\u6C47\u7387",
            isStaleOrFallback: true,
            isExpired: expired,
            badgeText: badgeText2,
            titleText: titleText2
          };
        }
      }
    }
    if (!ratePerCny || ratePerCny <= 0) {
      return null;
    }
    const cnyPerForeign = 1 / ratePerCny;
    const converted = Number((foreignAmount * cnyPerForeign).toFixed(2));
    const badgeText = isExpired ? `(\u7EA6 \xA5${converted.toFixed(2)} [\u5DF2\u8FC7\u671F])` : `(\u7EA6 \xA5${converted.toFixed(2)})`;
    const titleText = isExpired ? `\u6C47\u7387\u6765\u6E90: ${sourceName} (${sourceDate} \u5DF2\u8FC7\u671F)` : `\u6C47\u7387\u6765\u6E90: ${sourceName} (${sourceDate})`;
    return {
      convertedAmount: converted,
      formattedCny: `\xA5${converted.toFixed(2)}`,
      sourceDate: sourceDate || "\u672A\u77E5\u65E5\u671F",
      sourceName,
      isStaleOrFallback,
      isExpired,
      badgeText,
      titleText
    };
  }
  function extractPromotionEvents(root) {
    const events = [];
    const boxes = root.querySelectorAll("li.dd_box");
    boxes.forEach((b) => {
      let dateText = "";
      let region = null;
      let currency = null;
      b.querySelectorAll("p.dd_text").forEach((p) => {
        const t = p.textContent || "";
        if (t.includes("~")) dateText = t;
        if (t.includes("\u65E5\u670D")) {
          region = "\u65E5\u670D";
          currency = "JPY";
        } else if (t.includes("\u7F8E\u670D")) {
          region = "\u7F8E\u670D";
          currency = "USD";
        } else if (t.includes("\u82F1\u670D")) {
          region = "\u82F1\u670D";
          currency = "GBP";
        } else if (t.includes("\u56FD\u670D")) {
          region = "\u56FD\u670D";
          currency = "CNY";
        } else if (t.includes("\u6E2F\u670D")) {
          region = "\u6E2F\u670D";
          currency = "HKD";
        }
      });
      const range = parseDateRange(dateText);
      if (!range) return;
      const oldPriceEl = b.querySelector(".dd_price_old");
      const offPriceEl = b.querySelector(".dd_price_off");
      const plusPriceEl = b.querySelector(".dd_price_plus");
      if (!currency) {
        const allPriceText = b.querySelector(".dd_price")?.textContent || "";
        if (allPriceText.includes("HK$")) {
          currency = "HKD";
          region = region || "\u6E2F\u670D";
        } else if (allPriceText.includes("\u5186")) {
          currency = "JPY";
          region = region || "\u65E5\u670D";
        } else if (allPriceText.includes("\xA3")) {
          currency = "GBP";
          region = region || "\u82F1\u670D";
        } else if (allPriceText.includes("\xA5")) {
          if (region === "\u56FD\u670D") {
            currency = "CNY";
          } else {
            currency = "JPY";
            region = region || "\u65E5\u670D";
          }
        } else if (allPriceText.includes("$")) {
          if (region === "\u6E2F\u670D") {
            currency = "HKD";
          } else {
            currency = "USD";
            region = region || "\u7F8E\u670D";
          }
        }
      }
      const oldPrice = parsePrice(oldPriceEl);
      const offPrice = parsePrice(offPriceEl);
      const plusPrice = plusPriceEl ? parsePrice(plusPriceEl) : null;
      const isBest = b.querySelector(".dd_status_best, .store_tag_best") !== null;
      const activityA = b.querySelector('.dd_text a[href*="topic"], .dd_info p.dd_text a');
      const titleA = activityA || b.querySelector(".dd_info h4.dd_title a, .dd_text a, .dd_info a");
      const title = titleA?.textContent?.trim() || "\u6298\u6263\u6D3B\u52A8";
      const prodLink = b.querySelector(".dd_pic a");
      const prodHref = prodLink?.getAttribute("href") || "";
      const prodMatch = prodHref.match(/\/dd\/([A-Za-z0-9_-]+)/);
      const productId = prodMatch ? prodMatch[1] : null;
      events.push({
        title,
        region: region || "\u672A\u77E5\u5730\u533A",
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
  function buildPricePointsFromEvents(events) {
    if (events.length === 0) return [];
    const targetCurrency = events.find((e) => e.currency !== null)?.currency;
    const filteredEvents = targetCurrency ? events.filter((e) => e.currency === targetCurrency) : events;
    const points = [];
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
      const recoveryTime = ev.endTime + ONE_DAY_MS2;
      const nextEvent = filteredEvents[i + 1];
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
  function buildPriceStepTimeline(events) {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) => a.startTime - b.startTime);
    const boundarySet = /* @__PURE__ */ new Set();
    for (const ev of sorted) {
      boundarySet.add(ev.startTime);
      boundarySet.add(ev.endTime + ONE_DAY_MS2);
    }
    const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
    const rawIntervals = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const tStart = boundaries[i];
      const tEnd = boundaries[i + 1];
      const activeEvents = sorted.filter((e) => e.startTime <= tStart && e.endTime + ONE_DAY_MS2 >= tEnd);
      if (activeEvents.length > 0) {
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
        const pastEvents = sorted.filter((e) => e.endTime + ONE_DAY_MS2 <= tStart);
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
    const merged = [];
    for (const interval of rawIntervals) {
      if (merged.length === 0) {
        merged.push({ ...interval });
      } else {
        const prev = merged[merged.length - 1];
        if (prev.tEnd === interval.tStart && prev.normalPrice === interval.normalPrice && prev.plusPrice === interval.plusPrice) {
          prev.tEnd = interval.tEnd;
          prev.endDate = interval.endDate;
        } else {
          merged.push({ ...interval });
        }
      }
    }
    const maxRevertTime = Math.max(...sorted.map((e) => e.endTime + ONE_DAY_MS2));
    const activeAtFinalBoundary = sorted.filter((e) => e.startTime < maxRevertTime && e.endTime + ONE_DAY_MS2 >= maxRevertTime);
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
  function generateStepPath(intervals, getX, getY, priceSelector) {
    const parts = [];
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
    return parts.join(" ");
  }
  function renderPriceHistorySvg(pointsOrEvents, currencySymbol = "HK$", eventsList) {
    let displayEvents = [];
    if (eventsList && eventsList.length > 0) {
      displayEvents = eventsList;
    } else if (pointsOrEvents.length > 0 && "startDate" in pointsOrEvents[0]) {
      displayEvents = pointsOrEvents;
    }
    let intervals = [];
    if (displayEvents.length > 0) {
      intervals = buildPriceStepTimeline(displayEvents);
    } else if (pointsOrEvents.length >= 2) {
      const pts = pointsOrEvents;
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
      return '<div data-psnine-next="true" style="padding:10px;color:#888;">\u9700\u81F3\u5C11\u4E00\u6761\u6709\u6548\u5386\u53F2\u4FC3\u9500\u8BB0\u5F55\u751F\u6210\u8D70\u52BF\u56FE</div>';
    }
    const svgWidth = 500;
    const svgHeight = 220;
    const margin = { top: 25, right: 35, bottom: 40, left: 50 };
    const innerWidth = svgWidth - margin.left - margin.right;
    const innerHeight = svgHeight - margin.top - margin.bottom;
    const validPrices = [];
    for (const seg of intervals) {
      if (seg.normalPrice !== null) {
        validPrices.push({ price: seg.normalPrice, time: seg.tStart, date: seg.startDate });
      }
      if (seg.plusPrice !== null) {
        validPrices.push({ price: seg.plusPrice, time: seg.tStart, date: seg.startDate });
      }
    }
    const minPrice = 0;
    const maxPriceNum = validPrices.length > 0 ? Math.max(...validPrices.map((v) => v.price)) : 100;
    const maxPrice = Math.max(10, Math.ceil(maxPriceNum * 1.15));
    const priceSpan = maxPrice - minPrice;
    const minTime = intervals[0].tStart;
    const maxTime = intervals[intervals.length - 1].tEnd;
    const timeSpan = Math.max(1, maxTime - minTime);
    const getX = (t) => margin.left + (t - minTime) / timeSpan * innerWidth;
    const getY = (p) => margin.top + innerHeight - (p - minPrice) / priceSpan * innerHeight;
    const normalPath = generateStepPath(intervals, getX, getY, (seg) => seg.normalPrice);
    const plusPath = generateStepPath(intervals, getX, getY, (seg) => seg.plusPrice);
    let lowestPrice = null;
    let lowestPt = null;
    if (validPrices.length > 0) {
      lowestPrice = Math.min(...validPrices.map((v) => v.price));
      const lowest = validPrices.find((v) => v.price === lowestPrice);
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
    let tableHtml = "";
    if (displayEvents.length > 0) {
      const rowsHtml = displayEvents.map((ev) => {
        const normalStr = ev.offPrice !== null ? `${safeCurrency}${ev.offPrice.toFixed(2)}` : "\u672A\u77E5";
        const plusStr = ev.plusPrice === 0 ? "\u514D\u8D39 (0.00)" : ev.plusPrice !== null ? `${safeCurrency}${ev.plusPrice.toFixed(2)}` : "-";
        const oldStr = ev.oldPrice !== null ? `${safeCurrency}${ev.oldPrice.toFixed(2)}` : "\u672A\u77E5";
        return `
        <tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
          <td style="padding:6px 8px;">${escapeXml(ev.title)}</td>
          <td style="padding:6px 8px;">${escapeXml(ev.startDate)} ~ ${escapeXml(ev.endDate)}</td>
          <td style="padding:6px 8px;">${normalStr}</td>
          <td style="padding:6px 8px;">${plusStr}</td>
          <td style="padding:6px 8px;">${oldStr}</td>
        </tr>
      `;
      }).join("");
      tableHtml = `
      <div class="psnine-price-history-table-wrapper" style="margin-top:12px;overflow-x:auto;">
        <table class="psnine-price-history-table" style="width:100%;font-size:12px;text-align:left;border-collapse:collapse;border:1px solid rgba(0,0,0,0.1);" summary="\u5546\u54C1\u5386\u53F2\u4EF7\u683C\u8D70\u52BF\u660E\u7EC6">
          <caption style="text-align:left;font-weight:600;padding:4px 0;">\u4FC3\u9500\u5386\u53F2\u6570\u636E\u660E\u7EC6 (\u53EF\u952E\u76D8\u8BBF\u95EE)</caption>
          <thead>
            <tr style="background:rgba(0,0,0,0.04);border-bottom:1px solid rgba(0,0,0,0.1);">
              <th scope="col" style="padding:6px 8px;">\u6D3B\u52A8\u540D\u79F0</th>
              <th scope="col" style="padding:6px 8px;">\u4FC3\u9500\u5468\u671F</th>
              <th scope="col" style="padding:6px 8px;">\u666E\u901A\u4F1A\u5458\u4EF7</th>
              <th scope="col" style="padding:6px 8px;">PS+\u4F1A\u5458\u4EF7</th>
              <th scope="col" style="padding:6px 8px;">\u539F\u4EF7\u6062\u590D</th>
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
      <desc>\u5386\u53F2\u4EF7\u683C\u9636\u68AF\u8D70\u52BF\u56FE\uFF0C\u5305\u542B\u666E\u901A\u4F1A\u5458\u4EF7\u4E0E PS+ \u4F1A\u5458\u4EF7\u9636\u68AF\u8D70\u52BF\u53CA\u539F\u4EF7\u6062\u590D\u8BB0\u5F55</desc>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="currentColor" stroke-opacity="0.3" stroke-width="1" />

      <text x="${margin.left - 6}" y="${margin.top + 6}" text-anchor="end" font-size="10" fill="currentColor">${safeCurrency}${maxPrice}</text>
      <text x="${margin.left - 6}" y="${margin.top + innerHeight}" text-anchor="end" font-size="10" fill="currentColor">${safeCurrency}0</text>

      <text x="${margin.left}" y="${margin.top + innerHeight + 18}" text-anchor="start" font-size="10" fill="currentColor">${escapeXml(displayStartDate)}</text>
      <text x="${margin.left + innerWidth}" y="${margin.top + innerHeight + 18}" text-anchor="end" font-size="10" fill="currentColor">${escapeXml(displayEndDate)}</text>

      ${normalPath ? `<path d="${normalPath}" fill="none" stroke="#00a2ff" stroke-width="2.5" />` : ""}
      ${plusPath ? `<path d="${plusPath}" fill="none" stroke="#ffd633" stroke-width="2.5" stroke-dasharray="6,3" />` : ""}

      ${lowestPt && lowestPrice !== null ? `
        <circle cx="${lowestPt.cx.toFixed(1)}" cy="${lowestPt.cy.toFixed(1)}" r="5" fill="#e03131" stroke="#fff" stroke-width="1.5">
          <title>\u5386\u53F2\u53F2\u4F4E: ${safeCurrency}${lowestPrice.toFixed(2)} (${escapeXml(lowestPt.date)})</title>
        </circle>
      ` : ""}

      <g transform="translate(${margin.left + 10}, ${margin.top - 8})">
        <line x1="0" y1="0" x2="16" y2="0" stroke="#00a2ff" stroke-width="2" />
        <text x="20" y="3" font-size="11" fill="currentColor">\u666E\u901A\u4F1A\u5458\u4EF7</text>
        <line x1="100" y1="0" x2="116" y2="0" stroke="#ffd633" stroke-width="2" stroke-dasharray="4,2" />
        <text x="120" y="3" font-size="11" fill="currentColor">PS+\u4F1A\u5458\u4EF7</text>
      </g>
    </svg>
    ${tableHtml}
  `;
  }
  var mountDeals = (ctx) => {
    const { document: doc, url, settings, onContent, report } = ctx;
    const isDealsPage = url.pathname.includes("/dd") || url.pathname.includes("/huodong") || url.pathname.includes("/game/");
    if (!isDealsPage) return () => {
    };
    const isSingleProductDealPage = /^\/dd\/[A-Za-z0-9_-]+/.test(url.pathname) || /\/game\/\d+\/dd/.test(url.pathname);
    let isMounted = true;
    const abortController = new AbortController();
    let pendingLoadPromise = null;
    try {
      let currentShowCny = settings.currencyConversion;
      let ratesData = null;
      let ratesFetchFailed = false;
      let isBestOnlyFilterActive = false;
      const loadRates = async () => {
        if (!isMounted || abortController.signal.aborted) return null;
        if (ratesData) return ratesData;
        if (pendingLoadPromise) return pendingLoadPromise;
        pendingLoadPromise = (async () => {
          const CACHE_KEY = "psnine_next:rates:latest";
          try {
            const cached = await ctx.store.get(CACHE_KEY, null);
            if (!isMounted || abortController.signal.aborted) return null;
            if (cached && Date.now() - cached.time < ONE_DAY_MS2 && cached.data.base === "CNY" && isValidFxDate(cached.data.date)) {
              ratesData = cached.data;
              ratesFetchFailed = false;
              return ratesData;
            }
            const live = await ctx.http.json(
              "https://api.frankfurter.dev/v1/latest?base=CNY&symbols=HKD,USD,GBP,JPY",
              { ttl: ONE_DAY_MS2, signal: abortController.signal }
            );
            if (!isMounted || abortController.signal.aborted) return null;
            if (live && live.base === "CNY" && isValidFxDate(live.date) && live.rates && typeof live.rates.HKD === "number" && Number.isFinite(live.rates.HKD) && live.rates.HKD > 0) {
              await ctx.store.set(CACHE_KEY, { data: live, time: Date.now() });
              ratesData = live;
              ratesFetchFailed = false;
              return ratesData;
            }
          } catch (err) {
            if (!isMounted || abortController.signal.aborted) return null;
            ratesFetchFailed = true;
            ctx.report("deals_rates", err);
          }
          if (!isMounted || abortController.signal.aborted) return null;
          try {
            const stale = await ctx.store.get(CACHE_KEY, null);
            if (!isMounted || abortController.signal.aborted) return null;
            if (stale && stale.data && stale.data.base === "CNY" && isValidFxDate(stale.data.date)) {
              ratesData = stale.data;
              ratesFetchFailed = false;
              return ratesData;
            }
          } catch {
          }
          ratesFetchFailed = true;
          return null;
        })().finally(() => {
          pendingLoadPromise = null;
        });
        return pendingLoadPromise;
      };
      const detectCurrency = (el) => {
        const text = el.textContent || "";
        const regionParam = url.searchParams.get("region");
        if (regionParam === "jp" || text.includes("\u65E5\u670D") || text.includes("\u5186")) return "JPY";
        if (regionParam === "us" || text.includes("\u7F8E\u670D")) return "USD";
        if (regionParam === "gb" || text.includes("\u82F1\u670D")) return "GBP";
        if (regionParam === "cn" || text.includes("\u56FD\u670D")) return "CNY";
        if (regionParam === "hk" || text.includes("\u6E2F\u670D") || text.includes("HK$")) return "HKD";
        if (text.includes("$")) return "USD";
        if (text.includes("\xA3")) return "GBP";
        if (text.includes("\xA5")) return "JPY";
        return null;
      };
      const updateFxStatusDisplay = () => {
        const fxStatus = doc.getElementById("psnine-fx-status");
        if (!fxStatus) return;
        if (!currentShowCny) {
          fxStatus.textContent = "";
          fxStatus.style.display = "none";
          return;
        }
        fxStatus.style.display = "inline-block";
        if (ratesData) {
          const isExp = Date.now() - (/* @__PURE__ */ new Date(ratesData.date + "T00:00:00Z")).getTime() > MAX_FRESHNESS_MS;
          fxStatus.textContent = `\u6C47\u7387: Frankfurter (${ratesData.date}${isExp ? " \u5DF2\u8FC7\u671F" : ""})`;
          fxStatus.style.color = isExp ? "#e03131" : "#666";
        } else if (settings.exchangeRateDate && isValidFxDate(settings.exchangeRateDate)) {
          const isExp = Date.now() - (/* @__PURE__ */ new Date(settings.exchangeRateDate + "T00:00:00Z")).getTime() > MAX_FRESHNESS_MS;
          fxStatus.textContent = `\u6C47\u7387: \u7528\u6237\u8BBE\u7F6E (${settings.exchangeRateDate}${isExp ? " \u5DF2\u8FC7\u671F" : ""})`;
          fxStatus.style.color = isExp ? "#e03131" : "#666";
        } else if (ratesFetchFailed) {
          fxStatus.textContent = "\u6C47\u7387: \u4E0D\u53EF\u7528";
          fxStatus.style.color = "#888";
        } else {
          fxStatus.textContent = "\u6C47\u7387: \u52A0\u8F7D\u4E2D...";
          fxStatus.style.color = "#888";
        }
      };
      const convertPriceElement = (priceEl, currency) => {
        if (!currency || !currentShowCny || priceEl.classList.contains("psnine-cny-badge")) return;
        const rawText = priceEl.getAttribute("data-psnine-orig-text") || priceEl.textContent?.trim() || "";
        if (!priceEl.hasAttribute("data-psnine-orig-text")) {
          priceEl.setAttribute("data-psnine-orig-text", rawText);
        }
        const amt = parsePrice(priceEl);
        if (amt === null) return;
        const res = convertToCny(amt, currency, ratesData, settings.exchangeRates, settings.exchangeRateDate);
        let cnySpan = priceEl.nextElementSibling;
        const isOurBadge = cnySpan && cnySpan.classList.contains("psnine-cny-badge");
        if (!res && !ratesFetchFailed && !ratesData && !settings.exchangeRateDate) {
          if (!isOurBadge) {
            cnySpan = doc.createElement("span");
            cnySpan.className = "psnine-cny-badge";
            cnySpan.setAttribute("data-psnine-next", "true");
            cnySpan.setAttribute("style", "display:inline-block;font-size:11px;color:#888;font-weight:500;margin-left:4px;");
            priceEl.after(cnySpan);
          }
          cnySpan.textContent = "(\u6362\u7B97\u4E2D...)";
          cnySpan.style.display = currentShowCny ? "inline-block" : "none";
          return;
        }
        if (!res && !ratesFetchFailed) {
          if (isOurBadge && cnySpan) {
            cnySpan.remove();
          }
          return;
        }
        if (!isOurBadge) {
          cnySpan = doc.createElement("span");
          cnySpan.className = "psnine-cny-badge";
          cnySpan.setAttribute("data-psnine-next", "true");
          cnySpan.setAttribute("style", "display:inline-block;font-size:11px;color:#28a745;font-weight:500;margin-left:4px;");
          priceEl.after(cnySpan);
        }
        if (res) {
          cnySpan.textContent = res.badgeText;
          cnySpan.setAttribute("title", res.titleText);
          cnySpan.style.color = res.isExpired ? "#e03131" : "#28a745";
          cnySpan.style.display = currentShowCny ? "inline-block" : "none";
        } else if (ratesFetchFailed) {
          cnySpan.textContent = "(\u6C47\u7387\u4E0D\u53EF\u7528)";
          cnySpan.setAttribute("title", "\u6C47\u7387\u670D\u52A1\u4E0D\u53EF\u7528\u6216\u6570\u636E\u5931\u6548");
          cnySpan.style.color = "#888";
          cnySpan.style.display = currentShowCny ? "inline-block" : "none";
        }
      };
      const enhanceDealsAndStores = () => {
        const dealBoxes = doc.querySelectorAll("li.dd_box, li.store_box");
        dealBoxes.forEach((b) => {
          const box = b;
          const currency = detectCurrency(box);
          const tags = box.querySelectorAll(".dd_tag_plus, .dd_tag, .dd_tag_nor, .store_tag, .store_tag_plus");
          let discountTag = null;
          let discountPercent = 0;
          for (let i = 0; i < tags.length; i++) {
            const tEl = tags[i];
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
              discountTag.style.color = "#fff";
            }
            let titleA = box.querySelector(".dd_info h4.dd_title > a, h4.dd_title a, a.dd_title, .store_title a, .title a");
            if (!titleA) {
              const candidates = box.querySelectorAll(".dd_info p a");
              for (let c = 0; c < candidates.length; c++) {
                const el = candidates[c];
                const parentText = el.parentElement?.textContent || "";
                if (!parentText.includes("\u6D3B\u52A8") && !el.getAttribute("href")?.includes("topic")) {
                  titleA = el;
                  break;
                }
              }
            }
            if (titleA) {
              titleA.style.color = color;
              titleA.style.fontWeight = "bold";
            }
          }
          box.querySelectorAll(".dd_price_old, .dd_price_off, .dd_price_plus").forEach((pEl) => {
            convertPriceElement(pEl, currency);
          });
          box.querySelectorAll(".store_price > span:not(.psnine-cny-badge), .store_price > em:not(.psnine-cny-badge), .store_price > s, .store_price > b").forEach((pEl) => {
            convertPriceElement(pEl, currency);
          });
          const isBest = box.querySelector(".dd_status_best, .store_tag_best") !== null;
          if (isBestOnlyFilterActive && !isBest) {
            setHidden(box, "best-deal-filter", true);
          } else {
            setHidden(box, "best-deal-filter", false);
          }
        });
        if (dealBoxes.length > 0 && !doc.getElementById("psnine-deals-controls-bar")) {
          const targetContainer = doc.querySelector(".min-inner .box, .box");
          if (targetContainer) {
            const bar = doc.createElement("div");
            bar.id = "psnine-deals-controls-bar";
            bar.setAttribute("data-psnine-next", "true");
            bar.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 0;padding:8px 12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:6px;";
            const titleSpan = doc.createElement("span");
            titleSpan.textContent = "\u{1F3F7}\uFE0F \u6570\u6298\u589E\u5F3A:";
            titleSpan.style.cssText = "font-weight:500;font-size:13px;";
            bar.appendChild(titleSpan);
            const bestBtn = doc.createElement("button");
            bestBtn.type = "button";
            bestBtn.id = "psnine-toggle-best-deal-btn";
            bestBtn.setAttribute("data-psnine-next", "true");
            bestBtn.style.cssText = "padding:4px 10px;border-radius:4px;border:1px solid #ccc;background:transparent;cursor:pointer;font-size:12px;";
            bestBtn.textContent = isBestOnlyFilterActive ? "\u5DF2\u8FC7\u6EE4\uFF1A\u53EA\u770B\u53F2\u4F4E" : "\u53EA\u770B\u53F2\u4F4E";
            bestBtn.onclick = () => {
              if (!isMounted) return;
              isBestOnlyFilterActive = !isBestOnlyFilterActive;
              bestBtn.textContent = isBestOnlyFilterActive ? "\u5DF2\u8FC7\u6EE4\uFF1A\u53EA\u770B\u53F2\u4F4E" : "\u53EA\u770B\u53F2\u4F4E";
              bestBtn.style.background = isBestOnlyFilterActive ? "#da314b" : "transparent";
              bestBtn.style.color = isBestOnlyFilterActive ? "#fff" : "inherit";
              bestBtn.style.borderColor = isBestOnlyFilterActive ? "#da314b" : "#ccc";
              enhanceDealsAndStores();
            };
            bar.appendChild(bestBtn);
            const cnyBtn = doc.createElement("button");
            cnyBtn.type = "button";
            cnyBtn.id = "psnine-toggle-cny-btn";
            cnyBtn.setAttribute("data-psnine-next", "true");
            cnyBtn.style.cssText = "padding:4px 10px;border-radius:4px;border:1px solid #28a745;background:transparent;color:#28a745;cursor:pointer;font-size:12px;";
            cnyBtn.textContent = currentShowCny ? "\u5DF2\u5F00\u542F\u4EBA\u6C11\u5E01\u6362\u7B97 (CNY)" : "\u5207\u6362\u4EBA\u6C11\u5E01\u6362\u7B97";
            cnyBtn.onclick = async () => {
              if (!isMounted) return;
              currentShowCny = !currentShowCny;
              cnyBtn.textContent = currentShowCny ? "\u5DF2\u5F00\u542F\u4EBA\u6C11\u5E01\u6362\u7B97 (CNY)" : "\u5207\u6362\u4EBA\u6C11\u5E01\u6362\u7B97";
              updateFxStatusDisplay();
              if (currentShowCny && !ratesData) {
                await loadRates();
              }
              if (!isMounted) return;
              updateFxStatusDisplay();
              doc.querySelectorAll(".psnine-cny-badge").forEach((bg) => {
                bg.style.display = currentShowCny ? "inline-block" : "none";
              });
              enhanceDealsAndStores();
            };
            bar.appendChild(cnyBtn);
            const fxStatusSpan = doc.createElement("span");
            fxStatusSpan.id = "psnine-fx-status";
            fxStatusSpan.setAttribute("data-psnine-next", "true");
            fxStatusSpan.style.cssText = "font-size:11px;color:#666;margin-left:auto;";
            bar.appendChild(fxStatusSpan);
            targetContainer.insertBefore(bar, targetContainer.firstChild);
            updateFxStatusDisplay();
          }
        }
      };
      const renderChartIfSingleProduct = () => {
        if (isSingleProductDealPage && !doc.getElementById("psnine-price-chart-container")) {
          const allEvents = extractPromotionEvents(doc);
          if (allEvents.length > 0) {
            const firstValidEvent = allEvents.find((e) => e.currency !== null);
            if (firstValidEvent && firstValidEvent.currency) {
              const targetCurrency = firstValidEvent.currency;
              const targetProductId = firstValidEvent.productId;
              const events = allEvents.filter(
                (e) => e.currency === targetCurrency && (!targetProductId || !e.productId || e.productId === targetProductId)
              );
              if (events.length > 0) {
                const points = buildPricePointsFromEvents(events);
                if (points.length >= 2 || events.length >= 1) {
                  const chartDiv = doc.createElement("div");
                  chartDiv.id = "psnine-price-chart-container";
                  chartDiv.setAttribute("data-psnine-next", "true");
                  chartDiv.style.cssText = "margin:15px 0;padding:12px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;background:rgba(0,0,0,0.015);";
                  const heading = doc.createElement("div");
                  heading.setAttribute("data-psnine-next", "true");
                  heading.style.cssText = "font-weight:600;font-size:13px;margin-bottom:8px;";
                  heading.textContent = "\u{1F4C8} \u672C\u5546\u54C1\u5386\u53F2\u4EF7\u683C\u53D8\u52A8\u8D70\u52BF (\u771F\u5B9E\u4FC3\u9500\u9636\u68AF\u8BB0\u5F55)";
                  chartDiv.appendChild(heading);
                  const currencySymbol = targetCurrency === "HKD" ? "HK$" : targetCurrency === "USD" ? "$" : targetCurrency === "GBP" ? "\xA3" : targetCurrency === "JPY" ? "\u5186" : targetCurrency === "CNY" ? "\xA5" : targetCurrency;
                  const svgWrapper = doc.createElement("div");
                  svgWrapper.setAttribute("data-psnine-next", "true");
                  svgWrapper.innerHTML = renderPriceHistorySvg(points, currencySymbol, events);
                  chartDiv.appendChild(svgWrapper);
                  const firstBox = doc.querySelector("li.dd_box");
                  if (firstBox && firstBox.parentElement) {
                    firstBox.parentElement.parentElement?.insertBefore(chartDiv, firstBox.parentElement);
                  }
                }
              }
            }
          }
        }
      };
      enhanceDealsAndStores();
      renderChartIfSingleProduct();
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
      const cleanup = () => {
        isMounted = false;
        abortController.abort();
        unsubscribe();
        const bestBtn = doc.getElementById("psnine-toggle-best-deal-btn");
        if (bestBtn) bestBtn.onclick = null;
        const cnyBtn = doc.getElementById("psnine-toggle-cny-btn");
        if (cnyBtn) cnyBtn.onclick = null;
      };
      return cleanup;
    } catch (err) {
      report("deals", err);
      return () => {
      };
    }
  };

  // src/features/battle.ts
  var MONITORED_GAMES_STORE_KEY = "psnine_next:battle_monitored_games";
  var BATTLE_CACHE_STORE_KEY = "psnine_next:battle_cache";
  function extractGameIdFromUrl(urlStr) {
    const m = urlStr.match(/\/psngame\/(\d+)/);
    return m ? m[1] : null;
  }
  function parseBattleEntries(root) {
    const entries = [];
    const rows = root.querySelectorAll("table.list tr");
    rows.forEach((r) => {
      const gameLink = r.querySelector('a[href*="/psngame/"]');
      if (!gameLink) return;
      const gameId = extractGameIdFromUrl(gameLink.href || gameLink.getAttribute("href") || "");
      if (!gameId) return;
      const battleLink = r.querySelector('td.pd15 a[href*="/battle/"], p a[href*="/battle/"], a[href*="/battle/"]');
      const gameTitle = battleLink?.textContent?.trim() || gameLink.textContent?.trim() || "";
      const creatorA = r.querySelector('a[href*="/psnid/"]');
      const creatorHref = creatorA?.getAttribute("href") || creatorA?.href || "";
      const creatorId = creatorHref.match(/\/psnid\/([^/?#]+)/)?.[1] || creatorA?.textContent?.trim() || "";
      const descSpan = r.querySelector("td.pd15 span.font12, span.font12");
      let description = descSpan?.textContent?.trim() || "";
      if (!description) {
        const descP = r.querySelector("td.pd15 p, td.pd10 p, td:nth-child(3) p");
        if (descP && !descP.querySelector('a[href*="/battle/"]')) {
          description = descP.textContent?.trim() || "";
        }
      }
      const dateTd = r.querySelector("td.twoge:nth-child(4), td.twoge");
      const dateStr = dateTd?.textContent?.trim() || "";
      const recruitTd = r.querySelector("td.twoge:last-child");
      const recruitStr = recruitTd?.textContent?.trim() || "";
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
  function isValidBattlePage(doc) {
    if (doc.querySelector('form[action*="/auth/user/login"], .login-box, input[name="psnid"], input[type="password"]') !== null || /登录\s*[-|]\s*PSNINE/i.test(doc.title) || doc.title === "\u767B\u5F55") {
      return false;
    }
    if (doc.querySelector(".error-box, .alert-danger, .alert-error") !== null || doc.title.includes("\u51FA\u9519\u4E86") || doc.title.includes("404") || doc.title.includes("500")) {
      return false;
    }
    const entries = parseBattleEntries(doc);
    if (entries.length > 0) {
      return true;
    }
    const hasCreateBattleLink = doc.querySelector('a[href*="/set/battle"], a[href*="/topic/7552"]') !== null;
    if (hasCreateBattleLink) {
      return true;
    }
    const hasBattleTitle = doc.title.includes("\u7EA6\u6218");
    const hasContentContainer = doc.querySelector(".main, .min-inner .box, .box") !== null;
    const hasHeading = Array.from(doc.querySelectorAll("h1, h2, h3, .title, .page-header")).some(
      (el) => el.textContent?.includes("\u7EA6\u6218")
    );
    if (hasBattleTitle && (hasContentContainer || hasHeading)) {
      return true;
    }
    return false;
  }
  function validateBattleCache(raw) {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw;
    if (typeof obj.timestamp !== "number" || !Number.isFinite(obj.timestamp) || obj.timestamp <= 0) {
      return null;
    }
    if (!Array.isArray(obj.entries)) return null;
    const validEntries = [];
    for (const e of obj.entries) {
      if (e && typeof e === "object" && typeof e.gameId === "string" && /^\d+$/.test(e.gameId) && typeof e.gameTitle === "string" && typeof e.creatorId === "string" && typeof e.description === "string" && typeof e.dateStr === "string" && typeof e.recruitsCount === "number" && Number.isFinite(e.recruitsCount) && e.recruitsCount >= 1) {
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
  async function syncBattleCache(ctx, monitoredGames, forceRefresh = false) {
    if (!monitoredGames || monitoredGames.length === 0) {
      return [];
    }
    const interval = ctx.settings.BattleInfoUpdateInterval || 36e5;
    const rawCache = await ctx.store.get(BATTLE_CACHE_STORE_KEY, null);
    const existingCache = validateBattleCache(rawCache);
    if (!forceRefresh && existingCache && Date.now() - existingCache.timestamp < interval) {
      return existingCache.entries;
    }
    try {
      const targetUrl = new URL("/battle", ctx.url.origin).href;
      const httpTtl = forceRefresh ? 0 : Math.min(interval, 3e5);
      const htmlText = await ctx.http.text(targetUrl, { ttl: httpTtl });
      const DOMParserClass = ctx.window.DOMParser || DOMParser;
      const parser = new DOMParserClass();
      const parsedDoc = parser.parseFromString(htmlText, "text/html");
      if (!isValidBattlePage(parsedDoc)) {
        ctx.report("battle_cache_sync", new Error("HTTP 200 response is not a valid battle page (login or error page)"));
        return existingCache ? existingCache.entries : [];
      }
      const freshEntries = parseBattleEntries(parsedDoc);
      await ctx.store.set(BATTLE_CACHE_STORE_KEY, {
        entries: freshEntries,
        timestamp: Date.now()
      });
      return freshEntries;
    } catch (err) {
      ctx.report("battle_cache_sync", err);
    }
    return existingCache ? existingCache.entries : [];
  }
  var mountBattle = async (ctx) => {
    const { document: doc, url, settings, onContent, report } = ctx;
    const isBattlePage = url.pathname.includes("/battle");
    const isGamePage = url.pathname.includes("/psngame/");
    let isActive = true;
    const unsubs = [];
    try {
      let monitoredGames = await ctx.store.get(MONITORED_GAMES_STORE_KEY, []);
      if (!Array.isArray(monitoredGames)) monitoredGames = [];
      let toggleQueue = Promise.resolve();
      const toggleGameMonitoring = async (gameId, triggeringBtn) => {
        if (triggeringBtn) {
          triggeringBtn.style.pointerEvents = "none";
        }
        toggleQueue = toggleQueue.then(async () => {
          if (!isActive) return;
          try {
            const latest = await ctx.store.get(MONITORED_GAMES_STORE_KEY, []);
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
            report("battle_toggle_monitoring", err);
          } finally {
            if (triggeringBtn) {
              triggeringBtn.style.removeProperty("pointer-events");
            }
          }
        }).catch((err) => {
          report("battle_toggle_queue", err);
        });
        await toggleQueue;
      };
      const updateAllBellIcons = () => {
        doc.querySelectorAll(".psnine-battle-bell-btn").forEach((btnEl) => {
          const btn = btnEl;
          const gid = btn.getAttribute("data-game-id");
          if (!gid) return;
          const isMonitored = monitoredGames.includes(gid);
          btn.textContent = isMonitored ? "\u{1F514} \u5DF2\u76D1\u63A7" : "\u{1F515} \u76D1\u63A7";
          btn.style.borderColor = isMonitored ? "#f59f00" : "#ccc";
          btn.style.background = isMonitored ? "rgba(245, 159, 0, 0.15)" : "transparent";
          btn.style.color = isMonitored ? "#d97706" : "inherit";
          btn.setAttribute("title", isMonitored ? "\u70B9\u51FB\u53D6\u6D88\u5BF9\u6B64\u6E38\u620F\u7684\u7EA6\u6218\u76D1\u63A7" : "\u70B9\u51FB\u5F00\u542F\u5BF9\u6B64\u6E38\u620F\u7684\u7EA6\u6218\u76D1\u63A7");
        });
      };
      const updateNavRecruitNotification = async () => {
        try {
          const battleLinks = doc.querySelectorAll('.site-nav a[href*="/battle"], #pcmenu a[href*="/battle"], .nav-menu a[href*="/battle"], .mobile-nav-panel a[href*="/battle"]');
          if (battleLinks.length === 0 || !isActive) return;
          if (monitoredGames.length === 0) {
            doc.querySelectorAll(".psnine-battle-notify-badge").forEach((b) => b.remove());
            return;
          }
          const activeBattles = await syncBattleCache(ctx, monitoredGames);
          if (!isActive) return;
          const matchingGames = /* @__PURE__ */ new Set();
          for (const b of activeBattles) {
            if (monitoredGames.includes(b.gameId)) {
              matchingGames.add(b.gameId);
            }
          }
          const distinctGameCount = matchingGames.size;
          battleLinks.forEach((a) => {
            let badge = a.querySelector(".psnine-battle-notify-badge");
            if (distinctGameCount > 0) {
              if (!badge) {
                badge = doc.createElement("span");
                badge.className = "psnine-battle-notify-badge";
                badge.setAttribute("data-psnine-next", "true");
                badge.setAttribute("style", "display:inline-block;padding:0 5px;margin-left:4px;border-radius:10px;background:#e03131;color:#fff;font-size:10px;font-weight:bold;line-height:16px;vertical-align:middle;");
                a.appendChild(badge);
              }
              badge.textContent = `${distinctGameCount}`;
              badge.setAttribute("title", `\u53D1\u73B0 ${distinctGameCount} \u4E2A\u5DF2\u76D1\u63A7\u6E38\u620F\u7684\u7EA6\u6218\u62DB\u52DF\uFF01`);
            } else if (badge) {
              badge.remove();
            }
          });
        } catch (err) {
          report("battle_nav_update", err);
        }
      };
      if (isBattlePage) {
        let userProgressMap = {};
        if (ctx.userId && settings.showGameProgressInBattle) {
          const progressKey = `psnine_next:progress:${ctx.userId}`;
          const rawProgress = await ctx.store.get(progressKey, null);
          const valid = validateUserProgressData(rawProgress, ctx.userId);
          if (valid && valid.userId === ctx.userId && valid.games) {
            userProgressMap = valid.games;
          }
        }
        const enhanceBattlePage = () => {
          if (!isActive) return;
          const rows = doc.querySelectorAll("table.list tr");
          rows.forEach((r) => {
            const row = r;
            if (settings.removeHeaderInBattle) {
              const cells = row.querySelectorAll("td");
              cells.forEach((td) => {
                const isAvatar = td.getAttribute("width") === "50" || td.querySelector('a[href*="/psnid/"]') !== null && td.querySelector('a[href*="/psngame/"]') === null;
                if (isAvatar) {
                  setHidden(td, "battle-avatar", true);
                }
              });
            }
            const gameLink = row.querySelector('a[href*="/psngame/"]');
            if (!gameLink) return;
            const gameId = extractGameIdFromUrl(gameLink.href || gameLink.getAttribute("href") || "");
            if (!gameId) return;
            if (settings.showGameProgressInBattle && userProgressMap[gameId]) {
              const rec = userProgressMap[gameId];
              row.style.background = `linear-gradient(to right, rgba(56, 144, 255, 0.12) ${rec.percent}%, transparent ${rec.percent}%)`;
              if (!row.querySelector(".psnine-battle-progress-badge")) {
                const badge = doc.createElement("span");
                badge.className = "psnine-battle-progress-badge";
                badge.setAttribute("data-psnine-next", "true");
                badge.style.cssText = "display:inline-block;padding:1px 4px;font-size:10px;border-radius:3px;background:rgba(56, 144, 255, 0.2);color:#0056b3;margin-left:4px;";
                badge.textContent = `\u6211\u7684\u8FDB\u5EA6:${rec.percent}%`;
                const battleTitleLink = row.querySelector('td.pd15 a[href*="/battle/"]') || gameLink;
                battleTitleLink.parentElement?.appendChild(badge);
              }
            }
            if (!row.querySelector(".psnine-battle-bell-btn")) {
              const bellBtn = doc.createElement("button");
              bellBtn.type = "button";
              bellBtn.className = "psnine-battle-bell-btn";
              bellBtn.setAttribute("data-psnine-next", "true");
              bellBtn.setAttribute("data-game-id", gameId);
              bellBtn.style.cssText = "padding:2px 6px;font-size:11px;border-radius:4px;border:1px solid #ccc;cursor:pointer;margin-left:6px;user-select:none;transition:all 0.15s;";
              bellBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleGameMonitoring(gameId, bellBtn).catch((err) => report("battle_bell_click", err));
              };
              const titleTd = row.querySelector("td.pd15") || row.querySelector('td.pdd15:not([width="91"]):not(.h-p)') || row.querySelector("td:nth-child(3)");
              if (titleTd) {
                const p = titleTd.querySelector("p");
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
      if (isGamePage) {
        const gameId = extractGameIdFromUrl(url.pathname);
        if (gameId) {
          const injectGamePageBell = () => {
            if (!isActive || doc.getElementById("psnine-game-page-battle-bell")) return;
            const targetBar = doc.querySelector(".main > ul.inav, ul.inav, .box.pd10, h1");
            if (!targetBar) return;
            const bellBtn = doc.createElement("button");
            bellBtn.type = "button";
            bellBtn.id = "psnine-game-page-battle-bell";
            bellBtn.className = "psnine-battle-bell-btn";
            bellBtn.setAttribute("data-psnine-next", "true");
            bellBtn.setAttribute("data-game-id", gameId);
            bellBtn.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:4px;border:1px solid #ccc;cursor:pointer;margin-left:10px;vertical-align:middle;";
            bellBtn.onclick = (e) => {
              e.preventDefault();
              toggleGameMonitoring(gameId, bellBtn).catch((err) => report("battle_game_bell_click", err));
            };
            if (targetBar.tagName === "H1") {
              targetBar.appendChild(bellBtn);
            } else {
              const li = doc.createElement("li");
              li.setAttribute("data-psnine-next", "true");
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
      updateNavRecruitNotification().catch((err) => report("battle_nav_init", err));
      return () => {
        isActive = false;
        for (const unsub of unsubs) {
          try {
            unsub();
          } catch (err) {
            report("battle_cleanup", err);
          }
        }
      };
    } catch (err) {
      report("battle", err);
    }
  };

  // src/main.ts
  if (typeof window !== "undefined" && window.__psnine_next_initialized__) {
  } else {
    let earlyThemeInjection2 = function() {
      if (typeof document === "undefined") return;
      if (typeof window !== "undefined" && window.__psnine_next_early_styled__) {
        return;
      }
      let isDark = false;
      try {
        const raw = window.localStorage?.getItem(THEME_MIRROR_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.autoNightMode === "SYSTEM") {
            isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
          } else if (s.autoNightMode === "TIME") {
            const h = (/* @__PURE__ */ new Date()).getHours();
            const start = s.nightStart ?? 19;
            const end = s.nightEnd ?? 7;
            isDark = start > end ? h >= start || h < end : h >= start && h < end;
          } else {
            isDark = Boolean(s.nightMode);
          }
        } else {
          isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
        }
      } catch {
        isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
      }
      const container = document.head || document.documentElement;
      if (!container) {
        return;
      }
      try {
        if (!document.getElementById("psnineCoreStyles")) {
          const coreStyle = document.createElement("style");
          coreStyle.id = "psnineCoreStyles";
          coreStyle.setAttribute("data-psnine-next", "core-styles");
          coreStyle.textContent = CORE_STYLES;
          container.appendChild(coreStyle);
        }
        if (isDark) {
          if (!document.getElementById("nightModeStyle")) {
            const style = document.createElement("style");
            style.id = "nightModeStyle";
            style.setAttribute("data-psnine-next", "theme");
            style.textContent = DARK_THEME_STYLES;
            container.appendChild(style);
          }
          if (document.documentElement?.getAttribute("data-theme") !== "dark") {
            document.documentElement?.setAttribute("data-theme", "dark");
          }
          if (document.body && document.body.getAttribute("data-theme") !== "dark") {
            document.body.setAttribute("data-theme", "dark");
          }
        } else {
          const staleStyle = document.getElementById("nightModeStyle");
          if (staleStyle) {
            staleStyle.remove();
          }
          if (document.documentElement?.hasAttribute("data-theme")) {
            document.documentElement.removeAttribute("data-theme");
          }
          if (document.body?.hasAttribute("data-theme")) {
            document.body.removeAttribute("data-theme");
          }
        }
        if (typeof window !== "undefined") {
          window.__psnine_next_early_styled__ = true;
        }
      } catch {
      }
    };
    earlyThemeInjection = earlyThemeInjection2;
    if (typeof window !== "undefined") {
      window.__psnine_next_initialized__ = true;
    }
    earlyThemeInjection2();
    const activeCleanups = [];
    async function initialize() {
      if (window.__psnine_next_mounted__) {
        return;
      }
      window.__psnine_next_mounted__ = true;
      if (!document.getElementById("psnineCoreStyles")) {
        const container = document.head || document.documentElement || document.body;
        if (container) {
          const coreStyle = document.createElement("style");
          coreStyle.id = "psnineCoreStyles";
          coreStyle.setAttribute("data-psnine-next", "core-styles");
          coreStyle.textContent = CORE_STYLES;
          container.appendChild(coreStyle);
        }
      }
      const store = createStore("psnine_next:");
      const settings = await loadAndMigrateSettings(store);
      const http = createHttpClient(window.location.origin);
      const ctx = createContext({
        document,
        window,
        settings,
        store,
        http
      });
      applyTheme(ctx);
      try {
        mountSettingsUI(ctx);
      } catch (err) {
        ctx.report("settings-ui", err);
      }
      const modules = [
        { name: "global", mount: mountGlobal },
        { name: "community", mount: mountCommunity },
        { name: "editor", mount: mountEditor },
        { name: "paging", mount: mountPaging },
        { name: "reviews", mount: mountReviews },
        { name: "games", mount: mountGames },
        { name: "deals", mount: mountDeals },
        { name: "battle", mount: mountBattle },
        { name: "trophies", mount: mountTrophies }
      ];
      for (const mod of modules) {
        try {
          const res = mod.mount(ctx);
          if (res instanceof Promise) {
            res.then((cleanup) => {
              if (typeof cleanup === "function") activeCleanups.push(cleanup);
            }).catch((err) => ctx.report(mod.name, err));
          } else if (typeof res === "function") {
            activeCleanups.push(res);
          }
        } catch (err) {
          ctx.report(mod.name, err);
        }
      }
    }
    window.addEventListener("pagehide", (e) => {
      if (!e.persisted) {
        while (activeCleanups.length > 0) {
          const c = activeCleanups.shift();
          if (c) {
            try {
              c();
            } catch {
            }
          }
        }
        window.__psnine_next_mounted__ = false;
      }
    });
    window.addEventListener("pageshow", (e) => {
      if (!window.__psnine_next_mounted__) {
        initialize().catch((err) => console.error("[psnine_next] Init failed:", err));
      }
    });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initialize().catch((err) => console.error("[psnine_next] Init failed:", err));
      }, { once: true });
    } else {
      initialize().catch((err) => console.error("[psnine_next] Init failed:", err));
    }
  }
  var earlyThemeInjection;
})();
