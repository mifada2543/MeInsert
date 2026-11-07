/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/**
 * Copies the pinned runtime libraries from node_modules into assets/vendor.
 * The app itself has no build step; run this only when updating a dependency.
 *
 * NOTE (license): the ExifTool, zeroperl, and pdf-lib-dependency notices in
 * assets/vendor/licenses/ (exiftool-LICENSE.txt, zeroperl-LICENSE,
 * pdf-lib-dependencies-LICENSES.md) are NOT copied by the copies[] list
 * below because they ship inside @colorhythm/exiftool-wasm / pdf-lib's
 * bundle, not as standalone LICENSE files in node_modules. This script
 * intentionally leaves them untouched; do not delete assets/vendor/licenses/
 * wholesale on a re-vendor run. See assets/THIRD_PARTY_LICENSES.md.
 */
import { cp, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const vendor = join(root, 'assets', 'vendor');
const licenses = join(vendor, 'licenses');

const copies = [
  ['@colorhythm/exiftool-wasm/dist/esm/index.js', 'exiftool-wasm/index.js'],
  ['@colorhythm/exiftool-wasm/LICENSE', 'licenses/exiftool-wasm-LICENSE'],
  ['mediabunny/dist/bundles/mediabunny.min.mjs', 'mediabunny.mjs'],
  ['mediabunny/LICENSE', 'licenses/mediabunny-LICENSE'],
  ['pdf-lib/dist/pdf-lib.esm.min.js', 'pdf-lib.esm.js'],
  ['pdf-lib/LICENSE.md', 'licenses/pdf-lib-LICENSE.md'],
  ['browser-id3-writer/dist/browser-id3-writer.mjs', 'browser-id3-writer.mjs'],
  ['browser-id3-writer/LICENSE.md', 'licenses/browser-id3-writer-LICENSE.md'],
  ['fflate/esm/browser.js', 'fflate.mjs'],
  ['fflate/LICENSE', 'licenses/fflate-LICENSE'],
];

await mkdir(vendor, { recursive: true });
await mkdir(licenses, { recursive: true });

for (const [from, to] of copies) {
  const src = join(nm, from);
  const dest = join(vendor, to);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  console.log(`copied ${from}`);
}

const wasmDir = join(nm, '@colorhythm', 'exiftool-wasm', 'dist', 'esm');
for (const file of await readdir(wasmDir)) {
  if (!file.endsWith('.wasm')) continue;
  await cp(join(wasmDir, file), join(vendor, 'exiftool-wasm', file));
  console.log(`copied ${file}`);
}

const mainWasm = (await readdir(join(vendor, 'exiftool-wasm'))).find((f) => f.endsWith('.wasm'));
if (!mainWasm) throw new Error('ExifTool WASM asset was not copied.');
console.log(`done. ExifTool asset: ${mainWasm}`);
