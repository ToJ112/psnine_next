import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContext, extractVerifiedUserId } from '../../src/core/context';
import { defaultSettings } from '../../src/core/types';
import { createStore } from '../../src/core/store';
import { createHttpClient } from '../../src/core/http';

function clearCookies() {
  document.cookie.split(';').forEach(c => {
    document.cookie = c.trim().split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });
}

describe('Context and User Security', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearCookies();
  });

  describe('extractVerifiedUserId', () => {
    it('extracts ID from authentic cookie', () => {
      document.cookie = '__Psnine_psnid=player123; path=/';
      expect(extractVerifiedUserId(document)).toBe('player123');
    });

    it('extracts ID from verified header user nav', () => {
      document.body.innerHTML = `
        <div class="site-nav">
          <div class="user">
            <a href="https://psnine.com/psnid/verified_user">Profile</a>
          </div>
        </div>
      `;
      expect(extractVerifiedUserId(document)).toBe('verified_user');
    });

    it('NEVER infers identity from arbitrary links in page body', () => {
      document.body.innerHTML = `
        <div class="content">
          <p>Author is <a href="https://psnine.com/psnid/author_user">Author</a></p>
          <p>Comment by <a href="/psnid/commenter_user">Commenter</a></p>
        </div>
      `;
      // Cookie and nav are absent: MUST be null!
      expect(extractVerifiedUserId(document)).toBeNull();
    });
  });

  describe('onContent observer and loop prevention', () => {
    it('triggers callback for regular dynamic DOM insertions', async () => {
      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings },
        store,
        http,
      });

      const subscriber = vi.fn();
      const cleanup = ctx.onContent(subscriber);

      // Add regular new DOM element
      const newComment = document.createElement('div');
      newComment.className = 'post';
      document.body.appendChild(newComment);

      // Wait for rAF / timeout flush
      await new Promise(r => setTimeout(r, 150));

      expect(subscriber).toHaveBeenCalled();
      cleanup();
    });

    it('ignores plugin-enhanced DOM nodes with data-psnine-next attribute (loop prevention)', async () => {
      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings },
        store,
        http,
      });

      const subscriber = vi.fn();
      const cleanup = ctx.onContent(subscriber);

      // Create plugin self-enhanced element
      const pluginWidget = document.createElement('div');
      pluginWidget.setAttribute('data-psnine-next', 'widget');
      const child = document.createElement('span');
      child.textContent = 'hello';
      pluginWidget.appendChild(child);

      document.body.appendChild(pluginWidget);

      await new Promise(r => setTimeout(r, 150));

      // MUST NOT have triggered for plugin's own modification
      expect(subscriber).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
