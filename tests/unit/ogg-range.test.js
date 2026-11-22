/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectOggComment, oggCrc32, rewriteOggComment, rewriteOggCommentBlob } from '../../assets/js/core/ogg-comment.js';
import * as ogg from '../../assets/js/formats/ogg.js';
const bytesOf = (name) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
const encoder = new TextEncoder();
function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}
function mapOf(comments) {
  return Object.fromEntries(comments.map(({ key, value }) => [key.toUpperCase(), value]));
}
function identical(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function buildPage(chunks, { headerType = 0, sequence = 0 } = {}) {
  const lacing = chunks.map((chunk) => chunk.length);
  const header = new Uint8Array(27 + lacing.length);
  header.set([0x4f, 0x67, 0x67, 0x53], 0);
  header[4] = 0;
  header[5] = headerType;
  header[26] = lacing.length;
  header.set(lacing, 27);
  new DataView(header.buffer).setUint32(14, 1, true); // serial
  new DataView(header.buffer).setUint32(18, sequence, true);
  const body = concat(chunks);
  const page = new Uint8Array(header.length + body.length);
  page.set(header, 0);
  page.set(body, header.length);
  const crc = oggCrc32(page, 0, page.length, 22);
  new DataView(page.buffer).setUint32(22, crc, true);
  return page;
}
function sliceInto(bytes, size) {
  const chunks = [];
  for (let index = 0; index < bytes.length; index += size) {
    chunks.push(bytes.subarray(index, Math.min(index + size, bytes.length)));
  }
  return chunks;
}
function syntheticComment() {
  const vendor = new Uint8Array(400).fill(65);
  const title = encoder.encode('TITLE=ok');
  return concat([
    encoder.encode('\x03vorbis'), u32(vendor.length), vendor,
    u32(1), u32(title.length), title,
  ]);
}
function buildSyntheticOgg(splitComment) {
  const ident = concat([Uint8Array.of(1), encoder.encode('vorbis'), new Uint8Array(23)]);
  const page0 = buildPage([ident], { headerType: 0x02, sequence: 0 });
  const chunks = sliceInto(syntheticComment(), 255);
  assert.equal(chunks[0].length, 255, 'setup: first comment segment forces a continuation');
  if (!splitComment) return concat([page0, buildPage(chunks, { sequence: 1, headerType: 0x04 })]);
  const page1 = buildPage([chunks[0]], { sequence: 1 });
  const page2 = buildPage(chunks.slice(1), { sequence: 2, headerType: 0x04 });
  return concat([page0, page1, page2]);
}
async function readTagsViaMedia(blob, name) {
  const lib = await import('../../assets/vendor/mediabunny.mjs');
  const { Input, ALL_FORMATS, BlobSource } = lib;
  const input = new Input({ source: new BlobSource(new File([blob], name)), formats: ALL_FORMATS });
  const tags = await input.getMetadataTags();
  return Object.fromEntries(Object.entries(tags.raw || {}));
}
test('range rewrite is byte-identical to the full-buffer path for Vorbis and Opus', async () => {
  for (const name of ['tone.ogg', 'tone.opus']) {
    const original = bytesOf(name);
    const options = { changes: { TITLE: 'Judul baru', ARTIST: 'Artis baru' } };
    const expected = rewriteOggComment(original, options);
    assert.ok(expected, `${name}: full-buffer path must succeed`);
    const patched = await rewriteOggCommentBlob(new File([original], name), options);
    assert.ok(patched, `${name}: range path must succeed for a single-page comment`);
    const output = new Uint8Array(await patched.blob.arrayBuffer());
    assert.ok(identical(output, expected), `${name}: patched output is byte-identical to rewriteOggComment`);
    assert.ok(patched.patchedBytes.length > 0, `${name}: rebuilt comment page returned`);
    assert.deepEqual(
      mapOf(inspectOggComment(output).comments),
      mapOf(inspectOggComment(expected).comments),
      `${name}: same tag values`,
    );
  }
});
test('verification of the patched output yields the same tags as the full-buffer path', async () => {
  for (const name of ['tone.ogg', 'tone.opus']) {
    const original = bytesOf(name);
    const options = { changes: { TITLE: 'Info reread', MOOD: 'Calm' } };
    const expected = rewriteOggComment(original, options);
    const patched = await rewriteOggCommentBlob(new File([original], name), options);
    const mediaTags = await readTagsViaMedia(patched.blob, name);
    const expectedMediaTags = await readTagsViaMedia(new Blob([expected]), name);
    assert.equal(mediaTags.TITLE, 'Info reread', `${name}: mediabunny sees the new title`);
    assert.equal(mediaTags.MOOD, 'Calm', `${name}: mediabunny sees the added field`);
    assert.deepEqual(mediaTags, expectedMediaTags, `${name}: read-back matches the full-buffer path`);
  }
});
test('audio payload bytes after the comment header are byte-identical (shrink and grow)', async () => {
  for (const name of ['tone.ogg', 'tone.opus']) {
    const original = bytesOf(name);
    const inspected = inspectOggComment(original);
    const commentEnd = inspected.page.end;
    const tailLength = original.length - commentEnd;
    assert.ok(tailLength > 0, `${name}: fixture has audio pages after the comment`);
    for (const changes of [
      { TITLE: 'Short' },
      { TITLE: 'X'.repeat(5000) },
      { DESCRIPTION: '', ARTIST: ' artist \u00e9 \u{1f600} '.repeat(20) },
    ]) {
      const patched = await rewriteOggCommentBlob(new File([original], name), { changes });
      assert.ok(patched, `${name}: rewrite must succeed`);
      const output = new Uint8Array(await patched.blob.arrayBuffer());
      assert.ok(identical(output.subarray(0, inspected.page.start),
        original.subarray(0, inspected.page.start)), `${name}: leading pages unchanged`);
      assert.ok(identical(output.subarray(output.length - tailLength),
        original.subarray(commentEnd)), `${name}: audio payload after comment unchanged`);
    }
  }
});
test('a synthetic single-page comment is patched; a multi-page comment returns null', async () => {
  const single = buildSyntheticOgg(false);
  const singlePatched = await rewriteOggCommentBlob(new File([single], 'single.ogg'), {
    changes: { TITLE: 'ok2' },
  });
  assert.ok(singlePatched, 'single-page synthetic comment is patchable');
  assert.equal(mapOf(inspectOggComment(new Uint8Array(await singlePatched.blob.arrayBuffer())).comments).TITLE, 'ok2');
  const multi = buildSyntheticOgg(true);
  assert.equal(inspectOggComment(multi), null, 'setup: cross-page comment is rejected by the rewriter');
  assert.equal(rewriteOggComment(multi, { changes: { TITLE: 'ok2' } }), null);
  assert.equal(
    await rewriteOggCommentBlob(new File([multi], 'multi.ogg'), { changes: { TITLE: 'ok2' } }),
    null,
    'multi-page comment must return null so the full-remux fallback runs',
  );
});
test('corrupt, truncated, chained and non-Vorbis/Opus inputs all return null (fall back)', async () => {
  const options = { changes: { TITLE: 'x' } };
  const original = bytesOf('tone.ogg');
  const corrupt = original.slice();
  corrupt[30] ^= 0xff;
  assert.equal(await rewriteOggCommentBlob(new File([corrupt], 'corrupt.ogg'), options), null);
  assert.equal(await rewriteOggCommentBlob(new File([original.subarray(0, original.length - 40)], 'short.ogg'), options), null);
  const chained = new Uint8Array(original.length * 2);
  chained.set(original, 0);
  chained.set(original, original.length);
  assert.equal(await rewriteOggCommentBlob(new File([chained], 'chain.ogg'), options), null);
  for (const name of ['reject-flac.ogg', 'reject-speex.ogg']) {
    assert.equal(await rewriteOggCommentBlob(new File([bytesOf(name)], name), options), null, `${name}: unsupported stream`);
  }
  const huge = { changes: { TITLE: 'X'.repeat(200000) } };
  assert.equal(rewriteOggComment(original, huge), null);
  assert.equal(await rewriteOggCommentBlob(new File([original], 'tone.ogg'), huge), null);
});
test('ogg.write uses the range path without a fallback warning for a feasible edit', async () => {
  for (const name of ['tone.ogg', 'tone.opus']) {
    const options = name.endsWith('opus') ? { extension: 'opus', mime: 'audio/opus' } : {};
    const file = new File([bytesOf(name)], name);
    const written = await ogg.write(file, { set: { title: 'Range path' } }, options, () => {});
    assert.deepEqual(written.warnings, [], `${name}: no silent fallback for a feasible rewrite`);
    assert.equal(written.fields.title, 'Range path');
    assert.equal(written.info.codec, name.endsWith('opus') ? 'opus' : 'vorbis');
  }
});