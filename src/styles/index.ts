/**
 * Self-contained styles and inline SVGs for psnine_next.
 * Zero external font, image, or stylesheet dependencies.
 */

export const ICONS = {
  gear: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#28a745"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  coins: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f39c12"><path d="M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5zm0 2c4.42 0 8 1.79 8 3s-3.58 3-8 3-8-1.79-8-3 3.58-3 8-3zm0 16c-4.42 0-8-1.79-8-3v-2.22c1.78 1.34 4.67 2.22 8 2.22s6.22-.88 8-2.22V17c0 1.21-3.58 3-8 3zm0-5c-4.42 0-8-1.79-8-3v-2.22c1.78 1.34 4.67 2.22 8 2.22s6.22-.88 8-2.22V12c0 1.21-3.58 3-8 3z"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>`
};

export const CORE_STYLES = `
/* psnine_next Core Base Tokens & Styles (aligned with PSNINE v2) */
:root {
  --p9n-bg: var(--c-bg, #f4f6fa);
  --p9n-surface: var(--c-card, #ffffff);
  --p9n-surface-alt: var(--c-bg, #f8fafc);
  --p9n-text: var(--c-text, #1f2937);
  --p9n-muted: var(--c-text-2, #5f6b7a);
  --p9n-border: var(--c-line, #ccd6dd);
  --p9n-link: var(--c-brand, #1966c2);
  --p9n-primary: #1d4ed8;
  --p9n-radius-sm: var(--r-sm, 4px);
  --p9n-radius-md: var(--r-md, 8px);
}

[data-psnine-next]:where(:not(.psnine-nav-settings-link)) {
  box-sizing: border-box;
}

/* Base button styling */
.psnine-btn,
[data-psnine-next] button:where(:not(.psnine-settings-close)),
button[data-psnine-next]:where(:not(.psnine-settings-close)) {
  color: var(--p9n-text);
  background-color: var(--p9n-surface);
  border: 1px solid var(--p9n-border);
  padding: 6px 14px;
  font-size: 14px;
  border-radius: var(--p9n-radius-sm, 6px);
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.psnine-btn.psnine-btn-primary,
[data-psnine-next] button.psnine-btn-primary,
button[data-psnine-next].psnine-btn-primary {
  color: #ffffff !important;
  background-color: var(--p9n-primary) !important;
  border-color: var(--p9n-primary) !important;
}

.psnine-btn.psnine-btn-danger,
[data-psnine-next] button.psnine-btn-danger,
button[data-psnine-next].psnine-btn-danger {
  color: #e74c3c !important;
  background-color: var(--p9n-surface) !important;
  border-color: #e74c3c !important;
}

/* Floating Action Buttons (.float-btn native style) */
#psnine-settings-gear,
#psnine-scrollbottom {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  width: 44px;
  height: 44px;
  padding: 0 !important;
  border-radius: var(--r-md, var(--p9n-radius-md, 8px)) !important;
  background-color: var(--c-card, var(--p9n-surface)) !important;
  color: var(--c-text-2, var(--p9n-muted)) !important;
  border: 1px solid var(--c-line, var(--p9n-border)) !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 40 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  touch-action: manipulation;
  box-sizing: border-box;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
#psnine-settings-gear {
  bottom: max(20px, env(safe-area-inset-bottom));
}
#psnine-scrollbottom {
  bottom: calc(max(20px, env(safe-area-inset-bottom)) + 52px);
}
#psnine-settings-gear:hover,
#psnine-scrollbottom:hover {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-link) !important;
  border-color: var(--p9n-link) !important;
}

/* When merged into native .float-layer */
.float-layer > #psnine-settings-gear,
.float-layer > #psnine-scrollbottom {
  position: static !important;
  width: 46px !important;
  height: 46px !important;
  min-width: 46px !important;
  min-height: 46px !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: var(--r-md, 8px) !important;
  box-shadow: none !important;
}
@media (min-width: 769px) {
  .float-layer > #psnine-settings-gear,
  .float-layer > #psnine-scrollbottom {
    width: 52px !important;
    height: 52px !important;
    min-width: 52px !important;
    min-height: 52px !important;
  }
}

/* Nav menu trigger cursor */
.psnine-nav-settings-btn,
a.psnine-nav-settings-link {
  cursor: pointer;
  touch-action: manipulation;
}

/* Settings Modal Backdrop & Dialog */
.psnine-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  box-sizing: border-box;
  overflow: hidden;
}
.psnine-settings-dialog {
  background: var(--p9n-surface);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-md, 12px);
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  box-sizing: border-box;
}
.psnine-settings-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--p9n-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
}
.psnine-settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--p9n-text);
}
.psnine-settings-close {
  background: transparent !important;
  border: none !important;
  cursor: pointer;
  color: var(--p9n-muted) !important;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--p9n-radius-sm, 6px);
}
.psnine-settings-close:hover {
  color: var(--p9n-text) !important;
  background: rgba(128, 128, 128, 0.15) !important;
}
.psnine-settings-body {
  padding: 14px 16px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}
.psnine-settings-section {
  border-bottom: 1px solid var(--p9n-border);
  margin-bottom: 8px;
}
.psnine-settings-section[open] {
  margin-bottom: 12px;
}
.psnine-settings-summary {
  font-size: 15px;
  font-weight: 600;
  color: var(--p9n-link);
  padding: 10px 0;
  cursor: pointer;
  user-select: none;
}
.psnine-settings-summary:hover {
  color: var(--p9n-text);
}
.psnine-settings-summary:focus {
  outline: none;
}
.psnine-settings-summary:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 2px;
  border-radius: var(--p9n-radius-sm, 4px);
}
.psnine-settings-section-body {
  padding: 2px 0 8px 0;
}
.psnine-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--p9n-border);
  min-height: 44px;
  box-sizing: border-box;
  gap: 12px;
}
.psnine-settings-row > .psnine-settings-label,
.psnine-settings-row > label:where(:not(.psnine-switch)) {
  font-size: 14px;
  font-weight: 500;
  flex: 1 1 auto;
  min-width: 0;
  color: var(--p9n-text);
  padding-right: 8px;
  line-height: 1.4;
}
.psnine-settings-row input[type="text"],
.psnine-settings-row input[type="number"],
.psnine-settings-row select,
.psnine-settings-row textarea {
  font-size: 16px !important;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-sm, 6px);
  background: var(--p9n-surface);
  color: var(--p9n-text);
  box-sizing: border-box;
  max-width: 220px;
}
#psnine-setting-theme-mode {
  font-size: 16px !important;
  min-height: 40px;
  padding: 8px 12px;
  background: var(--p9n-surface);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-sm, 6px);
}
.psnine-settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
}
.psnine-settings-memory-warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: var(--p9n-radius-sm, 6px);
  font-size: 13px;
  line-height: 1.5;
}
.psnine-settings-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--p9n-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--p9n-surface-alt);
  flex: 0 0 auto;
  gap: 12px;
}
.psnine-settings-footer .psnine-btn {
  min-height: 44px !important;
  min-width: 80px;
  padding: 8px 18px !important;
  font-size: 16px !important;
  font-weight: 500;
  border-radius: var(--p9n-radius-md, 8px) !important;
}

/* iOS-Style Toggle Switch */
.psnine-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 48px !important;
  height: 44px !important;
  flex: 0 0 48px !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box;
  cursor: pointer;
  touch-action: manipulation;
}
.psnine-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
}
.psnine-slider {
  position: absolute;
  cursor: pointer;
  top: 8px;
  left: 0;
  width: 48px;
  height: 28px;
  background-color: var(--p9n-border);
  transition: background-color 0.25s ease;
  border-radius: 28px;
  box-sizing: border-box;
}
.psnine-slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: transform 0.25s ease;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.psnine-switch input:checked + .psnine-slider {
  background-color: #2ecc71;
}
.psnine-switch input:checked + .psnine-slider:before {
  transform: translateX(20px);
}
.psnine-switch input:focus-visible + .psnine-slider {
  outline: 2px solid var(--p9n-link);
  outline-offset: 2px;
}

/* Floor Number & Author Badges */
.psnine-floor-badge {
  display: inline-block;
  font-size: 12px;
  color: var(--p9n-muted);
  margin-right: 6px;
  user-select: none;
}

/* Game List Progress Badge (P06: Neutral, Accessible Contrast >= 4.5:1) */
.psnine-game-list-progress-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 500;
  border-radius: var(--p9n-radius-sm, 4px);
  background-color: var(--p9n-surface-alt, #f4f6fa);
  color: var(--p9n-text, #1f2937);
  border: 1px solid var(--p9n-border, #ccd6dd);
  margin-left: 6px;
  vertical-align: middle;
  box-sizing: border-box;
}

.psnine-author-badge {
  display: inline-block;
  background: var(--p9n-link);
  color: #ffffff;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: var(--p9n-radius-sm, 4px);
  margin-left: 5px;
  vertical-align: middle;
}

/* Reply Traceback Card */
.psnine-traceback-card {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--p9n-surface-alt);
  border-left: 3px solid var(--p9n-link);
  border-radius: var(--p9n-radius-sm, 4px);
  font-size: 13px;
}
.psnine-traceback-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--p9n-text);
  margin-bottom: 4px;
}
.psnine-traceback-content {
  color: var(--p9n-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Hot Tag */
.psnine-hot-badge {
  display: inline-block;
  background: #e74c3c;
  color: #fff;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: bold;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: middle;
}

/* Q&A Status Icons */
.psnine-qa-status {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  vertical-align: middle;
}

/* Trophy Module V2 Native Card & Outline Pill Styles */
.psnine-trophy-panel,
#psnine-trophy-stats-panel {
  background-color: var(--p9n-surface);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-md, 8px);
  padding: 14px 16px;
  margin: 12px 0;
  box-sizing: border-box;
}

.psnine-trophy-overview-top {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}

.psnine-trophy-card-hd,
#psnine-trophy-header-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--p9n-text);
}
.psnine-trophy-title-text {
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}
.psnine-trophy-completion,
#psnine-trophy-header-counts {
  white-space: nowrap;
  font-size: 12px;
  color: var(--p9n-muted);
  font-weight: normal;
}
#psnine-trophy-completion-badge {
  font-size: 11px;
  font-weight: normal;
  line-height: 1.4;
  color: var(--p9n-muted);
}

.psnine-trophy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 12px;
}

.psnine-trophy-action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* Neutral outline pill button (at least 36px touch height) */
.psnine-trophy-pill-btn,
.psnine-pill-btn,
.psnine-trophy-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 18px;
  border: 1px solid var(--p9n-border);
  background-color: var(--p9n-surface);
  color: var(--p9n-text);
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
  text-decoration: none;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.psnine-trophy-pill-btn:hover:not(:disabled),
.psnine-pill-btn:hover:not(:disabled),
.psnine-trophy-toolbar button:hover:not(:disabled) {
  background-color: var(--p9n-surface-alt);
  border-color: var(--p9n-link);
  color: var(--p9n-link);
}
.psnine-trophy-pill-btn.active,
.psnine-trophy-pill-btn[aria-pressed="true"],
.psnine-pill-btn.active,
.psnine-trophy-toolbar button.active,
.psnine-trophy-toolbar button[aria-pressed="true"] {
  background-color: var(--p9n-surface-alt);
  border-color: var(--p9n-link);
  color: var(--p9n-link);
  font-weight: 600;
}
.psnine-trophy-pill-btn.danger,
.psnine-trophy-pill-btn.psnine-btn-danger,
.psnine-trophy-toolbar button.danger,
.psnine-trophy-toolbar button.psnine-btn-danger {
  color: #e74c3c !important;
  border-color: #e74c3c !important;
  background-color: var(--p9n-surface) !important;
}
.psnine-trophy-pill-btn:disabled,
.psnine-pill-btn:disabled,
.psnine-trophy-toolbar button:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  pointer-events: none;
}

/* Trophy Charts grid & sections */
.psnine-trophy-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin: 10px 0;
}
.psnine-trophy-chart-section {
  padding: 12px 0;
  border: none;
  border-top: 1px solid var(--p9n-border);
  border-radius: 0;
  background-color: transparent;
  color: var(--p9n-text);
  box-sizing: border-box;
}

/* Trophy Icon thumbnail chip */
.psnine-trophy-chip,
.psnine-trophy-icon-chip {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: var(--p9n-radius-sm, 4px);
  border: 1px solid var(--p9n-border);
  background-color: transparent !important;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  box-sizing: border-box;
}
.psnine-trophy-chip.earned,
.psnine-trophy-icon-chip.earned,
.psnine-trophy-icon-chip[style*="#28a745"],
.psnine-trophy-icon-chip[style*="rgb(40, 167, 69)"] {
  border-color: #28a745 !important;
  opacity: 1 !important;
}
.psnine-trophy-chip.unearned,
.psnine-trophy-icon-chip.unearned {
  opacity: 0.6;
}

/* Trophy Preview Card */
.psnine-trophy-preview-card,
#psnine-trophy-preview-card {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: var(--p9n-surface-alt);
  border: 1px solid var(--p9n-border);
  border-radius: var(--p9n-radius-sm, 6px);
  font-size: 12px;
  color: var(--p9n-text);
  box-sizing: border-box;
}

/* Trophy Tip Row */
.psnine-trophy-tip-row {
  padding: 10px 14px;
  background-color: var(--p9n-surface-alt);
  border-bottom: 1px solid var(--p9n-border);
  color: var(--p9n-text);
  font-size: 12px;
}

/* Filtered Tip Reveal Button */
.psnine-trophy-filtered-btn,
.psnine-filtered-tip-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  background-color: var(--p9n-surface);
  color: var(--p9n-muted);
  font-size: 11px;
  border-radius: var(--p9n-radius-sm, 4px);
  border: 1px dashed var(--p9n-border);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}

/* Native Sort Dropdown */
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] {
  position: relative;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"] {
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] {
  display: none;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"]:not([data-psnine-dropdown-state="closed"]).hover > ul[data-psnine-trophy-sort-menu="true"],
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"].psnine-dropdown-open > ul[data-psnine-trophy-sort-menu="true"],
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"][data-psnine-dropdown-state="open"] > ul[data-psnine-trophy-sort-menu="true"] {
  display: block !important;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"][data-psnine-dropdown-state="closed"] > ul[data-psnine-trophy-sort-menu="true"] {
  display: none !important;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a {
  color: #dbe4ee !important;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li[data-psnine-sort-item] > a {
  cursor: pointer;
  touch-action: manipulation;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff !important;
  text-decoration: none;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a.current,
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a[data-psnine-sort-active="true"] {
  background-color: rgba(56, 144, 255, 0.24) !important;
  color: #ffffff !important;
  font-weight: 600;
  text-decoration: none;
}
ul.dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > ul[data-psnine-trophy-sort-menu="true"] > li > a:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: -2px;
}

/* Spoiler Bar (.mark) Light Mode Rules (G04) */
.mark {
  background-color: #2c3e50 !important;
  color: #2c3e50 !important;
  border-radius: 2px;
  cursor: pointer;
  user-select: none;
  padding: 1px 4px;
}
.mark.unmasked,
.mark.pinned {
  color: #ffffff !important;
  user-select: text;
}
.mark strong,
.mark b,
.mark em,
.mark i,
.mark a,
.mark a:visited,
.mark span,
.mark [style*="color"],
.mark * {
  color: inherit !important;
  background-color: transparent !important;
}
`;

