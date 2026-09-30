import { Context, Mount, Cleanup } from '../core/types';

/**
 * Validates whether a candidate pagination URL is safe and valid.
 * Must be same-origin, http(s), matching route family, and not an action/javascript URL.
 */
export function isSafeNextPageUrl(candidateUrl: string, currentUrl: URL, allowedPath?: string): boolean {
  try {
    const parsed = new URL(candidateUrl, currentUrl.href);
    if (parsed.origin !== currentUrl.origin) return false;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const path = parsed.pathname.toLowerCase();
    // Disallow action / mutating / sensitive endpoints
    if (path.startsWith('/set/') || path.startsWith('/signin') || path.startsWith('/trade/')) {
      return false;
    }

    const currentPath = (allowedPath || currentUrl.pathname).toLowerCase().replace(/\/$/, '');
    const cleanPath = path.replace(/\/$/, '');
    if (cleanPath !== currentPath) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Finds next page URL from existing pagination controls on page (C20).
 * Handles numeric pages (with li.current containing javascript:void(0)), rel="next", and chevron labels.
 */
export function getNextPageUrl(doc: Document, currentUrl: URL): string | null {
  // 1. Explicit rel="next" or standard "下一页" / chevron links
  const pageAnchors = Array.from(doc.querySelectorAll('.page a, ul.page a, a[rel="next"], .page a.next'));
  for (const a of pageAnchors) {
    const text = (a.textContent || '').trim();
    if (text === '下一页' || text === '>' || text === '»' || a.classList.contains('next') || a.getAttribute('rel') === 'next') {
      const rawHref = a.getAttribute('href');
      if (rawHref && !rawHref.startsWith('javascript:') && rawHref !== '#') {
        if (isSafeNextPageUrl(rawHref, currentUrl)) {
          const parsed = new URL(rawHref, currentUrl.href);
          parsed.hash = '';
          return parsed.href;
        }
      }
    }
  }

  // 2. Numeric pagination with current page indicator: <li class="current"><a href="javascript:void(0)">1</a></li>
  const currentItem = doc.querySelector('.page .current, ul.page li.current, .page li.active, ul.page li.active');
  if (currentItem) {
    const currentNum = parseInt(currentItem.textContent?.trim() || '0', 10);
    const parentLi = currentItem.closest('li') || currentItem;
    let nextSibling = parentLi.nextElementSibling;

    while (nextSibling) {
      if (nextSibling.classList.contains('disabled')) {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
      const a = nextSibling.querySelector('a') || (nextSibling.tagName.toLowerCase() === 'a' ? nextSibling as HTMLAnchorElement : null);
      if (a) {
        const rawHref = a.getAttribute('href');
        if (rawHref && !rawHref.startsWith('javascript:') && rawHref !== '#') {
          const targetNum = parseInt(a.textContent?.trim() || '0', 10);
          // If numeric, ensure target page number is strictly greater than current page
          if (!isNaN(currentNum) && !isNaN(targetNum) && targetNum > 0 && targetNum <= currentNum) {
            nextSibling = nextSibling.nextElementSibling;
            continue;
          }
          if (isSafeNextPageUrl(rawHref, currentUrl)) {
            const parsed = new URL(rawHref, currentUrl.href);
            parsed.hash = '';
            return parsed.href;
          }
        }
      }
      nextSibling = nextSibling.nextElementSibling;
    }
  }

  return null;
}

/**
 * Determines the specific list container where new page rows should be appended,
 * strictly scoped to known routes rather than matching any random table.
 * Accurately recognizes plain game tables by checking game links, even if the last page has only 1~5 rows.
 */
export function getListContainer(doc: Document, currentUrl: URL): { container: Element; itemSelector: string } | null {
  const path = currentUrl.pathname;

  // 1. Game comments page: must use ul.list, NOT table
  if (path.includes('/psngame/') && path.includes('/comment')) {
    const ul = doc.querySelector('div.box > ul.list:not(.sonlist), ul.list:not(.sonlist)');
    if (ul) return { container: ul, itemSelector: ':scope > li' };
    return null;
  }

  // 2. Exact Game list route (/psngame): in games.html, table has NO class!
  // Exclude single game trophy page (/psngame/:id)
  if (path === '/psngame' || path === '/psngame/' || /^\/psngame(?:\?.*)?$/.test(path + currentUrl.search)) {
    // Recognize game table by presence of game links (even with only 1 row on last page)
    const plainTable = doc.querySelector('table.list tbody, table.list') ||
      Array.from(doc.querySelectorAll('table')).find(t => !t.classList.contains('tbl') && t.querySelector('a[href*="/psngame/"]'));
    if (plainTable) {
      const tbody = plainTable.querySelector('tbody') || plainTable;
      return { container: tbody, itemSelector: 'tr' };
    }
  }

  // 3. Deals (/dd): in deals.html, list container is ul.dd_ul!
  if (path.startsWith('/dd')) {
    const ul = doc.querySelector('ul.dd_ul, ul.dd_box_ul, ul.list');
    if (ul) return { container: ul, itemSelector: ':scope > li' };
  }

  // 4. Personal profile games (/psnid/:id or /psnid/:id/psngame)
  if (path.startsWith('/psnid/')) {
    const table = doc.querySelector('table.list tbody, table.list') ||
      Array.from(doc.querySelectorAll('table')).find(t => !t.classList.contains('tbl') && t.querySelector('a[href*="/psngame/"]'));
    if (table) {
      const tbody = table.querySelector('tbody') || table;
      return { container: tbody, itemSelector: 'tr' };
    }
    const ul = doc.querySelector('ul.list:not(.sonlist)');
    if (ul) return { container: ul, itemSelector: ':scope > li' };
  }

  // 5. Discussion threads, genes, QA, battle
  // DO NOT treat topic article tables (.tbl) as pageable content!
  if (path.startsWith('/gene') || path.startsWith('/qa') || path.startsWith('/battle') || path.startsWith('/topic')) {
    const table = doc.querySelector('table.list tbody, table.list');
    if (table) {
      const tbody = table.querySelector('tbody') || table;
      return { container: tbody, itemSelector: 'tr' };
    }

    const ul = doc.querySelector('ul.list:not(.sonlist), .genelist, .topiclist');
    if (ul) return { container: ul, itemSelector: ':scope > li' };
  }

  return null;
}

/**
 * Extracts a robust unique identifier for a list item to deduplicate accurately.
 * In deals (/dd), extracts specific SKU link (.dd_title a[href*="/dd/"]) rather than shared promo topic links!
 * Strips all plugin chrome ([data-psnine-next]) from text fallback and preserves distinct posts by same author.
 */
export function getItemSignature(item: Element): string {
  if (item.id) return `id:${item.id}`;

  // 1. Deals SKU link
  const dealLink = item.querySelector('.dd_title a[href*="/dd/"], a[href*="/dd/"]');
  if (dealLink) {
    const href = dealLink.getAttribute('href');
    if (href) return `deal:${href}`;
  }

  // 2. Specific game link
  const gameLink = item.querySelector('td:first-child a[href*="/psngame/"], .title a[href*="/psngame/"]');
  if (gameLink) {
    const href = gameLink.getAttribute('href');
    if (href) return `game:${href}`;
  }

  // 3. Thread / QA / Gene title link
  const mainTitleLink = item.querySelector('.title a, p.title a, td.title a, h4 a');
  if (mainTitleLink) {
    const href = mainTitleLink.getAttribute('href');
    if (href) return `title:${href}`;
  }

  // 4. Comment anchor
  const floorAnchor = item.querySelector('a[name^="comment-"], a[name^="post-"], a[href*="#comment-"], a[href*="#post-"]');
  if (floorAnchor) {
    const name = floorAnchor.getAttribute('name') || floorAnchor.getAttribute('href');
    if (name) return `anchor:${name}`;
  }

  // 5. Text fallback: strip injected plugin chrome so floor badges / cards do not collide
  const clone = item.cloneNode(true) as Element;
  clone.querySelectorAll('[data-psnine-next]').forEach(c => c.remove());
  const author = clone.querySelector('.meta a.psnnode, .meta a[href*="/psnid/"], .author a')?.textContent?.trim() || '';
  const timestamp = clone.querySelector('.meta .h-p, .meta .date, .time')?.textContent?.trim() || '';
  const textSample = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);

  return `item:${author}:${timestamp}:${textSample}`;
}

/**
 * Auto-pagination (C20 & C21).
 * Supports standard route pagination and authentic profile game pagination (C21)
 * by following the real "查看所有游戏" anchor and native paginator links.
 * Respects maxPages across all pages including homepage, and provides manual continue trigger.
 */
export function setupAutoPagination(ctx: Context): Cleanup {
  const { document: doc, window: win, url, settings, http } = ctx;

  const isHomepage = url.pathname.startsWith('/psnid/') && !url.pathname.includes('/comment');
  if (isHomepage && !settings.autoPagingInHomepage) {
    return () => {};
  }

  // Prevent auto-pagination from competing with setupLoadAllQAAnswers on QA detail pages
  if (url.pathname.startsWith('/qa/') && settings.showAllQAAnswers) {
    return () => {};
  }

  const maxPages = settings.autoPaging ?? 0;
  if (maxPages <= 0) {
    return () => {};
  }

  let isMounted = true;
  let pagesLoaded = 0;
  let isLoading = false;
  let hasMore = true;
  let isStoppedByUser = false;
  let abortCtrl: AbortController | null = null;

  const visitedUrls = new Set<string>();
  const cleanCurrentUrl = new URL(url.href);
  cleanCurrentUrl.hash = '';
  visitedUrls.add(cleanCurrentUrl.href);

  // C21 Profile Fallback: follow the authentic "查看所有游戏" link if no direct pager exists
  let nextUrl = getNextPageUrl(doc, url);
  let allowedPath: string | undefined = undefined;

  if (!nextUrl && isHomepage) {
    // Find authentic "查看所有游戏" or PSN游戏 link
    const allGamesLink = doc.querySelector<HTMLAnchorElement>(
      'a[href*="/psnid/"][href$="/psngame"], a[href*="/psngame"][href*="/psnid/"]'
    );
    if (allGamesLink) {
      const rawHref = allGamesLink.getAttribute('href');
      if (rawHref) {
        try {
          const parsed = new URL(rawHref, url.href);
          if (parsed.origin === url.origin) {
            allowedPath = parsed.pathname;
            nextUrl = parsed.href;
          }
        } catch {}
      }
    }
  }

  const containerInfo = getListContainer(doc, url);
  if (!containerInfo || !nextUrl) {
    return () => {};
  }

  const controlBar = doc.createElement('div');
  controlBar.id = 'psnine-pagination-indicator';
  controlBar.setAttribute('data-psnine-next', 'chrome');
  controlBar.style.cssText = 'text-align:center; padding:16px; font-size:13px; color:#7f8c8d; display:none; user-select:none;';

  const statusText = doc.createElement('span');
  statusText.textContent = '正在加载下一页...';
  controlBar.appendChild(statusText);

  const stopBtn = doc.createElement('button');
  stopBtn.className = 'psnine-btn';
  stopBtn.style.cssText = 'margin-left:12px; font-size:12px; padding:2px 8px; min-height:24px; min-width:auto; cursor:pointer;';
  stopBtn.textContent = '停止翻页';
  stopBtn.addEventListener('click', () => {
    isStoppedByUser = true;
    if (abortCtrl) {
      abortCtrl.abort();
      abortCtrl = null;
    }
    controlBar.style.display = 'none';
  });
  controlBar.appendChild(stopBtn);

  const paginationBar = doc.querySelector('.page, ul.page');
  if (paginationBar) {
    paginationBar.before(controlBar);
  } else {
    containerInfo.container.after(controlBar);
  }

  const loadNextPage = async () => {
    if (isLoading || !hasMore || !nextUrl || isStoppedByUser || !isMounted) return;

    // Check if auto-pagination budget is reached; allow manual continue
    if (maxPages > 0 && pagesLoaded >= maxPages) {
      controlBar.style.display = 'block';
      statusText.innerHTML = `<span style="cursor:pointer; color:#3498db; text-decoration:underline;">已加载预设 ${pagesLoaded} 页，点击继续加载下一页</span>`;
      statusText.onclick = () => {
        statusText.onclick = null;
        pagesLoaded = 0; // Reset batch counter to allow another round
        loadNextPage();
      };
      return;
    }

    const normalizedTarget = new URL(nextUrl, url.href);
    normalizedTarget.hash = '';

    if (visitedUrls.has(normalizedTarget.href)) {
      hasMore = false;
      controlBar.style.display = 'none';
      return;
    }

    isLoading = true;
    controlBar.style.display = 'block';
    statusText.textContent = `正在自动加载第 ${pagesLoaded + 1} 页...`;

    abortCtrl = new AbortController();
    const thisCtrl = abortCtrl;

    try {
      const targetUrlToFetch = normalizedTarget.href;
      const nextPageDoc = await http.document(targetUrlToFetch, { signal: thisCtrl.signal });

      // Immediate post-fetch check: if aborted, stopped, or unmounted, abort immediately without DOM append
      if (thisCtrl.signal.aborted || isStoppedByUser || !isMounted) {
        return;
      }

      visitedUrls.add(targetUrlToFetch);

      const targetParsedUrl = new URL(targetUrlToFetch);
      const newContainerInfo = getListContainer(nextPageDoc, targetParsedUrl);
      if (!newContainerInfo) {
        hasMore = false;
        controlBar.style.display = 'none';
        return;
      }

      const newItems = Array.from(newContainerInfo.container.querySelectorAll(newContainerInfo.itemSelector));
      if (newItems.length === 0) {
        hasMore = false;
        controlBar.style.display = 'none';
        return;
      }

      const existingItems = Array.from(containerInfo.container.querySelectorAll(containerInfo.itemSelector));
      const existingSignatures = new Set(existingItems.map(getItemSignature));

      let appendedCount = 0;
      for (const item of newItems) {
        const sig = getItemSignature(item);
        if (existingSignatures.has(sig)) {
          continue;
        }
        existingSignatures.add(sig);

        const imported = doc.importNode(item, true);
        containerInfo.container.appendChild(imported);
        appendedCount++;
      }

      pagesLoaded++;

      // Follow next paginator link from fetched document
      nextUrl = getNextPageUrl(nextPageDoc, targetParsedUrl);

      if (!nextUrl) {
        hasMore = false;
        controlBar.style.display = 'none';
      } else if (maxPages > 0 && pagesLoaded >= maxPages) {
        // Budget reached: show manual continue prompt
        statusText.innerHTML = `<span style="cursor:pointer; color:#3498db; text-decoration:underline;">已加载预设 ${pagesLoaded} 页，点击继续加载下一页</span>`;
        statusText.onclick = () => {
          statusText.onclick = null;
          pagesLoaded = 0;
          loadNextPage();
        };
      } else {
        controlBar.style.display = 'none';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || thisCtrl.signal.aborted) return;
      statusText.innerHTML = `<span style="color:#e74c3c; cursor:pointer;">加载失败，点击重试</span>`;
      statusText.onclick = () => {
        statusText.onclick = null;
        loadNextPage();
      };
      ctx.report('autoPaging', err);
    } finally {
      isLoading = false;
      if (abortCtrl === thisCtrl) {
        abortCtrl = null;
      }
    }
  };

  const onScroll = () => {
    if (isLoading || !hasMore || isStoppedByUser || !isMounted) return;
    const scrollBottom = win.scrollY + win.innerHeight;
    const triggerOffset = doc.body.scrollHeight - 600;

    if (scrollBottom >= triggerOffset) {
      loadNextPage();
    }
  };

  win.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    isMounted = false;
    win.removeEventListener('scroll', onScroll);
    if (abortCtrl) abortCtrl.abort();
    controlBar.remove();
  };
}

/**
 * Load all QA answers feature with safe bounded loop, cancel/stop, and retry support (C12).
 * Retains remaining next URL and native pager when bounded limit is reached,
 * and only claims complete when no successor exists.
 * Safely guards activeAbortCtrl against race conditions across restarts.
 */
export function setupLoadAllQAAnswers(ctx: Context): Cleanup {
  const { document: doc, url, settings, http } = ctx;
  if (!url.pathname.startsWith('/qa/')) return () => {};

  const paginationBar = doc.querySelector('.page, ul.page') as HTMLElement | null;
  const answersList = doc.querySelector('ul.list:not(.sonlist), div.box.mt20 > ul.list');
  if (!paginationBar || !answersList) return () => {};

  let btn = doc.getElementById('psnine-load-all-qa') as HTMLButtonElement | null;
  if (btn) return () => {};

  btn = doc.createElement('button');
  btn.id = 'psnine-load-all-qa';
  btn.className = 'psnine-btn';
  btn.setAttribute('data-psnine-next', 'chrome');
  btn.style.cssText = 'margin:10px 0; font-size:12px; cursor:pointer; padding:4px 10px;';
  btn.textContent = '载入全部答案';

  paginationBar.before(btn);

  let isCancelled = false;
  let activeAbortCtrl: AbortController | null = null;
  const maxPagesPerBatch = 20; // Safe bounded upper limit per batch

  const visited = new Set<string>();
  const initialUrl = new URL(url.href);
  initialUrl.hash = '';
  visited.add(initialUrl.href);

  let currentNext = getNextPageUrl(doc, url);

  const fetchRemainingPages = async () => {
    if (activeAbortCtrl) {
      // If currently fetching, button acts as Stop / Cancel
      activeAbortCtrl.abort();
      activeAbortCtrl = null;
      btn!.textContent = '已停止载入 (点击继续)';
      return;
    }

    if (!currentNext) {
      btn!.textContent = '已载入全部回答';
      btn!.disabled = true;
      if (paginationBar) paginationBar.style.display = 'none';
      return;
    }

    const currentCtrl = new AbortController();
    activeAbortCtrl = currentCtrl;
    const signal = currentCtrl.signal;

    btn!.textContent = '正在全量载入回答... (点击停止)';
    let pagesCount = 0;

    const existingSignatures = new Set(
      Array.from(answersList.querySelectorAll(':scope > li')).map(getItemSignature)
    );

    try {
      while (currentNext && !visited.has(currentNext) && !signal.aborted && !isCancelled && pagesCount < maxPagesPerBatch) {
        const nextDoc = await http.document(currentNext, { signal });

        // Immediate post-fetch check
        if (signal.aborted || isCancelled || activeAbortCtrl !== currentCtrl) {
          return;
        }

        visited.add(currentNext);
        pagesCount++;

        const newAnswers = Array.from(nextDoc.querySelectorAll('ul.list > li:not(.sonlist li)'));
        for (const li of newAnswers) {
          const sig = getItemSignature(li);
          if (existingSignatures.has(sig)) continue;
          existingSignatures.add(sig);
          answersList.appendChild(doc.importNode(li, true));
        }

        currentNext = getNextPageUrl(nextDoc, new URL(currentNext));
      }

      if (signal.aborted || isCancelled) {
        btn!.textContent = '已停止载入 (点击继续)';
        return;
      }

      if (!currentNext) {
        // Truly finished all pages
        btn!.textContent = '已载入全部回答';
        btn!.disabled = true;
        if (paginationBar) paginationBar.style.display = 'none';
      } else {
        // Hit batch limit of 20 pages; retain remaining next and native pager!
        btn!.textContent = `已载入前 ${pagesCount} 页回答，点击继续载入后续`;
        if (paginationBar) paginationBar.style.display = '';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) {
        btn!.textContent = '已停止载入 (点击继续)';
        return;
      }
      btn!.textContent = '部分答案载入失败，点击重试';
      ctx.report('showAllQAAnswers', err);
    } finally {
      if (activeAbortCtrl === currentCtrl) {
        activeAbortCtrl = null;
      }
    }
  };

  btn.addEventListener('click', fetchRemainingPages);

  if (settings.showAllQAAnswers) {
    fetchRemainingPages().catch(err => ctx.report('showAllQAAnswers', err));
  }

  return () => {
    isCancelled = true;
    if (activeAbortCtrl) {
      activeAbortCtrl.abort();
      activeAbortCtrl = null;
    }
    btn?.remove();
  };
}

/**
 * Main Paging Module Mount
 */
export const mountPaging: Mount = (ctx: Context): Cleanup => {
  const cleanupAutoPaging = setupAutoPagination(ctx);
  const cleanupAllQA = setupLoadAllQAAnswers(ctx);

  return () => {
    cleanupAutoPaging();
    cleanupAllQA();
  };
};
