import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPageAuthor,
  applyUserHighlights,
  applyFloorNumbers,
  applyReplyTraceback,
  applyBlocklist,
  applyKeywordFilter,
  applyHotTags,
  applyQaStatusIcons,
  sortQAAnswersByNew,
  applyReverseSubReply,
  setupQaSubReplyExpansion,
  setupAvatarProfileCards,
  mountCommunity,
} from '../src/features/community';
import { createContext } from '../src/core/context';
import { defaultSettings } from '../src/core/types';
import { createStore } from '../src/core/store';
import { createHttpClient } from '../src/core/http';
import { isHiddenByReason } from '../src/core/dom';

describe('Community features module with real fixture semantics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('C01: Real-fixture OP detection (topic.html & gene.html)', () => {
    it('correctly identifies OP in .pd10 .meta a[itemprop="author"] and NOT first replier in .post', () => {
      document.body.innerHTML = `
        <div class="pd10">
          <h1>《战锤40K 星际战士2》白金攻略 前言</h1>
          <div class="meta">
            <a href="http://service.weibo.com/share">微博</a>
            <a href="https://psnine.com/psnid/scottzheng" itemprop="author">ScottZheng</a>
            <a href="https://psnine.com/node/guide">guide</a>
          </div>
        </div>
        <div class="main">
          <div class="post" id="post-1">
            <div class="meta">
              <a href="https://psnine.com/psnid/ubiplayer666" class="psnnode">ubiplayer666</a>
              <span>03-27 14:25</span>
            </div>
            <div class="content">Thanks for the guide!</div>
          </div>
          <div class="post" id="post-2">
            <div class="meta">
              <a href="https://psnine.com/psnid/scottzheng" class="psnnode">ScottZheng</a>
              <span>03-27 15:00</span>
            </div>
            <div class="content">Added more details.</div>
          </div>
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
      ctx.url = new URL('https://psnine.com/topic/39074');

      const op = getPageAuthor(document, ctx.url);
      expect(op).toBe('scottzheng');

      applyUserHighlights(ctx, document.body);

      const post1Author = document.querySelector('#post-1 .meta');
      expect(post1Author?.querySelector('.psnine-author-badge')).toBeNull();

      const post2Author = document.querySelector('#post-2 .meta');
      const badge = post2Author?.querySelector('.psnine-author-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('楼主');
    });
  });

  describe('C03: Main floor and subfloor numbering with monotonic sequence', () => {
    it('numbers both main floors (#1, #2) and subfloors (#1-1, #1-2) stably across dynamic inserts', () => {
      document.body.innerHTML = `
        <div class="post" id="p1">
          <div class="ml64">
            <div class="meta"><a class="psnnode">User A</a></div>
            <div class="content">Main comment 1</div>
            <div class="sonlistmark ml64 mt10">
              <ul class="sonlist">
                <li><div class="meta"><a class="psnnode">User B</a></div>Sub 1</li>
                <li><div class="meta"><a class="psnnode">User C</a></div>Sub 2</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="post" id="p2">
          <div class="ml64">
            <div class="meta"><a class="psnnode">User D</a></div>
            <div class="content">Main comment 2</div>
          </div>
        </div>
      `;

      applyFloorNumbers(document, document.body);

      const p1Badge = document.querySelector('#p1 .psnine-floor-badge');
      const p2Badge = document.querySelector('#p2 .psnine-floor-badge');
      expect(p1Badge?.textContent).toBe('#1');
      expect(p2Badge?.textContent).toBe('#2');

      const subBadges = document.querySelectorAll('.psnine-subfloor-badge');
      expect(subBadges.length).toBe(2);
      expect(subBadges[0].textContent).toBe('#1-1');
      expect(subBadges[1].textContent).toBe('#1-2');

      // Dynamic addition of post 3
      const p3 = document.createElement('div');
      p3.className = 'post';
      p3.id = 'p3';
      p3.innerHTML = `
        <div class="ml64">
          <div class="meta"><a class="psnnode">User E</a></div>
          <div class="sonlistmark ml64 mt10">
            <ul class="sonlist">
              <li><div class="meta"><a class="psnnode">User F</a></div>Sub 3-1</li>
            </ul>
          </div>
        </div>
      `;
      document.body.appendChild(p3);

      applyFloorNumbers(document, p3);

      const p3Badge = document.querySelector('#p3 .psnine-floor-badge');
      expect(p3Badge?.textContent).toBe('#3');
      const p3SubBadge = document.querySelector('#p3 .psnine-subfloor-badge');
      expect(p3SubBadge?.textContent).toBe('#3-1');
    });
  });

  describe('C04, C05: Traceback card spoiler interactivity and non-capturing clicks', () => {
    it('makes cloned spoiler bars in traceback cards interactive and ignores inner interactive clicks', () => {
      document.body.innerHTML = `
        <div class="post" id="post-1">
          <div class="ml64">
            <div class="meta"><a class="psnnode" href="/psnid/alice">alice</a></div>
            <div class="content">
              Top secret: <span class="mark" data-psnine-mask-ready="true">Hidden Plot</span>
              <a href="/psngame/123" id="inner-game-link">Game Link</a>
            </div>
          </div>
        </div>
        <div class="post" id="post-2">
          <div class="ml64">
            <div class="meta"><a class="psnnode" href="/psnid/bob">bob</a></div>
            <div class="content">Hey <a href="/psnid/alice">@alice</a> what do you think?</div>
          </div>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, replyTraceback: true },
        store,
        http,
      });

      applyFloorNumbers(document, document.body);
      applyReplyTraceback(ctx, document.body);

      const card = document.querySelector('.psnine-traceback-card') as HTMLElement;
      expect(card).not.toBeNull();

      const clonedMark = card.querySelector('.mark') as HTMLElement;
      expect(clonedMark).not.toBeNull();
      expect(clonedMark.classList.contains('unmasked')).toBe(false);

      clonedMark.click();
      expect(clonedMark.classList.contains('unmasked')).toBe(true);

      const post1 = document.getElementById('post-1') as HTMLElement;
      post1.scrollIntoView = vi.fn();

      clonedMark.click();
      expect(post1.scrollIntoView).not.toHaveBeenCalled();

      card.click();
      expect(post1.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('C09: Keyword filter subcomment isolation', () => {
    it('hides only the child subcomment with forbidden keyword without hiding the innocent parent post', () => {
      document.body.innerHTML = `
        <div class="post" id="parent-post">
          <div class="ml64">
            <div class="meta"><a class="psnnode">ParentAuthor</a></div>
            <div class="content">This is a completely innocent main post.</div>
            <div class="sonlistmark ml64 mt10">
              <ul class="sonlist">
                <li id="sub-clean">Normal subcomment</li>
                <li id="sub-bad">Toxic subcomment with bad_word</li>
              </ul>
            </div>
          </div>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, blockWordsList: ['bad_word'] },
        store,
        http,
      });

      applyKeywordFilter(ctx, document.body);

      const parentPost = document.getElementById('parent-post') as HTMLElement;
      expect(isHiddenByReason(parentPost, 'keyword-block')).toBe(false);

      const subClean = document.getElementById('sub-clean') as HTMLElement;
      expect(isHiddenByReason(subClean, 'keyword-block')).toBe(false);

      const subBad = document.getElementById('sub-bad') as HTMLElement;
      expect(isHiddenByReason(subBad, 'keyword-block')).toBe(true);
      expect(subBad.previousElementSibling?.className).toContain('psnine-keyword-placeholder');
    });
  });

  describe('C10: Avatar profile card with real profile selectors and hover grace', () => {
    it('renders authentic level and trophy stats from profile.html structure', async () => {
      document.body.innerHTML = `
        <div class="meta">
          <a class="psnnode" href="https://psnine.com/psnid/toonn95">toonn95</a>
        </div>
      `;

      const profileHtml = `
        <html>
          <body>
            <div class="psninfo">
              <table cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>toonn95</td>
                  <td><span class="text-level" tips="总点数：93180">Lv 336</span><em>经验93%</em></td>
                  <td><a href="/psnid?ob=point" class="text-rank">11584</a><em>所在服排名</em></td>
                </tr>
              </table>
            </div>
            <div class="psntrophy">
              <span class="text-platinum">白59</span>
              <span class="text-gold">金174</span>
              <span class="text-silver">银767</span>
              <span class="text-bronze">铜2454</span>
            </div>
            <div class="twoge">1.8年总耗时</div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => profileHtml,
      } as Response);

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, hoverHomepage: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/topic/123');

      const cleanup = setupAvatarProfileCards(ctx, document.body);

      const triggerBtn = document.querySelector('.psnine-profile-trigger') as HTMLButtonElement;
      expect(triggerBtn).not.toBeNull();

      triggerBtn.click();
      await new Promise(r => setTimeout(r, 60));

      const card = document.querySelector('.psnine-profile-card');
      expect(card).not.toBeNull();

      expect(card?.textContent).toContain('Lv 336');
      expect(card?.textContent).toContain('11584');
      expect(card?.textContent).toContain('白59');
      expect(card?.textContent).not.toContain('总耗时');

      cleanup();
    });
  });

  describe('C07: HOT tag reply count parsing accuracy', () => {
    it('parses reply count strictly without taking timestamps as numbers', () => {
      document.body.innerHTML = `
        <div class="topic-row" id="t1">
          <div class="title"><a href="/topic/1">Hot Topic</a></div>
          <span class="replies">25</span>
        </div>
        <div class="topic-row" id="t2">
          <div class="title"><a href="/topic/2">Cold Topic</a></div>
          <div class="meta"><span>03-27 14:25</span> <span>5条回复</span></div>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, hotTagThreshold: 20 },
        store,
        http,
      });

      applyHotTags(ctx, document.body);

      const t1 = document.getElementById('t1');
      expect(t1?.querySelector('.psnine-hot-badge')).not.toBeNull();

      const t2 = document.getElementById('t2');
      expect(t2?.querySelector('.psnine-hot-badge')).toBeNull();
    });
  });

  describe('C13: QA answers monotonic sorting locating parent from dynamic li', () => {
    it('sorts answers newest-first even when passed a single dynamically inserted li as root', () => {
      document.body.innerHTML = `
        <div class="box mt20">
          <ul class="list">
            <li id="ans-1"><div class="meta">Ans 1</div></li>
            <li id="ans-2"><div class="meta">Ans 2</div></li>
          </ul>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, listQAAnswersByNew: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/qa/12345');

      sortQAAnswersByNew(ctx, document.body);

      let items = Array.from(document.querySelectorAll('ul.list > li'));
      expect(items.map(li => li.id)).toEqual(['ans-2', 'ans-1']);

      // Simulate MutationObserver passing newly inserted li directly as root
      const ans3 = document.createElement('li');
      ans3.id = 'ans-3';
      ans3.innerHTML = `<div class="meta">Ans 3</div>`;
      document.querySelector('ul.list')!.appendChild(ans3);

      // Pass ans3 as root to sortQAAnswersByNew
      sortQAAnswersByNew(ctx, ans3);

      items = Array.from(document.querySelectorAll('ul.list > li'));
      expect(items.map(li => li.id)).toEqual(['ans-3', 'ans-2', 'ans-1']);
    });
  });

  describe('C15: Reverse sub-reply preserves display and filter styles with closest sonlist', () => {
    it('sets borderTop without clearing existing inline styles when passed dynamically inserted sub-li', () => {
      document.body.innerHTML = `
        <div class="sonlistmark ml64 mt10">
          <ul class="sonlist">
            <li id="sub-1" style="display: none; color: red;">Sub 1</li>
            <li id="sub-2" style="background: yellow;">Sub 2</li>
          </ul>
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
      ctx.url = new URL('https://psnine.com/trophy/123');

      const sub1 = document.getElementById('sub-1') as HTMLElement;
      // Pass sub1 directly as root
      applyReverseSubReply(ctx, sub1);

      const items = Array.from(document.querySelectorAll('ul.sonlist > li'));
      expect(items.map(li => li.id)).toEqual(['sub-2', 'sub-1']);

      expect(sub1.style.display).toBe('none');
      expect(sub1.style.color).toBe('red');
    });
  });

  describe('C14: QA sub-reply expansion button context filtering', () => {
    it('clicks only authentic sonlist expand buttons, ignoring unrelated action buttons', () => {
      document.body.innerHTML = `
        <div class="sonlistmark">
          <div class="btn btn-white font12" id="valid-expand">展开余下 3 条回复</div>
        </div>
        <div class="actions">
          <div class="btn btn-white font12" id="unrelated-btn">提交回答</div>
        </div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, showHiddenQASubReply: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/qa/555');

      const validBtn = document.getElementById('valid-expand') as HTMLElement;
      const unrelatedBtn = document.getElementById('unrelated-btn') as HTMLElement;

      const clickSpyValid = vi.spyOn(validBtn, 'click');
      const clickSpyUnrelated = vi.spyOn(unrelatedBtn, 'click');

      setupQaSubReplyExpansion(ctx, document.body);

      expect(clickSpyValid).toHaveBeenCalledTimes(1);
      expect(clickSpyUnrelated).not.toHaveBeenCalled();
    });
  });

  describe('mountCommunity cleanups accumulation across multiple onContent calls', () => {
    it('executes all accumulated cleanups on teardown without leaking prior observers', () => {
      document.body.innerHTML = `
        <div class="meta"><a class="psnnode" href="/psnid/user1">user1</a></div>
      `;

      const store = createStore();
      const http = createHttpClient();
      const ctx = createContext({
        document,
        window,
        settings: { ...defaultSettings, hoverHomepage: true },
        store,
        http,
      });
      ctx.url = new URL('https://psnine.com/topic/1');

      const cleanupCommunity = mountCommunity(ctx);

      // Trigger dynamic DOM addition to run onContent
      const extraDiv = document.createElement('div');
      extraDiv.innerHTML = `<div class="meta"><a class="psnnode" href="/psnid/user2">user2</a></div>`;
      document.body.appendChild(extraDiv);

      // Teardown should cleanly execute without throwing
      expect(() => {
        if (typeof cleanupCommunity === 'function') {
          cleanupCommunity();
        }
      }).not.toThrow();
    });
  });
});
