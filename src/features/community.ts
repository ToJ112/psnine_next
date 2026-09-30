import { enhanceMasks } from './global';
import { Context, Mount, Cleanup } from '../core/types';
import { setHidden, isHiddenByReason } from '../core/dom';
import { ICONS } from '../styles';

/**
 * Utility to find elements in root including root itself if it matches selector.
 */
export function queryAllIncludingSelf<T extends Element = Element>(root: ParentNode, selector: string): T[] {
  const list: T[] = [];
  if (root instanceof Element && root.matches(selector)) {
    list.push(root as unknown as T);
  }
  list.push(...Array.from(root.querySelectorAll<T>(selector)));
  return list;
}

/**
 * Extracts thread author PSNID from topic/gene/trade page.
 * Strictly checks author in the thread header (.pd10 with h1, or .header .meta);
 * NEVER infers from title text, and never treats repliers in .post:first-child as OP!
 */
export function getPageAuthor(doc: Document, url: URL): string | null {
  const isTopic = url.pathname.startsWith('/topic/');
  const isGene = url.pathname.startsWith('/gene/');
  const isTrade = url.pathname.startsWith('/trade/');
  if (!isTopic && !isGene && !isTrade) return null;

  // 1. Authentic topic.html header structure: .pd10 containing h1, author in .meta a[itemprop="author"] or .meta a[href*="/psnid/"]
  const pd10Header = doc.querySelector('.pd10');
  if (pd10Header && pd10Header.querySelector('h1')) {
    const authorLink = pd10Header.querySelector('.meta a[itemprop="author"], .meta a[href*="/psnid/"], .meta a.psnnode');
    if (authorLink && authorLink.textContent) {
      return authorLink.textContent.trim().toLowerCase();
    }
  }

  // 2. Header meta outside .pd10 (e.g. gene or trade header)
  const headerAuthor = doc.querySelector('.header .meta a[itemprop="author"], .header .meta a[href*="/psnid/"], .header .meta a.psnnode');
  if (headerAuthor && headerAuthor.textContent) {
    return headerAuthor.textContent.trim().toLowerCase();
  }

  // 3. Fallback: only if a .post element explicitly has itemprop="author"
  const postAuthor = doc.querySelector('.post .meta a[itemprop="author"]');
  if (postAuthor && postAuthor.textContent) {
    return postAuthor.textContent.trim().toLowerCase();
  }

  return null;
}

/**
 * Highlights topic author (C01) and specific admin/vip IDs (C02).
 */
export function applyUserHighlights(ctx: Context, root: ParentNode): void {
  const { document: doc, settings, url } = ctx;
  const authorId = getPageAuthor(doc, url);
  const specificIds = new Set((settings.highlightSpecificID || []).map(id => id.toLowerCase().trim()));

  const userLinks = queryAllIncludingSelf<HTMLAnchorElement>(root, 'a.psnnode, .meta a[href*="/psnid/"]');
  userLinks.forEach(link => {
    // Avoid re-enhancing or enhancing inside our own UI chrome
    if (link.closest('[data-psnine-next="chrome"]')) return;

    const rawId = (link.textContent || '').trim().replace(/^@/, '');
    const lowerId = rawId.toLowerCase();
    if (!lowerId) return;

    // 1. Author badge (C01): only in topic/gene/trade
    if (authorId && lowerId === authorId && !link.parentElement?.querySelector('.psnine-author-badge')) {
      const badge = doc.createElement('span');
      badge.className = 'psnine-author-badge';
      badge.setAttribute('data-psnine-next', 'chrome');
      badge.textContent = '楼主';
      badge.style.setProperty('background-color', settings.highlightBack || '#3890ff', 'important');
      badge.style.setProperty('color', settings.highlightFront || '#ffffff', 'important');
      badge.style.setProperty('padding', '1px 4px', 'important');
      badge.style.setProperty('margin-left', '4px', 'important');
      badge.style.setProperty('border-radius', '3px', 'important');
      badge.style.setProperty('font-size', '11px', 'important');
      link.after(badge);
    }

    // 2. Specific user highlight (C02)
    if (specificIds.has(lowerId)) {
      link.style.setProperty('background-color', settings.highlightSpecificBack || '#d9534f', 'important');
      link.style.setProperty('color', settings.highlightSpecificFront || '#ffffff', 'important');
      link.style.setProperty('padding', '1px 5px', 'important');
      link.style.setProperty('border-radius', '4px', 'important');
    }
  });
}

/**
 * Injects sequential floor numbering for main floors (#1, #2...)
 * AND subfloors (#1-1, #1-2...) with stable monotonic sequence across dynamic additions (C03).
 */
