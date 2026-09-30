import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountSettingsUI } from '../../src/core/settings-ui';
import { createContext } from '../../src/core/context';
import { defaultSettings } from '../../src/core/types';
import { createStore, SETTINGS_KEY } from '../../src/core/store';
import { createHttpClient } from '../../src/core/http';

describe('Settings UI (G07)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('injects floating gear button and opens settings dialog upon click', async () => {
    const store = createStore();
    const http = createHttpClient();
    const ctx = createContext({
      document,
      window,
      settings: { ...defaultSettings },
      store,
      http,
    });

    mountSettingsUI(ctx);

    const gear = document.getElementById('psnine-settings-gear');
    expect(gear).not.toBeNull();

    // Click gear to open dialog
    gear!.click();

    const dialog = document.querySelector('.psnine-settings-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('PSNINE 增强插件设置');

    // Close button works
    const closeBtn = document.querySelector('.psnine-settings-close') as HTMLElement;
    closeBtn.click();

    expect(document.querySelector('.psnine-settings-dialog')).toBeNull();
  });
});
