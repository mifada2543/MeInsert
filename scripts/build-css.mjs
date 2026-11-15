/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/**
 * Bundles assets/css/app.css (@import berantai) menjadi satu file statis.
 *
 * Tanpa dependensi: hanya Node >= 18 (fs/promises). Hasilnya
 * `assets/css/app.bundle.css` yang di-commit, sehingga GitHub Pages
 * tetap "no build" — file bundel ikut serta dalam repository.
 *
 * Jalankan:  npm run build:css
 * Cek sinkron: npm run check:css  (dipakai juga oleh tests/unit/manifest.test.js)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssDir = join(root, 'assets', 'css');
const entry = join(cssDir, 'app.css');
const outFile = join(cssDir, 'app.bundle.css');
const BANNER = `/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Bundel otomatis dari assets/css/*.css — JANGAN diedit langsung.
 * Sumber: assets/css/app.css + @import. Jalankan \`npm run build:css\`. */`;
const IMPORT_RE = /@import\s+"([^"]+)";\s*/g;
async function readCss(file) {
  return readFile(file, 'utf8');
}
/** Resolve an @import target relative to the importing file. */
function resolveImport(fromFile, spec) {
  return resolve(dirname(fromFile), spec);
}
/**
 * Flattens the @import graph. Order follows the source order in each file,
 * depth-first, exactly like the browser cascade.
 */
export async function bundleCss(entryFile = entry) {
  const chunks = [];
  const seen = new Set();
  async function walk(file) {
    const key = file;
    if (seen.has(key)) return;
    seen.add(key);
    const source = await readCss(file);
    let cursor = 0;
    for (const match of source.matchAll(IMPORT_RE)) {
      const before = source.slice(cursor, match.index);
      if (before.trim()) chunks.push(before.trim());
      const target = resolveImport(file, match[1]);
      await walk(target);
      cursor = match.index + match[0].length;
    }
    const rest = source.slice(cursor);
    if (rest.trim()) chunks.push(rest.trim());
  }
  await walk(entryFile);
  return `${BANNER}\n\n${chunks.join('\n\n')}\n`;
}
export async function buildCss({ write = true } = {}) {
  const css = await bundleCss();
  if (write) {
    await writeFile(outFile, css, 'utf8');
    const kb = (Buffer.byteLength(css, 'utf8') / 1024).toFixed(1);
    console.log(`built ${relative(root, outFile)} (${kb} KB, ${seenCount(css)} rules)`);
  }
  return css;
}
function seenCount(css) {
  return (css.match(/\{/g) || []).length;
}
export async function cssIsUpToDate() {
  const current = await readCss(outFile, 'utf8').catch(() => '');
  const fresh = await bundleCss();
  return current.trim() === fresh.trim();
}
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--check')) {
    const ok = await cssIsUpToDate();
    if (!ok) {
      console.error('app.bundle.css tidak sinkron dengan sumber CSS. Jalankan: npm run build:css');
      process.exitCode = 1;
    } else {
      console.log('app.bundle.css sinkron dengan sumber CSS.');
    }
  } else {
    await buildCss();
  }
}