export function applyFloorNumbers(doc: Document, root: ParentNode): void {
  // Find all main comments in document to establish continuous main floor sequence
  const allMainPosts = Array.from(doc.querySelectorAll('.post, ul.list > li:not(.sonlist li)'));

  let maxMainFloor = 0;
  allMainPosts.forEach(post => {
    const badge = post.querySelector(':scope > .ml64 > .meta .psnine-floor-badge, :scope > .meta .psnine-floor-badge, :scope > div > .meta .psnine-floor-badge');
    if (badge && badge.textContent) {
      const num = parseInt(badge.textContent.replace('#', ''), 10);
      if (!isNaN(num) && num > maxMainFloor) {
        maxMainFloor = num;
      }
    }
  });

  // Assign floor numbers to unbadged main posts
  allMainPosts.forEach(post => {
    const meta = post.querySelector(':scope > .ml64 > .meta, :scope > .meta, :scope > div > .meta');
    if (meta && !meta.querySelector('.psnine-floor-badge')) {
      maxMainFloor++;
      post.setAttribute('data-psnine-floor', String(maxMainFloor));

      const badge = doc.createElement('span');
      badge.className = 'psnine-floor-badge';
      badge.setAttribute('data-psnine-next', 'chrome');
      badge.textContent = `#${maxMainFloor}`;
      badge.style.cssText = 'color:#95a5a6; font-size:12px; margin-right:6px; font-weight:600;';
      meta.prepend(badge);
    }

    // Number subcomments inside this main floor (#N-1, #N-2...)
    const mainFloorNum = post.getAttribute('data-psnine-floor') ||
      post.querySelector('.psnine-floor-badge')?.textContent?.replace('#', '') || '1';

    const subLis = Array.from(post.querySelectorAll('ul.sonlist > li'));
    subLis.forEach((subLi, subIdx) => {
      const subMeta = subLi.querySelector('.meta');
      if (subMeta && !subMeta.querySelector('.psnine-subfloor-badge')) {
        const subfloorNum = `${mainFloorNum}-${subIdx + 1}`;
        subLi.setAttribute('data-psnine-subfloor', subfloorNum);

        const subBadge = doc.createElement('span');
        subBadge.className = 'psnine-subfloor-badge';
        subBadge.setAttribute('data-psnine-next', 'chrome');
        subBadge.textContent = `#${subfloorNum}`;
        subBadge.style.cssText = 'color:#bdc3c7; font-size:11px; margin-right:4px;';
        subMeta.prepend(subBadge);
      }
    });
  });
}

/**
 * Reply traceback for @mentions in comments (C04 & C05).
 * Built with SAFE DOM APIs (zero innerHTML), preserves interactive spoiler masks
 * by stripping cloned ephemeral markers and does not consume clicks on inner interactive elements.
 */
export function applyReplyTraceback(ctx: Context, root: ParentNode): void {
  if (!ctx.settings.replyTraceback) return;
  const { document: doc } = ctx;

  const allPosts = Array.from(doc.querySelectorAll('.post, ul.list > li:not(.sonlist li)'));

  allPosts.forEach((post, postIdx) => {
    const content = post.querySelector('.content');
    if (!content) return;

    const mentionLinks = queryAllIncludingSelf<HTMLAnchorElement>(content, 'a[href*="/psnid/"]:not([data-psnine-trace-bound])');
    mentionLinks.forEach(link => {
      link.setAttribute('data-psnine-trace-bound', 'true');
      const text = (link.textContent || '').trim();
      if (!text.startsWith('@')) return;

      const targetUser = text.replace(/^@/, '').toLowerCase();
      if (!targetUser) return;

      let matchedPost: Element | null = null;
      for (let i = postIdx - 1; i >= 0; i--) {
        const prevPost = allPosts[i];
        const prevAuthor = prevPost.querySelector('.meta a.psnnode, .meta a[href*="/psnid/"]')?.textContent?.trim().toLowerCase();
        if (prevAuthor === targetUser) {
          matchedPost = prevPost;
          break;
        }
      }

      if (matchedPost) {
        const prevContentEl = matchedPost.querySelector('.content');
        const prevFloor = matchedPost.querySelector('.psnine-floor-badge')?.textContent || '';
        const avatarImgEl = matchedPost.querySelector('img[src*="avatar"], .post a.l img, a.l img') as HTMLImageElement | null;

        // Build safe DOM card
        const card = doc.createElement('div');
        card.className = 'psnine-traceback-card';
        card.setAttribute('data-psnine-next', 'chrome');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('title', '点击平滑跳转到对应楼层');

        // Header
        const header = doc.createElement('div');
        header.className = 'psnine-traceback-header';

        if (avatarImgEl && avatarImgEl.src) {
          const avatar = doc.createElement('img');
          avatar.src = avatarImgEl.src;
          avatar.width = 16;
          avatar.height = 16;
          avatar.style.borderRadius = '50%';
          avatar.style.marginRight = '4px';
          header.appendChild(avatar);
        }

        const titleText = doc.createElement('span');
        titleText.textContent = `${text} ${prevFloor}`;
        header.appendChild(titleText);
        card.appendChild(header);

        // Content clone (preserves .mark spoilers and safe structure without raw innerHTML)
        const contentBody = doc.createElement('div');
        contentBody.className = 'psnine-traceback-content';

        if (prevContentEl) {
          const clonedContent = prevContentEl.cloneNode(true) as HTMLElement;
          clonedContent.querySelectorAll('.psnine-traceback-card').forEach(c => c.remove());

          // Strip ephemeral binding markers so enhanceMasks binds fresh, interactive handlers
          clonedContent.querySelectorAll('[data-psnine-mask-ready]').forEach(m => {
            m.removeAttribute('data-psnine-mask-ready');
            m.classList.remove('unmasked', 'pinned');
          });

          contentBody.appendChild(clonedContent);
          // Explicitly enhance cloned spoiler marks inside traceback
          enhanceMasks(ctx, contentBody);
        }
        card.appendChild(contentBody);

        const jumpToTarget = (e: Event) => {
          // Do NOT jump if user clicked an interactive child element (e.g. inner link or spoiler bar)
          const target = e.target as HTMLElement | null;
          if (target && target.closest('a, button, input, .mark, .psnine-mask-ready')) {
            return;
          }
          e.stopPropagation();
          matchedPost?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (matchedPost instanceof HTMLElement) {
            matchedPost.style.outline = '2px solid #3498db';
            setTimeout(() => { matchedPost.style.outline = ''; }, 1500);
          }
        };

        card.addEventListener('click', jumpToTarget);
        card.addEventListener('keydown', (e) => {
          const kb = e as KeyboardEvent;
          if (kb.key === 'Enter' || kb.key === ' ') {
            const target = e.target as HTMLElement | null;
            if (target && target.closest('a, button, input, .mark')) return;
            kb.preventDefault();
            jumpToTarget(e);
          }
        });

        link.after(card);
      }
    });
  });
}

