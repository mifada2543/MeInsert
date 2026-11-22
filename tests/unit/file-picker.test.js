/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const OFFICE = ['.docx', '.docm', '.xlsx', '.xlsm', '.pptx', '.pptm', '.odt', '.ods', '.odp'];
function exts(value) {
  return new Set(String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
}
test('single-file picker advertises every supported Office format', async () => {
  const source = await readFile('assets/js/editor/editor-file.js', 'utf8');
  const match = source.match(/els\.fileInput\.accept\s*=\s*'([^']+)'/);
  assert.ok(match, 'fileInput.accept assignment not found');
  const single = exts(match[1]);
  const missing = OFFICE.filter((ext) => !single.has(ext));
  assert.deepEqual(missing, [], `Office formats missing from single-file picker: ${missing.join(', ')}`);
});
test('single-file and batch pickers stay in sync', async () => {
  const source = await readFile('assets/js/editor/editor-file.js', 'utf8');
  const single = exts(source.match(/els\.fileInput\.accept\s*=\s*'([^']+)'/)[1]);
  const batch = await readFile('batch.html', 'utf8');
  const batchAccept = [...batch.matchAll(/accept="([^"]+)"/g)].map((item) => item[1]);
  assert.ok(batchAccept.length >= 2, 'batch picker accept attributes not found');
  const missing = [...exts(batchAccept[0])].filter((ext) => !single.has(ext));
  assert.deepEqual(missing, [], `Batch picker offers formats missing in single editor: ${missing.join(', ')}`);
});