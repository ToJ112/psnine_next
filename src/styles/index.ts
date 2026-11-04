/**
 * Self-contained styles and inline SVGs for psnine_next.
 * Zero external font, image, or stylesheet dependencies.
 */

export const ICONS = {
  gear: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill:var(--p9n-success)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  coins: `<svg viewBox="0 0 24 24" width="16" height="16" style="fill:var(--p9n-warning)"><path d="M12 2C6.48 2 2 4.24 2 7v10c0 2.76 4.48 5 10 5s10-2.24 10-5V7c0-2.76-4.48-5-10-5zm0 2c4.42 0 8 1.79 8 3s-3.58 3-8 3-8-1.79-8-3 3.58-3 8-3zm0 16c-4.42 0-8-1.79-8-3v-2.22c1.78 1.34 4.67 2.22 8 2.22s6.22-.88 8-2.22V17c0 1.21-3.58 3-8 3zm0-5c-4.42 0-8-1.79-8-3v-2.22c1.78 1.34 4.67 2.22 8 2.22s6.22-.88 8-2.22V12c0 1.21-3.58 3-8 3z"/></svg>`,
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
  --p9n-text-muted: var(--p9n-muted);
  --p9n-border: var(--c-line, #ccd6dd);
  --p9n-link: var(--c-brand, #1966c2);
  --p9n-link-soft: rgba(56, 144, 255, 0.12);
  --p9n-primary: #1d4ed8;
  --p9n-on-accent: #ffffff;
  --p9n-success: #28a745;
  --p9n-danger: #e03131;
  --p9n-warning: #f59f00;
  --p9n-warning-text: #b45309;
  --p9n-radius-sm: var(--r-sm, 4px);
  --p9n-radius-md: var(--r-md, 8px);
}

[data-psnine-next]:where(:not(.psnine-nav-settings-link)) {
  box-sizing: border-box;
}

/* Base button styling */
.psnine-btn,
[data-psnine-next] button:where(:not(.psnine-settings-close):not(.psnine-progress-filter-btn):not(.p9n-pill):not(.p9n-text-toggle):not(.p9n-seg-btn)),
button[data-psnine-next]:where(:not(.psnine-settings-close):not(.psnine-progress-filter-btn):not(.p9n-pill):not(.p9n-text-toggle):not(.p9n-seg-btn)) {
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
  color: var(--p9n-on-accent) !important;
  background-color: var(--p9n-primary) !important;
  border-color: var(--p9n-primary) !important;
}

.psnine-btn.psnine-btn-danger,
[data-psnine-next] button.psnine-btn-danger,
button[data-psnine-next].psnine-btn-danger {
  color: var(--p9n-danger) !important;
  background-color: var(--p9n-surface) !important;
  border-color: var(--p9n-danger) !important;
}

/* ==== Shared UI primitives (use these for all plugin controls) ====
   .p9n-row         flush full-width row, 1px top divider, no outer margin
   .p9n-row-label   small muted label at the start of a row
   .p9n-pill        32px capsule button/link; [aria-pressed="true"] or .is-active = selected
   .p9n-pill.is-danger / .is-success / .is-warning  semantic selected colors
   .p9n-seg + .p9n-seg-btn  segmented capsule (same look as the game progress filter)
   .p9n-text-toggle plain text + chevron toggle; [aria-pressed="true"] flips chevron, link color
   .p9n-tag         small inline chip (floor no., role, status)
   .p9n-section-title  plain section heading (no emoji) */
.p9n-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0;
  padding: 10px 14px;
  background-color: var(--p9n-surface);
  border-top: 1px solid var(--p9n-border);
  color: var(--p9n-text);
  box-sizing: border-box;
}
.p9n-row-label {
  font-size: 12px;
  color: var(--p9n-muted);
  white-space: nowrap;
}
.p9n-row-end {
  margin-left: auto;
}
.p9n-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--p9n-text);
}

