import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountSettingsUI, resolveThemeMode } from '../../src/core/settings-ui';
import { createContext } from '../../src/core/context';
import { defaultSettings, Settings } from '../../src/core/types';
import { createStore, SETTINGS_KEY } from '../../src/core/store';
import { createHttpClient } from '../../src/core/http';

describe('Settings UI (G07)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  const setupContext = (settingsOverrides: Partial<Settings> = {}) => {
    const store = createStore();
    const http = createHttpClient();
    const mockReload = vi.fn();
    const mockAlert = vi.fn();
    const mockConfirm = vi.fn(() => true);

    const win = {
      ...window,
      location: {
        ...window.location,
        reload: mockReload,
      },
      alert: mockAlert,
      confirm: mockConfirm,
    } as unknown as Window;

    const ctx = createContext({
      document,
      window: win,
      settings: { ...defaultSettings, ...settingsOverrides },
      store,
      http,
    });

    return { ctx, store, win, mockReload, mockAlert, mockConfirm };
  };

  it('injects floating gear button idempotently and opens settings dialog upon click', async () => {
    const { ctx } = setupContext();

    mountSettingsUI(ctx);
    mountSettingsUI(ctx); // calling again should not duplicate gear button

    const gears = document.querySelectorAll('#psnine-settings-gear');
    expect(gears.length).toBe(1);

    const gear = gears[0] as HTMLButtonElement;
    gear.click();

    const dialog = document.querySelector('.psnine-settings-dialog');
    expect(dialog).not.toBeNull();

    // Verify concise title
    const title = dialog?.querySelector('h2');
    expect(title?.textContent?.trim()).toBe('PSNINE 设置');

    // Close button works and removes modal
    const closeBtn = document.querySelector('.psnine-settings-close') as HTMLElement;
    closeBtn.click();
    expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
  });

  it('organizes settings into 8 collapsible sections with Appearance expanded and others collapsed', () => {
    const { ctx } = setupContext();
    mountSettingsUI(ctx);

    const gear = document.getElementById('psnine-settings-gear') as HTMLButtonElement;
    gear.click();

    const sections = Array.from(document.querySelectorAll<HTMLDetailsElement>('details.psnine-settings-section'));
    expect(sections.length).toBe(8);

    // Section 1 (Appearance) is open by default
    expect(sections[0].open).toBe(true);
    expect(sections[0].querySelector('summary')?.textContent).toBe('1. 外观主题与基础');

    // Sections 2-8 are collapsed by default
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].open).toBe(false);
    }

    expect(sections[1].querySelector('summary')?.textContent).toBe('2. 社区互动与回帖');
    expect(sections[2].querySelector('summary')?.textContent).toBe('3. 问答专区');
    expect(sections[3].querySelector('summary')?.textContent).toBe('4. 屏蔽与过滤');
    expect(sections[4].querySelector('summary')?.textContent).toBe('5. 游戏、奖杯与约战');
    expect(sections[5].querySelector('summary')?.textContent).toBe('6. 翻页与自动化');
    expect(sections[6].querySelector('summary')?.textContent).toBe('7. 链接修复与数折汇率');
    expect(sections[7].querySelector('summary')?.textContent).toBe('8. 配置管理');

    // Footer contains only Save and Cancel buttons
    const footerBtns = Array.from(document.querySelectorAll('.psnine-settings-footer button')).map(b => b.textContent?.trim());
    expect(footerBtns).toEqual(['保存配置', '取消']);

    // Config management section contains Export, Import, Restore defaults
    const manageBtns = Array.from(sections[7].querySelectorAll('button')).map(b => b.textContent?.trim());
    expect(manageBtns).toEqual(['导出配置', '导入配置', '恢复默认']);
  });

  describe('Theme mode resolution and schedule visibility', () => {
    it('correctly resolves theme mode from existing settings', () => {
      expect(resolveThemeMode({ ...defaultSettings, autoNightMode: 'SYSTEM' })).toBe('SYSTEM');
      expect(resolveThemeMode({ ...defaultSettings, autoNightMode: 'TIME' })).toBe('TIME');
      expect(resolveThemeMode({ ...defaultSettings, autoNightMode: 'OFF', nightMode: true })).toBe('DARK');
      expect(resolveThemeMode({ ...defaultSettings, autoNightMode: 'OFF', nightMode: false })).toBe('LIGHT');
      // Legacy compatibility
      expect(resolveThemeMode({ ...defaultSettings, autoNightMode: 'OFF', nightMode: true })).toBe('DARK');
    });

    it('initializes single select and controls nightStart/nightEnd visibility conditionally', () => {
      const { ctx } = setupContext({ autoNightMode: 'SYSTEM' });
      mountSettingsUI(ctx);

      const gear = document.getElementById('psnine-settings-gear') as HTMLButtonElement;
      gear.click();

      const select = document.getElementById('psnine-setting-theme-mode') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('SYSTEM');

      const startInput = document.querySelector('[id^="psnine-setting-nightStart"]') as HTMLElement;
      const endInput = document.querySelector('[id^="psnine-setting-nightEnd"]') as HTMLElement;
      const startRow = startInput.closest('.psnine-settings-row') as HTMLElement;
      const endRow = endInput.closest('.psnine-settings-row') as HTMLElement;

      // In SYSTEM mode, schedule rows are hidden without taking layout space
      expect(startRow.style.display).toBe('none');
      expect(startRow.hidden).toBe(true);
      expect(endRow.style.display).toBe('none');
      expect(endRow.hidden).toBe(true);

      // Switch to TIME mode -> schedule rows become visible
      select.value = 'TIME';
      select.dispatchEvent(new Event('change'));
      expect(startRow.style.display).toBe('');
      expect(startRow.hidden).toBe(false);
      expect(endRow.style.display).toBe('');
      expect(endRow.hidden).toBe(false);

      // Switch to DARK mode -> schedule rows become hidden again
      select.value = 'DARK';
      select.dispatchEvent(new Event('change'));
      expect(startRow.style.display).toBe('none');
      expect(startRow.hidden).toBe(true);
      expect(endRow.style.display).toBe('none');
      expect(endRow.hidden).toBe(true);
    });
  });

  describe('Real UI selection -> Persistence schema mapping', () => {
    it('saves LIGHT selection as autoNightMode: OFF and nightMode: false', async () => {
      const { ctx, store, mockReload } = setupContext({ autoNightMode: 'SYSTEM', nightMode: false });
      const storeSpy = vi.spyOn(store, 'set');

      mountSettingsUI(ctx);
      (document.getElementById('psnine-settings-gear') as HTMLButtonElement).click();

      const select = document.getElementById('psnine-setting-theme-mode') as HTMLSelectElement;
      select.value = 'LIGHT';
      select.dispatchEvent(new Event('change'));

      const saveBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-footer button'))
        .find(b => b.textContent?.trim() === '保存配置')!;

      saveBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(storeSpy).toHaveBeenCalledWith(SETTINGS_KEY, expect.objectContaining({
        autoNightMode: 'OFF',
        nightMode: false,
      }));
      expect(ctx.settings.autoNightMode).toBe('OFF');
      expect(ctx.settings.nightMode).toBe(false);
      expect(mockReload).toHaveBeenCalled();
      expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
    });

    it('saves DARK selection as autoNightMode: OFF and nightMode: true', async () => {
      const { ctx, store, mockReload } = setupContext({ autoNightMode: 'SYSTEM', nightMode: false });
      const storeSpy = vi.spyOn(store, 'set');

      mountSettingsUI(ctx);
      (document.getElementById('psnine-settings-gear') as HTMLButtonElement).click();

      const select = document.getElementById('psnine-setting-theme-mode') as HTMLSelectElement;
      select.value = 'DARK';
      select.dispatchEvent(new Event('change'));

      const saveBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-footer button'))
        .find(b => b.textContent?.trim() === '保存配置')!;

      saveBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(storeSpy).toHaveBeenCalledWith(SETTINGS_KEY, expect.objectContaining({
        autoNightMode: 'OFF',
        nightMode: true,
      }));
      expect(ctx.settings.autoNightMode).toBe('OFF');
      expect(ctx.settings.nightMode).toBe(true);
      expect(mockReload).toHaveBeenCalled();
    });

    it('saves TIME selection and custom schedule hours', async () => {
      const { ctx, store, mockReload } = setupContext({ autoNightMode: 'SYSTEM' });
      const storeSpy = vi.spyOn(store, 'set');

      mountSettingsUI(ctx);
      (document.getElementById('psnine-settings-gear') as HTMLButtonElement).click();

      const select = document.getElementById('psnine-setting-theme-mode') as HTMLSelectElement;
      select.value = 'TIME';
      select.dispatchEvent(new Event('change'));

      const startInput = document.querySelector('[id^="psnine-setting-nightStart"]') as HTMLInputElement;
      startInput.value = '21';
      startInput.dispatchEvent(new Event('change'));

      const endInput = document.querySelector('[id^="psnine-setting-nightEnd"]') as HTMLInputElement;
      endInput.value = '8';
      endInput.dispatchEvent(new Event('change'));

      const saveBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-footer button'))
        .find(b => b.textContent?.trim() === '保存配置')!;

      saveBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(storeSpy).toHaveBeenCalledWith(SETTINGS_KEY, expect.objectContaining({
        autoNightMode: 'TIME',
        nightStart: 21,
        nightEnd: 8,
      }));
      expect(ctx.settings.autoNightMode).toBe('TIME');
      expect(ctx.settings.nightStart).toBe(21);
      expect(ctx.settings.nightEnd).toBe(8);
      expect(mockReload).toHaveBeenCalled();
    });

    it('cancelling discards draft and never writes to store', () => {
      const { ctx, store } = setupContext({ autoNightMode: 'SYSTEM', nightMode: false });
      const storeSpy = vi.spyOn(store, 'set');

      mountSettingsUI(ctx);
      (document.getElementById('psnine-settings-gear') as HTMLButtonElement).click();

      const select = document.getElementById('psnine-setting-theme-mode') as HTMLSelectElement;
      select.value = 'DARK';
      select.dispatchEvent(new Event('change'));

      const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-footer button'))
        .find(b => b.textContent?.trim() === '取消')!;

      cancelBtn.click();

      expect(storeSpy).not.toHaveBeenCalled();
      expect(ctx.settings.autoNightMode).toBe('SYSTEM');
      expect(ctx.settings.nightMode).toBe(false);
      expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
    });
  });

  describe('Focus management, Escape closing, backdrop click and error handling', () => {
    it('restores focus to opener element when closed via Escape', () => {
      const { ctx } = setupContext();
      mountSettingsUI(ctx);

      const gear = document.getElementById('psnine-settings-gear') as HTMLButtonElement;
      gear.focus();
      expect(document.activeElement).toBe(gear);

      gear.click();
      expect(document.querySelector('.psnine-settings-dialog')).not.toBeNull();

      // Close via Escape key
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
      expect(document.activeElement).toBe(gear);
    });

    it('closes when clicking the backdrop outside the dialog', () => {
      const { ctx } = setupContext();
      mountSettingsUI(ctx);

      const gear = document.getElementById('psnine-settings-gear') as HTMLButtonElement;
      gear.click();

      const backdrop = document.querySelector('.psnine-modal-backdrop') as HTMLElement;
      expect(backdrop).not.toBeNull();

      // Click on backdrop itself
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
    });

    it('disables controls and blocks Escape, backdrop click, and close button while saving is pending, then recovers draft on rejection and allows retry', async () => {
      const { ctx, store, mockAlert, mockReload } = setupContext();

      let rejectSave!: (err: Error) => void;
      let callCount = 0;

      const storeSpy = vi.spyOn(store, 'set').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise<void>((_, reject) => {
            rejectSave = reject;
          });
        }
        return Promise.resolve();
      });

      mountSettingsUI(ctx);
      (document.getElementById('psnine-settings-gear') as HTMLButtonElement).click();

      // Modify a draft setting
      const select = document.getElementById('psnine-setting-theme-mode') as HTMLSelectElement;
      select.value = 'DARK';
      select.dispatchEvent(new Event('change'));

      const saveBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-footer button'))
        .find(b => b.textContent?.trim() === '保存配置')!;
      const cancelBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-footer button'))
        .find(b => b.textContent?.trim() === '取消')!;
      const closeBtn = document.querySelector('.psnine-settings-close') as HTMLButtonElement;
      const backdrop = document.querySelector('.psnine-modal-backdrop') as HTMLElement;

      // 1. Trigger save -> now pending in-flight
      saveBtn.click();

      // Verify controls are disabled during in-flight save
      expect(saveBtn.disabled).toBe(true);
      expect(cancelBtn.disabled).toBe(true);
      expect(closeBtn.disabled).toBe(true);
      expect(saveBtn.textContent).toBe('保存中...');

      // 2. Try closing via Escape while saving -> MUST NOT close
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.psnine-settings-dialog')).not.toBeNull();

      // 3. Try closing via close button while saving -> MUST NOT close
      closeBtn.click();
      expect(document.querySelector('.psnine-settings-dialog')).not.toBeNull();

      // 4. Try closing via backdrop click while saving -> MUST NOT close
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(document.querySelector('.psnine-settings-dialog')).not.toBeNull();

      // 5. Reject the pending save promise
      rejectSave(new Error('QuotaExceeded'));
      await new Promise(r => setTimeout(r, 20));

      // 6. Verify error recovery: alert shown, dialog open, draft preserved, buttons re-enabled
      expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('QuotaExceeded'));
      expect(document.querySelector('.psnine-settings-dialog')).not.toBeNull();
      expect(saveBtn.disabled).toBe(false);
      expect(cancelBtn.disabled).toBe(false);
      expect(closeBtn.disabled).toBe(false);
      expect(saveBtn.textContent).toBe('保存配置');
      expect(select.value).toBe('DARK');

      // 7. Retry save -> this time it succeeds
      saveBtn.click();
      await new Promise(r => setTimeout(r, 20));

      expect(storeSpy).toHaveBeenCalledTimes(2);
      expect(storeSpy).toHaveBeenLastCalledWith(SETTINGS_KEY, expect.objectContaining({
        autoNightMode: 'OFF',
        nightMode: true,
      }));
      expect(mockReload).toHaveBeenCalled();
      expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
    });

    it('supports restoring defaults in configuration management section', async () => {
      const { ctx, store, mockConfirm, mockReload } = setupContext({ autoNightMode: 'OFF', nightMode: true });
      const storeSpy = vi.spyOn(store, 'set');

      mountSettingsUI(ctx);
      (document.getElementById('psnine-settings-gear') as HTMLButtonElement).click();

      const resetBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.psnine-settings-section button'))
        .find(b => b.textContent?.trim() === '恢复默认')!;

      resetBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(mockConfirm).toHaveBeenCalled();
      expect(storeSpy).toHaveBeenCalledWith(SETTINGS_KEY, defaultSettings);
      expect(mockReload).toHaveBeenCalled();
    });
  });
});
