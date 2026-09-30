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
/* psnine_next Core Base Styles */
[data-psnine-next] {
  box-sizing: border-box;
}

/* Explicit high-contrast button styling avoiding white-on-white collisions */
[data-psnine-next] button,
button[data-psnine-next],
.psnine-btn {
  color: #2c3e50 !important;
  background-color: #ffffff !important;
  border: 1px solid #ccd6dd !important;
  padding: 6px 14px;
  font-size: 14px;
  border-radius: 6px;
  cursor: pointer;
  touch-action: manipulation;
}

[data-psnine-next] button.psnine-btn-primary,
button[data-psnine-next].psnine-btn-primary {
  color: #ffffff !important;
  background-color: #3498db !important;
  border-color: #3498db !important;
}

[data-psnine-next] button.psnine-btn-danger,
button[data-psnine-next].psnine-btn-danger {
  color: #e74c3c !important;
  background-color: #ffffff !important;
  border-color: #e74c3c !important;
}

/* Floating Bottom Button */
#psnine-scrollbottom {
  position: fixed;
  right: 20px;
  bottom: 70px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #3498db !important;
  color: #ffffff !important;
  border: none !important;
  cursor: pointer;
  z-index: 999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}
#psnine-scrollbottom:hover {
  background: #2980b9 !important;
}

/* Settings Gear Button */
#psnine-settings-gear {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #2c3e50 !important;
  color: #ecf0f1 !important;
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  touch-action: manipulation;
}
#psnine-settings-gear:hover {
  background: #1a252f !important;
}

/* Settings Modal Backdrop & Dialog */
.psnine-modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}
.psnine-settings-dialog {
  background: #ffffff;
  color: #2c3e50;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}
.psnine-settings-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.psnine-settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.psnine-settings-close {
  background: none !important;
  border: none !important;
  cursor: pointer;
  color: #7f8c8d !important;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
.psnine-settings-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.psnine-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f3f5;
  min-height: 44px;
}
.psnine-settings-row label {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  padding-right: 12px;
}
.psnine-settings-row input[type="text"],
.psnine-settings-row input[type="number"],
.psnine-settings-row select,
.psnine-settings-row textarea {
  font-size: 16px; /* Prevents auto-zoom on iOS Safari */
  padding: 8px 12px;
  border: 1px solid #ccd6dd;
  border-radius: 6px;
  background: #fff;
  color: #2c3e50;
  max-width: 200px;
  min-height: 38px;
  box-sizing: border-box;
}
.psnine-settings-footer {
  padding: 14px 20px;
  border-top: 1px solid #e1e8ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  flex-wrap: wrap;
  gap: 8px;
}

/* iOS-Style Toggle Switch */
.psnine-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
  flex-shrink: 0;
}
.psnine-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.psnine-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ccc;
  transition: .3s;
  border-radius: 28px;
}
.psnine-slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.psnine-switch input:checked + .psnine-slider {
  background-color: #2ecc71;
}
.psnine-switch input:checked + .psnine-slider:before {
  transform: translateX(22px);
}

/* Floor Number & Author Badges */
.psnine-floor-badge {
  display: inline-block;
  font-size: 12px;
  color: #7f8c8d;
  margin-right: 6px;
  user-select: none;
}
.psnine-author-badge {
  display: inline-block;
  background: #3498db;
  color: #ffffff;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 4px;
  margin-left: 5px;
  vertical-align: middle;
}

/* Reply Traceback Card */
.psnine-traceback-card {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-left: 3px solid #3498db;
  border-radius: 4px;
  font-size: 13px;
}
.psnine-traceback-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #34495e;
  margin-bottom: 4px;
}
.psnine-traceback-content {
  color: #555;
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

/* Trophy Overview Panel & Native Sort Dropdown */
#psnine-trophy-stats-panel .psnine-trophy-overview-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
#psnine-trophy-header-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
#psnine-trophy-header-title .psnine-trophy-title-text {
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}
#psnine-trophy-header-counts {
  white-space: nowrap;
  font-size: 12px;
  color: #666;
  font-weight: normal;
}
#psnine-trophy-completion-badge {
  font-size: 11px;
  font-weight: normal;
  line-height: 1.4;
}
#psnine-trophy-stats-panel .psnine-trophy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 12px;
}
#psnine-trophy-stats-panel .psnine-trophy-action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
#psnine-trophy-stats-panel .psnine-trophy-toolbar button {
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.4;
  border-radius: 4px;
  white-space: nowrap;
}
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
  outline: 2px solid #3890ff;
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
`;

export const DARK_THEME_STYLES = `
/* psnine_next Dark Theme */
body.bg, body[data-theme="dark"], html[data-theme="dark"] body {
  background: #2b2b2b !important;
  color: #bbb !important;
}
.box, .content, .header, .footer, .list li, .sonlist li, .dropdown ul, table.list {
  background-color: #2b2b2b !important;
  color: #bbb !important;
  border-color: #444 !important;
}
.box .post, td, th {
  border-bottom: 1px solid #3a3a3a !important;
}
.list li:hover {
  background-color: #353535 !important;
}
a {
  color: #64a5ff !important;
}
a:visited {
  color: #9b72cf !important;
}
.psnnode {
  background-color: #4f4f4f !important;
  color: #ddd !important;
}
/* Spoiler Bar (.mark) Dark Mode Rules (G04): no unconditional :hover; JS controls unmask */
.mark {
  background-color: #555555 !important;
  color: #555555 !important;
  cursor: pointer;
  user-select: none;
  border-radius: 2px;
  padding: 1px 4px;
}
.mark.unmasked,
.mark.pinned {
  color: #ffffff !important;
  user-select: text;
}
.psnine-settings-dialog {
  background: #333333 !important;
  color: #eeeeee !important;
}
.psnine-settings-header, .psnine-settings-footer {
  border-color: #444 !important;
  background: #2a2a2a !important;
}
.psnine-settings-row {
  border-color: #3e3e3e !important;
}
.psnine-settings-row input, .psnine-settings-row select, .psnine-settings-row textarea {
  background: #222 !important;
  color: #eee !important;
  border-color: #555 !important;
}

/* Dark mode button contrast */
[data-psnine-next] button,
button[data-psnine-next],
.psnine-btn {
  color: #eeeeee !important;
  background-color: #3d3d3d !important;
  border-color: #555555 !important;
}

.psnine-traceback-card {
  background: rgba(255, 255, 255, 0.06) !important;
}
.psnine-traceback-header {
  color: #9ac8eb !important;
}
.psnine-traceback-content {
  color: #bbb !important;
}
`;