.p9n-pill {
  position: relative;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px;
  height: 32px;
  min-height: 32px;
  margin: 0;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  border: 1px solid var(--p9n-border) !important;
  border-radius: 16px !important;
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  text-decoration: none !important;
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
/* Extends the tap target to 44px without changing the visual size */
.p9n-pill::after {
  content: "";
  position: absolute;
  inset: -6px 0;
}
.p9n-pill:hover,
.p9n-pill[aria-pressed="true"],
.p9n-pill.is-active {
  border-color: var(--p9n-link) !important;
  color: var(--p9n-link) !important;
  text-decoration: none !important;
}
.p9n-pill.is-danger[aria-pressed="true"],
.p9n-pill.is-danger.is-active {
  border-color: var(--p9n-danger) !important;
  background-color: var(--p9n-danger) !important;
  color: var(--p9n-on-accent) !important;
}
.p9n-pill.is-success[aria-pressed="true"],
.p9n-pill.is-success.is-active {
  border-color: var(--p9n-success) !important;
  color: var(--p9n-success) !important;
}
.p9n-pill.is-warning[aria-pressed="true"],
.p9n-pill.is-warning.is-active {
  border-color: var(--p9n-warning) !important;
  color: var(--p9n-warning-text) !important;
}
.p9n-pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.p9n-pill.is-sm {
  height: 26px;
  min-height: 26px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 13px !important;
}
.p9n-pill.is-sm::after {
  inset: -9px 0;
}
.p9n-pill:focus-visible,
.p9n-text-toggle:focus-visible,
.p9n-seg-btn:focus-visible {
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: 1px !important;
}

.p9n-seg {
  display: inline-flex !important;
  align-items: center !important;
  gap: 2px !important;
  padding: 2px !important;
  background: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  border-radius: 16px !important;
  box-sizing: border-box !important;
  vertical-align: middle;
}
.p9n-seg-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 28px !important;
  margin: 0 !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  line-height: 1 !important;
  border: none !important;
  border-radius: 14px !important;
  background: transparent !important;
  color: var(--p9n-muted) !important;
  font-weight: normal !important;
  white-space: nowrap !important;
  cursor: pointer !important;
  touch-action: manipulation !important;
  box-sizing: border-box !important;
  transition: background-color 0.15s ease, color 0.15s ease !important;
}
.p9n-seg-btn[aria-pressed="true"],
.p9n-seg-btn.is-active {
  background: var(--p9n-surface) !important;
  color: var(--p9n-link) !important;
  font-weight: 600 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
}

.p9n-text-toggle {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px;
  min-height: 32px;
  margin: 0;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
  border: none !important;
  background: transparent !important;
  color: var(--p9n-muted) !important;
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
}
.p9n-text-toggle::after {
  content: "";
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.15s ease;
}
.p9n-text-toggle[aria-pressed="true"] {
  color: var(--p9n-link) !important;
}
.p9n-text-toggle[aria-pressed="true"]::after {
  transform: translateY(1px) rotate(-135deg);
}
.p9n-text-toggle.is-sort::after {
  display: none;
}

.p9n-tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  border-radius: 9px;
  background-color: var(--p9n-surface-alt);
  color: var(--p9n-muted);
  vertical-align: middle;
  white-space: nowrap;
  box-sizing: border-box;
}
.p9n-tag.is-accent {
  background-color: var(--p9n-link);
  /* surface (not on-accent): dark-theme link is light blue */
  color: var(--p9n-surface);
}
.p9n-tag.is-danger {
  background-color: var(--p9n-danger);
  color: var(--p9n-on-accent);
}
.p9n-tag.is-success {
  background-color: var(--p9n-success);
  color: var(--p9n-surface);
}
html[data-theme="dark"] .p9n-seg-btn[aria-pressed="true"],
html[data-theme="dark"] .p9n-seg-btn.is-active {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4) !important;
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
  background-color: var(--p9n-on-accent);
  transition: transform 0.25s ease;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.psnine-switch input:checked + .psnine-slider {
  background-color: var(--p9n-success);
}
.psnine-switch input:checked + .psnine-slider:before {
  transform: translateX(20px);
}
.psnine-switch input:focus-visible + .psnine-slider {
  outline: 2px solid var(--p9n-link);
  outline-offset: 2px;
}

/* Game List Progress Badge (P06: Neutral, Accessible Contrast >= 4.5:1) */
.psnine-game-list-progress-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 500;
  border-radius: var(--p9n-radius-sm, 4px);
  background-color: var(--p9n-surface-alt);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  margin-left: 6px;
  vertical-align: middle;
  box-sizing: border-box;
}

/* Profile Sync Links (等级同步 / 游戏同步): .p9n-pill on the profile hero.
   The hero is a dark image, so the pill keeps an opaque surface fill (token text on token
   surface keeps >= 4.5:1 in both themes) plus a soft shadow to lift it off the photo. */
#psnine-sync-psn-btn-group {
  display: inline-flex;
  flex-wrap: wrap;
  /* Row gap >= 2 x the pill ::after hit-area overhang */
  gap: 12px 8px;
  margin: 8px 0;
  max-width: 100%;
  vertical-align: middle;
  box-sizing: border-box;
}
#psnine-sync-psn-btn-group > .p9n-pill {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

/* Game List Difficulty Sort (难度 ↓ / 难度 ↑): quiet .p9n-text-toggle.is-sort,
   flush-left so its text lines up with the 14px content inset (10px + 4px toggle padding) */
#psnine-difficulty-sort-btn {
  margin: 0 0 0 10px;
}

