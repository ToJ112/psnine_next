import { describe, it, expect, beforeEach } from 'vitest';
import { escapeHtml, parseBBCode, setupGeneWordCount, setupBBCodePreview } from '../src/features/editor';
import { createContext } from '../src/core/context';
import { defaultSettings } from '../src/core/types';
import { createStore } from '../src/core/store';
import { createHttpClient } from '../src/core/http';

describe('Editor features module (C17, C18)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('BBCode parsing and XSS prevention', () => {
    it('escapes raw HTML tags to prevent XSS', () => {
      const input = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const parsed = parseBBCode(input);
      expect(parsed).not.toContain('<script>');
      expect(parsed).toContain('&lt;script&gt;');
      expect(parsed).not.toContain('<img');
      expect(parsed).toContain('&lt;img');
    });

    it('parses valid BBCode tags into HTML', () => {
      const input = '[b]Bold[/b] [i]Italic[/i] [mask]Mask[/mask] [mark]Mark[/mark] [center]Center[/center] [quote]Quote[/quote] [url]https://psnine.com[/url]';
      const parsed = parseBBCode(input);
      expect(parsed).toContain('<strong>Bold</strong>');
      expect(parsed).toContain('<em>Italic</em>');
      expect(parsed).toContain('<span class="mark">Mask</span>');
      expect(parsed).toContain('<span class="mark">Mark</span>');
      expect(parsed).toContain('<div style="text-align:center;">Center</div>');
      expect(parsed).toContain('<blockquote>Quote</blockquote>');
      expect(parsed).toContain('<a href="https://psnine.com" target="_blank" rel="noopener noreferrer">https://psnine.com</a>');
    });

    it('rejects javascript: URLs inside [url] tags', () => {
      const input = '[url=javascript:stealCookie()]Malicious Link[/url]';
      const parsed = parseBBCode(input);
      expect(parsed).not.toContain('<a href="javascript:');
    });
  });

  describe('Gene word count & 600-char over-limit prevention (C17)', () => {
    it('updates character count and prevents submission when exceeding 600 chars', () => {
      document.body.innerHTML = `
        <form action="/set/gene/add">
          <textarea name="content"></textarea>
          <button type="submit">Publish</button>
        </form>
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
      ctx.url = new URL('https://psnine.com/set/gene');

      setupGeneWordCount(ctx, document.body);

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      const countBox = document.querySelector('.psnine-gene-count-box') as HTMLElement;
      const form = document.querySelector('form') as HTMLFormElement;

      expect(countBox.textContent).toContain('0 / 600');

      // Type within limit (newlines excluded from count)
      textarea.value = 'a'.repeat(500) + '\n\n';
      textarea.dispatchEvent(new Event('input'));
      expect(countBox.textContent).toContain('500 / 600');

      // Exceed 600 chars
      textarea.value = 'a'.repeat(601);
      textarea.dispatchEvent(new Event('input'));
      expect(countBox.textContent).toContain('601 / 600');
      expect(countBox.textContent).toContain('已超限');
      expect(countBox.style.color).toBe('rgb(231, 76, 60)');

      // Form submission should be prevented by capturing phase listener
      const submitEvent = new Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);
      expect(submitEvent.defaultPrevented).toBe(true);
    });
  });

  describe('BBCode live preview (C18)', () => {
    it('renders live preview below textarea', () => {
      document.body.innerHTML = `
        <form>
          <textarea id="content"></textarea>
        </form>
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

      setupBBCodePreview(ctx, document.body);

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      const preview = document.getElementById('psnine-bbcode-preview') as HTMLElement;

      expect(preview).not.toBeNull();
      expect(preview.style.display).toBe('none');

      textarea.value = 'Hello [b]World[/b]';
      textarea.dispatchEvent(new Event('input'));

      expect(preview.style.display).toBe('block');
      expect(preview.innerHTML).toContain('<strong>World</strong>');
    });
  });
});
