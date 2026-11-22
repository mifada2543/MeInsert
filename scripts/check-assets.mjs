/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */

import { readFileSync } from 'node:fs';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { exiftoolBuild as engine } from '../assets/js/core/image-engine-build.js';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const EXPECTED = new Map([
  ['apple-touch-icon.png', [0x89, 0x50, 0x4e, 0x47]],
  ['favicon-64.png', [0x89, 0x50, 0x4e, 0x47]],
  ['logo-96.webp', [0x52, 0x49, 0x46, 0x46]],
  ['icon-192.webp', [0x52, 0x49, 0x46, 0x46]],
  ['icon-512.webp', [0x52, 0x49, 0x46, 0x46]],
  ['icon-maskable-512.webp', [0x52, 0x49, 0x46, 0x46]],
  ['og-image.jpg', [0xff, 0xd8, 0xff]],
]);
const MAX_BYTES = 120 * 1024;
const problems = [];
for (const [name, magic] of EXPECTED) {
  const bytes = readFileSync(`${root}/assets/img/${name}`);
  if (bytes.length > MAX_BYTES) problems.push(`${name}: ${bytes.length} byte melebihi ${MAX_BYTES}`);
  if (!magic.every((value, index) => bytes[index] === value)) problems.push(`${name}: magic bytes tidak sesuai`);
  if (name.endsWith('.webp') && String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP') {
    problems.push(`${name}: bukan container WebP`);
  }
}
const ENGINE_DIR = new URL('../assets/vendor/exiftool-wasm/', import.meta.url);
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const loader = readFileSync(new URL('index.js', ENGINE_DIR), 'utf8');
if (!loader.includes(engine.name) || !engine.name.includes(engine.sha256.slice(0, 12))) {
  problems.push('ExifTool loader or filename does not match the build manifest.');
}
for (const [suffix, size, decompress] of [
  ['gz', engine.gzipBytes, gunzipSync],
  ['br', engine.brotliBytes, brotliDecompressSync],
]) {
  const filename = `${engine.name}.${suffix}`;
  if (!sw.includes(`./assets/vendor/exiftool-wasm/${filename}`)) {
    problems.push(`Service worker does not recognise ${filename}.`);
  }
  try {
    const compressed = readFileSync(new URL(filename, ENGINE_DIR));
    if (compressed.length !== size) problems.push(`${filename} has an unexpected size.`);
    if (suffix === 'br') {
      if (size >= 4_500_000) problems.push('Brotli WASM exceeds the 4.5 MB transfer budget.');
      if (createHash('sha256').update(compressed).digest('hex') !== engine.brotliSha256) {
        problems.push('Brotli WASM SHA-256 differs from the pinned compressed payload.');
      }
    }
    const plain = decompress(compressed);
    const digest = createHash('sha256').update(plain).digest('hex');
    if (plain.length !== engine.rawBytes || digest !== engine.sha256 || !WebAssembly.validate(plain)) {
      problems.push(`${filename} does not decode to the pinned valid WASM.`);
    }
  } catch (error) {
    problems.push(`${filename} is not readable: ${error.message}`);
  }
}
if (problems.length) {
  console.error(`Asset check failed:\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Asset check ok: ${EXPECTED.size} optimised images, gzip WASM ${engine.gzipBytes} bytes, Brotli WASM ${engine.brotliBytes} bytes.`);
}