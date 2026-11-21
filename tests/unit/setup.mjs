/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Generate the gitignored raw WASM needed by the Node ExifTool runtime.
 * The shipped application still uses the compressed .wasm.gz asset.
 * No network access or node_modules dependencies are required here.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { access, rename, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
const wasm = new URL('../../assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm', import.meta.url);
const compressed = new URL(`${wasm.href}.gz`);
const expectedSize = 27_651_111;
let valid = false;
try {
  await access(wasm);
  valid = (await stat(wasm)).size === expectedSize;
} catch { /* Not generated yet. */ }
if (!valid) {
  const temporary = new URL(`${wasm.href}.test-${process.pid}.tmp`);
  try {
    await pipeline(createReadStream(compressed), createGunzip(), createWriteStream(temporary));
    if ((await stat(temporary)).size !== expectedSize) {
      throw new Error('Decompressed ExifTool WASM size mismatch.');
    }
    await rename(temporary, wasm);
  } finally {
    await rm(temporary, { force: true });
  }
}