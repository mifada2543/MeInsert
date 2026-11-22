/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readSylt, toWriterSylt } from '../../assets/js/core/id3-sylt.js';
import { ID3Writer } from '../../assets/vendor/browser-id3-writer.mjs';
const fixtureUrl = new URL('../fixtures/tone.mp3', import.meta.url);
const latin1Bytes = (text) => Uint8Array.from([...text].map((ch) => ch.charCodeAt(0) & 0xff));
const utf8Bytes = (text) => new TextEncoder().encode(text);
const be32 = (value) => Uint8Array.from([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
const syncSafe = (value) => Uint8Array.from([(value >>> 21) & 0x7f, (value >>> 14) & 0x7f, (value >>> 7) & 0x7f, value & 0x7f]);
const concat = (...parts) => Uint8Array.from(parts.flatMap((part) => [...part]));
function frame(id, body, sizeOverride) {
  const size = sizeOverride === undefined ? body.length : sizeOverride;
  return concat(latin1Bytes(id), be32(size), new Uint8Array(2), body);
}
function syltBody({ encoding = 0, language = 'ind', timestampFormat = 2, type = 2, description = '', pairs }) {
  const encode = encoding === 3 ? utf8Bytes : latin1Bytes;
  const parts = [new Uint8Array([encoding, ...latin1Bytes(language), timestampFormat, type]), encode(description), new Uint8Array([0])];
  for (const [text, time] of pairs) parts.push(encode(text), new Uint8Array([0]), be32(time));
  return concat(...parts);
}
function id3(frames, tagSizeOverride) {
  const body = concat(...frames);
  const size = tagSizeOverride === undefined ? body.length : tagSizeOverride;
  return concat(latin1Bytes('ID3'), new Uint8Array([3, 0, 0]), syncSafe(size), body);
}
const blobOf = (bytes) => new Blob([bytes], { type: 'audio/mpeg' });
test('synthetic ID3v2.3 SYLT, encoding 0 (latin1), multi-line pairs', async () => {
  const body = syltBody({
    encoding: 0,
    language: 'ind',
    pairs: [['Baris satu', 1234], ['Baris dua', 5678], ['Baris tiga', 90000]],
  });
  const parsed = await readSylt(blobOf(id3([frame('SYLT', body)])));
  assert.deepEqual(parsed, {
    type: 2,
    timestampFormat: 2,
    language: 'ind',
    description: '',
    pairs: [
      { text: 'Baris satu', time: 1234 },
      { text: 'Baris dua', time: 5678 },
      { text: 'Baris tiga', time: 90000 },
    ],
  });
});
test('synthetic ID3v2.3 SYLT, encoding 3 (UTF-8), multibyte text and description', async () => {
  const body = syltBody({
    encoding: 3,
    language: 'ind',
    description: 'makna',
    pairs: [['Lirik café ☕', 0], ['こんにちは', 1500]],
  });
  const parsed = await readSylt(blobOf(id3([frame('SYLT', body)])));
  assert.equal(parsed.description, 'makna');
  assert.deepEqual(parsed.pairs, [
    { text: 'Lirik café ☕', time: 0 },
    { text: 'こんにちは', time: 1500 },
  ]);
});
test('earlier unrelated frames are skipped and the description terminator is respected', async () => {
  const title = frame('TIT2', new Uint8Array([0, ...utf8Bytes('Judul'), 0]));
  const body = syltBody({ encoding: 0, pairs: [['satu', 10], ['dua', 20]] });
  const parsed = await readSylt(blobOf(id3([title, frame('SYLT', body)])));
  assert.deepEqual(parsed.pairs, [{ text: 'satu', time: 10 }, { text: 'dua', time: 20 }]);
});
test('malformed frames, wrong signatures and truncated data resolve to null, never throw', async () => {
  const good = syltBody({ encoding: 0, pairs: [['ok', 100]] });
  const cases = [
    new Blob([new Uint8Array([1, 2, 3])]),                                    // too short
    new Blob([latin1Bytes('XXXX'), new Uint8Array(6)]),                       // not ID3
    blobOf(id3([frame('SYLT', good)], 4)),                                    // impossible tag size
    blobOf(id3([frame('SYLT', good, good.length + 50)])),                     // frame claims extra bytes
    blobOf(id3([frame('SYLT', new Uint8Array([9, 105, 110, 100, 2, 2, 0]))])), // bad encoding
    blobOf(id3([frame('SYLT', new Uint8Array([0, 105, 110, 100, 2, 2, 0]))])), // no terminator, no pairs
    blobOf(id3([frame('SYLT', concat(new Uint8Array([0, 105, 110, 100, 2, 2, 0]), be32(5)))])), // pair missing timestamp
    null, undefined, 42, {}, new ArrayBuffer(3),
  ];
  for (const input of cases) {
    assert.equal(await readSylt(input), null, `expected null for ${String(input)}`);
  }
});
test('ID3Writer.addTag() round-trips a SYLT frame through readSylt()', async () => {
  const raw = await readFile(fixtureUrl);
  const base = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const writer = new ID3Writer(base);
  writer.padding = 0;
  writer.setFrame('SYLT', {
    type: 2,
    timestampFormat: 2,
    language: 'ind',
    description: '',
    text: [['Baris satu', 1234], ['Baris dua', 5678]],
  });
  const output = writer.addTag();
  assert.ok(output instanceof ArrayBuffer, 'addTag() must be applied, not getBlob()');
  assert.deepEqual(await readSylt(blobOf(new Uint8Array(output))), {
    type: 2,
    timestampFormat: 2,
    language: 'ind',
    description: '',
    pairs: [
      { text: 'Baris satu', time: 1234 },
      { text: 'Baris dua', time: 5678 },
    ],
  });
});
test('toWriterSylt shape matches the browser-id3-writer contract and is defensive', () => {
  const parsed = {
    type: 2,
    timestampFormat: 2,
    language: 'ind',
    description: 'draft',
    pairs: [{ text: 'satu', time: 1234.9 }, { text: 'dua', time: '5678' }, { text: '', time: 1 }],
  };
  assert.deepEqual(toWriterSylt(parsed), {
    type: 2,
    timestampFormat: 2,
    language: 'ind',
    description: 'draft',
    text: [['satu', 1234], ['dua', 5678]],
  });
  assert.equal(toWriterSylt(null), null);
  assert.equal(toWriterSylt({ pairs: [] }), null);
  assert.equal(toWriterSylt({ pairs: [{ text: '', time: 1 }] }), null);
  assert.deepEqual(
    toWriterSylt({ pairs: [{ text: 'x', time: 0 }], language: 'xx', type: 99, timestampFormat: 9 }),
    { type: 2, timestampFormat: 2, language: 'eng', description: '', text: [['x', 0]] },
  );
});
test('toWriterSylt output re-writes through ID3Writer and preserves content-type / language', async () => {
  const raw = await readFile(fixtureUrl);
  const base = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const source = syltBody({ encoding: 0, language: 'ind', type: 1, pairs: [['lirik', 250]] });
  const parsed = await readSylt(blobOf(id3([frame('SYLT', source)])));
  const writer = new ID3Writer(base);
  writer.padding = 0;
  writer.setFrame('SYLT', toWriterSylt(parsed));
  assert.deepEqual(await readSylt(blobOf(new Uint8Array(writer.addTag()))), {
    type: 1,
    timestampFormat: 2,
    language: 'ind',
    description: '',
    pairs: [{ text: 'lirik', time: 250 }],
  });
});