/**
 * Controls reply action buttons visibility (C06).
 * Handles authentic selectors (.meta > span.r > a, .post a.r) without breaking touch/keyboard access.
 */
export function applyReplyControlsVisibility(ctx: Context, root: ParentNode): void {
  const { settings, window: win } = ctx;
  const isTouchDevice = typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;

  // Authentic selectors: span.r > a in meta, or a.r
  const replyLinks = queryAllIncludingSelf<HTMLElement>(root, '.post .meta > span.r > a, ul.list > li .meta > span.r > a, .post a.r, ul.list > li a.r');

  replyLinks.forEach(link => {
    // If touchscreen device, keep always accessible
    if (isTouchDevice) {
      link.style.opacity = '1';
      return;
    }

    if (!settings.showReplyControls) {
      if (link.getAttribute('data-psnine-reply-control-ready')) return;
      link.setAttribute('data-psnine-reply-control-ready', 'true');

      link.style.transition = 'opacity 0.2s';
      link.style.opacity = '0';

      const parent = link.closest('.post, li');
      if (parent) {
        parent.addEventListener('mouseenter', () => { link.style.opacity = '1'; });
        parent.addEventListener('mouseleave', () => { link.style.opacity = '0'; });
        // Keyboard focus accessibility
        parent.addEventListener('focusin', () => { link.style.opacity = '1'; });
        parent.addEventListener('focusout', () => { link.style.opacity = '0'; });
      }
    } else {
      link.style.opacity = '1';
    }
  });
}

/**
 * Hides comments or topics by users on the blocklist (C08).
 * Scans ONLY authentic author links of the post itself; NEVER hides posts due to @mentions inside content!
 */
export function applyBlocklist(ctx: Context, root: ParentNode): void {
  const { settings } = ctx;
  const blockedUsers = new Set((settings.blockList || []).map(u => u.toLowerCase().trim()).filter(Boolean));
  if (blockedUsers.size === 0) return;

  // 1. Top-level posts and items
  const candidateContainers = queryAllIncludingSelf<HTMLElement>(root, '.post, ul.list > li:not(.sonlist li), .touchclick, table.list tr, .topic-row');
  candidateContainers.forEach(container => {
    // Only check the owner/author element in the meta header, NOT inside content
    const authorEl = container.querySelector('.meta > a.psnnode, .meta a.psnnode:first-child, .meta a[href*="/psnid/"]:first-child, .author a, td:first-child a.psnnode');
    if (!authorEl) return;

    const author = (authorEl.textContent || '').trim().replace(/^@/, '').toLowerCase();
    const hrefAuthor = (authorEl.getAttribute('href')?.match(/\/psnid\/([a-zA-Z0-9_-]+)/)?.[1] || '').toLowerCase();

    if (blockedUsers.has(author) || blockedUsers.has(hrefAuthor)) {
      setHidden(container, 'blocklist', true);
    }
  });

  // 2. Subcomments (sonlist li)
  const subcomments = queryAllIncludingSelf<HTMLElement>(root, 'ul.sonlist > li');
  subcomments.forEach(subLi => {
    const authorEl = subLi.querySelector('.meta > a.psnnode, a.psnnode:first-child, a[href*="/psnid/"]:first-child');
    if (!authorEl) return;

    const author = (authorEl.textContent || '').trim().replace(/^@/, '').toLowerCase();
    const hrefAuthor = (authorEl.getAttribute('href')?.match(/\/psnid\/([a-zA-Z0-9_-]+)/)?.[1] || '').toLowerCase();

    if (blockedUsers.has(author) || blockedUsers.has(hrefAuthor)) {
      setHidden(subLi, 'blocklist', true);
    }
  });

  // 3. Hide entire sonlist container if all children are blocked
  const sonlists = queryAllIncludingSelf<HTMLElement>(root, 'ul.sonlist');
  sonlists.forEach(sonlist => {
    const children = Array.from(sonlist.querySelectorAll(':scope > li'));
    const allHidden = children.length > 0 && children.every(li => isHiddenByReason(li as HTMLElement, 'blocklist'));
    if (allHidden) {
      const markWrapper = sonlist.closest('.sonlistmark') as HTMLElement | null;
      if (markWrapper) {
        setHidden(markWrapper, 'blocklist', true);
      } else {
        setHidden(sonlist, 'blocklist', true);
      }
    }
  });
}

