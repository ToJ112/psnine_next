import { Context, Settings, Store, HttpClient } from './types';

/**
 * Extracts currently logged-in PSNID.
 * Strictly adheres to upstream authentic selectors (line 1073):
 * 1. __Psnine_psnid cookie
 * 2. div.nav-user > button.auth-user > span.name
 * 3. .user-menu-list a[href*="/psnid/"]
 * 4. ul.r li.dropdown ul li a
 * NEVER infers login identity from arbitrary profile links on the page being visited.
 */
export function extractVerifiedUserId(doc: Document): string | null {
  try {
    const cookie = doc.cookie || '';
    const cookieMatch = cookie.match(/(?:^|;\s*)__Psnine_psnid=([A-Za-z0-9_-]+)/);
    if (cookieMatch && cookieMatch[1]) return cookieMatch[1];

    const myUserIdNode = doc.querySelector('div.nav-user > button.auth-user > span.name');
    if (myUserIdNode && myUserIdNode.textContent?.trim()) {
      return myUserIdNode.textContent.trim();
    }

    const userMenuA = doc.querySelector('.user-menu-list a[href*="/psnid/"], .site-nav .user a[href*="/psnid/"], .nav-user a[href*="/psnid/"]');
    if (userMenuA) {
      const href = userMenuA.getAttribute('href') || '';
      const m = href.match(/\/psnid\/([A-Za-z0-9_-]+)/);
      if (m && m[1]) return m[1];
    }

    const oldA = doc.querySelector('ul.r li.dropdown ul li a') as HTMLAnchorElement | null;
    if (oldA && oldA.href) {
      const m = oldA.href.match(/\/psnid\/([A-Za-z0-9_-]+)/);
      if (m && m[1]) return m[1];
    }
  } catch {
    // Context access error fallback
  }

  return null;
}

export interface ContextOptions {
  document: Document;
  window: Window;
  settings: Settings;
  store: Store;
  http: HttpClient;
}

/**
 * Creates the global Context passed to all feature mount functions.
 * Implements safe onContent observation ignoring plugin's own DOM modifications.
 */
export function createContext(options: ContextOptions): Context {
  const { document: doc, window: win, settings, store, http } = options;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(win.location.href);
  } catch {
    parsedUrl = new URL('https://psnine.com/');
  }

  const userId = extractVerifiedUserId(doc);
  const reportedErrors: Array<{ feature: string; error: unknown }> = [];

  const contentSubscribers = new Set<(root: ParentNode) => void>();
  let observer: MutationObserver | null = null;
  let pendingNodes = new Set<Node>();
  let rafId: number | null = null;

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
        if (node.hasAttribute('data-psnine-next') || node.closest('[data-psnine-next]')) {
          continue;
        }
      }

      for (const subscriber of contentSubscribers) {
        try {
          subscriber(node as ParentNode);
        } catch (err) {
          reportError('onContent', err);
        }
      }
    }
  };

  const ensureObserver = () => {
    if (observer || typeof MutationObserver === 'undefined') return;

    observer = new MutationObserver((mutations) => {
      let hasValidAddition = false;

      for (const mut of mutations) {
        if (mut.type === 'childList') {
          for (let i = 0; i < mut.addedNodes.length; i++) {
            const added = mut.addedNodes[i];
            if (added.nodeType === Node.ELEMENT_NODE) {
              const el = added as HTMLElement;
              if (el.hasAttribute('data-psnine-next') || el.closest?.('[data-psnine-next]')) {
                continue;
              }
              pendingNodes.add(el);
              hasValidAddition = true;
            }
          }
        }
      }

      if (hasValidAddition && rafId === null) {
        rafId = win.requestAnimationFrame ? win.requestAnimationFrame(flushPending) : (win.setTimeout(flushPending, 16) as unknown as number);
      }
    });

    if (doc.body) {
      observer.observe(doc.body, { childList: true, subtree: true });
    } else {
      doc.addEventListener('DOMContentLoaded', () => {
        if (doc.body && observer) {
          observer.observe(doc.body, { childList: true, subtree: true });
        }
      }, { once: true });
    }
  };

  const reportError = (feature: string, error: unknown): void => {
    reportedErrors.push({ feature, error });
    if (typeof console !== 'undefined' && console.error) {
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

    onContent(fn: (root: ParentNode) => void): () => void {
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

    report(feature: string, error: unknown): void {
      reportError(feature, error);
    }
  };
}