/* On-demand Progress Query (查进度 / 查询中… / 重试): .p9n-pill.is-sm next to the game title */
.psnine-ondemand-progress-btn {
  margin-left: 6px !important;
  vertical-align: middle;
}
.psnine-ondemand-progress-btn.is-error {
  border-color: var(--p9n-danger) !important;
  color: var(--p9n-danger) !important;
}

/* Game Section Nav Toggle (collapsed 奖杯/排行/评论… grid) */
#psnine-game-nav-toggle {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0 14px;
  border: none !important;
  border-top: 1px solid var(--p9n-border) !important;
  border-radius: 0;
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  box-sizing: border-box;
}
#psnine-game-nav-toggle:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: -2px;
}
.psnine-game-nav-current {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--p9n-link);
  font-weight: 500;
}
.psnine-game-nav-current .icon {
  font-size: 18px;
  line-height: 1;
}
.psnine-game-nav-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--p9n-muted);
}
.psnine-game-nav-hint::after {
  content: "";
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.15s ease;
}
#psnine-game-nav-toggle[aria-expanded="true"] .psnine-game-nav-hint::after {
  transform: translateY(1px) rotate(-135deg);
}
/* Expanded grid sits flush under the toggle so both read as one card */
#psnine-game-nav-toggle + ul.inav {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  border-top: 1px solid var(--p9n-border) !important;
  box-shadow: none !important;
}

/* Game Variants Row (compact label + capsule links, 32px visual / 44px hit area).
   The trophy page "其他版本 Tips" row reuses the same markup and look. */
#psnine-game-variants-section,
#psnine-cross-version-tips-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0;
  padding: 10px 14px;
  background-color: var(--p9n-surface);
  border-top: 1px solid var(--p9n-border);
  border-radius: 0;
  color: var(--p9n-text);
  box-sizing: border-box;
}
.psnine-game-variants-label {
  font-size: 12px;
  color: var(--p9n-muted);
  white-space: nowrap;
}
.psnine-game-variants-list {
  display: flex;
  flex-wrap: wrap;
  /* Row gap >= 2 x the ::after hit-area overhang so wrapped chips never share tap area */
  gap: 12px 8px;
  min-width: 0;
}
a.psnine-variant-btn {
  position: relative;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px;
  max-width: 100%;
  height: 32px;
  padding: 0 12px 0 4px;
  font-size: 13px;
  line-height: 1;
  border-radius: 16px;
  border: 1px solid var(--p9n-border);
  background-color: var(--p9n-surface);
  color: var(--p9n-text) !important;
  text-decoration: none !important;
  touch-action: manipulation;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
a.psnine-variant-btn::after {
  content: "";
  position: absolute;
  inset: -6px 0;
}
a.psnine-variant-btn:not(:has(.psnine-variant-platform)) {
  padding-left: 12px;
}
a.psnine-variant-btn:hover {
  border-color: var(--p9n-link);
  color: var(--p9n-link) !important;
  text-decoration: none !important;
}
a.psnine-variant-btn:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 1px;
}
.psnine-variant-platform {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  background-color: var(--p9n-link);
  /* surface (not on-accent): dark-theme link is light blue, so white text would lose contrast */
  color: var(--p9n-surface);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.psnine-variant-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.psnine-variant-id {
  font-size: 12px;
  color: var(--p9n-muted);
}

/* ==== Community: floor / author / hot / QA tags (built on .p9n-tag) ==== */
.p9n-tag.psnine-floor-badge {
  margin-right: 6px;
  user-select: none;
}
.p9n-tag.psnine-subfloor-badge {
  height: 16px;
  padding: 0 5px;
  margin-right: 4px;
  font-size: 10px;
  font-weight: 500;
  user-select: none;
}
/* Default colors from .is-accent; user-customized highlight colors are applied inline */
.p9n-tag.psnine-author-badge {
  margin-left: 4px;
}
.p9n-tag.psnine-hot-badge {
  margin-left: 6px;
}
.p9n-tag.psnine-qa-status {
  margin-right: 6px;
}
.p9n-tag.psnine-qa-status.is-pending {
  background-color: var(--p9n-link-soft);
  color: var(--p9n-link);
}
/* Specific-user highlight: shape only; colors come from settings (inline) */
a.psnine-specific-user {
  padding: 1px 5px !important;
  border-radius: 4px !important;
}
/* QA bounty: coin glyph + count; gold/bronze tiers are semantic colors */
.psnine-qa-bounty {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--p9n-muted);
  vertical-align: middle;
}
.psnine-qa-bounty svg {
  width: 14px;
  height: 14px;
}
.psnine-qa-bounty.is-gold { color: #f39c12; }
.psnine-qa-bounty.is-bronze { color: #d35400; }

/* ==== Community: quiet icon button (profile preview trigger, card close) ====
   Doubled class + html body prefix outranks the generic plugin button rules (light and dark). */
html body button.psnine-icon-btn.psnine-icon-btn {
  position: relative;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 32px;
  height: 24px;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0 !important;
  font-size: 0;
  line-height: 1;
  border: none !important;
  border-radius: 6px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--p9n-muted) !important;
  cursor: pointer;
  vertical-align: middle;
}
/* 32x32 hit area without overlapping the adjacent username link */
html body button.psnine-icon-btn.psnine-icon-btn::after {
  content: "";
  position: absolute;
  inset: -4px 0;
}
html body button.psnine-icon-btn.psnine-icon-btn:hover {
  color: var(--p9n-link) !important;
}
html body button.psnine-icon-btn.psnine-icon-btn:focus-visible {
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: -2px !important;
}
html body button.psnine-icon-btn.psnine-icon-btn svg {
  width: 14px;
  height: 14px;
  pointer-events: none;
}
html body button.psnine-profile-card-close.psnine-icon-btn {
  width: 32px;
  height: 32px;
  margin: -6px -8px -6px 0;
}
html body button.psnine-profile-card-close.psnine-icon-btn::after {
  inset: 0;
}
html body button.psnine-profile-card-close.psnine-icon-btn svg {
  width: 16px;
  height: 16px;
}

/* ==== Community: user preview card ==== */
.psnine-profile-card {
  position: fixed;
  z-index: 10000;
  min-width: 240px;
  max-width: 320px;
  padding: 12px;
  background: var(--p9n-surface);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  line-height: 1.5;
}
html[data-theme="dark"] .psnine-profile-card {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}
.psnine-profile-card-status {
  color: var(--p9n-muted);
}
.psnine-profile-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.psnine-profile-card-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}
.psnine-profile-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.psnine-profile-card-trophies {
  padding: 6px 8px;
  background: var(--p9n-surface-alt);
  border-radius: 6px;
  color: var(--p9n-text);
}
.psnine-profile-card-footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--p9n-border);
  text-align: right;
}
.psnine-profile-card-link {
  color: var(--p9n-link) !important;
  font-weight: 500;
  text-decoration: none !important;
}
.psnine-profile-card-link:hover,
.psnine-profile-card-link:focus-visible {
  text-decoration: underline !important;
}

