/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaKind } from '../../assets/js/core/media-kind.js';
import { categoryForDetection } from '../../assets/js/batch/batch-limits.js';
import { fileIconName } from '../../assets/js/batch/batch-item.js';
const kindCases = [
  [null, 'light'],
  [undefined, 'light'],
  [{ kind: 'audio' }, 'audio'],
  [{ kind: 'video' }, 'video'],
  [{ kind: 'light' }, 'light'],
  [{ subtype: 'm4a' }, 'audio'],
  [{ id: 'mp3' }, 'audio'],
  [{ id: 'flac' }, 'audio'],
  [{ id: 'ogg', subtype: 'opus' }, 'audio'],
  [{ id: 'mkv' }, 'video'],
  [{ id: 'mp4' }, 'video'],
  [{ id: 'mp4', subtype: 'mov' }, 'video'],
  [{ id: 'rawVideo', subtype: 'braw' }, 'video'],
  [{ id: 'image', subtype: 'jpeg' }, 'light'],
  [{ id: 'office', subtype: 'docx' }, 'light'],
  [{ id: 'mp4', subtype: 'm4a', kind: 'video' }, 'video'],
  [{ id: 'mp4', subtype: 'mp4', kind: 'light' }, 'light'],
];
test('mediaKind maps detections to a single media category', () => {
  for (const [detection, expected] of kindCases) {
    assert.equal(mediaKind(detection), expected, JSON.stringify(detection));
  }
});
test('categoryForDetection delegates to mediaKind', () => {
  assert.equal(categoryForDetection(null), 'light');
  assert.equal(categoryForDetection({ id: 'mp4', subtype: 'm4a' }), 'audio');
  assert.equal(categoryForDetection({ id: 'mp4', kind: 'video', brandKind: 'generic' }), 'video');
  assert.equal(categoryForDetection({ id: 'mp4', kind: 'audio', subtype: 'm4a', codecs: ['AAC'] }), 'audio');
  assert.equal(categoryForDetection({ id: 'mp4', kind: 'light' }), 'light');
  assert.equal(categoryForDetection({ id: 'image', subtype: 'png' }), 'light');
});
test('fileIconName follows mediaKind after image and pdf branches', () => {
  assert.equal(fileIconName({ detection: { id: 'image', subtype: 'jpeg' } }), 'image');
  assert.equal(fileIconName({ detection: { id: 'pdf', subtype: 'pdf' } }), 'pdf');
  assert.equal(fileIconName({ detection: { id: 'mp4', subtype: 'm4a' } }), 'audio');
  assert.equal(fileIconName({ detection: { id: 'mp4', kind: 'audio', codecs: ['AAC'] } }), 'audio');
  assert.equal(fileIconName({ detection: { id: 'mp4', kind: 'video', subtype: 'mp4' } }), 'video');
  assert.equal(fileIconName({ detection: { id: 'mp4', kind: 'light' } }), 'file');
  assert.equal(fileIconName({}), 'file');
});
