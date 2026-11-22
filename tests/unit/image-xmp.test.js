/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTagMap, fieldsFor, mapTags, read, write } from '../../assets/js/formats/image.js';
const PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
));
test('PNG and WebP expose camera fields', () => {
  const ids = fieldsFor('png').map((field) => field.id);
  assert.ok(ids.includes('make'));
  assert.ok(ids.includes('model'));
  assert.ok(ids.includes('lens'));
  assert.ok(ids.includes('dateTaken'));
  assert.ok(fieldsFor('webp').map((field) => field.id).includes('dateTaken'));
});
test('PNG camera fields use XMP names, JPEG keeps native EXIF', () => {
  const payload = { set: { make: 'Canon', model: 'EOS', lens: 'RF 24-70', dateTaken: '2026-01-02' }, remove: [] };
  assert.deepEqual(buildTagMap(payload, 'png'), {
    'XMP-tiff:Make': 'Canon',
    'XMP-tiff:Model': 'EOS',
    'XMP-aux:Lens': 'RF 24-70',
    'XMP-exif:DateTimeOriginal': '2026:01:02 00:00:00',
  });
  assert.deepEqual(buildTagMap(payload, 'jpeg'), {
    'EXIF:Make': 'Canon',
    'EXIF:Model': 'EOS',
    'EXIF:LensModel': 'RF 24-70',
    'EXIF:DateTimeOriginal': '2026:01:02 00:00:00',
  });
});
test('PNG reading prefers XMP camera tags over EXIF', () => {
  const fields = mapTags({
    'XMP-tiff:Make': 'Canon',
    'EXIF:Make': 'Lama',
    'XMP-aux:Lens': 'RF 24-70',
    'XMP-exif:DateTimeOriginal': '2026:01:02 03:04:05',
  }, 'png');
  assert.equal(fields.make, 'Canon');
  assert.equal(fields.lens, 'RF 24-70');
  assert.equal(fields.dateTaken, '2026-01-02');
});
test('PNG round-trip writes and reads camera metadata as XMP', async () => {
  const source = new File([PNG], 'input.png', { type: 'image/png' });
  const out = await write(source, {
    set: {
      title: 'Foto uji',
      make: 'Canon',
      model: 'EOS R6',
      lens: 'RF 24-70mm',
      dateTaken: '2026-01-02',
    },
    remove: [],
    custom: [],
    customRemove: [],
    rawRemove: [],
  }, { extension: 'png', subtype: 'png', mime: 'image/png' });
  assert.deepEqual(out.warnings, []);
  assert.equal(out.fields.make, 'Canon');
  assert.equal(out.fields.dateTaken, '2026-01-02');
  const back = await read(new File([await out.blob.arrayBuffer()], 'output.png', { type: 'image/png' }), {
    extension: 'png',
    subtype: 'png',
  });
  assert.equal(back.fields.title, 'Foto uji');
  assert.equal(back.fields.make, 'Canon');
  assert.equal(back.fields.model, 'EOS R6');
  assert.equal(back.fields.lens, 'RF 24-70mm');
  assert.equal(back.fields.dateTaken, '2026-01-02');
});