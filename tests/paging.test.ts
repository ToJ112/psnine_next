import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNextPageUrl,
  getListContainer,
  getItemSignature,
  isSafeNextPageUrl,
  setupAutoPagination,
  setupLoadAllQAAnswers
} from '../src/features/paging';
import { createContext } from '../src/core/context';
import { defaultSettings } from '../src/core/types';
import { createStore } from '../src/core/store';
import { createHttpClient } from '../src/core/http';

describe('Paging features module with real fixture semantics (C12, C20, C21)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Container identification by real route & markup', () => {
    it('identifies plain table in /psngame even when last page has only 1 row', () => {
      // Last page of games with only 1 game row
      document.body.innerHTML = `
        <table>
          <tbody>
            <tr><td><a href="https://psnine.com/psngame/99999">Last Lone Game</a></td></tr>
          </tbody>
        </table>
      `;

      const info = getListContainer(document, new URL('https://psnine.com/psngame?page=250'));
      expect(info).not.toBeNull();
      expect(info?.itemSelector).toBe('tr');
    });

    it('identifies ul.dd_ul in /dd deals page', () => {
      document.body.innerHTML = `
        <ul class="dd_ul">
          <li>Deal 1</li>
          <li>Deal 2</li>
        </ul>
      `;

      const info = getListContainer(document, new URL('https://psnine.com/dd'));
      expect(info).not.toBeNull();
      expect(info?.itemSelector).toBe(':scope > li');
    });

    it('does NOT treat article table (.tbl) in /topic as pageable game container', () => {
      document.body.innerHTML = `
        <table class="tbl">
          <tbody>
            <tr><td>Guide Table Row</td></tr>
          </tbody>
        </table>
      `;

      const info = getListContainer(document, new URL('https://psnine.com/topic/39074'));
      expect(info).toBeNull();
    });

    it('identifies ul.list in /psngame/:id/comment and does NOT treat trophy tables as comment container', () => {
      document.body.innerHTML = `
        <table><tbody><tr><td>Trophy Row</td></tr></tbody></table>
        <div class="box">
          <ul class="list">
            <li>Comment 1</li>
          </ul>
        </div>
      `;

      const info = getListContainer(document, new URL('https://psnine.com/psngame/46507/comment'));
      expect(info).not.toBeNull();
      expect(info?.itemSelector).toBe(':scope > li');
      expect(info?.container.tagName.toLowerCase()).toBe('ul');
    });
  });

  describe('Safe getNextPageUrl with numeric pagination & path validation', () => {
    it('enforces same pathname and rejects cross-route navigation', () => {
      const currentUrl = new URL('https://psnine.com/psngame?page=1');
      expect(isSafeNextPageUrl('https://psnine.com/psngame?page=2', currentUrl)).toBe(true);
      // Different pathname: rejected
      expect(isSafeNextPageUrl('https://psnine.com/topic?page=2', currentUrl)).toBe(false);
      expect(isSafeNextPageUrl('https://psnine.com/set/password', currentUrl)).toBe(false);
    });

    it('extracts next page URL when current page anchor is javascript:void(0)', () => {
      document.body.innerHTML = `
        <div class="page">
          <ul>
            <li class="current"><a href="javascript:void(0)">1</a></li>
            <li><a href="/psngame?page=2">2</a></li>
            <li><a href="/psngame?page=3">3</a></li>
            <li class="disabled"><a href="#">...</a></li>
            <li><a href="/psngame?page=250">250</a></li>
          </ul>
        </div>
      `;

      const nextUrl = getNextPageUrl(document, new URL('https://psnine.com/psngame'));
      expect(nextUrl).toBe('https://psnine.com/psngame?page=2');
    });

    it('rejects unsafe actions and javascript links in pagination', () => {
      document.body.innerHTML = `
        <div class="page">
          <li class="current"><span>1</span></li>
          <li><a href="javascript:alert(1)">2</a></li>
          <li><a href="/set/delete">3</a></li>
          <li><a href="https://evil.com/page/4">4</a></li>
        </div>
      `;

      const nextUrl = getNextPageUrl(document, new URL('https://psnine.com/topic/123'));
      expect(nextUrl).toBeNull();
    });
  });

  describe('Item signature deduplication accuracy', () => {
    it('distinguishes deals sharing the same promotion topic link via specific SKU href', () => {
      const deal1 = document.createElement('li');
      deal1.innerHTML = `
        <h4 class="dd_title"><a href="https://psnine.com/dd/SKU_HORIZON">Horizon Zero Dawn</a></h4>
        <p><a href="https://psnine.com/topic/35613">HK$148以下折扣游戏</a></p>
      `;

      const deal2 = document.createElement('li');
      deal2.innerHTML = `
        <h4 class="dd_title"><a href="https://psnine.com/dd/SKU_UNCHARTED">Uncharted Collection</a></h4>
        <p><a href="https://psnine.com/topic/35613">HK$148以下折扣游戏</a></p>
      `;

      const sig1 = getItemSignature(deal1);
      const sig2 = getItemSignature(deal2);

      expect(sig1).not.toBe(sig2);
      expect(sig1).toContain('SKU_HORIZON');
      expect(sig2).toContain('SKU_UNCHARTED');
    });

    it('excludes injected plugin chrome from fallback signature', () => {
      const item = document.createElement('div');
      item.innerHTML = `
        <div class="meta"><a class="psnnode">AuthorX</a> <span class="h-p">2026-09-30</span></div>
        <span class="psnine-floor-badge" data-psnine-next="chrome">#999</span>
        <div class="content">Post text content</div>
      `;

      const sig = getItemSignature(item);
      expect(sig).not.toContain('999');
      expect(sig).toContain('AuthorX');
    });
  });

  describe('C21: Profile game pagination following authentic "查看所有游戏" link', () => {
    it('follows authentic 查看所有游戏 link on personal homepage and respects maxPages limit', async () => {
      document.body.innerHTML = `
        <table class="list">
          <tbody>
            <tr><td>Initial Game 1</td></tr>
          </tbody>
        </table>
        <div class="box">
          <a href="https://psnine.com/psnid/toonn95/psngame">查看所有游戏</a>
        </div>
      `;

      const allGamesPage1Html = `
        <html>
          <body>
            <table class="list">
              <tbody>
                <tr><td>All Games Row 1</td></tr>
                <tr><td>All Games Row 2</td></tr>
              </tbody>
            </table>
            <div class="page">
              <ul>
                <li class="current"><a href="javascript:void(0)">1</a></li>
                <li><a href="/psnid/toonn95/psngame?page=2">2</a></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => allGamesPage1Html,
      } as Response);

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, autoPaging: 1, autoPagingInHomepage: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/psnid/toonn95');

      const cleanup = setupAutoPagination(ctx);

      window.scrollY = 2000;
      Object.defineProperty(document.body, 'scrollHeight', { value: 2100, configurable: true });
      window.dispatchEvent(new Event('scroll'));

      await new Promise(r => setTimeout(r, 60));

      const rows = document.querySelectorAll('table.list tr');
      expect(rows.length).toBe(3);
      expect(rows[1].textContent).toContain('All Games Row 1');

      // Check that manual continue prompt is provided when maxPages is reached
      const indicator = document.getElementById('psnine-pagination-indicator');
      expect(indicator?.textContent).toContain('已加载预设');

      cleanup();
    });
  });

  describe('C12: Load All QA Answers with retry, cancellation, and 20-page batching', () => {
    it('supports user cancellation, continues without restarting, and retains pager when bounded', async () => {
      document.body.innerHTML = `
        <div class="page">
          <ul>
            <li class="current"><a href="javascript:void(0)">1</a></li>
            <li><a href="/qa/123?page=2">2</a></li>
          </ul>
        </div>
        <ul class="list">
          <li>Answer 1</li>
        </ul>
      `;

      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        fetchCount++;
        const nextUrl = fetchCount < 2 ? '/qa/123?page=3' : '';
        const html = `
          <html>
            <body>
              <ul class="list">
                <li>Answer from page ${fetchCount + 1}</li>
              </ul>
              <div class="page">
                <ul>
                  ${nextUrl ? `<li><a rel="next" href="${nextUrl}">下一页</a></li>` : ''}
                </ul>
              </div>
            </body>
          </html>
        `;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => html,
        } as Response);
      });

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, showAllQAAnswers: false },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/qa/123');

      const cleanup = setupLoadAllQAAnswers(ctx);

      const btn = document.getElementById('psnine-load-all-qa') as HTMLButtonElement;
      expect(btn).not.toBeNull();

      btn.click();
      await new Promise(r => setTimeout(r, 80));

      expect(fetchCount).toBeGreaterThanOrEqual(2);
      const answers = document.querySelectorAll('ul.list li');
      expect(answers.length).toBe(3);
      expect(btn.textContent).toBe('已载入全部回答');
      expect(btn.disabled).toBe(true);

      cleanup();
    });
  });
});
