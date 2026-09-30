import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDarkActive, applyTheme, mountGlobal, mountScrollBottom, integrateFloatingLayer, enhanceMasks, fixLinks, handleAutoCheckIn, applyNewestDefaultSort } from '../src/features/global';
import { createContext } from '../src/core/context';
import { defaultSettings } from '../src/core/types';
import { createStore } from '../src/core/store';
import { createHttpClient } from '../src/core/http';

describe('Global features module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('evaluates dark theme for SYSTEM, TIME, and manual switches', () => {
    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings, autoNightMode: 'OFF', nightMode: true },
      store,
      http,
    });

    expect(isDarkActive(ctx)).toBe(true);

    applyTheme(ctx);
    expect(document.getElementById('nightModeStyle')).not.toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    ctx.settings.nightMode = false;
    applyTheme(ctx);
    expect(document.getElementById('nightModeStyle')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('reconciles late native v2 data-theme overrides in both DARK and LIGHT modes without observer loops, and stops after cleanup', async () => {
    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings, autoNightMode: 'OFF', nightMode: true },
      store,
      http,
    });

    const cleanup = mountGlobal(ctx) as () => void;
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.getElementById('nightModeStyle')).not.toBeNull();

    let mutationCount = 0;
    const counterObserver = new MutationObserver(() => {
      mutationCount++;
    });
    counterObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Simulate native View/v2/js/main.js running later and setting dataset.theme = "light"
    document.documentElement.dataset.theme = 'light';
    await new Promise(r => setTimeout(r, 30));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.getElementById('nightModeStyle')).not.toBeNull();
    // 1 mutation from native script + 1 correction from plugin; must settle without looping
    expect(mutationCount).toBeLessThanOrEqual(3);

    // Switch plugin to explicit LIGHT mode
    ctx.settings.nightMode = false;
    applyTheme(ctx);
    await new Promise(r => setTimeout(r, 20));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.getElementById('nightModeStyle')).toBeNull();

    mutationCount = 0;
    // Simulate native View/v2/js/main.js setting dataset.theme = "dark" from stale psnine-theme
    document.documentElement.dataset.theme = 'dark';
    await new Promise(r => setTimeout(r, 30));

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.getElementById('nightModeStyle')).toBeNull();
    expect(mutationCount).toBeLessThanOrEqual(3);

    // After cleanup, observer must be disconnected and no longer intervene
    cleanup();
    counterObserver.disconnect();

    document.documentElement.dataset.theme = 'dark';
    await new Promise(r => setTimeout(r, 30));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });


  it('unmasks spoiler bar on tap/click and keyboard Enter/Space', () => {
    document.body.innerHTML = `
      <div class="content">
        <span class="mark">Secret Spoiler</span>
      </div>
    `;

    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings },
      store,
      http,
    });

    enhanceMasks(ctx, document.body);
    const mark = document.querySelector('.mark') as HTMLElement;
    expect(mark.classList.contains('unmasked')).toBe(false);

    mark.click();
    expect(mark.classList.contains('unmasked')).toBe(true);

    mark.click();
    expect(mark.classList.contains('unmasked')).toBe(false);

    mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(mark.classList.contains('unmasked')).toBe(true);
  });

  it('fixes D7VG links and upgrades HTTP to HTTPS', () => {
    document.body.innerHTML = `
      <div>
        <a id="l1" href="http://d7vg.com/topic/123">Old D7</a>
        <a id="l2" href="http://psnine.com/psngame/456">HTTP PSNINE</a>
      </div>
    `;

    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings },
      store,
      http,
    });

    fixLinks(ctx, document.body);

    const l1 = document.getElementById('l1');
    const l2 = document.getElementById('l2');

    expect(l1?.getAttribute('href')).toBe('https://psnine.com/topic/123');
    expect(l2?.getAttribute('href')).toBe('https://psnine.com/psngame/456');
  });

  it('linkifies bare URLs in text nodes while skipping code and existing links', () => {
    document.body.innerHTML = `
      <div id="container">
        <p>Check this: https://psnine.com/topic/888 for details.</p>
        <pre>Do not touch: https://example.com/api</pre>
        <a href="https://psnine.com">Already a link</a>
      </div>
    `;

    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings },
      store,
      http,
    });

    fixLinks(ctx, document.body);

    const links = document.querySelectorAll('#container p a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://psnine.com/topic/888');

    expect(document.querySelectorAll('pre a').length).toBe(0);
  });

  it('runs auto check-in only when enabled and not yet checked today', async () => {
    document.body.innerHTML = `
      <div class="nav-user">
        <a class="yuan" href="/signin">签到</a>
      </div>
    `;

    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings, autoCheckIn: true },
      store,
      http,
    });
    ctx.userId = 'test_user';

    const signinBtn = document.querySelector('.yuan') as HTMLElement;
    const clickSpy = vi.spyOn(signinBtn, 'click');

    await handleAutoCheckIn(ctx);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockClear();
    await handleAutoCheckIn(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  describe('G11 default newest post sorting on /gene and /qa', () => {
    it('redirects /gene to ?ob=date when listPostsByNew is true and no sort param exists', () => {
      const store = createStore();
      const http = createHttpClient();
      const mockReplace = vi.fn();
      const mockWin = {
        location: {
          replace: mockReplace,
          href: 'https://psnine.com/gene'
        }
      } as unknown as Window;

      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings, listPostsByNew: true, listQAAnswersByNew: false },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/gene');

      applyNewestDefaultSort(ctx);
      expect(mockReplace).toHaveBeenCalledWith('https://psnine.com/gene?ob=date');
    });

    it('redirects /qa to ?ob=date when listPostsByNew is true even if listQAAnswersByNew is false', () => {
      const store = createStore();
      const http = createHttpClient();
      const mockReplace = vi.fn();
      const mockWin = {
        location: {
          replace: mockReplace,
          href: 'https://psnine.com/qa'
        }
      } as unknown as Window;

      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings, listPostsByNew: true, listQAAnswersByNew: false },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/qa');

      applyNewestDefaultSort(ctx);
      expect(mockReplace).toHaveBeenCalledWith('https://psnine.com/qa?ob=date');
    });

    it('does NOT redirect /qa when listPostsByNew is false even if listQAAnswersByNew is true', () => {
      const store = createStore();
      const http = createHttpClient();
      const mockReplace = vi.fn();
      const mockWin = {
        location: {
          replace: mockReplace,
          href: 'https://psnine.com/qa'
        }
      } as unknown as Window;

      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings, listPostsByNew: false, listQAAnswersByNew: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/qa');

      applyNewestDefaultSort(ctx);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does NOT redirect when ob param already exists on /gene or /qa', () => {
      const store = createStore();
      const http = createHttpClient();
      const mockReplace = vi.fn();
      const mockWin = {
        location: {
          replace: mockReplace,
          href: 'https://psnine.com/gene?ob=hot'
        }
      } as unknown as Window;

      const ctx = createContext({
        document,
        window: mockWin,
        settings: { ...defaultSettings, listPostsByNew: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/gene?ob=hot');

      applyNewestDefaultSort(ctx);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
  describe('G06 Floating Layer Integration', () => {
    it('idempotently merges scrollbottom and gear into native .float-layer when present, preserving native buttons', () => {
      document.body.innerHTML = `
        <div class="float-layer">
          <button class="float-btn theme-toggle" type="button"><span>黑暗模式</span></button>
          <div class="float-btn to-top"><span>顶部</span></div>
        </div>
        <button id="psnine-settings-gear"><span>设置</span></button>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings },
        store,
        http,
      });

      mountScrollBottom(ctx);

      const floatLayer = document.querySelector('.float-layer')!;
      const scrollBottomBtn = document.getElementById('psnine-scrollbottom')!;
      const gearBtn = document.getElementById('psnine-settings-gear')!;
      const themeToggle = document.querySelector('.theme-toggle')!;

      // Both plugin buttons moved inside .float-layer
      expect(scrollBottomBtn.parentElement).toBe(floatLayer);
      expect(gearBtn.parentElement).toBe(floatLayer);

      // Both received .float-btn class
      expect(scrollBottomBtn.classList.contains('float-btn')).toBe(true);
      expect(gearBtn.classList.contains('float-btn')).toBe(true);

      // Native buttons preserved intact
      expect(themeToggle.parentElement).toBe(floatLayer);
      expect(floatLayer.children.length).toBe(4);

      // Calling again is completely idempotent
      integrateFloatingLayer(document);
      expect(floatLayer.children.length).toBe(4);
    });

    it('keeps scrollbottom in body when .float-layer is absent (legacy pages)', () => {
      document.body.innerHTML = `<div>Legacy Content</div>`;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings },
        store,
        http,
      });

      mountScrollBottom(ctx);

      const scrollBottomBtn = document.getElementById('psnine-scrollbottom')!;
      expect(scrollBottomBtn.parentElement).toBe(document.body);
      expect(scrollBottomBtn.classList.contains('float-btn')).toBe(false);
    });
  });
});
