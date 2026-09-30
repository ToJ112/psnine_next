import { HttpClient, HttpOptions } from './types';

interface CacheEntry {
  rawText: string;
  expires: number;
}

interface QueueItem {
  resolve: () => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/**
 * Creates an HttpClient with concurrency limit of 2,
 * in-flight request deduplication for non-signaled calls, raw-text caching (preventing shared Document mutations),
 * early/queued abort handling with post-acquire signal check, and strict URL security & DOM sanitization.
 */
export function createHttpClient(currentOrigin = 'https://psnine.com'): HttpClient {
  // Raw text cache keyed by URL: ensures multiple callers get fresh, independent Document clones
  const textCache = new Map<string, CacheEntry>();
  const inFlightText = new Map<string, Promise<string>>();

  const maxConcurrency = 2;
  let activeRequests = 0;
  const queue: QueueItem[] = [];

  let currentOriginParsed: URL;
  try {
    currentOriginParsed = new URL(currentOrigin);
  } catch {
    currentOriginParsed = new URL('https://psnine.com');
  }

  const acquire = (signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }

    if (activeRequests < maxConcurrency) {
      activeRequests++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const item: QueueItem = { resolve, reject, signal };

      if (signal) {
        item.onAbort = () => {
          const idx = queue.indexOf(item);
          if (idx > -1) {
            queue.splice(idx, 1);
          }
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        signal.addEventListener('abort', item.onAbort, { once: true });
      }

      queue.push(item);
    });
  };

