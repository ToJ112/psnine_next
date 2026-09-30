import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         PSNINE Next (PSN中文网功能增强)
// @namespace    https://github.com/ToJ112/psnine_next
// @version      1.0.0
// @description  现代化重构版 PSN中文网功能增强脚本，深度适配桌面 Tampermonkey 与 iOS Safari Stay
// @author       ToJ112, swsoyee, InfinityLoop, mordom0404, Nathaniel-Wu, JayusTree, aesct
// @match        https://psnine.com/*
// @match        https://www.psnine.com/*
// @match        https://*.psnine.com/*
// @match        http://psnine.com/*
// @match        http://www.psnine.com/*
// @match        http://*.psnine.com/*
// @match        https://d7vg.com/*
// @match        https://www.d7vg.com/*
// @match        https://*.d7vg.com/*
// @match        http://d7vg.com/*
// @match        http://www.d7vg.com/*
// @match        http://*.d7vg.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

`;

async function build() {
  console.log('[build] Starting esbuild bundling...');
  const outDir = 'dist';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'psnine_next.user.js');

  const result = await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    format: 'iife',
    target: ['safari15', 'es2020'],
    minify: false,
    sourcemap: false,
    write: false,
  });

  const bundledCode = result.outputFiles[0].text;

  // Strict verification: Ensure no unbundled external require or import exists
  const lines = bundledCode.split('\n');
  const hasBareImport = lines.some(l => /^\s*import\s+.*from\s+['"]/.test(l));
  const hasDynamicImport = /import\s*\(/.test(bundledCode);

  if (hasBareImport || hasDynamicImport) {
    throw new Error('[build] Verification failed: Found unbundled imports in output!');
  }

  const finalOutput = USERSCRIPT_HEADER + bundledCode;
  fs.writeFileSync(outFile, finalOutput, 'utf-8');

  const stats = fs.statSync(outFile);
  console.log(`[build] Successfully generated ${outFile} (${(stats.size / 1024).toFixed(1)} KB)`);
}

build().catch(err => {
  console.error('[build] Failed:', err);
  process.exit(1);
});
