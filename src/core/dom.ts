/**
 * Shared DOM utilities across all modules.
 * Implements multi-reason hidden management to prevent filter conflicts.
 */

const REASONS_ATTR = 'data-psnine-hidden-reasons';
const NATIVE_HIDDEN_ATTR = 'data-psnine-native-hidden';
const ORIGINAL_DISPLAY_ATTR = 'data-psnine-original-display';

/**
 * Manages visibility using a set of independent hiding reasons.
 * Ensures that if an element is hidden by multiple features (e.g. blocklist and score filter),
 * unhiding by one feature will NOT accidentally unhide it while other reasons remain active.
 * Also preserves any native HTML5 hidden attribute or inline display: none already present.
 */
export function setHidden(node: HTMLElement, reason: string, hidden: boolean): void {
  if (!node || !node.getAttribute) return;

  // Track if element was natively hidden before plugin intervention
  if (!node.hasAttribute(NATIVE_HIDDEN_ATTR)) {
    const isNativelyHidden = node.hidden || (node.style && node.style.display === 'none');
    node.setAttribute(NATIVE_HIDDEN_ATTR, isNativelyHidden ? 'true' : 'false');
    if (node.style && node.style.display && node.style.display !== 'none') {
      node.setAttribute(ORIGINAL_DISPLAY_ATTR, node.style.display);
    }
  }

  const existingStr = node.getAttribute(REASONS_ATTR) || '';
  const reasons = new Set(existingStr.split(',').map(s => s.trim()).filter(Boolean));

  if (hidden) {
    reasons.add(reason);
  } else {
    reasons.delete(reason);
  }

  if (reasons.size > 0) {
    node.setAttribute(REASONS_ATTR, Array.from(reasons).join(','));
    node.hidden = true;
    node.style.display = 'none';
  } else {
    node.removeAttribute(REASONS_ATTR);
    const wasNativelyHidden = node.getAttribute(NATIVE_HIDDEN_ATTR) === 'true';
    if (!wasNativelyHidden) {
      node.hidden = false;
      const origDisplay = node.getAttribute(ORIGINAL_DISPLAY_ATTR);
      if (origDisplay) {
        node.style.display = origDisplay;
      } else {
        node.style.removeProperty('display');
      }
    }
  }
}

/**
 * Returns all active hidden reasons for the element.
 */
export function getHiddenReasons(node: HTMLElement): string[] {
  if (!node || !node.getAttribute) return [];
  const existingStr = node.getAttribute(REASONS_ATTR) || '';
  return existingStr.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Checks whether the element is hidden by a specific reason or any reason.
 */
export function isHiddenByReason(node: HTMLElement, reason?: string): boolean {
  const reasons = getHiddenReasons(node);
  if (!reason) return reasons.length > 0;
  return reasons.includes(reason);
}

/**
 * Clears all plugin hidden reasons on an element, restoring native state.
 */
export function clearAllHiddenReasons(node: HTMLElement): void {
  if (!node || !node.getAttribute) return;
  node.removeAttribute(REASONS_ATTR);
  const wasNativelyHidden = node.getAttribute(NATIVE_HIDDEN_ATTR) === 'true';
  if (!wasNativelyHidden) {
    node.hidden = false;
    const origDisplay = node.getAttribute(ORIGINAL_DISPLAY_ATTR);
    if (origDisplay) {
      node.style.display = origDisplay;
    } else {
      node.style.removeProperty('display');
    }
  }
}