export const DARK_THEME_STYLES = `
/* psnine_next Dark Theme Tokens */
html[data-theme="dark"],
body[data-theme="dark"],
html[data-theme="dark"] body {
  --p9n-bg: var(--c-bg, #10151d);
  --p9n-surface: var(--c-card, #1a222d);
  --p9n-surface-alt: var(--c-bg, #202c3a);
  --p9n-text: var(--c-text, #e6ebf2);
  --p9n-muted: var(--c-text-2, #a8b3c2);
  --p9n-border: var(--c-line, #3b4859);
  --p9n-link: var(--c-brand, #91bdff);
  --p9n-primary: #1d4ed8;
}

/* Page Background & Base Text (scoped with html[data-theme="dark"]) */
html[data-theme="dark"] body.bg,
html[data-theme="dark"] body[data-theme="dark"],
html[data-theme="dark"] body,
body[data-theme="dark"] {
  background-color: #10151d !important;
  color: #e6ebf2 !important;
}

/* Floating Action Buttons in Dark Mode */
html[data-theme="dark"] #psnine-settings-gear,
html[data-theme="dark"] #psnine-scrollbottom {
  padding: 0 !important;
  background-color: var(--c-card, var(--p9n-surface)) !important;
  color: var(--c-text-2, var(--p9n-muted)) !important;
  border: 1px solid var(--c-line, var(--p9n-border)) !important;
  border-radius: var(--r-md, var(--p9n-radius-md, 8px)) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

html[data-theme="dark"] .float-layer > #psnine-settings-gear,
html[data-theme="dark"] .float-layer > #psnine-scrollbottom {
  position: static !important;
  background-color: var(--c-card, var(--p9n-surface)) !important;
  color: var(--c-text-2, var(--p9n-muted)) !important;
  border: 1px solid var(--c-line, var(--p9n-border)) !important;
  box-shadow: none !important;
}

/* Structural Panels & Containers */
html[data-theme="dark"] .box,
html[data-theme="dark"] .content,
html[data-theme="dark"] .header,
html[data-theme="dark"] .footer,
html[data-theme="dark"] .dropdown ul,
html[data-theme="dark"] .mobile-nav-panel {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Navigation (.inav) */
html[data-theme="dark"] .inav {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .inav li a {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .inav li.current,
html[data-theme="dark"] .inav li.current a {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-text) !important;
}

/* Pagination (.page li a) */
html[data-theme="dark"] .page li a {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-link) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .page li.current a {
  background-color: var(--p9n-primary) !important;
  color: #ffffff !important;
  border-color: var(--p9n-primary) !important;
}

/* Lists and Tables */
html[data-theme="dark"] .list,
html[data-theme="dark"] table.list,
html[data-theme="dark"] .sonlist {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .list li,
html[data-theme="dark"] .sonlist li,
html[data-theme="dark"] table.list tr,
html[data-theme="dark"] table.list td:where(:not(.t1):not(.t2):not(.t3):not(.t4)),
html[data-theme="dark"] table.list th,
html[data-theme="dark"] .box .post {
  background-color: transparent !important;
  color: var(--p9n-text) !important;
  border-bottom: 1px solid var(--p9n-border) !important;
}
html[data-theme="dark"] .list li:hover,
html[data-theme="dark"] table.list tr:hover {
  background-color: var(--p9n-surface-alt) !important;
}

/* Trophy Grade Cell Backgrounds (preserve t1/t2/t3/t4 grade colors) */
html[data-theme="dark"] table.list td.t1,
html[data-theme="dark"] .t1 {
  background-color: #3b4d71 !important;
}
html[data-theme="dark"] table.list td.t2,
html[data-theme="dark"] .t2 {
  background-color: #5c4528 !important;
}
html[data-theme="dark"] table.list td.t3,
html[data-theme="dark"] .t3 {
  background-color: #4a4f57 !important;
}
html[data-theme="dark"] table.list td.t4,
html[data-theme="dark"] .t4 {
  background-color: #5a3826 !important;
}
html[data-theme="dark"] table.list td.t1 a,
html[data-theme="dark"] table.list td.t2 a,
html[data-theme="dark"] table.list td.t3 a,
html[data-theme="dark"] table.list td.t4 a {
  color: #ffffff !important;
}

/* Known pale yellow inline table in .content (.tbl) */
html[data-theme="dark"] .content table.tbl,
html[data-theme="dark"] .content table.tbl tr,
html[data-theme="dark"] .content table.tbl td,
html[data-theme="dark"] .content table.tbl th,
html[data-theme="dark"] table.tbl,
html[data-theme="dark"] table.tbl tr,
html[data-theme="dark"] table.tbl td,
html[data-theme="dark"] table.tbl th {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Typography */
html[data-theme="dark"] h1,
html[data-theme="dark"] h2,
html[data-theme="dark"] h3,
html[data-theme="dark"] .text-strong {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] strong:where(:not([class*="alert-"]):not([class*="alert-"] *)),
html[data-theme="dark"] b:where(:not([class*="alert-"]):not([class*="alert-"] *)) {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] em:where(:not([class*="alert-"]):not([class*="alert-"] *)) {
  color: var(--p9n-muted) !important;
}

/* Generic links: Exclude native navs/headers, semantic grade text, buttons, and inline-colored links */
html[data-theme="dark"] a:where(:not(.btn):not(.text-platinum):not(.text-gold):not(.text-silver):not(.text-bronze):not([style*="color"]):not(.mobile-nav-panel *):not(.user-menu-list *):not(.site-nav *):not(#header *):not(.header *):not(#pcmenu *)) {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] a:visited:where(:not(.btn):not(.text-platinum):not(.text-gold):not(.text-silver):not(.text-bronze):not([style*="color"]):not(.mobile-nav-panel *):not(.user-menu-list *):not(.site-nav *):not(#header *):not(.header *):not(#pcmenu *)) {
  color: #c4b5fd !important;
}

/* Semantic Trophy Rarity Colors */
html[data-theme="dark"] .text-platinum,
html[data-theme="dark"] a.text-platinum {
  color: #70b8ff !important;
}
html[data-theme="dark"] .text-gold,
html[data-theme="dark"] a.text-gold {
  color: #ffd166 !important;
}
html[data-theme="dark"] .text-silver,
html[data-theme="dark"] a.text-silver {
  color: #d1d5db !important;
}
html[data-theme="dark"] .text-bronze,
html[data-theme="dark"] a.text-bronze {
  color: #f4a261 !important;
}

html[data-theme="dark"] .psnnode {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-text) !important;
}

/* Form Controls (exclude color and checkbox) */
html[data-theme="dark"] input[type="text"],
html[data-theme="dark"] input[type="number"],
html[data-theme="dark"] input[type="search"],
html[data-theme="dark"] input[type="password"],
html[data-theme="dark"] textarea,
html[data-theme="dark"] select {
  background-color: var(--p9n-bg) !important;
  color: var(--p9n-text) !important;
  border: 1px solid var(--p9n-border) !important;
}

/* Spoiler Bar (.mark) Dark Mode Rules (G04) */
html[data-theme="dark"] .mark {
  background-color: #3b4859 !important;
  color: #3b4859 !important;
  cursor: pointer;
  user-select: none;
  border-radius: 2px;
  padding: 1px 4px;
}
html[data-theme="dark"] .mark.unmasked,
html[data-theme="dark"] .mark.pinned {
  color: #ffffff !important;
  user-select: text;
}
html[data-theme="dark"] .mark strong,
html[data-theme="dark"] .mark b,
html[data-theme="dark"] .mark em,
html[data-theme="dark"] .mark i,
html[data-theme="dark"] .mark a,
html[data-theme="dark"] .mark a:visited,
html[data-theme="dark"] .mark span,
html[data-theme="dark"] .mark [style*="color"],
html[data-theme="dark"] .mark * {
  color: inherit !important;
  background-color: transparent !important;
}

/* Semantic Alert Badges in Dark Mode (Tips, Like counts, Status markers) */
html[data-theme="dark"] .alert-success,
html[data-theme="dark"] em.alert-success,
html[data-theme="dark"] span.alert-success {
  background-color: #1e4620 !important;
  color: #75b798 !important;
  border-color: #2b6a38 !important;
}
html[data-theme="dark"] .alert-info,
html[data-theme="dark"] em.alert-info,
html[data-theme="dark"] span.alert-info {
  background-color: #0d3c61 !important;
  color: #6ea8fe !important;
  border-color: #1a5c96 !important;
}
html[data-theme="dark"] .alert-warning,
html[data-theme="dark"] em.alert-warning,
html[data-theme="dark"] span.alert-warning {
  background-color: #4d3800 !important;
  color: #ffda6a !important;
  border-color: #7a5a00 !important;
}
html[data-theme="dark"] .alert-danger,
html[data-theme="dark"] .alert-error,
html[data-theme="dark"] em.alert-danger,
html[data-theme="dark"] em.alert-error,
html[data-theme="dark"] span.alert-danger,
html[data-theme="dark"] span.alert-error {
  background-color: #491217 !important;
  color: #ea868f !important;
  border-color: #721c24 !important;
}

/* Ensure b/em/strong inside alert badges inherit high-contrast badge text */
html[data-theme="dark"] [class*="alert-"] b,
html[data-theme="dark"] [class*="alert-"] em,
html[data-theme="dark"] [class*="alert-"] strong,
html[data-theme="dark"] .alert-success b,
html[data-theme="dark"] .alert-success em,
html[data-theme="dark"] .alert-success strong,
html[data-theme="dark"] .alert-info b,
html[data-theme="dark"] .alert-info em,
html[data-theme="dark"] .alert-info strong,
html[data-theme="dark"] .alert-warning b,
html[data-theme="dark"] .alert-warning em,
html[data-theme="dark"] .alert-warning strong,
html[data-theme="dark"] .alert-danger b,
html[data-theme="dark"] .alert-danger em,
html[data-theme="dark"] .alert-danger strong,
html[data-theme="dark"] .alert-error b,
html[data-theme="dark"] .alert-error em,
html[data-theme="dark"] .alert-error strong {
  color: inherit !important;
}

/* Settings Modal Dark Mode */
html[data-theme="dark"] .psnine-settings-dialog {
  background: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-header {
  border-color: var(--p9n-border) !important;
  background: var(--p9n-surface) !important;
}
html[data-theme="dark"] .psnine-settings-footer {
  border-color: var(--p9n-border) !important;
  background: var(--p9n-bg) !important;
}
html[data-theme="dark"] .psnine-settings-section {
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-summary {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-settings-summary:hover {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-settings-summary:focus-visible {
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: 2px;
}
html[data-theme="dark"] .psnine-settings-row {
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-row > .psnine-settings-label,
html[data-theme="dark"] .psnine-settings-row > label:where(:not(.psnine-switch)) {
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-settings-row input,
html[data-theme="dark"] .psnine-settings-row select,
html[data-theme="dark"] .psnine-settings-row textarea {
  background: var(--p9n-bg) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-settings-memory-warning {
  background: #332701 !important;
  color: #ffd875 !important;
  border-color: #665005 !important;
}

/* Generic Button Contrast in Dark Mode (Exclude custom status/chip/filter buttons) */
html[data-theme="dark"] [data-psnine-next] button:where(:not(.psnine-btn-primary):not(.psnine-btn-danger):not(.psnine-settings-close):not(.psnine-trophy-icon-chip):not(.psnine-trophy-chip):not(.psnine-score-filter-chip):not(#psnine-clear-score-filter-btn):not(#psnine-toggle-best-deal-btn):not(#psnine-toggle-cny-btn):not(.psnine-battle-bell-btn):not(#psnine-scrollbottom):not(#psnine-settings-gear):not(.psnine-filtered-tip-btn):not(.psnine-trophy-pill-btn)),
html[data-theme="dark"] button[data-psnine-next]:where(:not(.psnine-btn-primary):not(.psnine-btn-danger):not(.psnine-settings-close):not(.psnine-trophy-icon-chip):not(.psnine-trophy-chip):not(.psnine-score-filter-chip):not(#psnine-clear-score-filter-btn):not(#psnine-toggle-best-deal-btn):not(#psnine-toggle-cny-btn):not(.psnine-battle-bell-btn):not(#psnine-scrollbottom):not(#psnine-settings-gear):not(.psnine-filtered-tip-btn):not(.psnine-trophy-pill-btn)),
html[data-theme="dark"] .psnine-btn:where(:not(.psnine-btn-primary):not(.psnine-btn-danger)) {
  color: var(--p9n-text) !important;
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-btn.psnine-btn-primary,
html[data-theme="dark"] [data-psnine-next] button.psnine-btn-primary,
html[data-theme="dark"] button[data-psnine-next].psnine-btn-primary {
  color: #ffffff !important;
  background-color: var(--p9n-primary) !important;
  border-color: var(--p9n-primary) !important;
}
html[data-theme="dark"] .psnine-btn.psnine-btn-danger,
html[data-theme="dark"] [data-psnine-next] button.psnine-btn-danger,
html[data-theme="dark"] button[data-psnine-next].psnine-btn-danger {
  color: #ff6b6b !important;
  background-color: var(--p9n-surface-alt) !important;
  border-color: #ff6b6b !important;
}
html[data-theme="dark"] .psnine-settings-close {
  color: var(--p9n-muted) !important;
  background: transparent !important;
}
html[data-theme="dark"] .psnine-settings-close:hover {
  color: var(--p9n-text) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

/* Trophy Module Dark Mode */
html[data-theme="dark"] .psnine-trophy-panel {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-card-hd {
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-chart-section {
  background-color: transparent !important;
  border: none !important;
  border-top: 1px solid var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn,
html[data-theme="dark"] .psnine-pill-btn,
html[data-theme="dark"] .psnine-trophy-toolbar button {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn:hover:not(:disabled),
html[data-theme="dark"] .psnine-pill-btn:hover:not(:disabled),
html[data-theme="dark"] .psnine-trophy-toolbar button:hover:not(:disabled) {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-link) !important;
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn.active,
html[data-theme="dark"] .psnine-trophy-pill-btn[aria-pressed="true"],
html[data-theme="dark"] .psnine-pill-btn.active,
html[data-theme="dark"] .psnine-trophy-toolbar button.active,
html[data-theme="dark"] .psnine-trophy-toolbar button[aria-pressed="true"] {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-link) !important;
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn.danger,
html[data-theme="dark"] .psnine-trophy-pill-btn.psnine-btn-danger,
html[data-theme="dark"] .psnine-trophy-toolbar button.danger,
html[data-theme="dark"] .psnine-trophy-toolbar button.psnine-btn-danger {
  color: #ff6b6b !important;
  border-color: #ff6b6b !important;
  background-color: var(--p9n-surface) !important;
}
html[data-theme="dark"] .psnine-trophy-pill-btn:disabled,
html[data-theme="dark"] .psnine-pill-btn:disabled,
html[data-theme="dark"] .psnine-trophy-toolbar button:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
}
html[data-theme="dark"] .psnine-trophy-preview-card,
html[data-theme="dark"] #psnine-trophy-preview-card {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] .psnine-trophy-filtered-btn,
html[data-theme="dark"] .psnine-filtered-tip-btn {
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-muted) !important;
}

/* Custom Status & Filter Buttons in Dark Mode */
/* 1. Trophy Icon Chip (Preserve earned green border) */
html[data-theme="dark"] .psnine-trophy-chip,
html[data-theme="dark"] .psnine-trophy-icon-chip {
  background-color: transparent !important;
}
html[data-theme="dark"] .psnine-trophy-chip.earned,
html[data-theme="dark"] .psnine-trophy-icon-chip.earned,
html[data-theme="dark"] .psnine-trophy-icon-chip[style*="#28a745"],
html[data-theme="dark"] .psnine-trophy-icon-chip[style*="rgb(40, 167, 69)"] {
  border-color: #28a745 !important;
}

/* 2. Review Score Filter Chip (Preserve selected orange status) */
html[data-theme="dark"] .psnine-score-filter-chip {
  background-color: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  color: var(--p9n-muted) !important;
}
html[data-theme="dark"] .psnine-score-filter-chip[style*="#ff9800"],
html[data-theme="dark"] .psnine-score-filter-chip[style*="rgb(255, 152, 0)"] {
  background-color: #ff9800 !important;
  border-color: #ff9800 !important;
  color: #ffffff !important;
}
html[data-theme="dark"] #psnine-clear-score-filter-btn {
  border-color: #ff9800 !important;
  background-color: rgba(255, 152, 0, 0.15) !important;
  color: #ffb74d !important;
}

/* 3. Deal Best Only Toggle Button (Preserve active red state) */
html[data-theme="dark"] #psnine-toggle-best-deal-btn {
  background-color: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  color: var(--p9n-text) !important;
}
html[data-theme="dark"] #psnine-toggle-best-deal-btn[style*="#da314b"],
html[data-theme="dark"] #psnine-toggle-best-deal-btn[style*="rgb(218, 49, 75)"] {
  background-color: #da314b !important;
  border-color: #da314b !important;
  color: #ffffff !important;
}

/* 4. Deal CNY Toggle Button (Preserve active green state) */
html[data-theme="dark"] #psnine-toggle-cny-btn {
  background-color: rgba(40, 167, 69, 0.15) !important;
  border: 1px solid #28a745 !important;
  color: #51cf66 !important;
}

/* 5. Battle Bell Monitor Button (Preserve active amber/gold state) */
html[data-theme="dark"] .psnine-battle-bell-btn {
  background-color: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  color: var(--p9n-muted) !important;
}
html[data-theme="dark"] .psnine-battle-bell-btn[style*="245, 159, 0"],
html[data-theme="dark"] .psnine-battle-bell-btn[style*="#f59f00"] {
  background-color: rgba(245, 159, 0, 0.2) !important;
  border-color: #f59f00 !important;
  color: #fbbf24 !important;
}

/* Toggle Switch Slider in Dark Mode */
html[data-theme="dark"] .psnine-slider {
  background-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-switch input:checked + .psnine-slider {
  background-color: #2ecc71 !important;
}

/* Traceback in Dark Mode */
html[data-theme="dark"] .psnine-traceback-card {
  background: var(--p9n-surface-alt) !important;
}
html[data-theme="dark"] .psnine-traceback-header {
  color: var(--p9n-link) !important;
}
html[data-theme="dark"] .psnine-traceback-content {
  color: var(--p9n-muted) !important;
}

/* Plugin Panels & Low Contrast Container Fixes */
html[data-theme="dark"] #psnine-trophy-stats-panel,
html[data-theme="dark"] #psnine-trophy-preview-card,
html[data-theme="dark"] #psnine-enhanced-reviews-panel,
html[data-theme="dark"] #psnine-deals-controls-bar,
html[data-theme="dark"] #psnine-price-chart-container,
html[data-theme="dark"] #psnine-game-variants-section,
html[data-theme="dark"] #psnine-cross-version-tips-section {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Muted labels & counts in plugin panels */
html[data-theme="dark"] #psnine-trophy-header-counts,
html[data-theme="dark"] #psnine-fx-status,
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color:#666"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color: #666"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color:#888"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color: #888"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color:#555"],
html[data-theme="dark"] #psnine-trophy-stats-panel [style*="color: #555"],
html[data-theme="dark"] #psnine-trophy-preview-card [style*="color:#666"],
html[data-theme="dark"] #psnine-trophy-preview-card [style*="color: #666"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color:#666"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color: #666"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color:#888"],
html[data-theme="dark"] #psnine-enhanced-reviews-panel [style*="color: #888"],
html[data-theme="dark"] #psnine-deals-controls-bar [style*="color:#666"],
html[data-theme="dark"] #psnine-deals-controls-bar [style*="color: #666"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color:#666"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color: #666"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color:#888"],
html[data-theme="dark"] #psnine-price-chart-container [style*="color: #888"],
html[data-theme="dark"] #psnine-game-variants-section [style*="color:#666"],
html[data-theme="dark"] #psnine-game-variants-section [style*="color: #666"],
html[data-theme="dark"] #psnine-cross-version-tips-section [style*="color:#666"],
html[data-theme="dark"] #psnine-cross-version-tips-section [style*="color: #666"] {
  color: var(--p9n-muted) !important;
}

/* Game List Progress Badge in Dark Mode */
html[data-theme="dark"] .psnine-game-list-progress-badge {
  background-color: var(--p9n-surface-alt, #202c3a) !important;
  color: var(--p9n-text, #e6ebf2) !important;
  border-color: var(--p9n-border, #3b4859) !important;
}
`;