/* ==== Community: reply traceback card & keyword-folded placeholders (flush, surface-alt) ==== */
.psnine-traceback-card {
  margin: 6px 0 0;
  padding: 8px 12px;
  background: var(--p9n-surface-alt);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: var(--p9n-text);
  cursor: pointer;
}
.psnine-traceback-card:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 1px;
}
.psnine-traceback-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--p9n-muted);
}
.psnine-traceback-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
.psnine-traceback-user {
  font-weight: 600;
  color: var(--p9n-text);
}
.psnine-traceback-content {
  color: var(--p9n-muted);
  word-break: break-word;
}
.psnine-keyword-placeholder {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin: 0;
  padding: 4px 12px;
  list-style: none;
  background: var(--p9n-surface-alt);
  color: var(--p9n-muted);
  font-size: 12px;
}
td.psnine-keyword-placeholder-cell {
  padding: 4px 12px;
  background: var(--p9n-surface-alt);
  color: var(--p9n-muted);
  font-size: 12px;
}
td.psnine-keyword-placeholder-cell .psnine-keyword-reveal {
  margin-left: 8px;
  vertical-align: middle;
}

/* ==== Paging: auto-paging control bar & QA "load all answers" pill ==== */
/* Visibility is toggled inline (display:none / ''); layout lives here */
#psnine-pagination-indicator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  font-size: 12px;
  color: var(--p9n-muted);
  user-select: none;
}
#psnine-load-all-qa {
  margin: 10px 0;
}

/* ==== Editor: gene word counter & BBCode preview ==== */
.psnine-gene-count-box {
  margin-top: 6px;
  font-size: 12px;
  color: var(--p9n-muted);
  font-variant-numeric: tabular-nums;
}
.psnine-gene-count-box.is-over {
  color: var(--p9n-danger);
  font-weight: 600;
}
#psnine-bbcode-preview {
  margin-top: 10px;
  padding: 10px 12px;
  min-height: 40px;
  background: var(--p9n-surface);
  color: var(--p9n-text);
  border: 1px solid var(--p9n-border);
  border-radius: 8px;
  overflow-wrap: break-word;
  word-break: break-word;
}
.psnine-bbcode-preview-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--p9n-muted);
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

/* Trophy Tips Expand Toggle & Jump Highlight (plain text + chevron, same idiom as the game nav toggle) */
#psnine-trophy-tips-trigger,
button#psnine-trophy-tips-trigger,
.o_btn.psnine-trophy-tips-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
  margin: 0 !important;
  width: auto !important;
  min-height: 34px !important;
  height: 34px !important;
  padding: 0 4px 0 8px !important;
  font-size: 12px !important;
  line-height: 1 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--p9n-muted) !important;
  cursor: pointer !important;
  text-align: center !important;
  box-sizing: border-box !important;
  outline: none !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}
