/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import adapter, { fieldsFor, meta, read, sectionsFor, write } from '../../assets/js/formats/raw-video.js';
const SOURCE = new URL('../../assets/js/formats/raw-video.js', import.meta.url);
const WATERMARK = [
  '/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */',
  '/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */',
  '/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */',
];
const SAMPLE = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
));
test('raw-video.js diawali watermark lisensi tepat 3 baris', async () => {
  const lines = (await readFile(SOURCE, 'utf8')).split('\n').slice(0, 3).map((line) => line.trimEnd());
  assert.deepEqual(lines, WATERMARK);
});
test('meta dan seluruh field adapter bersifat read-only', () => {
  assert.equal(meta.readOnly, true);
  assert.equal(meta.id, 'rawVideo');
  assert.equal(meta.engine, 'exiftool');
  assert.deepEqual(meta.extensions, ['braw', 'r3d', 'ari', 'mxf']);
  assert.equal(adapter.meta.readOnly, true);
  for (const subtype of ['braw', 'r3d', 'arriraw']) {
    assert.ok(sectionsFor(subtype).length > 0);
    const fields = fieldsFor(subtype);
    assert.equal(fields.length, 6);
    for (const field of fields) {
      assert.equal(field.readOnly, true, `field ${field.id} harus readOnly`);
    }
  }
  assert.equal(adapter.fields.length, 6);
  assert.equal(adapter.sections.length, 1);
});
test('write() menolak penulisan dengan kode UNSUPPORTED_WRITE', async () => {
  const file = new File([SAMPLE], 'take.braw', { type: 'video/*' });
  await assert.rejects(write(file, {}, {}), { code: 'UNSUPPORTED_WRITE' });
  await assert.rejects(adapter.write(file, {}, {}), { code: 'UNSUPPORTED_WRITE' });
});
test('read() mengembalikan struktur read-only untuk File sintetis', async () => {
  const file = new File([SAMPLE], 'take.braw', { type: 'video/*' });
  const result = await read(file, { extension: 'braw', subtype: 'braw', mime: 'video/*' });
  assert.equal(result.info.kind, 'video');
  assert.deepEqual(result.custom, []);
  assert.ok(Array.isArray(result.raw));
  for (const id of fieldsFor('braw').map((field) => field.id)) {
    assert.ok(id in result.fields, `field ${id} harus ada di hasil baca`);
  }
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings.every((warning) => typeof warning === 'string' && warning.length > 0));
});
