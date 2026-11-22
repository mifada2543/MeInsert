/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { commentPictures, editPictures, flacPictures, pictureBase64, repairFlacMetadata, serializePicture } from '../../assets/js/formats/vorbis-pictures.js';
function picture(type = 3) {
  const block = serializePicture({ mimeType: 'image/png', kind: 'coverFront', description: '日本語 cover', data: Uint8Array.of(1, 2, 3) });
  new DataView(block.buffer).setUint32(0, type);
  return block;
}
function block(type, bytes, last = false) {
  return Uint8Array.from([type | (last ? 128 : 0), bytes.length >>> 16, bytes.length >>> 8, bytes.length, ...bytes]);
}
test('raw picture path retains every byte, including arbitrary types and Unicode descriptions', () => {
  const pictures = [picture(1), picture(3), picture(4)];
  assert.deepEqual(commentPictures({ METADATA_BLOCK_PICTURE: pictures.map(pictureBase64) }), pictures);
  assert.equal(editPictures(pictures, { action: 'keep' }), pictures);
  assert.deepEqual(editPictures(pictures, { action: 'remove' }), [pictures[2]]);
  const image = { mimeType: 'image/png', kind: 'coverFront', data: Uint8Array.of(9, 8) };
  assert.deepEqual(editPictures(pictures, { action: 'set' }, [image]), [pictures[2], serializePicture(image)]);
});
test('native FLAC restoration changes metadata only, fixes vendor and last-block flags', async () => {
  const vendor = new TextEncoder().encode('Mediabunny');
  const comment = Uint8Array.from([vendor.length, 0, 0, 0, ...vendor, 0, 0, 0, 0]);
  const audio = Uint8Array.of(255, 248, 18, 42, 99);
  const original = Uint8Array.from([102, 76, 97, 67, ...block(0, new Uint8Array(34)), ...block(4, comment), ...block(6, picture(), true), ...audio]);
  const pictures = [picture(1), picture(4), picture(3)];
  const repaired = repairFlacMetadata(original, pictures, 'Lavf 日本語');
  assert.deepEqual(await flacPictures(new Blob([repaired])), pictures);
  assert.deepEqual(repaired.subarray(-audio.length), audio);
  assert.match(new TextDecoder().decode(repaired), /Lavf 日本語/);
  assert.doesNotMatch(new TextDecoder().decode(repaired), /Mediabunny/);
  const removed = repairFlacMetadata(repaired, [], 'Lavf 日本語');
  assert.deepEqual(await flacPictures(new Blob([removed])), []);
  assert.deepEqual(removed.subarray(-audio.length), audio);
});
test('truncated FLAC fails rather than silently dropping metadata', async () => {
  await assert.rejects(flacPictures(new Blob([Uint8Array.of(102, 76, 97, 67, 134, 0, 0, 42)])), /Truncated/);
});