#psnine-trophy-tips-trigger::after {
  content: "";
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.15s ease;
}
#psnine-trophy-tips-trigger[aria-pressed="true"] {
  color: var(--p9n-link) !important;
}
#psnine-trophy-tips-trigger[aria-pressed="true"]::after {
  transform: translateY(1px) rotate(-135deg);
}
#psnine-trophy-tips-trigger:focus-visible,
button#psnine-trophy-tips-trigger:focus-visible,
.o_btn.psnine-trophy-tips-btn:focus-visible {
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: 1px !important;
}
.psnine-tip-jump-target {
  background-color: var(--p9n-surface-alt) !important;
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: -2px !important;
  transition: background-color 0.25s ease, outline 0.25s ease;
}
@media (prefers-reduced-motion: reduce) {
  .psnine-tip-jump-target {
    transition: none !important;
  }
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

/* Inline Tips Rows (trophy list): muted "Tips · N 条" head with the full-page link on the
   right, flat items separated by 1px dividers; loading/empty/error share one status line */
td.psnine-inline-tip-cell {
  padding: 10px 14px;
  background-color: var(--p9n-surface-alt);
  border-bottom: 1px solid var(--p9n-border);
  color: var(--p9n-text);
  font-size: 12px;
}
.psnine-inline-tip-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--p9n-muted);
}
.psnine-inline-tip-status.is-error {
  color: var(--p9n-danger);
}
.psnine-inline-tip-list {
  max-height: 280px;
  overflow-y: auto;
}
.psnine-inline-tip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--p9n-muted);
}
.psnine-inline-tip-head > a {
  color: var(--p9n-link) !important;
  text-decoration: none !important;
  white-space: nowrap;
}
.psnine-inline-tip-head > a:hover {
  text-decoration: underline !important;
}
.psnine-inline-tip-item {
  padding: 8px 0;
  border-top: 1px solid var(--p9n-border);
  font-size: 12px;
}
.psnine-inline-tip-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
  font-size: 11px;
  color: var(--p9n-muted);
}
.psnine-inline-tip-author {
  font-weight: 500;
  color: var(--p9n-link);
}
.psnine-inline-tip-body {
  line-height: 1.5;
}
.psnine-filtered-tip-body {
  margin-top: 6px;
}

/* Filtered Tip Reveal Button (已过滤 · 原因 · 点击显示): quiet full-width text line */
/* button.class outranks the generic "[data-psnine-next] button" base rule (0,1,1) */
button.psnine-filtered-tip-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 32px;
  margin: 0;
  padding: 0;
  text-align: left;
  border-radius: 0;
  background: transparent !important;
  color: var(--p9n-muted) !important;
  font-size: 12px;
  border: none !important;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  box-sizing: border-box;
}
.psnine-filtered-tip-btn:hover,
.psnine-filtered-tip-btn[aria-expanded="true"] {
  color: var(--p9n-link) !important;
}
.psnine-filtered-tip-btn:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 1px;
}

/* Trophy Detail Tips Sort (按热度排序): .p9n-text-toggle.is-sort above the Tips list */
#psnine-sort-tips-by-likes-btn {
  margin: 0 0 4px 10px;
}

/* Guide Topic Trophy Status (.p9n-tag 已获得 / 未获得 / 状态未知) */
.psnine-guide-trophy-badge {
  margin-left: 4px;
}

/* Battle List: monitor pill (.p9n-pill.is-sm.is-warning, aria-pressed = monitored)
   and personal progress tag */
.psnine-battle-bell-btn {
  margin-left: 6px !important;
  vertical-align: middle;
  user-select: none;
}
.psnine-battle-progress-badge {
  margin-left: 4px;
  background-color: var(--p9n-link-soft);
  color: var(--p9n-link);
}