/**
 * Filters posts/comments containing blocked keywords with valid HTML table/list placeholders (C09).
 * Ensures child comments with keywords only hide the child comment, NOT the entire parent post!
 * Ignores injected plugin chrome.
 */
export function applyKeywordFilter(ctx: Context, root: ParentNode): void {
  const { settings, document: doc } = ctx;
  const keywords = (settings.blockWordsList || []).map(k => k.trim()).filter(Boolean);
  if (keywords.length === 0) return;

  let regexes: RegExp[] = [];
  if (settings.blockWordsRegex) {
    for (const k of keywords) {
      try {
        regexes.push(new RegExp(k, 'i'));
      } catch {
        regexes.push(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      }
    }
  }

  // Check subcomments FIRST so their content is handled independently
  const subcomments = queryAllIncludingSelf<HTMLElement>(root, 'ul.sonlist > li');
  subcomments.forEach(subLi => {
    if (subLi.hasAttribute('data-psnine-keyword-checked')) return;
    subLi.setAttribute('data-psnine-keyword-checked', 'true');

    const text = extractOwnText(subLi);
    const matched = testKeyword(text, keywords, regexes, settings.blockWordsRegex);
    if (matched) {
      setHidden(subLi, 'keyword-block', true);
      const placeholder = createPlaceholder('li', matched, doc, subLi);
      subLi.before(placeholder);
    }
  });

  // Check top-level items (excluding nested sonlist content and chrome)
  const items = queryAllIncludingSelf<HTMLElement>(root, '.post, ul.list > li:not(.sonlist li), .topic-row, table.list tr');
  items.forEach(item => {
    if (item.hasAttribute('data-psnine-keyword-checked')) return;
    item.setAttribute('data-psnine-keyword-checked', 'true');

    // Extract text belonging ONLY to this post (excluding child sonlist comments and plugin chrome)
    const text = extractOwnText(item, true);
    const matched = testKeyword(text, keywords, regexes, settings.blockWordsRegex);

    if (matched) {
      setHidden(item, 'keyword-block', true);
      const tag = item.tagName.toLowerCase();
      const placeholder = createPlaceholder(tag === 'tr' ? 'tr' : (tag === 'li' ? 'li' : 'div'), matched, doc, item);
      item.before(placeholder);
    }
  });
}

function testKeyword(text: string, keywords: string[], regexes: RegExp[], isRegex: boolean): string | null {
  if (isRegex) {
    for (const r of regexes) {
      if (r.test(text)) return r.source;
    }
  } else {
    const lower = text.toLowerCase();
    for (const k of keywords) {
      if (lower.includes(k.toLowerCase())) return k;
    }
  }
  return null;
}

function extractOwnText(el: HTMLElement, excludeSonlist = false): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-psnine-next]').forEach(c => c.remove());
  if (excludeSonlist) {
    clone.querySelectorAll('ul.sonlist, .sonlistmark').forEach(s => s.remove());
  }
  return clone.textContent || '';
}

function createPlaceholder(type: 'tr' | 'li' | 'div', keyword: string, doc: Document, originalEl: HTMLElement): HTMLElement {
  if (type === 'tr') {
    const tr = doc.createElement('tr');
    tr.className = 'psnine-keyword-placeholder-row';
    tr.setAttribute('data-psnine-next', 'chrome');
    const td = doc.createElement('td');
    td.setAttribute('colspan', '100%');
    td.style.cssText = 'padding:6px 12px; background:rgba(0,0,0,0.03); color:#7f8c8d; font-size:12px;';
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'background:none; border:none; color:inherit; font:inherit; cursor:pointer; text-decoration:underline;';
    btn.textContent = `[已屏蔽] 该行包含关键词 "${keyword}" (点击查看)`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setHidden(originalEl, 'keyword-block', false);
      tr.remove();
    });
    td.appendChild(btn);
    tr.appendChild(td);
    return tr;
  }

  const el = doc.createElement(type);
  el.className = 'psnine-keyword-placeholder';
  el.setAttribute('data-psnine-next', 'chrome');
  el.style.cssText = 'padding:8px 12px; margin:4px 0; background:rgba(0,0,0,0.04); font-size:12px; color:#7f8c8d; border-radius:4px;';
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.style.cssText = 'background:none; border:none; color:inherit; font:inherit; cursor:pointer; text-decoration:underline;';
  btn.textContent = `[已屏蔽] 该内容包含关键词 "${keyword}" (点击查看)`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setHidden(originalEl, 'keyword-block', false);
    el.remove();
  });
  el.appendChild(btn);
  return el;
}

/**
 * Interactive Profile Card on Avatar Hover / Tap (C10).
 * Safe DOM rendering (zero innerHTML), authentic profile header selectors
 * (.psninfo .text-level, .psntrophy, .psninfo .text-rank), grace hover delay to allow entering card,
 * explicit tap button for mobile, keyboard lifecycle, and viewport clamping.
 */
