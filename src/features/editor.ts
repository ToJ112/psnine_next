import { Context, Mount, Cleanup } from '../core/types';
import { enhanceMasks } from './global';

/**
 * Escapes HTML characters to prevent XSS during live preview.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Converts safe BBCode into HTML.
 * Supports [b], [i], [u], [s], [mask], [mark], [center], [quote], [color], [img], [url=...], [url]...[/url].
 */
export function parseBBCode(rawText: string): string {
  let html = escapeHtml(rawText);

  // Formatting tags
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<del>$1</del>');

  // Spoilers: [mask] and [mark]
  html = html.replace(/\[(mask|mark)\]([\s\S]*?)\[\/\1\]/gi, '<span class="mark">$2</span>');

  // Alignment: [center]
  html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align:center;">$1</div>');

  // Blockquote: [quote]
  html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>');

  // Colors: [color=...]
  html = html.replace(/\[color=([a-zA-Z#0-9]+)\]([\s\S]*?)\[\/color\]/gi, (match, color, content) => {
    if (/^[a-zA-Z]+$|^#[0-9a-fA-F]{3,6}$/.test(color)) {
      return `<span style="color:${color}">${content}</span>`;
    }
    return content;
  });

  // Images: [img]https://...[/img]
  html = html.replace(/\[img\](https?:\/\/[^\s<>"']+)\[\/img\]/gi, '<img src="$1" style="max-width:100%; border-radius:4px;">');

  // URL with custom text: [url=https://...]text[/url]
  html = html.replace(/\[url=(https?:\/\/[^\s<>"']+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');

  // Bare URL tag: [url]https://...[/url]
  html = html.replace(/\[url\](https?:\/\/[^\s<>"']+)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // Line breaks
  html = html.replace(/\r?\n/g, '<br>');

  return html;
}

/**
 * Live character counter and 600-character limit enforcer on gene post creation (C17).
 * Strictly scoped ONLY to gene post creation (/set/gene or form[action*="/gene"]).
 * Uses event capture on submit/click to block over-limit submissions without overriding
 * site native button disabled state (e.g. submitting in-flight or risk-control).
 */
export function setupGeneWordCount(ctx: Context, root: ParentNode): void {
  const isGeneRoute = ctx.url.pathname.includes('/set/gene') || ctx.url.pathname.endsWith('/gene/new');

  const geneForm = root.querySelector('form[action*="/gene"], form#form-gene') || (isGeneRoute ? root.querySelector('form') : null);
  if (!geneForm) return;

  const textarea = geneForm.querySelector('textarea[name="content"], textarea#content') as HTMLTextAreaElement | null;
  if (!textarea || textarea.getAttribute('data-psnine-gene-ready')) return;

  textarea.setAttribute('data-psnine-gene-ready', 'true');

  const container = ctx.document.createElement('div');
  container.className = 'psnine-gene-count-box';
  container.setAttribute('data-psnine-next', 'chrome');
  container.style.cssText = 'margin-top:6px; font-size:13px; color:#7f8c8d; font-weight:500;';

  textarea.after(container);

  const submitBtn = geneForm.querySelector('input[type="submit"], button[type="submit"]') as HTMLInputElement | HTMLButtonElement | null;
  const maxLimit = 600;
  let isOverLimit = false;

  const updateCount = () => {
    // Official P9 logic excludes newlines from character count
    const cleanText = textarea.value.replace(/[\r\n]/g, '');
    const len = cleanText.length;
    isOverLimit = len > maxLimit;

    if (isOverLimit) {
      container.style.color = '#e74c3c';
      container.style.fontWeight = 'bold';
      container.textContent = `机因字数: ${len} / ${maxLimit} (已超限，无法发表)`;
    } else {
      container.style.color = '#7f8c8d';
      container.style.fontWeight = '500';
      container.textContent = `机因字数: ${len} / ${maxLimit}`;
    }
  };

  // Block form submission in capturing phase if over limit
  geneForm.addEventListener('submit', (e) => {
    if (isOverLimit) {
      e.preventDefault();
      e.stopPropagation();
      ctx.window.alert?.('机因字数超过 600 字限制，无法发表！');
    }
  }, true);

  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      if (isOverLimit) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  textarea.addEventListener('input', updateCount);
  updateCount();
}

/**
 * BBCode live preview container below form (C18).
 * Explicitly enhances generated .mark elements inside the preview container.
 */
export function setupBBCodePreview(ctx: Context, root: ParentNode): void {
  const textarea = root.querySelector('textarea#content, textarea[name="content"]') as HTMLTextAreaElement | null;
  if (!textarea || textarea.getAttribute('data-psnine-preview-ready')) return;

  textarea.setAttribute('data-psnine-preview-ready', 'true');

  const previewBox = ctx.document.createElement('div');
  previewBox.id = 'psnine-bbcode-preview';
  previewBox.setAttribute('data-psnine-next', 'chrome');
  previewBox.style.cssText = 'margin-top:10px; padding:12px; border:1px dashed #ccd6dd; border-radius:6px; min-height:40px; word-wrap:break-word; word-break:break-word; display:none;';

  const previewHeader = ctx.document.createElement('div');
  previewHeader.textContent = '实时预览 (BBCode)';
  previewHeader.style.cssText = 'font-size:12px; color:#7f8c8d; font-weight:bold; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;';
  previewBox.appendChild(previewHeader);

  const previewContent = ctx.document.createElement('div');
  previewContent.className = 'content';
  previewBox.appendChild(previewContent);

  textarea.after(previewBox);

  const updatePreview = () => {
    const val = textarea.value.trim();
    if (val.length === 0) {
      previewBox.style.display = 'none';
      previewContent.innerHTML = '';
    } else {
      previewBox.style.display = 'block';
      previewContent.innerHTML = parseBBCode(val);
      // Explicitly enhance spoiler marks inside preview
      enhanceMasks(ctx, previewContent);
    }
  };

  textarea.addEventListener('input', updatePreview);
  if (textarea.value.trim().length > 0) {
    updatePreview();
  }
}

/**
 * Main Editor Module Mount
 */
export const mountEditor: Mount = (ctx: Context): Cleanup => {
  const enhance = (root: ParentNode) => {
    setupGeneWordCount(ctx, root);
    setupBBCodePreview(ctx, root);
  };

  enhance(ctx.document.body || ctx.document);

  const unsubs = ctx.onContent((root) => {
    enhance(root);
  });

  return () => {
    unsubs();
  };
};
