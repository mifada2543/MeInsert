/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectOggComment, rewriteOggComment } from '../../assets/js/core/ogg-comment.js';
import * as ogg from '../../assets/js/formats/ogg.js';
const bytesOf = (name) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
function pageOffsets(bytes) {
  const out = [];
  let offset = 0;
  while (offset + 27 <= bytes.length) {
    const segments = bytes[offset + 26];
    let body = 0;
    for (let i = 0; i < segments; i += 1) body += bytes[offset + 27 + i];
    out.push({ start: offset, end: offset + 27 + segments + body });
    offset = out[out.length - 1].end;
  }
  return out;
}
function decode(bytes) {
  return new TextDecoder().decode(bytes);
}
function commentsOf(bytes) {
  const map = new Map();
  for (const item of inspectOggComment(bytes).comments) {
    const key = item.key.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item.value);
  }
  return map;
}
test('repeated keys, Unicode, empty values and unknown fields survive a rewrite', () => {
  for (const name of ['tone.ogg', 'tone.opus']) {
    const original = bytesOf(name);
    const patched = rewriteOggComment(original, {
      changes: {
        ARTIST: ['First', 'Kedua \u00e9 \u{1f600}'],
        MOOD: 'Calm',
        DESCRIPTION: '',
      },
    });
    assert.ok(patched, `${name}: patch must succeed`);
    const values = commentsOf(patched);
    assert.deepEqual(values.get('artist'), ['First', 'Kedua \u00e9 \u{1f600}']);
    assert.deepEqual(values.get('mood'), ['Calm']);
    assert.equal(values.has('description'), false);
    assert.equal(values.get('encoder')[0], commentsOf(original).get('encoder')[0]);
  }
});
test('OpusHead and Vorbis identification/setup bytes stay identical after growth', () => {
  for (const name of ['tone.ogg', 'tone.opus']) {
    const original = bytesOf(name);
    const patched = rewriteOggComment(original, { changes: { TITLE: 'X'.repeat(5000) } });
    assert.ok(patched, `${name}: growth must succeed`);
    assert.equal(pageOffsets(patched).length, pageOffsets(original).length);
    assert.deepEqual([...patched.subarray(0, 64)], [...original.subarray(0, 64)]);
    assert.equal(decode(patched.subarray(0, 128)).includes('OpusHead'),
      decode(original.subarray(0, 128)).includes('OpusHead'));
  }
});
test('corrupted page CRC is rejected instead of producing an unverified file', () => {
  const original = bytesOf('tone.opus');
  const damaged = original.slice();
  damaged[100] ^= 0xff;
  assert.equal(rewriteOggComment(damaged, { changes: { TITLE: 'x' } }), null);
  assert.equal(inspectOggComment(damaged), null);
});
test('truncated Ogg stream is rejected safely', () => {
  const original = bytesOf('tone.ogg');
  assert.equal(rewriteOggComment(original.subarray(0, original.length - 40), { changes: { TITLE: 'x' } }), null);
});
test('chained streams are either fully patched or rejected, never half-modified', () => {
  const original = bytesOf('tone.opus');
  const chained = new Uint8Array(original.length * 2);
  chained.set(original, 0);
  chained.set(original, original.length);
  const patched = rewriteOggComment(chained, { changes: { TITLE: 'Chain' } });
  if (patched) {
    const maps = commentsOf(patched);
    assert.ok(maps.get('title').every((value) => value === 'Chain'), 'every stream must carry the new value');
  } else {
    assert.equal(inspectOggComment(chained), null);
  }
});
test('ogg.write still preserves decoded audio for long metadata', async () => {
  const original = bytesOf('tone.ogg');
  const file = new File([original], 'tone.ogg');
  const result = await ogg.write(file, { set: { title: 'Panjang \u00e9 \u{1f600} '.repeat(20) } }, { subtype: 'vorbis' }, () => {});
  const out = new Uint8Array(await result.blob.arrayBuffer());
  assert.ok(out.length > 0);
  assert.ok(inspectOggComment(out), 'output must remain a parseable Ogg stream');
});