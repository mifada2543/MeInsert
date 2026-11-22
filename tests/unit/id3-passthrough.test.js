/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ID3Writer } from '../../assets/vendor/browser-id3-writer.mjs';
import { parseId3Tag } from '../../assets/js/core/id3-passthrough.js';
import { write as writeMp3 } from '../../assets/js/formats/mp3.js';
function withTag(frames) {
  const raw = readFileSync('tests/fixtures/tone.mp3');
  const writer = new ID3Writer(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  writer.padding = 0;
  for (const [id, value] of frames) writer.setFrame(id, value);
  return new Uint8Array(writer.addTag());
}
function frameBody(tag, id) {
  const parsed = parseId3Tag(tag);
  assert.ok(parsed, 'tag should parse');
  const frame = parsed.frames.find((item) => item.id === id);
  return frame ? frame.bytes.slice(10) : null;
}
test('parseId3Tag rejects missing and v2.2 tags', () => {
  assert.equal(parseId3Tag(Uint8Array.of(1, 2, 3)), null);
  const v22 = Uint8Array.from([0x49, 0x44, 0x33, 2, 2, 0, 0, 0, 0, 0]);
  assert.equal(parseId3Tag(v22), null);
});
test('editing a title keeps untouched PRIV and TXXX frames verbatim', async () => {
  const priv = { id: 'meinsert-test', data: Uint8Array.from([1, 2, 3, 255]) };
  const source = withTag([
    ['TIT2', 'Judul lama'],
    ['PRIV', priv],
    ['TXXX', { description: 'custom', value: 'tersimpan' }],
  ]);
  const beforePriv = frameBody(source, 'PRIV');
  const beforeTxxx = frameBody(source, 'TXXX');
  assert.ok(beforePriv?.length);
  assert.ok(beforeTxxx?.length);
  const file = new File([source], 'tagged.mp3', { type: 'audio/mpeg' });
  const result = await writeMp3(file, { set: { title: 'Judul baru' } });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const parsed = parseId3Tag(output);
  assert.ok(parsed, 'output tag should parse with passthrough');
  assert.deepEqual([...frameBody(output, 'PRIV')], [...beforePriv]);
  assert.deepEqual([...frameBody(output, 'TXXX')], [...beforeTxxx]);
  assert.equal(result.fields.title, 'Judul baru');
  assert.ok(!result.warnings.some((item) => /ditulis ulang penuh/.test(item)));
});