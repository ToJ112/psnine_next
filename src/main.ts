import { createContext } from './core/context';
import { createStore, loadAndMigrateSettings, THEME_MIRROR_KEY } from './core/store';
import { createHttpClient } from './core/http';
import { mountSettingsUI } from './core/settings-ui';
import { CORE_STYLES, DARK_THEME_STYLES } from './styles';
import { Cleanup } from './core/types';

// Feature modules
import { mountGlobal, applyTheme } from './features/global';
import { mountCommunity } from './features/community';
import { mountEditor } from './features/editor';
import { mountPaging } from './features/paging';

// Modules implemented by partner
import { mountReviews } from './features/reviews';
import { mountGames } from './features/games';
import { mountDeals } from './features/deals';
import { mountBattle } from './features/battle';
import { mountTrophies } from './features/trophies';

// Top-level execution guard: prevent duplicate script injections in the same window/environment
if (typeof window !== 'undefined' && window.__psnine_next_initialized__) {
  // Already initialized in this window, avoid duplicate execution
} else {
  if (typeof window !== 'undefined') {
    window.__psnine_next_initialized__ = true;
  }

  /**
   * Early document-start theme injection to eliminate white flash (FOUC).
   * Strictly uses isolated theme mirror from localStorage without touching user data.
   * If document.head/documentElement is null at document-start, avoids premature guard
   * and allows initialize() to guarantee core styles are injected.
   */
  function earlyThemeInjection(): void {
    if (typeof document === 'undefined') return;
    if (typeof window !== 'undefined' && window.__psnine_next_early_styled__) {
      return;
    }

    // Step A: Determine if dark theme should be applied (isolated try-catch)
    let isDark = false;
    try {
      const raw = window.localStorage?.getItem(THEME_MIRROR_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.autoNightMode === 'SYSTEM') {
          isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
        } else if (s.autoNightMode === 'TIME') {
          const h = new Date().getHours();
          const start = s.nightStart ?? 19;
          const end = s.nightEnd ?? 7;
          isDark = start > end ? (h >= start || h < end) : (h >= start && h < end);
        } else {
          isDark = Boolean(s.nightMode);
        }
      } else {
        // default SYSTEM: first run without mirror also evaluates system dark preference
        isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      }
    } catch {
      // Storage restricted, fall back to default SYSTEM evaluation via matchMedia
      isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }

    // Step B: Inject styles if container exists
    const container = document.head || document.documentElement;
    if (!container) {
      // At real document-start in some browsers, both head and documentElement can be null!
      // Return and let DOM ready / initialize retry insertion!
      return;
    }

    try {
      // CSS injection order: core styles first, dark theme styles second
      if (!document.getElementById('psnineCoreStyles')) {
        const coreStyle = document.createElement('style');
        coreStyle.id = 'psnineCoreStyles';
        coreStyle.setAttribute('data-psnine-next', 'core-styles');
        coreStyle.textContent = CORE_STYLES;
        container.appendChild(coreStyle);
      }

      if (isDark) {
        if (!document.getElementById('nightModeStyle')) {
          const style = document.createElement('style');
          style.id = 'nightModeStyle';
          style.setAttribute('data-psnine-next', 'theme');
          style.textContent = DARK_THEME_STYLES;
          container.appendChild(style);
        }
        if (document.documentElement?.getAttribute('data-theme') !== 'dark') {
          document.documentElement?.setAttribute('data-theme', 'dark');
        }
        if (document.body && document.body.getAttribute('data-theme') !== 'dark') {
          document.body.setAttribute('data-theme', 'dark');
        }
      } else {
        const staleStyle = document.getElementById('nightModeStyle');
        if (staleStyle) {
          staleStyle.remove();
        }
        if (document.documentElement?.hasAttribute('data-theme')) {
          document.documentElement.removeAttribute('data-theme');
        }
        if (document.body?.hasAttribute('data-theme')) {
          document.body.removeAttribute('data-theme');
        }
      }

      if (typeof window !== 'undefined') {
        window.__psnine_next_early_styled__ = true;
      }
    } catch {
      // Container append error
    }
  }

  // Run early style injection immediately
  earlyThemeInjection();

  const activeCleanups: Cleanup[] = [];

  /**
   * Main initialization on DOM ready with idempotency and BFCache support.
   */
  async function initialize(): Promise<void> {
    // Prevent duplicate mounts in same document session
    if (window.__psnine_next_mounted__) {
      return;
    }
    window.__psnine_next_mounted__ = true;

    // Guarantee core styles exist even if early document-start found no container
    if (!document.getElementById('psnineCoreStyles')) {
      const container = document.head || document.documentElement || document.body;
      if (container) {
        const coreStyle = document.createElement('style');
        coreStyle.id = 'psnineCoreStyles';
        coreStyle.setAttribute('data-psnine-next', 'core-styles');
        coreStyle.textContent = CORE_STYLES;
        container.appendChild(coreStyle);
      }
    }

    const store = createStore('psnine_next:');
    const settings = await loadAndMigrateSettings(store);
    const http = createHttpClient(window.location.origin);

    const ctx = createContext({
      document,
      window,
      settings,
      store,
      http,
    });

    // Re-apply theme with full verified settings and reactive watchers
    applyTheme(ctx);

    // Mount in-page settings panel
    try {
      mountSettingsUI(ctx);
    } catch (err) {
      ctx.report('settings-ui', err);
    }

    // Mount modules with independent error isolation and collect cleanups
    const modules = [
      { name: 'global', mount: mountGlobal },
      { name: 'community', mount: mountCommunity },
      { name: 'editor', mount: mountEditor },
      { name: 'paging', mount: mountPaging },
      { name: 'reviews', mount: mountReviews },
      { name: 'games', mount: mountGames },
      { name: 'deals', mount: mountDeals },
      { name: 'battle', mount: mountBattle },
      { name: 'trophies', mount: mountTrophies },
    ];

    for (const mod of modules) {
      try {
        const res = mod.mount(ctx);
        if (res instanceof Promise) {
          res.then(cleanup => {
            if (typeof cleanup === 'function') activeCleanups.push(cleanup);
          }).catch(err => ctx.report(mod.name, err));
        } else if (typeof res === 'function') {
          activeCleanups.push(res);
        }
      } catch (err) {
        ctx.report(mod.name, err);
      }
    }
  }

  // BFCache (Back-Forward Cache) and page navigation lifecycle management
  window.addEventListener('pagehide', (e: PageTransitionEvent) => {
    // If page is going into BFCache (persisted === true), keep mounted DOM and listeners.
    // Only execute cleanups when page is permanently unloaded (nonpersisted).
    if (!e.persisted) {
      while (activeCleanups.length > 0) {
        const c = activeCleanups.shift();
        if (c) {
          try { c(); } catch {}
        }
      }
      window.__psnine_next_mounted__ = false;
    }
  });

  window.addEventListener('pageshow', (e: PageTransitionEvent) => {
    // If not restored from BFCache and not mounted, mount cleanly.
    // If e.persisted is true, DOM and listeners are already intact from BFCache.
    if (!window.__psnine_next_mounted__) {
      initialize().catch(err => console.error('[psnine_next] Init failed:', err));
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initialize().catch(err => console.error('[psnine_next] Init failed:', err));
    }, { once: true });
  } else {
    initialize().catch(err => console.error('[psnine_next] Init failed:', err));
  }
}
