import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bindInlineTipTrophyLinks,
  applyTrophyRowHighlight,
  clearTrophyRowHighlight,
  type TrophyItem
} from '../src/features/trophies';

describe('Inline Tip Trophy Jump & Highlight Unit Tests', () => {

function createMockTrophyItem(overrides: Partial<TrophyItem> & { trophyId: string; row: HTMLElement }): TrophyItem {
  return {
    trophyId: overrides.trophyId,
    name: overrides.name || "测试奖杯",
    description: overrides.description || "测试描述",
    iconSrc: overrides.iconSrc || "https://psnine.com/icon.png",
    type: overrides.type || "bronze",
    rarityPercent: overrides.rarityPercent ?? 50,
    status: overrides.status || "unearned",
    earnedTimestamp: overrides.earnedTimestamp ?? null,
    earnedTimeStr: overrides.earnedTimeStr || "",
    tipsCount: overrides.tipsCount ?? 1,
    originalIndex: overrides.originalIndex ?? 0,
    row: overrides.row,
    table: overrides.table || (overrides.row.closest("table") as HTMLElement) || document.createElement("table")
  };
}

  beforeEach(() => {
    document.body.innerHTML = '';
    clearTrophyRowHighlight();
  });

  it('handles in-list target: marks link, prevents default, scrolls, focuses, and highlights row', () => {
    document.body.innerHTML = `
      <table class="list">
        <tbody>
          <tr class="trophy" id="cup-1">
            <td><a href="/trophy/12345001">奖杯 1</a></td>
          </tr>
        </tbody>
      </table>
      <div id="tip-content">
        <a href="/trophy/12345001" id="jump-link">同游戏奖杯</a>
      </div>
    `;

    const row = document.getElementById('cup-1') as HTMLElement;
    row.scrollIntoView = vi.fn();

    const trophyItem = createMockTrophyItem({ trophyId: '12345001', row });

    const tipContainer = document.getElementById('tip-content') as HTMLElement;
    const link = document.getElementById('jump-link') as HTMLAnchorElement;

    bindInlineTipTrophyLinks(tipContainer, () => [trophyItem], window, document, 'https://psnine.com');

    expect(link.getAttribute('data-psnine-tip-jump')).toBe('true');
    expect(link.getAttribute('data-psnine-internal-link')).toBe('true');

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(row.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(row.classList.contains('psnine-tip-jump-target')).toBe(true);
    expect(row.getAttribute('data-psnine-highlight')).toBe('true');
    expect(row.getAttribute('tabindex')).toBe('-1');
  });

  it('does NOT intercept external, cross-game, anchor, or modifier clicks', () => {
    document.body.innerHTML = `
      <div id="tip-content">
        <a href="https://other.com/trophy/12345001" id="link-external">外部链接</a>
        <a href="/trophy/99999001" id="link-crossgame">跨游戏链接</a>
        <a href="/trophy/12345001#comment-42" id="link-anchor">带锚点链接</a>
        <a href="/trophy/12345001" id="link-modifier">同游戏链接</a>
      </div>
      <table class="list">
        <tbody>
          <tr class="trophy" id="cup-1"><td>奖杯 1</td></tr>
        </tbody>
      </table>
    `;

    const row = document.getElementById('cup-1') as HTMLElement;
    const trophyItem = createMockTrophyItem({ trophyId: '12345001', row });

    const tipContainer = document.getElementById('tip-content') as HTMLElement;
    bindInlineTipTrophyLinks(tipContainer, () => [trophyItem], window, document, 'https://psnine.com');

    const extLink = document.getElementById('link-external') as HTMLAnchorElement;
    const crossLink = document.getElementById('link-crossgame') as HTMLAnchorElement;
    const anchorLink = document.getElementById('link-anchor') as HTMLAnchorElement;
    const modLink = document.getElementById('link-modifier') as HTMLAnchorElement;

    // External, cross-game, anchor links must not be marked as tip-jump
    expect(extLink.hasAttribute('data-psnine-tip-jump')).toBe(false);
    expect(crossLink.hasAttribute('data-psnine-tip-jump')).toBe(false);
    expect(anchorLink.hasAttribute('data-psnine-tip-jump')).toBe(false);
    expect(modLink.getAttribute('data-psnine-tip-jump')).toBe('true');

    // Modifier clicks on valid link must NOT be prevented
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...mod });
      modLink.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
      ev.preventDefault(); // suppress jsdom navigation warning
    }
  });

  it('triggers click on active native filter button when target row is hidden by native filter', () => {
    document.body.innerHTML = `
      <ul class="dropmenu">
        <li><button class="o_btn own select">已获得</button></li>
      </ul>
      <table class="list">
        <tbody>
          <tr class="trophy" id="cup-1" style="display: none;" data-psnine-native-sync-hidden="true">
            <td>奖杯 1</td>
          </tr>
        </tbody>
      </table>
      <div id="tip-content">
        <a href="/trophy/12345001" id="jump-link">跳转到未获杯</a>
      </div>
    `;

    const row = document.getElementById('cup-1') as HTMLElement;
    const filterBtn = document.querySelector('.o_btn.own') as HTMLElement;
    const filterClickSpy = vi.fn();
    filterBtn.addEventListener('click', filterClickSpy);

    const trophyItem = createMockTrophyItem({ trophyId: '12345001', row });

    const tipContainer = document.getElementById('tip-content') as HTMLElement;
    const link = document.getElementById('jump-link') as HTMLAnchorElement;

    bindInlineTipTrophyLinks(tipContainer, () => [trophyItem], window, document, 'https://psnine.com');

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(clickEvent);

    expect(filterClickSpy).toHaveBeenCalledTimes(1);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('targets fresh replaced row at click time and falls back to default navigation if target is detached or missing', () => {
    document.body.innerHTML = `
      <table class="list">
        <tbody id="tbody">
          <tr class="trophy" id="cup-old"><td>旧行</td></tr>
        </tbody>
      </table>
      <div id="tip-content">
        <a href="/trophy/12345001" id="jump-link">奖杯链接</a>
      </div>
    `;

    const oldRow = document.getElementById('cup-old') as HTMLElement;
    const newRow = document.createElement('tr');
    newRow.id = 'cup-new';
    newRow.className = 'trophy';

    let currentRows: TrophyItem[] = [createMockTrophyItem({ trophyId: '12345001', row: oldRow })];

    const tipContainer = document.getElementById('tip-content') as HTMLElement;
    const link = document.getElementById('jump-link') as HTMLAnchorElement;

    bindInlineTipTrophyLinks(tipContainer, () => currentRows, window, document, 'https://psnine.com');

    // Replace oldRow with newRow in document and in live trophies list
    oldRow.remove();
    document.getElementById('tbody')!.appendChild(newRow);
    currentRows = [createMockTrophyItem({ trophyId: '12345001', row: newRow })];

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(newRow.classList.contains('psnine-tip-jump-target')).toBe(true);
    expect(oldRow.classList.contains('psnine-tip-jump-target')).toBe(false);

    // If target is completely missing from current live list at click time:
    currentRows = [];
    const missingClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(missingClick);
    expect(missingClick.defaultPrevented).toBe(false);
    missingClick.preventDefault(); // suppress jsdom navigation warning
  });

  it('does not touch unrelated hidden reasons when no active native filter is selected', () => {
    document.body.innerHTML = `
      <table class="list">
        <tbody>
          <tr class="trophy" id="cup-1" style="display: none;" data-other-collapse="true">
            <td>奖杯 1</td>
          </tr>
        </tbody>
      </table>
      <div id="tip-content">
        <a href="/trophy/12345001" id="jump-link">链接</a>
      </div>
    `;

    const row = document.getElementById('cup-1') as HTMLElement;
    const trophyItem = createMockTrophyItem({ trophyId: '12345001', row });

    const tipContainer = document.getElementById('tip-content') as HTMLElement;
    const link = document.getElementById('jump-link') as HTMLAnchorElement;

    bindInlineTipTrophyLinks(tipContainer, () => [trophyItem], window, document, 'https://psnine.com');

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    // data-other-collapse remains intact
    expect(row.getAttribute('data-other-collapse')).toBe('true');
  });

  it('repeated highlight clicks preserve original tabindex and cleanup properly restores it', () => {
    const row = document.createElement('tr');
    row.setAttribute('tabindex', '0');
    document.body.appendChild(row);

    // First highlight call
    applyTrophyRowHighlight(row, window);
    expect(row.getAttribute('tabindex')).toBe('-1');
    expect(row.classList.contains('psnine-tip-jump-target')).toBe(true);

    // Repeated call before timer expires
    applyTrophyRowHighlight(row, window);
    expect(row.getAttribute('tabindex')).toBe('-1');
    expect(row.classList.contains('psnine-tip-jump-target')).toBe(true);

    // Cleanup restores true original tabindex '0'
    clearTrophyRowHighlight();
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.classList.contains('psnine-tip-jump-target')).toBe(false);
    expect(row.hasAttribute('data-psnine-highlight')).toBe(false);

    // When row originally had no tabindex
    const rowWithoutTabIndex = document.createElement('tr');
    document.body.appendChild(rowWithoutTabIndex);

    applyTrophyRowHighlight(rowWithoutTabIndex, window);
    expect(rowWithoutTabIndex.getAttribute('tabindex')).toBe('-1');

    clearTrophyRowHighlight();
    expect(rowWithoutTabIndex.hasAttribute('tabindex')).toBe(false);
  });

  it('avoids double-binding when called multiple times on the same root', () => {
    document.body.innerHTML = `
      <div id="tip-content">
        <a href="/trophy/12345001" id="jump-link">同游戏奖杯</a>
      </div>
      <table class="list">
        <tbody>
          <tr class="trophy" id="cup-1"><td>奖杯 1</td></tr>
        </tbody>
      </table>
    `;

    const row = document.getElementById('cup-1') as HTMLElement;
    const trophyItem = createMockTrophyItem({ trophyId: '12345001', row });

    const tipContainer = document.getElementById('tip-content') as HTMLElement;
    const link = document.getElementById('jump-link') as HTMLAnchorElement;

    bindInlineTipTrophyLinks(tipContainer, () => [trophyItem], window, document, 'https://psnine.com');
    // Call again to verify idempotent no-op
    bindInlineTipTrophyLinks(tipContainer, () => [trophyItem], window, document, 'https://psnine.com');

    const clickSpy = vi.fn();
    row.addEventListener('focus', clickSpy);

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
  });
});
