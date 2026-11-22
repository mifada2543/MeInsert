/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const WATERMARK = [
  'MeInsert — Edit metadata file tanpa upload, 100% di browser.',
  'Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert',
  'reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2',
];
const ROOTS = ['assets/css', 'assets/js', 'scripts', 'tests', 'sw.js'];
async function collect(path) {
  const files = [];
  const info = await stat(path);
  if (info.isFile()) {
    if (/\.(js|mjs|css)$/i.test(path)) files.push(path);
    return files;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await collect(child));
    else if (/\.(js|mjs|css)$/i.test(entry.name)) files.push(child);
  }
  return files;
}
test('every MeInsert source code file carries the license watermark', async () => {
  const files = (await Promise.all(ROOTS.map((path) => collect(join(root, path))))).flat();
  assert.ok(files.length > 100, `watermark scan must cover the whole codebase, found ${files.length} files`);
  const missing = [];
  for (const file of files) {
    const head = (await readFile(file, 'utf8')).split(/\r?\n/).slice(0, 4).join('\n');
    if (!WATERMARK.every((line) => head.includes(line))) missing.push(relative(root, file));
  }
  assert.deepEqual(missing, [], `files without watermark: ${missing.join(', ')}`);
});
test('the generated CSS bundle has exactly one watermark at the top', async () => {
  const source = await readFile(join(root, 'assets/css/app.bundle.css'), 'utf8');
  const banner = WATERMARK.map((line) => `/* ${line} */`);
  assert.deepEqual(source.split(/\r?\n/).slice(0, 3), banner);
  for (const line of banner) {
    assert.equal(source.split(line).length - 1, 1, `duplicated watermark line: ${line}`);
  }
});