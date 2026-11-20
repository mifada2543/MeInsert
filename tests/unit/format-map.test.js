/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_FIELDS, crossFormatPatch, crossTarget } from '../../assets/js/core/format-map.js';
const detectionFields = {
  mp3: new Set(['title', 'artist', 'album', 'year', 'genre', 'comment', 'copyright', 'composer', 'software']),
  image: new Set(['title', 'creator', 'description', 'keywords', 'rights', 'date', 'software']),
  pdf: new Set(['title', 'author', 'subject', 'keywords', 'creator', 'producer', 'creationDate', 'modDate']),
};
test('standard fields are unique and stable', () => {
  const ids = STANDARD_FIELDS.map((field) => field.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('title'));
  assert.ok(ids.includes('date'));
});
test('crossTarget respects format-specific field names', () => {
  assert.equal(crossTarget('image', 'artist'), 'creator');
  assert.equal(crossTarget('image', 'copyright'), 'rights');
  assert.equal(crossTarget('pdf', 'artist'), 'author');
  assert.equal(crossTarget('mp3', 'date'), 'year');
  assert.equal(crossTarget('pdf', 'album'), '');
});
test('crossFormatPatch converts a date to a four-digit year for MP3', () => {
  const patch = crossFormatPatch({
    detectionId: 'mp3',
    availableFields: detectionFields.mp3,
    values: { title: 'Lagu', date: '2026-01-02' },
  });
  assert.deepEqual(patch.set, { title: 'Lagu', year: '2026' });
});
test('crossFormatPatch skips fields a format does not expose', () => {
  const patch = crossFormatPatch({
    detectionId: 'image',
    availableFields: detectionFields.image,
    values: { artist: 'Fotografer', copyright: '© 2026', comment: 'Tidak ada di PNG' },
  });
  assert.deepEqual(patch.set, { creator: 'Fotografer', rights: '© 2026' });
});
test('crossFormatPatch never forces album or composer into PDF', () => {
  const patch = crossFormatPatch({
    detectionId: 'pdf',
    availableFields: detectionFields.pdf,
    values: { title: 'Laporan', artist: 'Penulis', album: 'X', genre: 'Y', composer: 'Z', copyright: 'C' },
  });
  assert.deepEqual(patch.set, { title: 'Laporan', author: 'Penulis' });
});
test('crossFormatPatch maps removals to native field ids', () => {
  const patch = crossFormatPatch({
    detectionId: 'mp3',
    availableFields: detectionFields.mp3,
    values: { title: 'Tetap' },
    removed: ['artist', 'date'],
  });
  assert.deepEqual(patch.set, { title: 'Tetap' });
  assert.deepEqual(patch.remove.sort(), ['artist', 'year']);
});
test('crossFormatPatch only works for known detection ids', () => {
  const patch = crossFormatPatch({ detectionId: 'unknown', values: { title: 'X' } });
  assert.deepEqual(patch, { set: {}, remove: [] });
});