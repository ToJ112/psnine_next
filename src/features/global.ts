import { Context, Mount, Cleanup } from '../core/types';
import { DARK_THEME_STYLES, ICONS } from '../styles';

/**
 * Checks whether dark theme should currently be active.
 */
export function isDarkActive(ctx: Context): boolean {
  const { settings, window: win } = ctx;

  if (settings.autoNightMode === 'SYSTEM') {
    if (typeof win.matchMedia === 'function') {
      return win.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return Boolean(settings.nightMode);
  }

  if (settings.autoNightMode === 'TIME') {
    const hour = new Date().getHours();
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

/**
 * Applies or removes dark theme styles on documentElement (v2 standard) and injects fallback style.
 */
export function applyTheme(ctx: Context): void {
  const { document: doc } = ctx;
  const dark = isDarkActive(ctx);

  let styleEl = doc.getElementById('nightModeStyle') as HTMLStyleElement | null;

  if (dark) {
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'nightModeStyle';
      styleEl.setAttribute('data-psnine-next', 'theme');
      styleEl.textContent = DARK_THEME_STYLES;
      (doc.head || doc.documentElement).appendChild(styleEl);
    }
    if (doc.documentElement.getAttribute('data-theme') !== 'dark') {
      doc.documentElement.setAttribute('data-theme', 'dark');
    }
    if (doc.body && doc.body.getAttribute('data-theme') !== 'dark') {
      doc.body.setAttribute('data-theme', 'dark');
    }
  } else {
    if (styleEl) {
      styleEl.remove();
    }
    if (doc.documentElement.hasAttribute('data-theme')) {
      doc.documentElement.removeAttribute('data-theme');
    }
    if (doc.body && doc.body.hasAttribute('data-theme')) {
      doc.body.removeAttribute('data-theme');
    }
  }
}

/**
 * Enhanced unmask for black spoiler bars (G04).
 * Supports hover (if hoverUnmark enabled) on desktop and tap-to-toggle on mobile touchscreens.
 */
export function enhanceMasks(ctx: Context, root: ParentNode): void {
  const { settings } = ctx;
  const marks: Element[] = [];

  if (root instanceof Element && root.classList.contains('mark') && !root.hasAttribute('data-psnine-mask-ready')) {
    marks.push(root);
  }
  marks.push(...Array.from(root.querySelectorAll('.mark:not([data-psnine-mask-ready])')));

  marks.forEach(mark => {
    mark.setAttribute('data-psnine-mask-ready', 'true');
    mark.setAttribute('tabindex', '0');
    mark.setAttribute('title', settings.hoverUnmark ? '悬浮或点击揭示剧透' : '点击揭示剧透');

    if (settings.hoverUnmark) {
      mark.addEventListener('mouseenter', () => mark.classList.add('unmasked'));
      mark.addEventListener('mouseleave', () => {
        if (!mark.classList.contains('pinned')) {
          mark.classList.remove('unmasked');
        }
      });
    }

    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mark.classList.contains('pinned')) {
        mark.classList.remove('pinned');
        mark.classList.remove('unmasked');
      } else {
        mark.classList.add('pinned');
        mark.classList.add('unmasked');
      }
    });

    // Keyboard accessibility
    mark.addEventListener('keydown', (e) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        mark.classList.toggle('unmasked');
      }
    });
  });
}

/**
 * Smooth scroll to bottom button (G06) using standard accessible <button>.
 */
export function mountScrollBottom(ctx: Context): void {
  const { document: doc, window: win } = ctx;
  let btn = doc.getElementById('psnine-scrollbottom') as HTMLButtonElement | null;
  if (!btn) {
    btn = doc.createElement('button');
    btn.id = 'psnine-scrollbottom';
    btn.setAttribute('data-psnine-next', 'scrollbottom');
    btn.setAttribute('type', 'button');
    btn.setAttribute('title', '滚动到底部');
    btn.setAttribute('aria-label', '滚动到底部');
    btn.innerHTML = ICONS.arrowDown;
    btn.addEventListener('click', () => {
      const target = doc.getElementById('comment') || doc.querySelector('.content.pb10 textarea');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        win.scrollTo({ top: doc.body.scrollHeight, behavior: 'smooth' });
      }
    });
    doc.body.appendChild(btn);
  }
}

/**
 * Returns current date in Shanghai time zone (Asia/Shanghai) to align with PSNINE site time.
 */
export function getShanghaiDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Daily auto check-in (G05).
 * Uses site Shanghai time zone, authentic selectors (.float-btn.sign, a.yuan),
 * records attempt before clicking, and does NOT falsely treat raw click as confirmed signin.
 */
export async function handleAutoCheckIn(ctx: Context): Promise<void> {
  const { document: doc, settings, store, userId } = ctx;
  if (!settings.autoCheckIn || !userId) return;

  const shanghaiDate = getShanghaiDateString();
  const attemptKey = `checkin_attempt:${userId}:${shanghaiDate}`;

  const alreadyAttempted = await store.get(attemptKey, false);
  if (alreadyAttempted) return;

  const signBtn = doc.querySelector('.float-btn.sign, a.yuan[href*="signin"], .nav-user a.yuan') as HTMLElement | null;
  if (signBtn) {
    const text = (signBtn.textContent || '').trim();
    // Only attempt if authentic signin button indicates uncompleted state
    if (text.includes('签') && !text.includes('已签') && !signBtn.classList.contains('signed')) {
      await store.set(attemptKey, true);
      signBtn.click();
    }
  }
}