/* Trophy Navigation Dropmenu (Keeps sort dropdown, filter buttons, and Tips on one row) */
ul.dropmenu.psnine-trophy-nav-dropmenu,
ul.dropmenu[data-psnine-trophy-nav="true"] {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li,
ul.dropmenu[data-psnine-trophy-nav="true"] > li {
  float: none !important;
  display: inline-flex !important;
  align-items: center !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"],
ul.dropmenu[data-psnine-trophy-nav="true"] > li.dropdown[data-psnine-trophy-sort-dropdown="true"] {
  min-width: 0 !important;
  flex: 0 1 auto !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"],
ul.dropmenu[data-psnine-trophy-nav="true"] > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"] {
  display: inline-block !important;
  max-width: 100% !important;
  min-width: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  vertical-align: middle !important;
  height: 36px !important;
  line-height: 36px !important;
  box-sizing: border-box !important;
}
@media (max-width: 480px) {
  ul.dropmenu.psnine-trophy-nav-dropmenu > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"],
  ul.dropmenu[data-psnine-trophy-nav="true"] > li.dropdown[data-psnine-trophy-sort-dropdown="true"] > a[data-psnine-trophy-sort-trigger="true"] {
    max-width: 105px !important;
  }
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li:not(.dropdown),
ul.dropmenu[data-psnine-trophy-nav="true"] > li:not(.dropdown) {
  flex-shrink: 0 !important;
}
ul.dropmenu.psnine-trophy-nav-dropmenu > li > .o_btn:not(#psnine-trophy-tips-trigger),
ul.dropmenu[data-psnine-trophy-nav="true"] > li > .o_btn:not(#psnine-trophy-tips-trigger) {
  margin: 0 4px !important;
}
/* Segmented Capsule Control: game progress filter (全部/非 100%/100%) and trophy earned/unearned */
/* The trophy segment wraps native buttons; its child selectors repeat the class to outrank the
   generic dark-theme "[data-psnine-next] button" rule (0,2,2) without !important wars elsewhere. */
#psnine-game-progress-filter,
.psnine-trophy-filter-segment[data-psnine-next] {
  display: inline-flex !important;
  align-items: center !important;
  gap: 2px !important;
  padding: 2px !important;
  background: var(--p9n-surface-alt) !important;
  border: 1px solid var(--p9n-border) !important;
  border-radius: 16px !important;
  box-sizing: border-box !important;
}
#psnine-game-progress-filter {
  margin: 6px 0 10px 12px !important;
}
.psnine-trophy-filter-segment[data-psnine-next] {
  margin: 0 4px !important;
  vertical-align: middle !important;
  flex-shrink: 0 !important;
}

.psnine-progress-filter-btn,
.psnine-trophy-filter-segment.psnine-trophy-filter-segment[data-psnine-next] > * {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 28px !important;
  margin: 0 !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  line-height: 1 !important;
  border-radius: 14px !important;
  border: none !important;
  outline: none !important;
  cursor: pointer !important;
  touch-action: manipulation !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  background: transparent !important;
  color: var(--p9n-muted) !important;
  font-weight: normal !important;
  box-shadow: none !important;
  transition: background-color 0.15s ease, color 0.15s ease !important;
}
.psnine-trophy-filter-segment.psnine-trophy-filter-segment[data-psnine-next] > * {
  width: auto !important;
  float: none !important;
  min-width: 0 !important;
  white-space: nowrap !important;
}

.psnine-progress-filter-btn.active,
.psnine-trophy-filter-segment.psnine-trophy-filter-segment[data-psnine-next] > *.select {
  background: var(--p9n-surface) !important;
  color: var(--p9n-link) !important;
  font-weight: 600 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
}
.psnine-progress-filter-btn:focus-visible,
.psnine-trophy-filter-segment.psnine-trophy-filter-segment[data-psnine-next] > *:focus-visible {
  outline: 2px solid var(--p9n-link) !important;
  outline-offset: 1px !important;
}

html[data-theme="dark"] .psnine-progress-filter-btn.active,
html[data-theme="dark"] .psnine-trophy-filter-segment.psnine-trophy-filter-segment[data-psnine-next] > *.select {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4) !important;
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
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
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

/* ==== Deals (/dd, /dd/:id, /game/:id/dd, /huodong) ====
   Controls bar = .p9n-row; toggles = .p9n-pill with aria-pressed state.
   Component tokens pin the historical best-deal red and CNY green in both themes. */
#psnine-toggle-best-deal-btn {
  --p9n-deal-best: #da314b;
  --p9n-danger: var(--p9n-deal-best);
}
#psnine-toggle-cny-btn {
  --p9n-deal-cny: #28a745;
}
#psnine-toggle-cny-btn[aria-pressed="true"] {
  border-color: var(--p9n-deal-cny) !important;
}
#psnine-fx-status {
  font-size: 11px;
  color: var(--p9n-muted);
  white-space: nowrap;
}
#psnine-fx-status.is-expired {
  color: var(--p9n-danger);
}
#psnine-fx-status[hidden],
.psnine-cny-badge[hidden] {
  display: none !important;
}
.psnine-cny-badge {
  display: inline-block;
  margin-left: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--p9n-success);
  white-space: nowrap;
}
.psnine-cny-badge.is-expired {
  color: var(--p9n-danger);
}
.psnine-cny-badge.is-pending,
.psnine-cny-badge.is-unavailable {
  color: var(--p9n-muted);
}
#psnine-price-chart-container {
  margin: 0;
  padding: 12px 14px;
  border-top: 1px solid var(--p9n-border);
  background-color: var(--p9n-surface);
  color: var(--p9n-text);
  box-sizing: border-box;
}
.psnine-price-chart-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin-bottom: 6px;
}
.psnine-price-chart-subtitle,
.psnine-price-chart-empty {
  font-size: 12px;
  color: var(--p9n-muted);
}
.psnine-price-chart-empty {
  padding: 8px 0;
}
.psnine-price-chart-svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 240px;
  color: var(--p9n-muted);
  font-family: inherit;
  user-select: none;
}
.psnine-price-history-table-wrapper {
  margin-top: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.psnine-price-history-table-wrapper:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 1px;
}
.psnine-price-history-table {
  width: 100%;
  border: none;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
  color: var(--p9n-text);
}
.psnine-price-history-table caption {
  padding: 0 0 4px;
  text-align: left;
  font-size: 12px;
  color: var(--p9n-muted);
}
.psnine-price-history-table th,
.psnine-price-history-table td {
  padding: 6px 10px 6px 0;
  border: none;
  border-bottom: 1px solid var(--p9n-border);
  background: transparent;
  vertical-align: top;
}
.psnine-price-history-table th {
  font-weight: 500;
  color: var(--p9n-muted);
  white-space: nowrap;
}
.psnine-price-history-table tbody tr:last-child td {
  border-bottom: none;
}
.psnine-price-history-table .is-nowrap {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ==== Reviews panel (R01-R06, /psngame/:id/comment) ====
   Flush block of .p9n-row sections: header (title, summary, view seg + 正态曲线 pill),
   a single scrollable row of .p9n-pill.is-sm score chips, and borderless chart sections. */
#psnine-enhanced-reviews-panel {
  margin: 0;
  padding: 0;
  background-color: var(--p9n-surface);
  color: var(--p9n-text);
  border-bottom: 1px solid var(--p9n-border);
}
#psnine-enhanced-reviews-panel .psnine-reviews-summary {
  font-size: 12px;
  color: var(--p9n-muted);
  white-space: nowrap;
}
#psnine-enhanced-reviews-panel .psnine-reviews-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
#psnine-enhanced-reviews-panel .psnine-score-filter-row {
  flex-wrap: nowrap;
}
/* Padding + negative margin keep the pills' 44px hit area and focus ring inside the scroller */
#psnine-enhanced-reviews-panel .psnine-score-filter-scroll {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  margin: -9px -3px;
  padding: 9px 3px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
