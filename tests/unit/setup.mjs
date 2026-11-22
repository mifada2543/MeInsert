/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */

import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, rename, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createBrotliDecompress } from 'node:zlib';
const wasm = new URL(`../../assets/vendor/exiftool-wasm/${exiftoolBuild.name}`, import.meta.url);
const compressed = new URL(`${wasm.href}.br`);
const expectedSize = exiftoolBuild.rawBytes;
let valid = false;
try {
  await access(wasm);
  valid = (await stat(wasm)).size === expectedSize;
} catch {  }
if (!valid) {
  const temporary = new URL(`${wasm.href}.test-${process.pid}.tmp`);
  try {
    await pipeline(createReadStream(compressed), createBrotliDecompress(), createWriteStream(temporary));
    if ((await stat(temporary)).size !== expectedSize) {
      throw new Error('Decompressed ExifTool WASM size mismatch.');
    }
    await rename(temporary, wasm);
  } finally {
    await rm(temporary, { force: true });
  }
}