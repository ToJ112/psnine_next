import { Context, Settings, defaultSettings } from './types';
import { SETTINGS_KEY, validateSettings } from './store';
import { ICONS } from '../styles';

/**
 * Injects the in-page settings panel and triggers (G07).
 * Implements accessible focus management, Escape closing, label association,
 * and comprehensive coverage of all planned settings.
 */
export function mountSettingsUI(ctx: Context): void {
  const { document: doc, window: win, store } = ctx;

  let previouslyFocused: HTMLElement | null = null;
  let modalBackdrop: HTMLElement | null = null;

  // 1. Create floating gear button (standard <button> for accessibility)
  let gearBtn = doc.getElementById('psnine-settings-gear') as HTMLButtonElement | null;
  if (!gearBtn) {
    gearBtn = doc.createElement('button');
    gearBtn.id = 'psnine-settings-gear';
    gearBtn.setAttribute('data-psnine-next', 'gear');
    gearBtn.setAttribute('type', 'button');
    gearBtn.setAttribute('title', 'PSNINE 增强设置');
    gearBtn.setAttribute('aria-label', 'PSNINE 增强设置');
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
  const closeSettingsModal = () => {
    if (modalBackdrop) {
      modalBackdrop.remove();
      modalBackdrop = null;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    }
  };

  const openSettingsModal = () => {
    if (modalBackdrop) return;
    previouslyFocused = doc.activeElement as HTMLElement | null;

    modalBackdrop = doc.createElement('div');
    modalBackdrop.className = 'psnine-modal-backdrop';
    modalBackdrop.setAttribute('data-psnine-next', 'modal');

    // Close on backdrop click outside dialog
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeSettingsModal();
      }
    });

    const dialog = doc.createElement('div');
    dialog.className = 'psnine-settings-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'psnine-settings-title');

    // Header
    const header = doc.createElement('div');
    header.className = 'psnine-settings-header';
    header.innerHTML = `
      <h2 id="psnine-settings-title">PSNINE 增强插件设置 (Next)</h2>
      <button class="psnine-settings-close" type="button" aria-label="关闭设置面板">${ICONS.close}</button>
    `;
    const closeBtn = header.querySelector('.psnine-settings-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', closeSettingsModal);

    // Body
    const body = doc.createElement('div');
    body.className = 'psnine-settings-body';

    // If store backend is downgraded to MEMORY, display user-friendly warning banner
    if (store.backend === 'MEMORY') {
      const banner = doc.createElement('div');
      banner.className = 'psnine-settings-memory-warning';
      banner.setAttribute('data-psnine-next', 'memory-warning');
      banner.style.cssText = 'background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:8px 12px; margin-bottom:12px; border-radius:4px; font-size:13px;';
      banner.textContent = '提示：当前运行在内存临时存储模式（持久化存储受限），页面刷新后修改的设置可能会丢失。';
      body.appendChild(banner);
    }

    const current: Settings = { ...ctx.settings };

    let idCounter = 0;
    const createRow = (label: string, inputEl: HTMLElement, inputId: string): HTMLElement => {
      const row = doc.createElement('div');
      row.className = 'psnine-settings-row';
      const lbl = doc.createElement('label');
      lbl.htmlFor = inputId;
      lbl.textContent = label;
      row.appendChild(lbl);
      row.appendChild(inputEl);
      return row;
    };

    const createSectionHeader = (title: string): HTMLElement => {
      const h3 = doc.createElement('h3');
      h3.style.cssText = 'font-size:15px; margin:16px 0 6px 0; color:#3498db; border-bottom:1px solid #e1e8ed; padding-bottom:4px;';
      h3.textContent = title;
      return h3;
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
      input.style.width = '120px';
      input.value = String(current[key] ?? '');
      input.addEventListener('change', () => {
        (current as unknown as Record<string, unknown>)[key] = input.value;
      });
      return createRow(label, input, id);
    };

    const createSelect = (key: keyof Settings, label: string, options: Array<{ label: string; value: string }>): HTMLElement => {
      const id = `psnine-setting-${key}-${++idCounter}`;
      const select = doc.createElement('select');
      select.id = id;
      for (const opt of options) {
        const optionEl = doc.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        if (String(current[key]) === opt.value) {
          optionEl.selected = true;
        }
        select.appendChild(optionEl);
      }
      select.addEventListener('change', () => {
        (current as unknown as Record<string, unknown>)[key] = select.value;
      });
      return createRow(label, select, id);
    };

    // SECTION 1: 主题与基础
    body.appendChild(createSectionHeader('1. 外观主题与基础'));
    body.appendChild(createSwitch('nightMode', '深色模式手动开关'));
    body.appendChild(createSelect('autoNightMode', '自动深色模式', [
      { label: '跟随系统 (SYSTEM)', value: 'SYSTEM' },
      { label: '定时切换 (TIME)', value: 'TIME' },
      { label: '关闭 (OFF)', value: 'OFF' }
    ]));
    body.appendChild(createNumberInput('nightStart', '深色模式开始小时 (0~23)', 0, 23));
    body.appendChild(createNumberInput('nightEnd', '深色模式结束小时 (0~23)', 0, 23));
    body.appendChild(createSwitch('hoverUnmark', '黑条剧透悬浮/点击反白'));

    // SECTION 2: 社区与回复
    body.appendChild(createSectionHeader('2. 社区互动与回帖'));
    body.appendChild(createSwitch('replyTraceback', '楼层 @回复内容回溯'));
    body.appendChild(createSwitch('showReplyControls', '楼层回复按钮常显 (关闭则悬浮显示)'));
    body.appendChild(createSwitch('hoverHomepage', '头像悬浮/轻触展示用户卡片'));
    body.appendChild(createColorInput('highlightBack', '楼主高亮背景颜色'));
    body.appendChild(createColorInput('highlightFront', '楼主高亮文字颜色'));
    body.appendChild(createTextInput('highlightSpecificID', '特别关注/管理高亮用户ID (逗号分隔)'));
    body.appendChild(createColorInput('highlightSpecificBack', '特定用户高亮背景颜色'));
    body.appendChild(createColorInput('highlightSpecificFront', '特定用户高亮文字颜色'));
    body.appendChild(createNumberInput('hotTagThreshold', '热门话题回帖阈值', 1, 999));
    body.appendChild(createSwitch('expandCollapsedSubcomments', '视口内自动展开子评论'));

    // SECTION 3: 问答专区
    body.appendChild(createSectionHeader('3. 问答专区'));
    body.appendChild(createSwitch('newQaStatus', '问答状态图标与铜板悬赏展示'));
    body.appendChild(createSwitch('showHiddenQASubReply', '展开问答折叠的子回复'));
    body.appendChild(createSwitch('listQAAnswersByNew', '问答答案按最新优先排序'));
    body.appendChild(createSwitch('showAllQAAnswers', '全量载入所有问答回答'));

    // SECTION 4: 屏蔽与过滤
    body.appendChild(createSectionHeader('4. 屏蔽与过滤'));
    body.appendChild(createTextInput('blockList', '用户黑名单列表 (逗号分隔)'));
    body.appendChild(createTextInput('blockWordsList', '关键词屏蔽列表 (逗号分隔)'));
    body.appendChild(createSwitch('blockWordsRegex', '屏蔽词启用正则表达式'));

    // SECTION 5: 游戏、奖杯与约战
    body.appendChild(createSectionHeader('5. 游戏、奖杯与约战'));
    body.appendChild(createSwitch('redirectToMine', '游戏页自动跳转至我的奖杯'));
    body.appendChild(createNumberInput('filterNonePlatinumAlpha', '无白金游戏卡片透明度 (0~1)', 0, 1, 0.05));
    body.appendChild(createSwitch('platinumGlow', '白金奖杯发光光晕特效'));
    body.appendChild(createSwitch('foldTrophySummary', '默认折叠奖杯汇总列表'));
    body.appendChild(createSwitch('foldTrophyChart', '默认折叠奖杯统计图表'));
    body.appendChild(createSwitch('referGameVariants', '关联游戏多版本信息'));
    body.appendChild(createSwitch('preferSearchForFindingVariants', '优先搜索查找同款版本'));
    body.appendChild(createSwitch('removeHeaderInBattle', '约战页面隐藏发起人头像'));
    body.appendChild(createSwitch('showGameProgressInBattle', '约战页面展示我的游戏完成度'));
    body.appendChild(createNumberInput('BattleInfoUpdateInterval', '约战信息刷新间隔 (毫秒)', 60000, 86400000, 60000));

    // SECTION 6: 翻页与自动化
    body.appendChild(createSectionHeader('6. 翻页与自动化'));
    body.appendChild(createNumberInput('autoPaging', '列表自动向后翻页数 (0 为关闭)', 0, 50));
    body.appendChild(createSwitch('autoPagingInHomepage', '个人主页游戏列表自动翻页'));
    body.appendChild(createSwitch('listPostsByNew', '机因列表默认按最新排序'));
    body.appendChild(createSwitch('autoCheckIn', '每日打开网站自动签到打卡'));

    // SECTION 7: 链接与数折汇率
    body.appendChild(createSectionHeader('7. 链接修复与数折汇率'));
    body.appendChild(createSwitch('fixTextLinks', '纯文本链接自动转换为可点击超链接'));
    body.appendChild(createSwitch('fixD7VGLinks', '旧版 D7VG 域名链接自动修复'));
    body.appendChild(createSwitch('fixHTTPLinks', '站内链接自动升级至 HTTPS'));
    body.appendChild(createSwitch('currencyConversion', '数折外币折算人民币展示'));
    body.appendChild(createTextInput('exchangeRateDate', '汇率有效基准日期 (手填，如 2026-09-30)'));

    // 手填汇率字典支持
    const ratesId = `psnine-setting-exchangeRates-${++idCounter}`;
    const ratesInput = doc.createElement('textarea');
    ratesInput.id = ratesId;
    ratesInput.style.cssText = 'font-size:14px; width:200px; height:60px; font-family:monospace;';
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
    body.appendChild(createRow('自定义汇率表 (JSON 格式)', ratesInput, ratesId));

    // Footer with Save, Reset, Import, Export
    const footer = doc.createElement('div');
    footer.className = 'psnine-settings-footer';

    const saveBtn = doc.createElement('button');
    saveBtn.className = 'psnine-btn psnine-btn-primary';
    saveBtn.type = 'button';
    saveBtn.textContent = '保存配置';
    saveBtn.addEventListener('click', async () => {
      const validated = validateSettings(current);
      await store.set(SETTINGS_KEY, validated);
      Object.assign(ctx.settings, validated);
      closeSettingsModal();
      win.location.reload();
    });

    const cancelBtn = doc.createElement('button');
    cancelBtn.className = 'psnine-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', closeSettingsModal);

    const resetBtn = doc.createElement('button');
    resetBtn.className = 'psnine-btn psnine-btn-danger';
    resetBtn.type = 'button';
    resetBtn.textContent = '恢复默认';
    resetBtn.addEventListener('click', async () => {
      if (win.confirm('确定将所有设置恢复为默认值吗？')) {
        await store.set(SETTINGS_KEY, defaultSettings);
        Object.assign(ctx.settings, defaultSettings);
        closeSettingsModal();
        win.location.reload();
      }
    });

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
      const input = doc.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const validated = validateSettings(parsed);
            await store.set(SETTINGS_KEY, validated);
            Object.assign(ctx.settings, validated);
            win.alert('配置导入成功！页面即将刷新。');
            win.location.reload();
          } catch {
            win.alert('配置文件格式错误，无法解析！');
          }
        }
      });
      input.click();
    });

    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
    footer.appendChild(exportBtn);
    footer.appendChild(importBtn);
    footer.appendChild(resetBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    modalBackdrop.appendChild(dialog);
    (doc.body || doc.documentElement).appendChild(modalBackdrop);

    // Escape listener for closing modal
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettingsModal();
        doc.removeEventListener('keydown', onKeyDown);
      }
    };
    doc.addEventListener('keydown', onKeyDown);

    // Focus close button initially
    closeBtn.focus();
  };

  gearBtn.addEventListener('click', openSettingsModal);
}
