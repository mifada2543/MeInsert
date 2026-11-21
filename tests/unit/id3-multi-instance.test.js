/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ID3Writer } from '../../assets/vendor/browser-id3-writer.mjs';
import { parseId3Tag, frameIdentity } from '../../assets/js/core/id3-passthrough.js';
import { write as writeMp3 } from '../../assets/js/formats/mp3.js';

const DECODERS = { 0: 'iso-8859-1', 1: 'utf-16le', 2: 'utf-16be', 3: 'utf-8' };
function terminated(bytes, offset, encoding) {
  if (encoding === 1 || encoding === 2) {
    let end = offset;
    while (end + 1 < bytes.length && !(bytes[end] === 0 && bytes[end + 1] === 0)) end += 2;
    return { value: new TextDecoder(DECODERS[encoding]).decode(bytes.slice(offset, end)), end: end + 2 };
  }
  let end = offset;
  while (end < bytes.length && bytes[end] !== 0) end += 1;
  return { value: new TextDecoder(DECODERS[encoding] || DECODERS[0]).decode(bytes.slice(offset, end)), end: end + 1 };
}
function decodeText(bytes, encoding) {
  let start = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) start = 2;
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) start = 2;
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  return new TextDecoder(DECODERS[encoding] || DECODERS[0]).decode(bytes.slice(start)).replace(/\0+$/, '');
}
function decodeComm(frame) {
  const body = frame.bytes.slice(10);
  const encoding = body[0] || 0;
  const language = String.fromCharCode(...body.slice(1, 4));
  const description = terminated(body, 4, encoding);
  return { encoding, language, description: description.value, text: decodeText(body.slice(description.end), encoding) };
}
function frameInventory(bytes) {
  const parsed = parseId3Tag(bytes);
  assert.ok(parsed, 'tag should parse');
  return {
    parsed,
    ids: parsed.frames.map((frame) => frame.id),
    comms: parsed.frames.filter((frame) => frame.id === 'COMM').map(decodeComm),
    raw: parsed.frames.map((frame) => ({ id: frame.id, bytes: [...frame.bytes] })),
  };
}
function makeFixture(frames) {
  const raw = readFileSync('tests/fixtures/tone.mp3');
  const writer = new ID3Writer(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  writer.padding = 0;
  for (const [id, value] of frames) writer.setFrame(id, value);
  return new Uint8Array(writer.addTag());
}
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
function audioBytes(bytes) {
  const tag = parseId3Tag(bytes);
  assert.ok(tag, 'tag should parse');
  return bytes.slice(tag.tagEnd);
}

const TWO_COMM = [
  ['TIT2', 'Judul lama'],
  ['COMM', { description: 'review', text: 'Review lama' }],
  ['COMM', { description: 'source', text: 'Source lama' }],
  ['PRIV', { id: 'vendor', data: Uint8Array.from([7, 8, 9]) }],
  ['TXXX', { description: 'one', value: '1' }],
  ['TXXX', { description: 'two', value: '2' }],
];

test('editing only TIT2 preserves two COMM frames with different descriptions', async () => {
  const source = makeFixture(TWO_COMM);
  const before = frameInventory(source);
  assert.equal(before.comms.length, 2, 'fixture must contain two COMM frames');
  assert.deepEqual(before.comms.map((item) => item.description).sort(), ['review', 'source']);

  const result = await writeMp3(new File([source], 'multi.mp3', { type: 'audio/mpeg' }), {
    set: { title: 'Judul baru' },
  });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const after = frameInventory(output);

  assert.equal(after.comms.length, 2, 'two unrelated COMM frames must survive a title edit');
  assert.deepEqual(
    after.comms.map((item) => [item.description, item.text]).sort(),
    [['review', 'Review lama'], ['source', 'Source lama']],
  );
  assert.deepEqual([...audioBytes(output)], [...audioBytes(source)], 'audio payload must be unchanged');
  const title = after.raw.find((frame) => frame.id === 'TIT2');
  assert.ok(title, 'title frame must exist');
  assert.equal(decodeText(Uint8Array.from(title.bytes).slice(11), title.bytes[10] || 0), 'Judul baru');
});

test('unrelated PRIV and TXXX instances survive a title edit', async () => {
  const source = makeFixture(TWO_COMM);
  const result = await writeMp3(new File([source], 'multi.mp3', { type: 'audio/mpeg' }), {
    set: { title: 'Judul baru' },
  });
  const after = frameInventory(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal(after.ids.filter((id) => id === 'PRIV').length, 1);
  assert.equal(after.ids.filter((id) => id === 'TXXX').length, 2);
});

function concatBytes(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function framesOf(bytes, id) {
  return parseId3Tag(bytes).frames.filter((frame) => frame.id === id);
}
function addedRawFrame(bytes, id, body) {
  const tag = parseId3Tag(bytes);
  assert.ok(tag);
  const frame = Uint8Array.from([
    ...[...id].map((char) => char.charCodeAt(0)),
    (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff,
    (body.length >>> 8) & 0xff, body.length & 0xff, 0, 0, ...body,
  ]);
  const bodyOut = concatBytes([
    ...tag.frames.map((item) => item.bytes), frame, new Uint8Array(1024),
  ]);
  const header = Uint8Array.from([
    0x49, 0x44, 0x33, tag.version[0], tag.version[1], 0,
    (bodyOut.length >> 21) & 0x7f, (bodyOut.length >> 14) & 0x7f,
    (bodyOut.length >> 7) & 0x7f, bodyOut.length & 0x7f,
  ]);
  return concatBytes([header, bodyOut, bytes.slice(tag.tagEnd)]);
}
function toV24(bytes) {
  const tag = parseId3Tag(bytes);
  assert.ok(tag);
  const frames = tag.frames.map((frame) => {
    const out = frame.bytes.slice();
    const size = (((out[4] << 24) | (out[5] << 16) | (out[6] << 8) | out[7]) >>> 0);
    out[4] = (size >> 21) & 0x7f;
    out[5] = (size >> 14) & 0x7f;
    out[6] = (size >> 7) & 0x7f;
    out[7] = size & 0x7f;
    return out;
  });
  const bodyOut = concatBytes([...frames, new Uint8Array(tag.paddingLength || 1024)]);
  const header = Uint8Array.from([
    0x49, 0x44, 0x33, 4, 0, 0,
    (bodyOut.length >> 21) & 0x7f, (bodyOut.length >> 14) & 0x7f,
    (bodyOut.length >> 7) & 0x7f, bodyOut.length & 0x7f,
  ]);
  return concatBytes([header, bodyOut, bytes.slice(tag.tagEnd)]);
}

test('multiple APIC frames survive an unrelated title edit', async () => {
  const source = makeFixture([
    ['TIT2', 'Judul lama'],
    ['APIC', { description: 'front', type: 3, data: JPEG }],
    ['APIC', { description: 'back', type: 4, data: JPEG.slice(0, 8) }],
  ]);
  const before = framesOf(source, 'APIC').map((frame) => frameIdentity('APIC', frame.bytes));
  assert.equal(before.length, 2);
  const result = await writeMp3(new File([source], 'covers.mp3', { type: 'audio/mpeg' }), {
    set: { title: 'Judul baru' },
  });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const after = framesOf(output, 'APIC');
  assert.equal(after.length, 2);
  assert.deepEqual(after.map((frame) => frameIdentity('APIC', frame.bytes)).sort(), [...before].sort());
  assert.deepEqual([...audioBytes(output)], [...audioBytes(source)]);
});

test('editing one TXXX instance preserves the other', async () => {
  const source = makeFixture([
    ['TIT2', 'Judul'],
    ['TXXX', { description: 'keep', value: 'lama' }],
    ['TXXX', { description: 'change', value: 'lama' }],
  ]);
  const result = await writeMp3(new File([source], 'txxx.mp3', { type: 'audio/mpeg' }), {
    custom: [{ key: 'change', value: 'baru' }],
  });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const frames = framesOf(output, 'TXXX');
  assert.equal(frames.length, 2);
  const identities = frames.map((frame) => frameIdentity('TXXX', frame.bytes)).sort();
  assert.deepEqual(identities, ['change', 'keep']);
  const changed = frames.find((frame) => frameIdentity('TXXX', frame.bytes) === 'change');
  const body = changed.bytes.slice(10);
  const description = terminated(body, 1, body[0] || 0);
  assert.match(decodeText(body.slice(description.end), body[0] || 0), /baru/);
});

test('unknown structurally valid frames survive a known-field edit', async () => {
  const source = addedRawFrame(makeFixture([['TIT2', 'Judul']]), 'ZZZZ', Uint8Array.from([3, 65, 66, 67]));
  const unknown = framesOf(source, 'ZZZZ');
  assert.equal(unknown.length, 1);
  const result = await writeMp3(new File([source], 'unknown.mp3', { type: 'audio/mpeg' }), {
    set: { title: 'Baru' },
  });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual([...framesOf(output, 'ZZZZ')[0].bytes], [...unknown[0].bytes]);
});

test('editing a comment keeps unrelated comments and PRIV intact', async () => {
  const source = makeFixture(TWO_COMM);
  const result = await writeMp3(new File([source], 'comment.mp3', { type: 'audio/mpeg' }), {
    set: { comment: 'Review baru' },
  });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const after = frameInventory(output);
  assert.deepEqual(after.comms.map((item) => [item.description, item.text]).sort(),
    [['review', 'Review baru'], ['source', 'Source lama']]);
  assert.equal(after.ids.filter((id) => id === 'PRIV').length, 1);
});

test('setting or removing one cover keeps the other cover', async () => {
  const source = makeFixture([
    ['TIT2', 'Judul'],
    ['APIC', { description: 'front', type: 3, data: JPEG }],
    ['APIC', { description: 'back', type: 4, data: JPEG.slice(0, 8) }],
  ]);
  const before = framesOf(source, 'APIC').map((frame) => frameIdentity('APIC', frame.bytes));
  const back = before.find((id) => id.includes('|4|'));
  const setResult = await writeMp3(new File([source], 'covers.mp3', { type: 'audio/mpeg' }), {
    cover: { action: 'set', data: JPEG, name: 'new', kind: 'coverFront' },
  });
  const setOutput = new Uint8Array(await setResult.blob.arrayBuffer());
  const setFrames = framesOf(setOutput, 'APIC').map((frame) => frameIdentity('APIC', frame.bytes));
  assert.equal(setFrames.length, 2);
  assert.ok(setFrames.includes(back), 'secondary cover must survive a cover replace');

  const removeResult = await writeMp3(new File([source], 'covers.mp3', { type: 'audio/mpeg' }), {
    rawRemove: ['APIC'],
  });
  const removeOutput = new Uint8Array(await removeResult.blob.arrayBuffer());
  const removeFrames = framesOf(removeOutput, 'APIC').map((frame) => frameIdentity('APIC', frame.bytes));
  assert.deepEqual(removeFrames, [back], 'only the primary cover should be removed');
});

test('ID3v2.4 tags keep both COMM frames byte-identically', async () => {
  const source = toV24(makeFixture(TWO_COMM));
  assert.equal(parseId3Tag(source).version[0], 4);
  const before = framesOf(source, 'COMM').map((frame) => frameIdentity('COMM', frame.bytes)).sort();
  const result = await writeMp3(new File([source], 'v24.mp3', { type: 'audio/mpeg' }), {
    set: { title: 'Judul baru' },
  });
  const output = new Uint8Array(await result.blob.arrayBuffer());
  assert.equal(parseId3Tag(output).version[0], 4);
  const after = framesOf(output, 'COMM').map((frame) => frameIdentity('COMM', frame.bytes)).sort();
  assert.deepEqual(after, before);
});

test('repeated save cycles do not accumulate metadata loss', async () => {
  let current = makeFixture(TWO_COMM);
  for (const title of ['Satu', 'Dua', 'Tiga']) {
    const result = await writeMp3(new File([current], 'cycle.mp3', { type: 'audio/mpeg' }), {
      set: { title },
    });
    current = new Uint8Array(await result.blob.arrayBuffer());
    const inventory = frameInventory(current);
    assert.equal(inventory.comms.length, 2, `COMM frames lost after edit to ${title}`);
    assert.equal(inventory.ids.filter((id) => id === 'PRIV').length, 1);
  }
  assert.deepEqual(frameInventory(current).comms.map((item) => item.text).sort(), ['Review lama', 'Source lama']);
});

test('malformed tags fall back safely with a precise warning', async () => {
  const source = makeFixture([['TIT2', 'Judul']]);
  assert.ok(parseId3Tag(source)?.frames.length);
  const damaged = source.slice();
  damaged.set([0x7f, 0xff, 0xff, 0xff], 14);
  const result = await writeMp3(new File([damaged], 'bad.mp3', { type: 'audio/mpeg' }), {
    set: { title: 'Baru' },
  });
  assert.ok(result.warnings.some((item) => /ditulis ulang penuh/.test(item)), JSON.stringify(result.warnings));
  assert.ok(result.blob.size > 0);
});
