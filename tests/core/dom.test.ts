import { describe, it, expect, beforeEach } from 'vitest';
import { setHidden, getHiddenReasons, isHiddenByReason, clearAllHiddenReasons } from '../../src/core/dom';

describe('setHidden multi-reason management', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    el.textContent = 'test content';
    document.body.appendChild(el);
  });

  it('hides element when first reason is set', () => {
    setHidden(el, 'blocklist', true);
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe('none');
    expect(getHiddenReasons(el)).toEqual(['blocklist']);
    expect(isHiddenByReason(el, 'blocklist')).toBe(true);
  });

  it('preserves hidden state when one of multiple reasons is removed (prevent R03 overriding C08)', () => {
    // Both blocklist (C08) and score-filter (R03) hide the element
    setHidden(el, 'blocklist', true);
    setHidden(el, 'score-filter', true);

    expect(getHiddenReasons(el).sort()).toEqual(['blocklist', 'score-filter']);
    expect(el.hidden).toBe(true);

    // Score filter decides to unhide (user changed score slider/filter)
    setHidden(el, 'score-filter', false);

    // Critical check: MUST remain hidden because 'blocklist' is still active!
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe('none');
    expect(getHiddenReasons(el)).toEqual(['blocklist']);
    expect(isHiddenByReason(el, 'blocklist')).toBe(true);
    expect(isHiddenByReason(el, 'score-filter')).toBe(false);

    // Only when blocklist is also unhidden does it become visible
    setHidden(el, 'blocklist', false);
    expect(el.hidden).toBe(false);
    expect(el.style.display).toBe('');
    expect(getHiddenReasons(el)).toEqual([]);
  });

  it('preserves native hidden state', () => {
    const nativelyHidden = document.createElement('div');
    nativelyHidden.hidden = true;
    document.body.appendChild(nativelyHidden);

    setHidden(nativelyHidden, 'custom-filter', true);
    expect(nativelyHidden.hidden).toBe(true);

    setHidden(nativelyHidden, 'custom-filter', false);
    // Should still be natively hidden
    expect(nativelyHidden.hidden).toBe(true);
  });

  it('restores original inline display style', () => {
    el.style.display = 'inline-flex';
    setHidden(el, 'test', true);
    expect(el.style.display).toBe('none');

    setHidden(el, 'test', false);
    expect(el.style.display).toBe('inline-flex');
  });

  it('can clear all hidden reasons', () => {
    setHidden(el, 'r1', true);
    setHidden(el, 'r2', true);
    expect(el.hidden).toBe(true);

    clearAllHiddenReasons(el);
    expect(el.hidden).toBe(false);
    expect(getHiddenReasons(el)).toEqual([]);
  });
});