export function setupAvatarProfileCards(ctx: Context, root: ParentNode): () => void {
  if (!ctx.settings.hoverHomepage) return () => {};
  const { document: doc, http, url: currentUrl } = ctx;

  let activeCard: HTMLElement | null = null;
  let activeAbortCtrl: AbortController | null = null;
  let hideTimer: number | null = null;
  let showTimer: number | null = null;

  const closeActiveCard = () => {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (activeAbortCtrl) {
      activeAbortCtrl.abort();
      activeAbortCtrl = null;
    }
    if (activeCard) {
      activeCard.remove();
      activeCard = null;
    }
  };

  const scheduleHide = () => {
    if (showTimer) clearTimeout(showTimer);
    hideTimer = window.setTimeout(closeActiveCard, 350);
  };

  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const showProfileCard = async (username: string, anchorEl: HTMLElement) => {
    cancelHide();
    if (activeCard) {
      closeActiveCard();
    }

    activeAbortCtrl = new AbortController();
    const abortSignal = activeAbortCtrl.signal;

    const card = doc.createElement('div');
    card.className = 'psnine-profile-card';
    card.setAttribute('data-psnine-next', 'chrome');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', `${username} 的个人资料`);
    card.style.cssText = 'position:fixed; z-index:10000; background:#fff; color:#333; padding:12px; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,0.25); min-width:240px; max-width:320px; font-size:12px; border:1px solid #ddd;';

    // Keep card open when cursor moves into it
    card.addEventListener('mouseenter', cancelHide);
    card.addEventListener('mouseleave', scheduleHide);

    const loadingText = doc.createElement('div');
    loadingText.textContent = `正在载入 ${username} 的资料...`;
    card.appendChild(loadingText);

    doc.body.appendChild(card);
    activeCard = card;

    // Viewport position calculation with clamp
    const rect = anchorEl.getBoundingClientRect();
    const cardHeight = 160;
    const cardWidth = 280;
    const top = Math.min(window.innerHeight - cardHeight - 10, Math.max(10, rect.bottom + 6));
    const left = Math.min(window.innerWidth - cardWidth - 10, Math.max(10, rect.left));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;

    try {
      const profileUrl = new URL(`/psnid/${username}`, currentUrl.origin).href;
      const userDoc = await http.document(profileUrl, { ttl: 60000, signal: abortSignal });

      if (abortSignal.aborted || card !== activeCard) return;
      card.innerHTML = ''; // safe reset

      // Header with username and close button
      const userHeader = doc.createElement('div');
      userHeader.style.cssText = 'font-weight:bold; font-size:15px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;';

      const nameSpan = doc.createElement('span');
      nameSpan.textContent = username;
      userHeader.appendChild(nameSpan);

      const closeBtn = doc.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', '关闭资料卡片');
      closeBtn.style.cssText = 'background:none; border:none; cursor:pointer; color:#95a5a6; font-size:16px; padding:0 4px;';
      closeBtn.innerHTML = ICONS.close;
      closeBtn.addEventListener('click', closeActiveCard);
      userHeader.appendChild(closeBtn);
      card.appendChild(userHeader);

      // Authentic level selector from profile.html: .psninfo .text-level (e.g. Lv 336)
      const levelEl = userDoc.querySelector('.psninfo .text-level');
      const levelText = levelEl ? levelEl.textContent?.trim() : null;

      // Authentic rank selector: .psninfo .text-rank
      const rankEl = userDoc.querySelector('.psninfo .text-rank');
      const rankText = rankEl ? rankEl.textContent?.trim() : null;

      if (levelText || rankText) {
        const statsRow = doc.createElement('div');
        statsRow.style.cssText = 'display:flex; gap:10px; align-items:center; margin-bottom:6px;';

        if (levelText) {
          const lvlSpan = doc.createElement('span');
          lvlSpan.style.cssText = 'color:#f39c12; font-weight:bold; font-size:13px;';
          lvlSpan.textContent = levelText;
          statsRow.appendChild(lvlSpan);
        }

        if (rankText) {
          const rankSpan = doc.createElement('span');
          rankSpan.style.cssText = 'color:#7f8c8d; font-size:11px;';
          rankSpan.textContent = `排名 #${rankText}`;
          statsRow.appendChild(rankSpan);
        }
        card.appendChild(statsRow);
      }

      // Authentic trophies summary selector: .psntrophy
      const psntrophyEl = userDoc.querySelector('.psntrophy');
      if (psntrophyEl) {
        const trophyRow = doc.createElement('div');
        trophyRow.style.cssText = 'background:#f8f9fa; border-radius:4px; padding:4px 8px; margin:6px 0; font-size:11px; display:flex; gap:8px;';
        trophyRow.textContent = psntrophyEl.textContent?.trim() || '';
        card.appendChild(trophyRow);
      }

      // Link to profile
      const linkRow = doc.createElement('div');
      linkRow.style.cssText = 'margin-top:8px; text-align:right; border-top:1px solid #f0f0f0; padding-top:6px;';
      const profileLink = doc.createElement('a');
      profileLink.href = profileUrl;
      profileLink.textContent = '访问个人主页 »';
      profileLink.style.cssText = 'color:#3498db; font-size:11px; text-decoration:none; font-weight:600;';
      linkRow.appendChild(profileLink);
      card.appendChild(linkRow);

      // Re-clamp card inside viewport after dynamic content populated
      const newRect = card.getBoundingClientRect();
      if (newRect.bottom > window.innerHeight) {
        card.style.top = `${Math.max(10, window.innerHeight - newRect.height - 10)}px`;
      }
    } catch {
      if (!abortSignal.aborted && card === activeCard) {
        card.textContent = '资料加载失败';
      }
    }
  };

  const avatars = queryAllIncludingSelf<HTMLAnchorElement>(root, 'a.psnnode[href*="/psnid/"], a.l[href*="/psnid/"], .meta a[href*="/psnid/"]');
  avatars.forEach(link => {
    if (link.getAttribute('data-psnine-card-ready')) return;
    link.setAttribute('data-psnine-card-ready', 'true');

    const match = link.getAttribute('href')?.match(/\/psnid\/([a-zA-Z0-9_-]+)/);
    const username = match?.[1];
    if (!username) return;

    link.addEventListener('mouseenter', () => {
      cancelHide();
      showTimer = window.setTimeout(() => showProfileCard(username, link), 500);
    });
    link.addEventListener('mouseleave', scheduleHide);

    // Provide a small explicit tap trigger button for mobile/touch screens
    const triggerBtn = doc.createElement('button');
    triggerBtn.className = 'psnine-profile-trigger';
    triggerBtn.setAttribute('data-psnine-next', 'chrome');
    triggerBtn.type = 'button';
    triggerBtn.style.cssText = 'background:none; border:none; padding:0 2px; cursor:pointer; color:#7f8c8d; font-size:10px; vertical-align:middle;';
    triggerBtn.setAttribute('title', '查看个人卡片');
    triggerBtn.setAttribute('aria-label', `查看 ${username} 资料卡片`);
    triggerBtn.textContent = '👤';

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (activeCard) {
        closeActiveCard();
      } else {
        showProfileCard(username, triggerBtn);
      }
    });

    triggerBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeActiveCard();
      }
    });

    link.after(triggerBtn);
  });

  return () => {
    closeActiveCard();
  };
}

