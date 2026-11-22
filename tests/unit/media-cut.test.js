/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUT_MODES, normalizeTrim, conversionCutOptions, expectedCutDuration, mediaRangeProof, } from '../../assets/js/core/media-cut.js';
const tone = new Blob([readFileSync(new URL('../fixtures/tone.mp3', import.meta.url))]);
test('normalizeTrim parses numbers and rejects out-of-range or malformed windows', () => {
  assert.equal(normalizeTrim(null), null);
  assert.equal(normalizeTrim(undefined), null);
  assert.deepEqual(normalizeTrim({ start: 0.2, end: 0.5 }), { start: 0.2, end: 0.5, mode: 'copy' });
  assert.deepEqual(normalizeTrim({ start: '0.25', end: '0.75', mode: 'precise' }), {
    start: 0.25, end: 0.75, mode: 'precise',
  });
  assert.equal(CUT_MODES.COPY, 'copy');
  assert.equal(CUT_MODES.PRECISE, 'precise');
  for (const bad of [
    { start: -1, end: 1 }, { start: 1, end: 1 }, { start: 2, end: 1 },
    { start: NaN, end: 1 }, { start: 0, end: Infinity }, {}, { start: 0, end: 1, mode: 'fast' },
    { start: 0, end: 1, mode: null },
  ]) assert.equal(normalizeTrim(bad), null);
  assert.equal(normalizeTrim({ start: 0, end: 12 }, { duration: 10 }), null);
  assert.deepEqual(normalizeTrim({ start: 0, end: 12 }, { duration: 12 }), {
    start: 0, end: 12, mode: 'copy',
  });
  assert.deepEqual(normalizeTrim({ start: 10, end: 12 }, { duration: 12 }), { start: 10, end: 12, mode: 'copy' });
  assert.deepEqual(normalizeTrim({ start: 0, end: 10.0000001 }, { duration: 10 }), {
    start: 0, end: 10.0000001, mode: 'copy',
  });
});
test('conversionCutOptions maps modes and preserves base copy settings', () => {
  const copy = conversionCutOptions({ start: 0.2, end: 0.5, mode: 'copy' }, { shiftTolerance: Infinity });
  assert.deepEqual(copy, {
    trim: { start: 0.2, end: 0.5 },
    copy: { shiftTolerance: Infinity, mode: 'forced', boundaryPolicy: 'shrink' },
  });
  const precise = conversionCutOptions({ start: 0.2, end: 0.5, mode: 'precise' }, { shiftTolerance: Infinity });
  assert.deepEqual(precise, {
    trim: { start: 0.2, end: 0.5 },
    copy: {
      shiftTolerance: Infinity, mode: 'preferred', boundaryPolicy: 'shrink', boundaryTolerance: 0,
    },
  });
  assert.deepEqual(conversionCutOptions({ start: 0, end: 1, mode: 'copy' }, { mode: 'preferred' }).copy, {
    mode: 'forced', boundaryPolicy: 'shrink',
  });
});
test('expectedCutDuration reflects the normalized window only', () => {
  assert.equal(expectedCutDuration({ start: 0.2, end: 0.5, mode: 'precise' }), 0.3);
  assert.equal(expectedCutDuration(null), 0);
  assert.equal(expectedCutDuration({ start: 2, end: 1 }), 0);
  assert.equal(expectedCutDuration({ start: 0, end: 1, mode: 'fast' }), 0);
});
test('mediaRangeProof hashes encoded packets inside the trim window', async () => {
  const proof = await mediaRangeProof(tone, 0, 1);
  assert.equal(proof.valid, true);
  assert.equal(proof.algorithm, 'mp3-frames-v1');
  assert.ok(Array.isArray(proof.regions) && proof.regions.length > 0);
  for (const region of proof.regions) {
    assert.ok(region.length > 0);
    assert.match(region.hash, /^[a-f0-9]{64}$/);
  }
  const narrow = await mediaRangeProof(tone, 0.2, 0.5);
  assert.equal(narrow.valid, true);
  assert.equal(narrow.regions.length, proof.regions.length);
  assert.ok(narrow.regions.every((region, index) => region.length <= proof.regions[index].length));
  assert.notEqual(narrow.regions[0].hash, proof.regions[0].hash);
  const broken = await mediaRangeProof(new Blob([new Uint8Array([1, 2, 3, 4])]), 0, 1);
  assert.equal(broken.valid, false);
  assert.equal(broken.algorithm, 'av-range-v1');
  assert.ok(broken.error);
});