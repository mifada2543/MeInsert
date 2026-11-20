/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { inspectOggComment, oggCrc32, rewriteOggComment } from '../../assets/js/core/ogg-comment.js';
import * as ogg from '../../assets/js/formats/ogg.js';
const fixtures = ['tone.ogg', 'tone.opus'];
const bytesOf = (name) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function assertValidPages(bytes, expectedPages) {
  const data = view(bytes);
  const pages = [];
  for (let offset = 0; offset + 27 <= bytes.length;) {
    const segments = bytes[offset + 26];
    let bodyLength = 0;
    for (let index = 0; index < segments; index += 1) bodyLength += bytes[offset + 27 + index];
    const end = offset + 27 + segments + bodyLength;
    const crcOffset = offset + 22;
    assert.equal(data.getUint32(crcOffset, true), oggCrc32(bytes, offset, end, crcOffset), `CRC valid at page ${pages.length}`);
    pages.push({
      headerType: bytes[offset + 5],
      granule: data.getBigUint64(offset + 6, true),
      serial: data.getUint32(offset + 14, true),
      sequence: data.getUint32(offset + 18, true),
      lacing: Array.from(bytes.subarray(offset + 27, offset + 27 + segments)),
    });
    offset = end;
  }
  assert.deepEqual(pages, expectedPages, 'page headers (sequence/granule/type/lacing) unchanged');
}
function mapOf(comments) {
  return Object.fromEntries(comments.map(({ key, value }) => [key.toUpperCase(), value]));
}
function pageHeaders(inspected) {
  return inspected.pages.map(({ headerType, granule, serial, sequence, lacing }) => ({
    headerType, granule, serial, sequence, lacing,
  }));
}
function hasBinary(name) {
  return spawnSync('sh', ['-c', `command -v ${name} >/dev/null 2>&1`], { stdio: 'ignore' }).status === 0;
}
function ffmpegHash(path) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'hash', '-hash', 'sha256', '-'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `ffmpeg failed: ${result.stderr}`);
  return /SHA256=([a-f0-9]+)/.exec(result.stdout)?.[1];
}
function ffprobeField(path, field) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', field, '-of', 'default=noprint_wrappers=1', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, `ffprobe failed: ${result.stderr}`);
  return result.stdout.trim();
}
test('inspectOggComment recognizes Vorbis and Opus comment packets and validates CRC', () => {
  for (const name of fixtures) {
    const inspected = inspectOggComment(bytesOf(name));
    assert.ok(inspected, `${name}: comment packet found`);
    assert.equal(inspected.kind, name.endsWith('opus') ? 'opus' : 'vorbis');
    assert.equal(inspected.vendor, 'Lavf60.16.100');
    const tags = mapOf(inspected.comments);
    assert.equal(tags.TITLE, 'Synthetic fixture');
    assert.equal(tags.ARTIST, 'MeInsert fixture');
    assert.ok(tags.METADATA_BLOCK_PICTURE.startsWith('AAAAAwAAAAlpbWFnZS9wbmc'), `${name}: cover retained`);
    assert.equal(inspected.pages.length, 3, `${name}: three Ogg pages`);
  }
});
test('rewriting a title changes only the comment packet bytes and its page CRC', () => {
  for (const name of fixtures) {
    const before = bytesOf(name);
    const inspected = inspectOggComment(before);
    const pages = pageHeaders(inspected);
    const after = rewriteOggComment(before, { changes: { TITLE: 'Judul baru' } });
    assert.ok(after, `${name}: rewrite must fit`);
    assert.equal(after.length, before.length, `${name}: packet length and page layout unchanged`);
    const rewritten = inspectOggComment(after);
    assert.ok(rewritten, `${name}: rewritten file still parses`);
    assert.equal(mapOf(rewritten.comments).TITLE, 'Judul baru');
    assert.equal(rewritten.vendor, inspected.vendor, `${name}: vendor unchanged`);
    for (const key of ['ARTIST', 'ALBUM', 'DESCRIPTION', 'METADATA_BLOCK_PICTURE']) {
      assert.equal(mapOf(rewritten.comments)[key], mapOf(inspected.comments)[key], `${name}: ${key} unchanged`);
    }
    assertValidPages(after, pages);
    const crcOffset = rewritten.page.start + 22;
    let outsideChanges = 0;
    for (let index = 0; index < before.length; index += 1) {
      const inPacket = index >= inspected.start && index < inspected.end;
      const isCrc = index >= crcOffset && index < crcOffset + 4;
      if (!inPacket && !isCrc) assert.equal(after[index], before[index], `${name}: byte ${index} outside comment packet changed`);
      if (after[index] !== before[index]) outsideChanges += 1;
    }
    assert.ok(outsideChanges > 4, `${name}: comment bytes did change`);
  }
});
test('rewrite preserves media info when read back through the media engine', async () => {
  const lib = await import('../../assets/vendor/mediabunny.mjs');
  const { Input, ALL_FORMATS, BlobSource } = lib;
  for (const name of fixtures) {
    const before = bytesOf(name);
    const patched = rewriteOggComment(before, { changes: { TITLE: 'Info reread' } });
    const readInfo = async (bytes) => {
      const file = new File([bytes], name);
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const audio = await input.getPrimaryAudioTrack();
      return {
        duration: await input.computeDuration(),
        sampleRate: await audio.getSampleRate(),
        channels: await audio.getNumberOfChannels(),
        codec: await audio.getCodec(),
      };
    };
    assert.deepEqual(await readInfo(patched), await readInfo(before), `${name}: media info unchanged`);
  }
});
test('rewrite supports removal, custom keys, multi-valued comments, and grows the comment page when needed', () => {
  const before = bytesOf('tone.ogg');
  const removed = rewriteOggComment(before, { changes: { DESCRIPTION: '' } });
  assert.ok(removed);
  assert.equal(mapOf(inspectOggComment(removed).comments).DESCRIPTION, undefined);
  const added = rewriteOggComment(before, { changes: { TITLE: 'X', MOOD: 'Calm' } });
  assert.ok(added);
  const values = inspectOggComment(added).comments.filter(({ key }) => key.toUpperCase() === 'MOOD').map(({ value }) => value);
  assert.deepEqual(values, ['Calm']);
  const multi = rewriteOggComment(before, { changes: { DESCRIPTION: ['A', 'B'] } });
  assert.ok(multi);
  const multiValues = inspectOggComment(multi).comments
    .filter(({ key }) => key.toUpperCase() === 'DESCRIPTION').map(({ value }) => value);
  assert.deepEqual(multiValues, ['A', 'B']);

  const grown = rewriteOggComment(before, { changes: { TITLE: 'X'.repeat(20000) } });
  assert.ok(grown, 'a comment that no longer fits is grown inside its Ogg page');
  const impossible = rewriteOggComment(before, { changes: { TITLE: 'X'.repeat(200000) } });
  assert.equal(impossible, null, 'a comment needing more than 255 lacing segments must fall back');
});
test('rewrite rejects corrupt pages, truncated files and non Vorbis/Opus Ogg streams', () => {
  for (const name of fixtures) {
    const bytes = bytesOf(name);
    const corrupt = bytes.slice();
    view(corrupt).setUint32(corrupt.length - 16, view(corrupt).getUint32(corrupt.length - 16, true) ^ 1, true);
    assert.equal(inspectOggComment(corrupt), null, `${name}: CRC corruption rejected`);
    assert.equal(rewriteOggComment(corrupt, { changes: { TITLE: 'x' } }), null);
    assert.equal(inspectOggComment(bytes.subarray(0, bytes.length - 10)), null, `${name}: truncation rejected`);
  }
  for (const name of ['reject-flac.ogg', 'reject-speex.ogg']) {
    assert.equal(inspectOggComment(bytesOf(name)), null, `${name}: unsupported stream rejected`);
  }
});
test('ogg.write takes the targeted path for metadata-only edits and warns on fallback', async () => {
  for (const name of fixtures) {
    const options = name.endsWith('opus') ? { extension: 'opus', mime: 'audio/opus' } : {};
    const file = new File([bytesOf(name)], name);
    const before = await ogg.read(file);
    const written = await ogg.write(file, { set: { title: 'Info reread' } }, options, () => {});
    assert.deepEqual(written.warnings, [], `${name}: no silent fallback for a feasible rewrite`);
    assert.equal(written.fields.title, 'Info reread');
    assert.equal(written.info.duration, before.info.duration, `${name}: duration unchanged`);
    assert.deepEqual(written.info, before.info, `${name}: info unchanged`);
    const patched = new Uint8Array(await written.blob.arrayBuffer());
    assertValidPages(patched, pageHeaders(inspectOggComment(bytesOf(name))));
    const huge = await ogg.write(file, { set: { title: 'X'.repeat(200000) } }, options, () => {});
    assert.ok(huge.warnings.some((warning) => warning.includes('media engine')), `${name}: fallback must be reported`);
  }
});
test('ffmpeg/ffprobe independent verification (development-only, skipped when unavailable)', (t) => {
  if (!hasBinary('ffmpeg') || !hasBinary('ffprobe')) {
    t.skip('ffmpeg/ffprobe not installed');
    return;
  }
  for (const name of fixtures) {
    const original = bytesOf(name);
    const patched = rewriteOggComment(original, { changes: { TITLE: 'Info reread' } });
    const originalPath = `/tmp/opencode/ogg-proof-original-${process.pid}-${name}`;
    const patchedPath = `/tmp/opencode/ogg-proof-patched-${process.pid}-${name}`;
    writeFileSync(originalPath, original);
    writeFileSync(patchedPath, patched);
    assert.equal(ffmpegHash(patchedPath), ffmpegHash(originalPath), `${name}: decoded audio hash unchanged`);
    assert.ok(ffprobeField(patchedPath, 'stream_tags=title').includes('Info reread'), `${name}: ffprobe sees new title`);
    assert.ok(ffprobeField(patchedPath, 'stream=codec_name').includes(name.endsWith('opus') ? 'opus' : 'vorbis'));
  }
});
test('growing the comment packet preserves following Ogg packets and CRC', () => {
  for (const name of fixtures) {
    const before = bytesOf(name);
    const original = inspectOggComment(before);
    const patched = rewriteOggComment(before, { changes: { TITLE: 'Independent verify' } });
    assert.ok(patched, `${name}: growth must succeed`);
    const after = inspectOggComment(patched);
    assert.ok(after, `${name}: patched stream must parse`);
    assert.equal(after.comments.find((entry) => entry.key === 'title')?.value, 'Independent verify');
    assert.ok(after.packet.length < 4000, `${name}: setup packet was not swallowed into the comment`);
    assert.equal(after.pages.length, original.pages.length, `${name}: page count unchanged`);
    assert.deepEqual(
      after.pages.map((page) => page.sequence),
      original.pages.map((page) => page.sequence),
      `${name}: sequence numbers unchanged`,
    );
  }
});