/**
 * Adds HOT badge to discussions exceeding reply threshold (C07).
 * Parses reply count strictly from .replies, a.rep, td.twoge em or exact regex,
 * NEVER concatenating dates or timestamps into numbers!
 */
export function applyHotTags(ctx: Context, root: ParentNode): void {
  const { settings, document: doc } = ctx;
  const threshold = settings.hotTagThreshold ?? 20;

  const topics = queryAllIncludingSelf<HTMLElement>(root, '.topic-row, .list > li, table.list tr');
  topics.forEach(topic => {
    // Only check authentic reply count containers
    const replyCountEl = topic.querySelector('.replies, a.rep, td.twoge em');
    let count = 0;

    if (replyCountEl && replyCountEl.textContent) {
      const parsed = parseInt(replyCountEl.textContent.trim(), 10);
      if (!isNaN(parsed)) count = parsed;
    } else {
      // Fallback: search for exact "X条" or "X回复" inside meta without taking timestamps
      const metaSpan = topic.querySelector('.meta, span.r');
      if (metaSpan && metaSpan.textContent) {
        const match = metaSpan.textContent.match(/(\d+)\s*(?:条|回|回复)/);
        if (match && match[1]) {
          count = parseInt(match[1], 10);
        }
      }
    }

    if (count >= threshold && !topic.querySelector('.psnine-hot-badge')) {
      const titleLink = topic.querySelector('.title a, p.title a, td.title a, h4 a');
      if (titleLink) {
        const badge = doc.createElement('span');
        badge.className = 'psnine-hot-badge';
        badge.setAttribute('data-psnine-next', 'chrome');
        badge.textContent = 'HOT';
        badge.style.cssText = 'background:#e74c3c; color:#fff; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:3px; margin-left:6px; vertical-align:middle;';
        titleLink.after(badge);
      }
    }
  });
}

/**
 * Adds status (solved / in-progress / unanswered) and bounty coins icon in Q&A lists (C11).
 * Strictly adheres to line 2223 changeQaStatus in upstream codebase.
 * Strictly scoped ONLY to /qa routes and honors settings.newQaStatus switch.
 */