  const release = (): void => {
    activeRequests--;
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;

      if (next.signal && next.onAbort) {
        next.signal.removeEventListener('abort', next.onAbort);
      }

      if (next.signal?.aborted) {
        continue;
      }

      activeRequests++;
      next.resolve();
      return;
    }
  };

  /**
   * Validates target URL against strict security boundaries:
   * - Protocol must be http: or https:
   * - No username or password allowed
   * - HTML / text requests are strictly limited to EXACT same-origin (protocol, host, port)
   * - External JSON is whitelisted strictly to EXACT origin https://api.frankfurter.dev
   */
  const validateUrl = (urlStr: string, requestType: 'text' | 'document' | 'json'): URL => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr, currentOriginParsed.href);
    } catch {
      throw new Error(`[HttpClient] Invalid URL: ${urlStr}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`[HttpClient] Protocol not allowed: ${parsed.protocol}`);
    }

    if (parsed.username !== '' || parsed.password !== '') {
      throw new Error(`[HttpClient] Embedded credentials not allowed in URL`);
    }

    const isSameOrigin = parsed.origin === currentOriginParsed.origin;
    const isFrankfurterOrigin = parsed.origin === 'https://api.frankfurter.dev';

    if (requestType === 'document' || requestType === 'text') {
      if (!isSameOrigin) {
        throw new Error(`[HttpClient] Cross-origin document fetch not allowed: ${parsed.origin}`);
      }
    } else if (requestType === 'json') {
      if (!isSameOrigin && !isFrankfurterOrigin) {
        throw new Error(`[HttpClient] Disallowed external JSON endpoint: ${parsed.origin}`);
      }
    }

    return parsed;
  };

  /**
   * Internal fetcher for raw text with deduplication, semaphore, and TTL caching.
   * Requests with caller-specific AbortSignal do NOT share in-flight promises,
   * guaranteeing that one caller's abort never cancels others and every caller's abort is respected.
   */
  const fetchRawText = async (validatedUrl: URL, options?: HttpOptions): Promise<string> => {
    const normalizedUrl = validatedUrl.href;
    const now = Date.now();
    const ttl = options?.ttl ?? 0;
    const canDeduplicate = !options?.signal;

    if (options?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    // Check raw text cache
    if (ttl > 0 && textCache.has(normalizedUrl)) {
      const entry = textCache.get(normalizedUrl)!;
      if (entry.expires > now) {
        return entry.rawText;
      }
      textCache.delete(normalizedUrl);
    }

    // Check in-flight deduplication only for requests without caller-specific AbortSignal
    if (canDeduplicate && inFlightText.has(normalizedUrl)) {
      return inFlightText.get(normalizedUrl)!;
    }

    const task = (async (): Promise<string> => {
      await acquire(options?.signal);
      try {
        // Re-check signal after acquiring semaphore to prevent race condition during queue wait
        if (options?.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }

        const controller = new AbortController();
        const timeoutMs = 15000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let abortHandler: (() => void) | undefined;
        if (options?.signal) {
          abortHandler = () => controller.abort();
          options.signal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
          const res = await fetch(normalizedUrl, {
            signal: controller.signal,
            credentials: 'same-origin'
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
            options.signal.removeEventListener('abort', abortHandler);
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

  /**
   * Sanitizes a parsed Document against active script execution and remote injection.
   * Strips active resource tags (script, iframe, style, link, object, embed, etc.),
   * validates and relativizes safe URLs, filters SVG data URLs and other scriptable protocols,
   * and sanitizes srcset attributes.
   */
  const sanitizeDocument = (doc: Document, baseUrl: URL): Document => {
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'form', 'applet', 'style', 'link'];
    for (const tag of dangerousTags) {
      const elements = doc.querySelectorAll(tag);
      elements.forEach(el => {
        if (tag === 'meta') {
          if (el.hasAttribute('http-equiv') || el.getAttribute('name')?.toLowerCase() === 'refresh') {
            el.remove();
          }
        } else {
          el.remove();
        }
      });
    }

    const isMaliciousUrl = (rawUrl: string): boolean => {
      const clean = rawUrl.replace(/[\u0000-\u0020\u007F-\u009F\s]/g, '').toLowerCase();
      if (clean.startsWith('javascript:') || clean.startsWith('vbscript:')) {
        return true;
      }
      if (clean.startsWith('data:')) {
        // Disallow SVG data URLs as they can contain active script XML
        if (clean.startsWith('data:image/svg+xml')) {
          return true;
        }
        // Only allow safe raster image data URLs
        if (!clean.startsWith('data:image/png') &&
            !clean.startsWith('data:image/jpeg') &&
            !clean.startsWith('data:image/jpg') &&
            !clean.startsWith('data:image/webp') &&
            !clean.startsWith('data:image/gif')) {
          return true;
        }
      }
      return false;
    };

    const toAbsoluteUrl = (rel: string): string => {
      try {
        return new URL(rel, baseUrl).href;
      } catch {
        return rel;
      }
    };

    const sanitizeSrcset = (srcsetVal: string): string => {
      const candidates = srcsetVal.split(',');
      const cleanedCandidates: string[] = [];
      for (const cand of candidates) {
        const trimmed = cand.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const urlPart = parts[0];
        const descriptor = parts.slice(1).join(' ');
        if (isMaliciousUrl(urlPart)) {
          continue; // Strip malicious candidate URL
        }
        const absUrl = toAbsoluteUrl(urlPart);
        cleanedCandidates.push(descriptor ? `${absUrl} ${descriptor}` : absUrl);
      }
      return cleanedCandidates.join(', ');
    };

    const all = doc.querySelectorAll('*');
    all.forEach(el => {
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const val = attr.value;

        // Disallow all inline event handlers (onclick, onload, onerror, etc.)
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }

        // Disallow active submit / frame targets
        if (name === 'srcdoc' || name === 'action' || name === 'formaction' || name.endsWith(':href')) {
          if (name !== 'href') {
            el.removeAttribute(attr.name);
            continue;
          }
        }

        if (name === 'srcset') {
          const cleaned = sanitizeSrcset(val);
          if (cleaned) {
            el.setAttribute(attr.name, cleaned);
          } else {
            el.removeAttribute(attr.name);
          }
          continue;
        }

        if (name === 'href' || name === 'src' || name === 'poster' || name === 'data' || name === 'background') {
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
    async text(urlStr: string, options?: HttpOptions): Promise<string> {
      const validatedUrl = validateUrl(urlStr, 'text');
      return fetchRawText(validatedUrl, options);
    },

    async document(urlStr: string, options?: HttpOptions): Promise<Document> {
      const validatedUrl = validateUrl(urlStr, 'document');
      const rawText = await fetchRawText(validatedUrl, options);
      const parser = new DOMParser();
      const rawDoc = parser.parseFromString(rawText, 'text/html');
      return sanitizeDocument(rawDoc, validatedUrl);
    },

    async json<T>(urlStr: string, options?: HttpOptions): Promise<T> {
      const validatedUrl = validateUrl(urlStr, 'json');
      const rawText = await fetchRawText(validatedUrl, options);
      return JSON.parse(rawText) as T;
    }
  };
}