#psnine-enhanced-reviews-panel .psnine-score-filter-chip {
  flex: 0 0 auto;
  gap: 4px;
}
#psnine-enhanced-reviews-panel .psnine-score-filter-count {
  font-size: 11px;
  color: var(--p9n-muted);
}
#psnine-enhanced-reviews-panel .psnine-score-filter-chip[aria-pressed="true"] .psnine-score-filter-count {
  color: inherit;
}
#psnine-enhanced-reviews-panel #psnine-clear-score-filter-btn {
  flex: 0 0 auto;
  border-color: transparent !important;
  background-color: var(--p9n-link-soft) !important;
  color: var(--p9n-link) !important;
}
#psnine-enhanced-reviews-panel .psnine-review-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px 20px;
  align-items: start;
}
#psnine-enhanced-reviews-panel .psnine-review-chart {
  min-width: 0;
  margin: 0;
  padding: 0;
}
#psnine-enhanced-reviews-panel .psnine-review-chart-title {
  display: block;
  margin-bottom: 4px;
}
#psnine-enhanced-reviews-panel .psnine-review-svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 220px;
  color: var(--p9n-text);
  font-family: inherit;
  user-select: none;
}
#psnine-enhanced-reviews-panel .psnine-weekly-svg {
  max-height: 200px;
}
#psnine-enhanced-reviews-panel .score-bar-group {
  cursor: pointer;
}
#psnine-enhanced-reviews-panel .score-bar-group:focus-visible {
  outline: 2px solid var(--p9n-link);
  outline-offset: 1px;
}
#psnine-enhanced-reviews-panel .psnine-empty-chart {
  padding: 10px 0;
  font-size: 12px;
  color: var(--p9n-muted);
}
#psnine-enhanced-reviews-panel .psnine-review-table {
  margin-top: 4px;
  font-size: 11px;
  color: var(--p9n-muted);
}
#psnine-enhanced-reviews-panel .psnine-review-table > summary {
  cursor: pointer;
}
#psnine-enhanced-reviews-panel .psnine-review-table-scroll {
  max-height: 100px;
  margin-top: 4px;
  overflow-y: auto;
}
#psnine-enhanced-reviews-panel .psnine-review-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
#psnine-enhanced-reviews-panel .psnine-review-table tr {
  border-bottom: 1px solid var(--p9n-border);
}
#psnine-enhanced-reviews-panel .psnine-review-table th,
#psnine-enhanced-reviews-panel .psnine-review-table td {
  padding: 2px 0;
  text-align: left;
  font-weight: normal;
}
#psnine-enhanced-reviews-panel .psnine-review-table .is-num {
  text-align: right;
}
#psnine-enhanced-reviews-panel .psnine-review-table .is-strong {
  font-weight: 500;
}
#psnine-enhanced-reviews-panel .psnine-review-chart-note {
  margin-top: 2px;
  font-size: 11px;
  color: var(--p9n-muted);
  text-align: right;
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
  --p9n-text-muted: var(--p9n-muted);
  --p9n-link: var(--c-brand, #91bdff);
  --p9n-link-soft: rgba(145, 189, 255, 0.16);
  --p9n-primary: #1d4ed8;
  --p9n-on-accent: #ffffff;
  --p9n-success: #51cf66;
  --p9n-danger: #ff6b6b;
  --p9n-warning: #fbbf24;
  --p9n-warning-text: #fbbf24;
}