export function applyQaStatusIcons(ctx: Context, root: ParentNode): void {
  if (!ctx.settings.newQaStatus || !ctx.url.pathname.startsWith('/qa')) return;
  const { document: doc } = ctx;

  const qaItems = queryAllIncludingSelf<HTMLElement>(root, 'ul.list > li, .list > li');
  qaItems.forEach(node => {
    const titleLink = node.querySelector('div.ml64 > p.title.font16 > a, .title a, p.title a');
    if (!titleLink || node.querySelector('.psnine-qa-status')) return;

    // Upstream line 2227: div.meta > .r > span:nth-child(2)
    const statusSpan = node.querySelector('div.meta > .r > span:nth-child(2), .meta span.r span:last-child');
    const statusText = statusSpan ? statusSpan.textContent?.trim() : (node.textContent || '');

    const wrapper = doc.createElement('span');
    wrapper.className = 'psnine-qa-status';
    wrapper.setAttribute('data-psnine-next', 'chrome');

    if (statusText?.includes('已解决') || node.querySelector('.fa-check-circle')) {
      wrapper.innerHTML = `${ICONS.checkCircle} <span style="font-size:11px; color:#28a745; margin-right:4px;">已解决</span>`;
      titleLink.before(wrapper);
    } else if (statusText?.includes('解决中')) {
      wrapper.innerHTML = `<span style="font-size:11px; color:#3498db; font-weight:600; margin-right:4px;">[解决中]</span>`;
      titleLink.before(wrapper);
    } else if (statusText?.includes('未回答')) {
      wrapper.innerHTML = `<span style="font-size:11px; color:#95a5a6; margin-right:4px;">[未回答]</span>`;
      titleLink.before(wrapper);
    }

    // Upstream line 2237: div.meta > .r > span:nth-child(1) matching /悬赏(\d+)铜/
    const rewardSpan = node.querySelector('div.meta > .r > span:nth-child(1), .meta span.r');
    if (rewardSpan && rewardSpan.textContent) {
      const match = rewardSpan.textContent.match(/悬赏(\d+)铜/);
      if (match && match[1] && !node.querySelector('.psnine-qa-bounty')) {
        const count = parseInt(match[1], 10);
        let color = '#7f8c8d';
        if (count > 30) color = '#f39c12'; // gold
        else if (count === 10) color = '#d35400'; // bronze

        const bounty = doc.createElement('span');
        bounty.className = 'psnine-qa-bounty';
        bounty.setAttribute('data-psnine-next', 'chrome');
        bounty.style.cssText = 'margin-left:6px; vertical-align:middle;';
        bounty.innerHTML = `${ICONS.coins} <span style="font-size:11px; color:${color}; font-weight:bold;">${count}</span>`;
        titleLink.after(bounty);
      }
    }
  });
}

/**
 * Reorders QA answers by newest first with stable monotonic sequence (C13).
 * Accurately finds parent ul.list even when root is a single dynamically inserted li.
 * Only appends if children order actually changed, avoiding mutation oscillation.
 */
export function sortQAAnswersByNew(ctx: Context, root: ParentNode): void {
  if (!ctx.settings.listQAAnswersByNew || !ctx.url.pathname.startsWith('/qa/')) return;

  let answersContainer: Element | null = null;
  if (root instanceof Element) {
    if (root.matches('ul.list:not(.sonlist)')) {
      answersContainer = root;
    } else {
      answersContainer = root.closest('ul.list:not(.sonlist)') || root.querySelector('ul.list:not(.sonlist)');
    }
  }
  if (!answersContainer) {
    answersContainer = ctx.document.querySelector('div.box.mt20 > ul.list:not(.sonlist), ul.list:not(.sonlist)');
  }
  if (!answersContainer) return;

  const answers = Array.from(answersContainer.querySelectorAll<HTMLElement>(':scope > li'));
  if (answers.length <= 1) return;

  // Assign monotonic original order index to each answer
  let maxOrder = 0;
  answers.forEach(a => {
    const existing = a.getAttribute('data-psnine-qa-orig-order');
    if (existing) {
      maxOrder = Math.max(maxOrder, parseInt(existing, 10));
    }
  });

  answers.forEach(a => {
    if (!a.hasAttribute('data-psnine-qa-orig-order')) {
      maxOrder++;
      a.setAttribute('data-psnine-qa-orig-order', String(maxOrder));
    }
  });

  // Sort descending by original order so newest answers appear at top
  const sorted = [...answers].sort((a, b) => {
    const orderA = parseInt(a.getAttribute('data-psnine-qa-orig-order') || '0', 10);
    const orderB = parseInt(b.getAttribute('data-psnine-qa-orig-order') || '0', 10);
    return orderB - orderA;
  });

  // Only perform DOM manipulation if order actually changed
  const needsReorder = answers.some((el, idx) => el !== sorted[idx]);
  if (needsReorder) {
    sorted.forEach(a => answersContainer!.appendChild(a));
  }
}

/**
 * Reverse floor sub-comments order (C15, upstream lines 1897-1920).
 * Fixedly active on /trophy/:id, /psngame/:id/comment, and /psnid/:id/comment.
 * Preserves existing inline styles (e.g. display:none or filters) and only updates border-top.
 * Handles single inserted sub-li by locating closest sonlist block.
 */
