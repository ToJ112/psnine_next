import { Context, Settings, defaultSettings } from './types';
import { SETTINGS_KEY, validateSettings } from './store';
import { applyTheme } from '../features/global';
import { ICONS } from '../styles';

/**
 * Resolves current theme mode from Settings for single UI dropdown.
 * Compatible with legacy nightMode boolean and autoNightMode values.
 */
export function resolveThemeMode(s: Settings): 'SYSTEM' | 'LIGHT' | 'DARK' | 'TIME' {
  if (s.autoNightMode === 'SYSTEM') return 'SYSTEM';
  if (s.autoNightMode === 'TIME') return 'TIME';
  if (s.autoNightMode === 'OFF') {
    return s.nightMode ? 'DARK' : 'LIGHT';
  }
  return s.nightMode ? 'DARK' : 'SYSTEM';
}

/**
 * Injects the in-page settings panel and triggers (G07).
 * Implements accessible focus management, Escape closing, label association,
 * compact details/summary categorization, and reliable settings persistence.
 */
export function mountSettingsUI(ctx: Context): void {
  const { document: doc, window: win, store } = ctx;

  let previouslyFocused: HTMLElement | null = null;
  let modalBackdrop: HTMLElement | null = null;
  let onKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  let isSaving = false;

  // 1. Create floating gear button (standard <button> for accessibility)
  let gearBtn = doc.getElementById('psnine-settings-gear') as HTMLButtonElement | null;
  if (!gearBtn) {
    gearBtn = doc.createElement('button');
    gearBtn.id = 'psnine-settings-gear';
    gearBtn.setAttribute('data-psnine-next', 'gear');
    gearBtn.setAttribute('type', 'button');
    gearBtn.setAttribute('title', 'PSNINE 设置');
    gearBtn.setAttribute('aria-label', 'PSNINE 设置');
    gearBtn.innerHTML = ICONS.gear;
    (doc.body || doc.documentElement).appendChild(gearBtn);
  }

  // 2. Inject into v2 user menu & mobile nav
  const injectNavMenu = () => {
    const targets = doc.querySelectorAll('.user-menu-list, .mobile-nav-panel nav, .nav-user .dropdown ul, .header .dropdown ul');
    targets.forEach(target => {
      if (!target.querySelector('#psnine-nav-settings-link')) {
        const item = doc.createElement('li');
        item.id = 'psnine-nav-settings-link';
        item.setAttribute('data-psnine-next', 'nav-link');
        const btn = doc.createElement('button');
        btn.setAttribute('type', 'button');
        btn.className = 'psnine-nav-settings-btn';
        btn.style.cssText = 'background:none; border:none; color:inherit; font:inherit; cursor:pointer; padding:6px 12px; width:100%; text-align:left; display:flex; align-items:center; gap:6px;';
        btn.innerHTML = `${ICONS.gear} <span>插件设置</span>`;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          openSettingsModal();
        });
        item.appendChild(btn);
        target.appendChild(item);
      }
    });
  };

  injectNavMenu();
  ctx.onContent(() => injectNavMenu());

  // 3. Modal open / close logic with focus trap & restore
  const closeSettingsModal = (force = false) => {
    if (isSaving && !force) return;
    if (modalBackdrop) {
      if (onKeyDownHandler) {
        doc.removeEventListener('keydown', onKeyDownHandler);
        onKeyDownHandler = null;
      }
      modalBackdrop.remove();
      modalBackdrop = null;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try {
          previouslyFocused.focus();
        } catch {}
      }
    }
  };

  const openSettingsModal = () => {
    if (modalBackdrop) return;
    isSaving = false;
    previouslyFocused = doc.activeElement as HTMLElement | null;

    modalBackdrop = doc.createElement('div');
    modalBackdrop.className = 'psnine-modal-backdrop';
    modalBackdrop.setAttribute('data-psnine-next', 'modal');

    // Close on backdrop click outside dialog
    modalBackdrop.addEventListener('click', (e) => {
      if (isSaving) return;
      if (e.target === modalBackdrop) {
        closeSettingsModal();
      }
    });

    const dialog = doc.createElement('div');
    dialog.className = 'psnine-settings-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'psnine-settings-title');

    // Header: concise title
    const header = doc.createElement('div');
    header.className = 'psnine-settings-header';
    header.innerHTML = `
      <h2 id="psnine-settings-title">PSNINE 设置</h2>
      <button class="psnine-settings-close" type="button" aria-label="关闭设置面板">${ICONS.close}</button>
    `;
    const closeBtn = header.querySelector('.psnine-settings-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => {
      if (isSaving) return;
      closeSettingsModal();
    });

    // Body
    const body = doc.createElement('div');
    body.className = 'psnine-settings-body';

    // If store backend is downgraded to MEMORY, display user-friendly warning banner
    if (store.backend === 'MEMORY') {
      const banner = doc.createElement('div');
      banner.className = 'psnine-settings-memory-warning';
      banner.setAttribute('data-psnine-next', 'memory-warning');
      banner.textContent = '提示：当前运行在内存临时存储模式（持久化存储受限），页面刷新后修改的设置可能会丢失。';
      body.appendChild(banner);
    }

    const current: Settings = { ...ctx.settings };

    let idCounter = 0;
    const createRow = (label: string, inputEl: HTMLElement, inputId: string): HTMLElement => {
      const row = doc.createElement('div');
      row.className = 'psnine-settings-row';
      const lbl = doc.createElement('label');
      lbl.className = 'psnine-settings-label';
      lbl.htmlFor = inputId;
      lbl.textContent = label;
      row.appendChild(lbl);
      row.appendChild(inputEl);
      return row;
    };

    const createSection = (title: string, defaultOpen = false): { details: HTMLDetailsElement; body: HTMLElement } => {
      const details = doc.createElement('details');
      details.className = 'psnine-settings-section';
      if (defaultOpen) {
        details.open = true;
      }
      const summary = doc.createElement('summary');
      summary.className = 'psnine-settings-summary';
      summary.textContent = title;
      details.appendChild(summary);

      const sectionBody = doc.createElement('div');
      sectionBody.className = 'psnine-settings-section-body';
      details.appendChild(sectionBody);

      return { details, body: sectionBody };
    };

    const createSwitch = (key: keyof Settings, label: string): HTMLElement => {
      const id = `psnine-setting-${key}-${++idCounter}`;
      const wrapper = doc.createElement('label');
      wrapper.className = 'psnine-switch';
      wrapper.htmlFor = id;

      const checkbox = doc.createElement('input');
      checkbox.id = id;
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(current[key]);
      checkbox.addEventListener('change', () => {
        (current as unknown as Record<string, unknown>)[key] = checkbox.checked;
      });

      const slider = doc.createElement('span');
      slider.className = 'psnine-slider';
      wrapper.appendChild(checkbox);
      wrapper.appendChild(slider);
      return createRow(label, wrapper, id);
    };

    const createNumberInput = (key: keyof Settings, label: string, min = 0, max = 9999, step = 1): HTMLElement => {
      const id = `psnine-setting-${key}-${++idCounter}`;
      const input = doc.createElement('input');
      input.id = id;
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(current[key] ?? 0);
      input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          (current as unknown as Record<string, unknown>)[key] = val;
        }
      });
      return createRow(label, input, id);
    };

    const createTextInput = (key: keyof Settings, label: string): HTMLElement => {
      const id = `psnine-setting-${key}-${++idCounter}`;
      const input = doc.createElement('input');
      input.id = id;
      input.type = 'text';
      const rawVal = current[key];
      input.value = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal ?? '');
      input.addEventListener('change', () => {
        if (Array.isArray(current[key])) {
          (current as unknown as Record<string, unknown>)[key] = input.value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          (current as unknown as Record<string, unknown>)[key] = input.value;
        }
      });
      return createRow(label, input, id);
    };

    const createColorInput = (key: keyof Settings, label: string): HTMLElement => {
      const id = `psnine-setting-${key}-${++idCounter}`;
      const input = doc.createElement('input');
      input.id = id;
      input.type = 'text';
      input.value = String(current[key] ?? '');
      input.addEventListener('change', () => {
        (current as unknown as Record<string, unknown>)[key] = input.value;
      });
      return createRow(label, input, id);
    };

    // SECTION 1: 外观主题与基础 (默认展开)
    const s1 = createSection('1. 外观主题与基础', true);

    const initialThemeMode = resolveThemeMode(current);

    const themeSelect = doc.createElement('select');
    themeSelect.id = 'psnine-setting-theme-mode';
    themeSelect.className = 'psnine-settings-select';

    const themeOptions: Array<{ label: string; value: 'SYSTEM' | 'LIGHT' | 'DARK' | 'TIME' }> = [
      { label: '跟随系统', value: 'SYSTEM' },
      { label: '浅色', value: 'LIGHT' },
      { label: '深色', value: 'DARK' },
      { label: '定时', value: 'TIME' }
    ];

    for (const opt of themeOptions) {
      const optEl = doc.createElement('option');
      optEl.value = opt.value;
      optEl.textContent = opt.label;
      if (initialThemeMode === opt.value) {
        optEl.selected = true;
      }
      themeSelect.appendChild(optEl);
    }

    const startRow = createNumberInput('nightStart', '深色模式开始小时 (0~23)', 0, 23);
    const endRow = createNumberInput('nightEnd', '深色模式结束小时 (0~23)', 0, 23);

    const updateScheduleVisibility = (mode: string) => {
      const isTime = mode === 'TIME';
      startRow.style.display = isTime ? '' : 'none';
      startRow.hidden = !isTime;
      endRow.style.display = isTime ? '' : 'none';
      endRow.hidden = !isTime;
    };

    themeSelect.addEventListener('change', () => {
      const mode = themeSelect.value;
      if (mode === 'SYSTEM') {
        current.autoNightMode = 'SYSTEM';
        current.nightMode = false;
      } else if (mode === 'TIME') {
        current.autoNightMode = 'TIME';
      } else if (mode === 'DARK') {
        current.autoNightMode = 'OFF';
        current.nightMode = true;
      } else if (mode === 'LIGHT') {
        current.autoNightMode = 'OFF';
        current.nightMode = false;
      }
      updateScheduleVisibility(mode);
    });

    updateScheduleVisibility(initialThemeMode);

    s1.body.appendChild(createRow('外观', themeSelect, 'psnine-setting-theme-mode'));
    s1.body.appendChild(startRow);
    s1.body.appendChild(endRow);
    s1.body.appendChild(createSwitch('hoverUnmark', '黑条剧透悬浮/点击反白'));
    body.appendChild(s1.details);

    // SECTION 2: 社区与回复
    const s2 = createSection('2. 社区互动与回帖', false);
    s2.body.appendChild(createSwitch('replyTraceback', '楼层 @回复内容回溯'));
    s2.body.appendChild(createSwitch('showReplyControls', '楼层回复按钮常显 (关闭则悬浮显示)'));
    s2.body.appendChild(createSwitch('hoverHomepage', '头像悬浮/轻触展示用户卡片'));
    s2.body.appendChild(createColorInput('highlightBack', '楼主高亮背景颜色'));
    s2.body.appendChild(createColorInput('highlightFront', '楼主高亮文字颜色'));
    s2.body.appendChild(createTextInput('highlightSpecificID', '特别关注/管理高亮用户ID (逗号分隔)'));
    s2.body.appendChild(createColorInput('highlightSpecificBack', '特定用户高亮背景颜色'));
    s2.body.appendChild(createColorInput('highlightSpecificFront', '特定用户高亮文字颜色'));
    s2.body.appendChild(createNumberInput('hotTagThreshold', '热门话题回帖阈值', 1, 999));
    s2.body.appendChild(createSwitch('expandCollapsedSubcomments', '视口内自动展开子评论'));
    body.appendChild(s2.details);

    // SECTION 3: 问答专区
    const s3 = createSection('3. 问答专区', false);
    s3.body.appendChild(createSwitch('newQaStatus', '问答状态图标与铜板悬赏展示'));
    s3.body.appendChild(createSwitch('showHiddenQASubReply', '展开问答折叠的子回复'));
    s3.body.appendChild(createSwitch('listQAAnswersByNew', '问答答案按最新优先排序'));
    s3.body.appendChild(createSwitch('showAllQAAnswers', '全量载入所有问答回答'));
    body.appendChild(s3.details);

    // SECTION 4: 屏蔽与过滤
    const s4 = createSection('4. 屏蔽与过滤', false);
    s4.body.appendChild(createTextInput('blockList', '用户黑名单列表 (逗号分隔)'));
    s4.body.appendChild(createTextInput('blockWordsList', '关键词屏蔽列表 (逗号分隔)'));
    s4.body.appendChild(createSwitch('blockWordsRegex', '屏蔽词启用正则表达式'));
    body.appendChild(s4.details);

    // SECTION 5: 游戏、奖杯与约战
    const s5 = createSection('5. 游戏、奖杯与约战', false);
    s5.body.appendChild(createSwitch('redirectToMine', '游戏页自动跳转至我的奖杯'));
    s5.body.appendChild(createNumberInput('filterNonePlatinumAlpha', '无白金游戏卡片透明度 (0~1)', 0, 1, 0.05));
    s5.body.appendChild(createSwitch('platinumGlow', '白金奖杯发光光晕特效'));
    s5.body.appendChild(createSwitch('foldTrophySummary', '默认折叠奖杯汇总列表'));
    s5.body.appendChild(createSwitch('foldTrophyChart', '默认折叠奖杯统计图表'));
    s5.body.appendChild(createSwitch('referGameVariants', '关联游戏多版本信息'));
    s5.body.appendChild(createSwitch('preferSearchForFindingVariants', '优先搜索查找同款版本'));
    s5.body.appendChild(createSwitch('removeHeaderInBattle', '约战页面隐藏发起人头像'));
    s5.body.appendChild(createSwitch('showGameProgressInBattle', '约战页面展示我的游戏完成度'));
    s5.body.appendChild(createNumberInput('BattleInfoUpdateInterval', '约战信息刷新间隔 (毫秒)', 60000, 86400000, 60000));
    body.appendChild(s5.details);

    // SECTION 6: 翻页与自动化
    const s6 = createSection('6. 翻页与自动化', false);
    s6.body.appendChild(createNumberInput('autoPaging', '列表自动向后翻页数 (0 为关闭)', 0, 50));
    s6.body.appendChild(createSwitch('autoPagingInHomepage', '个人主页游戏列表自动翻页'));
    s6.body.appendChild(createSwitch('listPostsByNew', '机因列表默认按最新排序'));
    s6.body.appendChild(createSwitch('autoCheckIn', '每日打开网站自动签到打卡'));
    body.appendChild(s6.details);

    // SECTION 7: 链接与数折汇率
    const s7 = createSection('7. 链接修复与数折汇率', false);
    s7.body.appendChild(createSwitch('fixTextLinks', '纯文本链接自动转换为可点击超链接'));
    s7.body.appendChild(createSwitch('fixD7VGLinks', '旧版 D7VG 域名链接自动修复'));
    s7.body.appendChild(createSwitch('fixHTTPLinks', '站内链接自动升级至 HTTPS'));
    s7.body.appendChild(createSwitch('currencyConversion', '数折外币折算人民币展示'));
    s7.body.appendChild(createTextInput('exchangeRateDate', '汇率有效基准日期 (手填，如 2026-09-30)'));

    const ratesId = `psnine-setting-exchangeRates-${++idCounter}`;
    const ratesInput = doc.createElement('textarea');
    ratesInput.id = ratesId;
    ratesInput.className = 'psnine-settings-textarea';
    ratesInput.value = JSON.stringify(current.exchangeRates || {}, null, 2);
    ratesInput.addEventListener('change', () => {
      try {
        const parsed = JSON.parse(ratesInput.value);
        if (typeof parsed === 'object' && parsed !== null) {
          current.exchangeRates = parsed;
        }
      } catch {
        // Invalid JSON
      }
    });
    s7.body.appendChild(createRow('自定义汇率表 (JSON 格式)', ratesInput, ratesId));
    body.appendChild(s7.details);

    // SECTION 8: 配置管理 (默认折叠)
    const s8 = createSection('8. 配置管理', false);
    const manageActions = doc.createElement('div');
    manageActions.className = 'psnine-settings-actions';

    const exportBtn = doc.createElement('button');
    exportBtn.className = 'psnine-btn';
    exportBtn.type = 'button';
    exportBtn.textContent = '导出配置';
    exportBtn.addEventListener('click', () => {
      const jsonStr = JSON.stringify(ctx.settings, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = blobUrl;
      a.download = `psnine-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    });

    const importBtn = doc.createElement('button');
    importBtn.className = 'psnine-btn';
    importBtn.type = 'button';
    importBtn.textContent = '导入配置';
    importBtn.addEventListener('click', () => {
      if (isSaving) return;
      const input = doc.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        if (isSaving) return;
        const file = input.files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const validated = validateSettings(parsed);
            isSaving = true;
            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            closeBtn.disabled = true;
            await store.set(SETTINGS_KEY, validated);
            Object.assign(ctx.settings, validated);
            try {
              applyTheme(ctx);
            } catch {}
            win.alert('配置导入成功！页面即将刷新。');
            closeSettingsModal(true);
            win.location.reload();
          } catch {
            isSaving = false;
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            closeBtn.disabled = false;
            win.alert('配置文件格式错误，无法解析！');
          }
        }
      });
      input.click();
    });

    const resetBtn = doc.createElement('button');
    resetBtn.className = 'psnine-btn psnine-btn-danger';
    resetBtn.type = 'button';
    resetBtn.textContent = '恢复默认';
    resetBtn.addEventListener('click', async () => {
      if (isSaving) return;
      if (win.confirm('确定将所有设置恢复为默认值吗？')) {
        isSaving = true;
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        closeBtn.disabled = true;
        try {
          await store.set(SETTINGS_KEY, defaultSettings);
          Object.assign(ctx.settings, defaultSettings);
          try {
            applyTheme(ctx);
          } catch {}
          closeSettingsModal(true);
          win.location.reload();
        } catch (err) {
          isSaving = false;
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
          closeBtn.disabled = false;
          win.alert('恢复默认设置失败，请重试：' + (err instanceof Error ? err.message : String(err)));
        }
      }
    });

    manageActions.appendChild(exportBtn);
    manageActions.appendChild(importBtn);
    manageActions.appendChild(resetBtn);
    s8.body.appendChild(manageActions);
    body.appendChild(s8.details);

    // Footer with Save and Cancel only
    const footer = doc.createElement('div');
    footer.className = 'psnine-settings-footer';

    const saveBtn = doc.createElement('button');
    saveBtn.className = 'psnine-btn psnine-btn-primary';
    saveBtn.type = 'button';
    saveBtn.textContent = '保存配置';

    const cancelBtn = doc.createElement('button');
    cancelBtn.className = 'psnine-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';

    saveBtn.addEventListener('click', async () => {
      if (isSaving) return;
      isSaving = true;
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      closeBtn.disabled = true;
      const originalSaveText = saveBtn.textContent;
      saveBtn.textContent = '保存中...';

      try {
        const validated = validateSettings(current);
        await store.set(SETTINGS_KEY, validated);
        Object.assign(ctx.settings, validated);
        try {
          applyTheme(ctx);
        } catch {}
        closeSettingsModal(true);
        win.location.reload();
      } catch (err) {
        isSaving = false;
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        closeBtn.disabled = false;
        saveBtn.textContent = originalSaveText;
        win.alert('保存设置失败，请重试：' + (err instanceof Error ? err.message : String(err)));
      }
    });

    cancelBtn.addEventListener('click', () => {
      if (isSaving) return;
      closeSettingsModal();
    });

    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    modalBackdrop.appendChild(dialog);
    (doc.body || doc.documentElement).appendChild(modalBackdrop);

    // Focus trap & Escape listener for closing modal
    onKeyDownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isSaving) return;
        closeSettingsModal();
        return;
      }

      if (isSaving) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        )).filter(el => {
          return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
        });

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (doc.activeElement === first || !dialog.contains(doc.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (doc.activeElement === last || !dialog.contains(doc.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    doc.addEventListener('keydown', onKeyDownHandler);

    // Initial focus on close button
    closeBtn.focus();
  };

  if (!gearBtn.hasAttribute('data-psnine-bound')) {
    gearBtn.setAttribute('data-psnine-bound', 'true');
    gearBtn.addEventListener('click', openSettingsModal);
  }
}
