/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Regression fixtures for extended-header preservation, footer, and fail-closed CRC. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ID3Writer } from '../../assets/vendor/browser-id3-writer.mjs';
import { parseId3Tag, patchId3Tag } from '../../assets/js/core/id3-passthrough.js';
import { write as writeMp3 } from '../../assets/js/formats/mp3.js';
function concat(parts) {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function syncSafe(v) { return Uint8Array.from([(v >>> 21) & 127, (v >>> 14) & 127, (v >>> 7) & 127, v & 127]); }
function baseTag() {
  const raw = readFileSync('tests/fixtures/tone.mp3');
  const writer = new ID3Writer(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  writer.padding = 0;
  writer.setFrame('TIT2', 'Original');
  writer.setFrame('COMM', { description: 'review', text: 'Untouched' });
  return new Uint8Array(writer.addTag());
}
function withExtendedV23(crc = false) {
  const src = baseTag();
  const tag = parseId3Tag(src);
  const ext = crc
    ? Uint8Array.from([0, 0, 0, 10, 0x80, 0, 0, 0, 4, 0, 0, 0, 0, 0])
    : Uint8Array.from([0, 0, 0, 6, 0, 0, 0, 0, 4, 0]);
  const body = concat([ext, ...tag.frames.map((f) => f.bytes), new Uint8Array(1024)]);
  const head = Uint8Array.from([73, 68, 51, 3, 0, 0x40, ...syncSafe(body.length)]);
  return concat([head, body, src.slice(tag.tagEnd)]);
}
function withExtendedV24({ crc = false, footer = false } = {}) {
  const src = baseTag();
  const tag = parseId3Tag(src);
  const ext = crc
    ? Uint8Array.from([0, 0, 0, 12, 1, 0x20, 5, 0, 0, 0, 0, 0])
    : Uint8Array.from([0, 0, 0, 6, 1, 0]);
  const frames = tag.frames.map((f) => {
    const b = f.bytes.slice();
    const size = b.length - 10;
    b.set(syncSafe(size), 4);
    return b;
  });
  const body = concat([ext, ...frames, new Uint8Array(1024)]);
  const flags = 0x40 | (footer ? 0x10 : 0);
  const head = Uint8Array.from([73, 68, 51, 4, 0, flags, ...syncSafe(body.length + (footer ? 10 : 0))]);
  const foot = footer ? Uint8Array.from([51, 68, 73, ...head.slice(3)]) : new Uint8Array();
  return concat([head, body, foot, src.slice(tag.tagEnd)]);
}
function assertUntouchedFrames(before, after) {
  const x = parseId3Tag(before); const y = parseId3Tag(after);
  assert.ok(y);
  const beforeComm = x.frames.filter((f) => f.id === 'COMM').map((f) => [...f.bytes]);
  const afterComm = y.frames.filter((f) => f.id === 'COMM').map((f) => [...f.bytes]);
  assert.deepEqual(afterComm, beforeComm);
  assert.deepEqual([...after.slice(y.tagEnd)], [...before.slice(x.tagEnd)]);
}
for (const [name, fixture] of [
  ['ID3v2.3 extended header without CRC', withExtendedV23],
  ['ID3v2.4 extended header without CRC', () => withExtendedV24()],
  ['ID3v2.4 extended header plus footer', () => withExtendedV24({ footer: true })],
]) {
  test(`${name} survives an unrelated title edit`, async () => {
    const source = fixture();
    const before = parseId3Tag(source);
    assert.ok(before.extendedHeader?.length);
    const result = await writeMp3(new File([source], 'extended.mp3', { type: 'audio/mpeg' }), { set: { title: 'Changed' } });
    const output = new Uint8Array(await result.blob.arrayBuffer());
    const after = parseId3Tag(output);
    assert.ok(after.extendedHeader?.length);
    assert.equal(after.version[0], before.version[0]);
    assert.equal(Boolean(after.footer), Boolean(before.footer));
    assert.equal(output[5] & 0x40, 0x40);
    assertUntouchedFrames(source, output);
    assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
  });
}
for (const [name, fixture] of [
  ['ID3v2.3 extended CRC', () => withExtendedV23(true)],
  ['ID3v2.4 extended CRC', () => withExtendedV24({ crc: true })],
]) {
  test(`${name} refuses edit before writing`, async () => {
    const source = fixture();
    assert.ok(parseId3Tag(source)?.unsupportedExtendedHeader);
    await assert.rejects(() => writeMp3(new File([source], 'crc.mp3', { type: 'audio/mpeg' }), { set: { title: 'Changed' } }), /extended header|CRC/i);
  });
}
test('direct patch API refuses unsupported extended-header CRC', () => {
  const source = withExtendedV23(true);
  assert.equal(patchId3Tag(source, baseTag(), ['TIT2']), null);
});
test('malformed extended header is rejected rather than full-rewritten', async () => {
  const source = withExtendedV23();
  const damaged = source.slice();
  damaged.set([0x7f, 0xff, 0xff, 0xff], 10);
  assert.equal(parseId3Tag(damaged), null);
  await assert.rejects(() => writeMp3(new File([damaged], 'broken.mp3', { type: 'audio/mpeg' }), { set: { title: 'Changed' } }), /extended header|footer/i);
});