export function applyReverseSubReply(ctx: Context, root: ParentNode): void {
  const isTargetRoute = /(\/trophy\/\d+)|(\/psngame\/\d+\/comment)|(\/psnid\/.+?\/comment)/.test(ctx.url.pathname);
  if (!isTargetRoute) return;

  const blocks: Element[] = [];
  if (root instanceof Element) {
    if (root.matches('div.sonlistmark')) {
      blocks.push(root);
    } else {
      const closest = root.closest('div.sonlistmark');
      if (closest) blocks.push(closest);
    }
  }
  blocks.push(...Array.from(root.querySelectorAll('div.sonlistmark')));

  blocks.forEach(block => {
    const sonlist = block.querySelector('.sonlist');
    if (!sonlist) return;

    const items = Array.from(sonlist.querySelectorAll<HTMLElement>(':scope > li'));
    if (items.length <= 1) return;

    let maxSubOrder = 0;
    items.forEach(li => {
      const ord = li.getAttribute('data-psnine-sub-order');
      if (ord) maxSubOrder = Math.max(maxSubOrder, parseInt(ord, 10));
    });

    items.forEach(li => {
      if (!li.hasAttribute('data-psnine-sub-order')) {
        maxSubOrder++;
        li.setAttribute('data-psnine-sub-order', String(maxSubOrder));
      }
    });

    const sorted = [...items].sort((a, b) => {
      const ordA = parseInt(a.getAttribute('data-psnine-sub-order') || '0', 10);
      const ordB = parseInt(b.getAttribute('data-psnine-sub-order') || '0', 10);
      return ordB - ordA;
    });

    const needsReorder = items.some((el, idx) => el !== sorted[idx]);
    if (needsReorder) {
      sorted.forEach((li, i) => {
        li.style.borderTop = i === 0 ? 'none' : '';
        sonlist.appendChild(li);
      });
    }
  });
}

/**
 * Expand QA sub-replies (C14, upstream line 1943).
 * Restricts to exact native sonlist expand control (matching 查看/展开/回复 context),
 * avoiding arbitrary clicks on unrelated buttons.
 */
export function setupQaSubReplyExpansion(ctx: Context, root: ParentNode): void {
  if (!ctx.settings.showHiddenQASubReply || !ctx.url.pathname.startsWith('/qa/')) return;

  const buttons = queryAllIncludingSelf<HTMLElement>(root, 'div.btn.btn-white.font12, .sonlistmark div.btn');
  buttons.forEach(btn => {
    if (btn.hasAttribute('data-psnine-clicked')) return;
    const text = (btn.textContent || '').trim();
    if (/(查看|展开|余下|条回复)/.test(text)) {
      btn.setAttribute('data-psnine-clicked', 'true');
      btn.click();
    }
  });
}

/**
 * Viewport auto-expansion for collapsed subcomments (C16, upstream lines 3945-3975).
 * Strictly scoped to trophy and game comment pages, targeting span.r > a:last-of-type matching /^评论\(\d+\)/.
 * Collects and returns cleanup to disconnect all IntersectionObservers.
 */
export function setupViewportSubcommentsExpansion(ctx: Context, root: ParentNode): () => void {
  if (!ctx.settings.expandCollapsedSubcomments) return () => {};

  const isGameComment = ctx.url.pathname.includes('/psngame/') && ctx.url.pathname.includes('/comment');
  const isTrophy = ctx.url.pathname.startsWith('/trophy/');
  if (!isGameComment && !isTrophy) return () => {};

  const activeObservers: IntersectionObserver[] = [];

  const commentMetas = queryAllIncludingSelf<HTMLElement>(root, 'div.meta:not(.pb10)');
  commentMetas.forEach(meta => {
    const subLink = meta.querySelector('span.r > a:last-of-type') as HTMLElement | null;
    if (!subLink) return;

    const text = (subLink.textContent || '').trim();
    if (!/^评论\(\d+\)/.test(text)) return;

    // Check if subcomment already expanded
    const parentLi = subLink.closest('li');
    if (parentLi && parentLi.querySelector('div.sonlistmark.ml64.mt10 > ul.sonlist > li')) {
      return; // already expanded
    }

    if (subLink.hasAttribute('data-psnine-auto-expanded')) return;
    subLink.setAttribute('data-psnine-auto-expanded', 'true');

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            subLink.click();
            obs.disconnect();
          }
        });
      }, { threshold: 0.1 });
      observer.observe(subLink);
      activeObservers.push(observer);
    }
  });

  return () => {
    activeObservers.forEach(obs => obs.disconnect());
  };
}

/**
 * Main Community Module Mount.
 * Accurately accumulates all cleanups across initial enhancement and subsequent onContent events.
 */
export const mountCommunity: Mount = (ctx: Context): Cleanup => {
  const cleanups: Array<() => void> = [];

  const enhance = (root: ParentNode) => {
    applyUserHighlights(ctx, root);
    applyFloorNumbers(ctx.document, root);
    applyReplyTraceback(ctx, root);
    applyReplyControlsVisibility(ctx, root);
    applyBlocklist(ctx, root);
    applyKeywordFilter(ctx, root);
    const cardCleanup = setupAvatarProfileCards(ctx, root);
    if (cardCleanup) cleanups.push(cardCleanup);
    applyHotTags(ctx, root);
    applyQaStatusIcons(ctx, root);
    sortQAAnswersByNew(ctx, root);
    applyReverseSubReply(ctx, root);
    setupQaSubReplyExpansion(ctx, root);
    const subCleanup = setupViewportSubcommentsExpansion(ctx, root);
    if (subCleanup) cleanups.push(subCleanup);
  };

  enhance(ctx.document.body || ctx.document);

  const unsubs = ctx.onContent((root) => {
    enhance(root);
  });

  return () => {
    unsubs();
    cleanups.forEach(c => {
      try { c(); } catch {}
    });
    cleanups.length = 0;
  };
};
