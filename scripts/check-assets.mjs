/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Development-only guard for optimised brand assets. No runtime dependency.
import { readFileSync } from 'node:fs';
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
if (problems.length) {
  console.error(`Asset check failed:\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Asset check ok: ${EXPECTED.size} optimised image assets.`);
}