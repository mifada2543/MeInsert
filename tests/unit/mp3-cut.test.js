/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseId3Tag } from '../../assets/js/core/id3-passthrough.js';
import { sliceMp3Range } from '../../assets/js/core/mp3-cut.js';
function fixture(name) {
  const bytes = new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));
  return { bytes, file: new Blob([bytes]) };
}
const XING_WARNING = 'Xing/Info header dibuang karena jumlah frame/durasi sumber tidak berlaku setelah pemotongan.';
test('sliceMp3Range keeps the original ID3 prefix verbatim and drops the Xing frame for non-zero starts', async () => {
  const { bytes, file } = fixture('tone.mp3');
  const tagEnd = parseId3Tag(bytes).tagEnd;
  const result = await sliceMp3Range(file, 0.2, 0.5);
  assert.ok(result);
  assert.equal(result.blob.type, 'audio/mpeg');
  const output = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual(output.slice(0, tagEnd), bytes.slice(0, tagEnd));
  assert.ok(result.warnings.includes(XING_WARNING));
  assert.ok(result.frameCount > 0);
  assert.ok(result.duration > 0 && result.duration < 0.5);
  assert.equal(output.length, tagEnd + result.frameCount * 192);
});
test('sliceMp3Range of a 0.2-0.5 window yields about 0.3 s on a long source', async () => {
  const { bytes, file } = fixture('tone-long.mp3');
  const tagEnd = parseId3Tag(bytes).tagEnd;
  const result = await sliceMp3Range(file, 0.2, 0.5);
  assert.ok(result);
  assert.ok(Math.abs(result.duration - 0.3) <= 0.05, `duration=${result.duration}`);
  assert.ok(result.frameCount >= 11 && result.frameCount <= 13);
  assert.ok(result.warnings.includes(XING_WARNING));
  const output = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual(output.slice(0, tagEnd), bytes.slice(0, tagEnd));
});
test('sliceMp3Range from zero drops stale Xing and warns about frame copy', async () => {
  const { bytes, file } = fixture('tone-long.mp3');
  const result = await sliceMp3Range(file, 0, 0.1);
  assert.ok(result);
  assert.ok(result.warnings.includes(XING_WARNING));
  assert.ok(result.warnings.some((warning) => /bit reservoir/.test(warning)));
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const tagEnd = parseId3Tag(bytes).tagEnd;
  assert.notDeepEqual(output.slice(tagEnd, tagEnd + 4), bytes.slice(tagEnd, tagEnd + 4));
});
test('sliceMp3Range rejects invalid ranges and non-MP3 data', async () => {
  const { file } = fixture('tone.mp3');
  assert.equal(await sliceMp3Range(file, 0.5, 0.2), null);
  assert.equal(await sliceMp3Range(file, -1, 0.5), null);
  assert.equal(await sliceMp3Range(new Blob([new Uint8Array([1, 2, 3, 4])]), 0, 1), null);
});
test('MP3 precise mode is rejected instead of silently using frame copy', async () => {
  const { file } = fixture('tone-long.mp3');
  assert.equal(await sliceMp3Range(file, 0.1, 0.2, 'precise'), null);
});