/* Page Background & Base Text (scoped with html[data-theme="dark"]) */
html[data-theme="dark"] body.bg,
html[data-theme="dark"] body[data-theme="dark"],
html[data-theme="dark"] body,
body[data-theme="dark"] {
  background-color: var(--p9n-bg) !important;
  color: var(--p9n-text) !important;
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
  color: var(--p9n-on-accent) !important;
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
html[data-theme="dark"] [data-psnine-next] button:where(:not(.psnine-btn-primary):not(.p9n-pill):not(.p9n-text-toggle):not(.p9n-seg-btn):not(.psnine-btn-danger):not(.psnine-settings-close):not(.psnine-trophy-icon-chip):not(.psnine-trophy-chip):not(#psnine-scrollbottom):not(#psnine-settings-gear):not(.psnine-filtered-tip-btn):not(.psnine-progress-filter-btn)),
html[data-theme="dark"] button[data-psnine-next]:where(:not(.psnine-btn-primary):not(.p9n-pill):not(.p9n-text-toggle):not(.p9n-seg-btn):not(.psnine-btn-danger):not(.psnine-settings-close):not(.psnine-trophy-icon-chip):not(.psnine-trophy-chip):not(#psnine-scrollbottom):not(#psnine-settings-gear):not(.psnine-filtered-tip-btn):not(.psnine-progress-filter-btn)),
html[data-theme="dark"] .psnine-btn:where(:not(.psnine-btn-primary):not(.psnine-btn-danger):not(.psnine-progress-filter-btn):not(.p9n-pill):not(.p9n-text-toggle):not(.p9n-seg-btn)) {
  color: var(--p9n-text) !important;
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-border) !important;
}
html[data-theme="dark"] .psnine-btn.psnine-btn-primary,
html[data-theme="dark"] [data-psnine-next] button.psnine-btn-primary,
html[data-theme="dark"] button[data-psnine-next].psnine-btn-primary {
  color: var(--p9n-on-accent) !important;
  background-color: var(--p9n-primary) !important;
  border-color: var(--p9n-primary) !important;
}
html[data-theme="dark"] .psnine-btn.psnine-btn-danger,
html[data-theme="dark"] [data-psnine-next] button.psnine-btn-danger,
html[data-theme="dark"] button[data-psnine-next].psnine-btn-danger {
  color: var(--p9n-danger) !important;
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-danger) !important;
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
html[data-theme="dark"] .psnine-trophy-preview-card,
html[data-theme="dark"] #psnine-trophy-preview-card {
  background-color: var(--p9n-surface-alt) !important;
  border-color: var(--p9n-border) !important;
  color: var(--p9n-text) !important;
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

/* 5. Battle Bell Monitor pill: no dark override needed; .p9n-pill.is-warning[aria-pressed]
   uses --p9n-warning / --p9n-warning-text, which the dark theme already retunes */

/* Toggle Switch Slider in Dark Mode */
html[data-theme="dark"] .psnine-slider {
  background-color: var(--p9n-border) !important;
}

/* Plugin Panels & Low Contrast Container Fixes */
html[data-theme="dark"] #psnine-trophy-stats-panel,
html[data-theme="dark"] #psnine-trophy-preview-card {
  background-color: var(--p9n-surface) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

/* Muted labels & counts in plugin panels */
html[data-theme="dark"] #psnine-trophy-header-counts {
  color: var(--p9n-muted) !important;
}


/* Game List Progress Badge in Dark Mode */
html[data-theme="dark"] .psnine-game-list-progress-badge {
  background-color: var(--p9n-surface-alt) !important;
  color: var(--p9n-text) !important;
  border-color: var(--p9n-border) !important;
}

`;