/**
 * Fixes bare text links (G08), D7VG legacy links (G09), and HTTP to HTTPS (G10).
 * Uses exact URL hostname matching without touching query strings or fake domains.
 */
export function fixLinks(ctx: Context, root: ParentNode): void {
  const { document: doc, settings, url: currentUrl } = ctx;

  const allAnchors: HTMLAnchorElement[] = [];
  if (root instanceof HTMLAnchorElement) allAnchors.push(root);
  allAnchors.push(...Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]')));

  // 1. Fix D7VG legacy links (G09) & Upgrade site links to HTTPS (G10)
  allAnchors.forEach(a => {
    const rawHref = a.getAttribute('href');
    if (!rawHref) return;

    let parsed: URL;
    try {
      parsed = new URL(rawHref, currentUrl);
    } catch {
      return;
    }

    const host = parsed.hostname.toLowerCase();

    // Exact D7VG hostname replacement (G09)
    if (settings.fixD7VGLinks && (host === 'd7vg.com' || host === 'www.d7vg.com')) {
      parsed.hostname = 'psnine.com';
      if (settings.fixHTTPLinks) {
        parsed.protocol = 'https:';
      }
      a.setAttribute('href', parsed.href);
      return;
    }

    // Exact PSNINE HTTPS upgrade (G10)
    if (settings.fixHTTPLinks && (host === 'psnine.com' || host === 'www.psnine.com')) {
      if (parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
        a.setAttribute('href', parsed.href);
      }
    }
  });

  // 2. Linkify bare URL text nodes (G08)
  if (settings.fixTextLinks) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Strictly exclude any ancestor that is an anchor, code, input, or editable
        if (parent.closest('a, script, style, textarea, input, pre, code, [contenteditable="true"], [data-psnine-next]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const urlRegex = /(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-zA-Z0-9/])/g;
    const nodesToReplace: Text[] = [];

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      if (urlRegex.test(textNode.nodeValue || '')) {
        nodesToReplace.push(textNode);
      }
      urlRegex.lastIndex = 0;
    }

    nodesToReplace.forEach(node => {
      const text = node.nodeValue || '';
      const fragment = doc.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
        }
        const matchedUrl = match[0];
        const a = doc.createElement('a');
        a.href = matchedUrl;
        a.textContent = matchedUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
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

/**
 * Ensures Gene / QA post lists default to newest sort if listPostsByNew is enabled (G11).
 * Both /gene and /qa lists are controlled by listPostsByNew per historical upstream logic.
 * listQAAnswersByNew is strictly reserved for C13 (sorting answers inside a QA question).
 */
export function applyNewestDefaultSort(ctx: Context): void {
  const { settings, url, window: win } = ctx;

  const isGeneList = url.pathname === '/gene' || url.pathname === '/gene/';
  const isQaList = url.pathname === '/qa' || url.pathname === '/qa/';

  if ((isGeneList || isQaList) && settings.listPostsByNew) {
    if (!url.searchParams.has('ob')) {
      const targetUrl = new URL(url.href);
      targetUrl.searchParams.set('ob', 'date');
      win.location.replace(targetUrl.href);
    }
  }
}

/**
 * Main Global Module Mount (G01~G11, X01, X02)
 */
export const mountGlobal: Mount = (ctx: Context): Cleanup => {
  applyTheme(ctx);

  let themeObserver: MutationObserver | null = null;
  if (typeof MutationObserver !== 'undefined' && ctx.document.documentElement) {
    themeObserver = new MutationObserver(() => {
      const shouldBeDark = isDarkActive(ctx);
      const htmlTheme = ctx.document.documentElement.getAttribute('data-theme');
      const bodyTheme = ctx.document.body ? ctx.document.body.getAttribute('data-theme') : null;
      const hasStyle = Boolean(ctx.document.getElementById('nightModeStyle'));

      if (shouldBeDark) {
        if (htmlTheme !== 'dark' || (ctx.document.body && bodyTheme !== 'dark') || !hasStyle) {
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
      attributeFilter: ['data-theme'],
    });
    if (ctx.document.body) {
      themeObserver.observe(ctx.document.body, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }
  }

  let mediaWatcher: MediaQueryList | null = null;
  const onMediaChange = () => applyTheme(ctx);

  if (typeof ctx.window.matchMedia === 'function') {
    mediaWatcher = ctx.window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaWatcher.addEventListener) {
      mediaWatcher.addEventListener('change', onMediaChange);
    } else if ('addListener' in mediaWatcher) {
      (mediaWatcher as any).addListener(onMediaChange);
    }
  }

  const timer = ctx.window.setInterval(() => {
    if (ctx.settings.autoNightMode === 'TIME') {
      applyTheme(ctx);
    }
  }, 60000);

  enhanceMasks(ctx, ctx.document);
  mountScrollBottom(ctx);
  fixLinks(ctx, ctx.document.body || ctx.document);
  applyNewestDefaultSort(ctx);
  handleAutoCheckIn(ctx).catch(err => ctx.report('autoCheckIn', err));

  const unsubs = ctx.onContent((root) => {
    enhanceMasks(ctx, root);
    fixLinks(ctx, root);
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
        mediaWatcher.removeEventListener('change', onMediaChange);
      } else if ('removeListener' in mediaWatcher) {
        (mediaWatcher as any).removeListener(onMediaChange);
      }
    }
  };
};
