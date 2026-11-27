/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { exiftoolBuild } from '../assets/js/core/image-engine-build.js';

const root = new URL('../', import.meta.url);
const pages = ['index.html', 'single.html', 'batch.html', 'about.html', 'privacy.html', 'Terms.html'];
const assetLink = /<(?:script|link)\b[^>]*\b(?:src|href)="(assets\/(?:js\/[^"]+\.js|css\/app\.bundle\.css))"[^>]*>/g;
const critical = new Set([
  'assets/vendor/exiftool-wasm/index.js',
  `assets/vendor/exiftool-wasm/${exiftoolBuild.name}.br`,
  'assets/vendor/brotli-decode.mjs',
  'sw.js',
]);
for (const name of pages) {
  const html = await readFile(new URL(name, root), 'utf8');
  for (const [, path] of html.matchAll(assetLink)) critical.add(path);
}
const assets = {};
for (const path of [...critical].sort()) {
  const bytes = await readFile(new URL(path, root));
  assets[path] = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
}
const manifest = new URL('asset-integrity.json', import.meta.url);
const expected = `${JSON.stringify(assets, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(manifest, 'utf8').catch(() => '') !== expected) {
    console.error('Asset integrity manifest is stale. Run npm run build:sri and review the changed hashes.');
    process.exitCode = 1;
  }
} else {
  await writeFile(manifest, expected);
}
