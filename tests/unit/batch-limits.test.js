/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_LIMITS,
  applyDurationLimits,
  categoryForDetection,
  validateSelection,
} from '../../assets/js/batch/batch-limits.js';
import { makeCsvReport, makeJsonReport } from '../../assets/js/batch/batch-report.js';

const file = (size) => ({ size });

test('categoryForDetection classifies supported families', () => {
  assert.equal(categoryForDetection({ id: 'mp4', subtype: 'm4a' }), 'audio');
  assert.equal(categoryForDetection({ id: 'mp4', subtype: 'mp4' }), 'video');
  assert.equal(categoryForDetection({ id: 'ogg', subtype: 'opus' }), 'audio');
  assert.equal(categoryForDetection({ id: 'image', subtype: 'png' }), 'light');
});

test('validateSelection enforces video and total limits', () => {
  const items = Array.from({ length: BATCH_LIMITS.video.maxFiles + 1 }, (_, index) => ({
    file: file(100),
    detection: { id: 'mp4', subtype: 'mp4' },
    category: 'video',
    included: true,
    excluded: false,
    id: `video-${index}`,
  }));
  const result = validateSelection(items);
  assert.equal(result.ok, false);
  assert.match(result.messages.join(' '), /Video/);
});

test('validateSelection accepts a mixed light batch within limits', () => {
  const items = Array.from({ length: 2 }, (_, index) => ({
    file: file(1024),
    detection: { id: 'image', subtype: 'png' },
    category: 'light',
    included: true,
    excluded: false,
    id: `png-${index}`,
  }));
  assert.equal(validateSelection(items).ok, true);
});

test('applyDurationLimits rejects unreadable media duration', () => {
  const item = {
    file: file(1024),
    detection: { id: 'mp3', subtype: 'mp3' },
    category: 'audio',
    included: true,
    excluded: false,
    readResult: { info: { duration: '' } },
  };
  const reason = applyDurationLimits(item);
  assert.match(reason, /Durasi/);
  assert.equal(item.included, false);
  assert.equal(item.limitLocked, true);
});

test('applyDurationLimits accepts audio within the thirty minute cap', () => {
  const item = {
    file: file(1024),
    detection: { id: 'mp3', subtype: 'mp3' },
    category: 'audio',
    included: true,
    excluded: false,
    readResult: { info: { duration: 29 * 60 } },
  };
  assert.equal(applyDurationLimits(item), null);
  assert.equal(item.limitLocked, undefined);
});

test('makeCsvReport escapes commas, quotes, and newlines', () => {
  const csv = makeCsvReport([{
    file: { name: 'a, "b".jpg', size: 3 },
    detection: { id: 'image', label: 'JPEG', subtype: 'jpeg' },
    category: 'light',
    status: 'done',
    readResult: { raw: [{}] },
    warnings: ['line\nbreak'],
    outputName: 'a-meinsert.jpg',
  }]);
  assert.match(csv, /"a, ""b""\.jpg"/);
  assert.match(csv, /"line\nbreak"/);
});

test('makeJsonReport exposes metadata summary without file contents', () => {
  const report = JSON.parse(makeJsonReport([{
    file: { name: 'doc.pdf', size: 10 },
    detection: { id: 'pdf', label: 'PDF', subtype: 'pdf' },
    category: 'light',
    status: 'ready',
    readResult: { raw: [{}, {}], info: {} },
    operations: { set: 1, remove: 0, rawRemove: 0, custom: 0 },
  }]));
  assert.equal(report.totals.files, 1);
  assert.equal(report.files[0].rawTagCount, 2);
  assert.equal(report.files[0].operations.set, 1);
});
