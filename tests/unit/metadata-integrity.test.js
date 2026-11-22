/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
import * as ogg from '../../assets/js/formats/ogg.js';
import * as mp3 from '../../assets/js/formats/mp3.js';
import * as mkv from '../../assets/js/formats/mkv.js';
const adapter = {
  meta: { id: 'mp3', label: 'MP3' },
  fields: [
    { id: 'title', label: 'Judul', type: 'text', native: 'TIT2' },
    { id: 'artist', label: 'Artis', type: 'text', native: 'TPE1' },
    { id: 'album', label: 'Album', type: 'text', native: 'TALB' },
    { id: 'genre', label: 'Genre', type: 'tags', native: 'TCON' },
  ],
};
const detection = { id: 'mp3', subtype: 'mp3', label: 'MP3' };
function readResult(overrides = {}) {
  return {
    fields: {
      title: 'Old title',
      artist: 'Artist',
      album: 'Album',
      genre: ['Pop'],
      ...(overrides.fields || {}),
    },
    custom: overrides.custom || [{ key: 'MOOD', value: 'Calm' }],
    raw: overrides.raw || [
      { group: 'ID3', tag: 'TIT2', value: 'Old title' },
      { group: 'ID3', tag: 'TPE1', value: 'Artist' },
      { group: 'ID3', tag: 'TALB', value: 'Album' },
      { group: 'ID3', tag: 'TCON', value: 'Pop' },
      { group: 'File', tag: 'FileName', value: 'song.mp3' },
    ],
    info: { duration: 12.5, hasCover: true, ...(overrides.info || {}) },
    warnings: overrides.warnings || [],
  };
}
test('createSnapshot normalizes fields, custom tags, raw tags, cover, and structure', () => {
  const snapshot = createSnapshot({ adapter, detection, readResult: readResult() });
  assert.equal(snapshot.format.id, 'mp3');
  assert.equal(snapshot.fields.title.value, 'Old title');
  assert.equal(snapshot.fields.genre.normalized, '["Pop"]');
  assert.equal(snapshot.custom[0].canonicalKey, 'MOOD');
  assert.equal(snapshot.raw.length, 4);
  assert.equal(snapshot.raw.some((row) => row.group === 'File'), false);
  assert.equal(snapshot.cover.present, true);
  assert.equal(snapshot.structure.duration, 12.5);
});
test('buildChangePlan drops no-op edits and freezes only real operations', () => {
  const baseline = createSnapshot({ adapter, detection, readResult: readResult() });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: {
      set: { title: 'New title', genre: ['Pop', 'Jazz'] },
      remove: [],
      custom: [{ key: 'MOOD', value: 'Calm' }],
      rawRemove: ['ZZZZ'],
    },
    outputName: 'song-meinsert.mp3',
  });
  assert.equal(plan.hasOperations, true);
  assert.deepEqual(plan.operations.map((operation) => operation.id || operation.key || operation.tag), ['title', 'genre']);
  assert.deepEqual(plan.payload.set, { title: 'New title', genre: ['Pop', 'Jazz'] });
  assert.deepEqual(plan.payload.custom, []);
  assert.deepEqual(plan.payload.rawRemove, []);
  assert.equal(plan.noops.length, 2);
  assert.equal(plan.outputName, 'song-meinsert.mp3');
});
test('verifyIntegrity reports a preserved file as ok', () => {
  const baseline = createSnapshot({ adapter, detection, readResult: readResult() });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: { set: { title: 'New title', genre: ['Pop', 'Jazz'] } },
    outputName: 'song-meinsert.mp3',
  });
  const after = createSnapshot({
    adapter,
    detection,
    readResult: readResult({
      fields: { title: 'New title', genre: ['Pop', 'Jazz'] },
      raw: [
        { group: 'ID3', tag: 'TIT2', value: 'New title' },
        { group: 'ID3', tag: 'TPE1', value: 'Artist' },
        { group: 'ID3', tag: 'TALB', value: 'Album' },
        { group: 'ID3', tag: 'TCON', value: 'Pop, Jazz' },
      ],
    }),
  });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'ok');
  assert.equal(result.findings.length, 0);
  assert.ok(result.summary.preserved > 0);
});
test('verifyIntegrity fails when an untouched raw tag disappears', () => {
  const baseline = createSnapshot({ adapter, detection, readResult: readResult() });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: { set: { title: 'New title' } },
    outputName: 'song-meinsert.mp3',
  });
  const after = createSnapshot({
    adapter,
    detection,
    readResult: readResult({
      fields: { title: 'New title' },
      raw: [
        { group: 'ID3', tag: 'TIT2', value: 'New title' },
        { group: 'ID3', tag: 'TALB', value: 'Album' },
        { group: 'ID3', tag: 'TCON', value: 'Pop' },
      ],
    }),
  });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'failed');
  assert.ok(result.findings.some((finding) => finding.code === 'METADATA_LOST' && finding.target === 'raw:TPE1'));
});
test('verifyIntegrity marks unsupported ID3 frames as known loss, not failure', () => {
  const baseline = createSnapshot({
    adapter,
    detection,
    readResult: readResult({
      raw: [
        { group: 'ID3', tag: 'TIT2', value: 'Old title' },
        { group: 'ID3', tag: 'TPE1', value: 'Artist' },
        { group: 'ID3', tag: 'TALB', value: 'Album' },
        { group: 'ID3', tag: 'TCON', value: 'Pop' },
        { group: 'ID3', tag: 'XXXX', value: 'unsupported' },
      ],
    }),
  });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: { set: { title: 'New title' } },
    outputName: 'song-meinsert.mp3',
  });
  const after = createSnapshot({
    adapter,
    detection,
    readResult: readResult({
      fields: { title: 'New title' },
      raw: [
        { group: 'ID3', tag: 'TIT2', value: 'New title' },
        { group: 'ID3', tag: 'TPE1', value: 'Artist' },
        { group: 'ID3', tag: 'TALB', value: 'Album' },
        { group: 'ID3', tag: 'TCON', value: 'Pop' },
      ],
    }),
  });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'warning');
  assert.equal(result.knownLoss.length, 1);
  assert.equal(result.knownLoss[0].code, 'UNKNOWN_ID3_FRAME');
});
test('verifyIntegrity fails when a requested field is not written', () => {
  const baseline = createSnapshot({ adapter, detection, readResult: readResult() });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: { set: { title: 'New title' } },
    outputName: 'song-meinsert.mp3',
  });
  const after = createSnapshot({ adapter, detection, readResult: readResult() });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'failed');
  assert.ok(result.findings.some((finding) => finding.code === 'REQUEST_NOT_APPLIED' && finding.target === 'field:title'));
});
const lyricAdapter = {
  meta: { id: 'flac', label: 'FLAC' },
  fields: [{ id: 'lyrics', label: 'Lirik', type: 'textarea', native: 'LYRICS' }],
};
const lyricDetection = { id: 'flac', subtype: 'flac', label: 'FLAC' };
const OLD_LYRICS = '[00:00.00] Lama';
const NEW_LYRICS = '[00:00.00] Baru';
const lyricSidecar = { lyrics: { lang: 'id', lines: [{ time: 0, text: 'Baru' }] }, subtitles: null };
function lyricReadResult(lyrics) {
  return readResult({
    fields: { lyrics },
    custom: [],
    raw: [{ group: 'Vorbis', tag: 'LYRICS', value: lyrics }],
  });
}
test('a planned sidecar lyric rewrite is not reported as an unexpected field or raw change', () => {
  const baseline = createSnapshot({ adapter: lyricAdapter, detection: lyricDetection, readResult: lyricReadResult(OLD_LYRICS) });
  const plan = buildChangePlan({
    adapter: lyricAdapter,
    detection: lyricDetection,
    baseline,
    payload: { set: { lyrics: NEW_LYRICS }, sidecar: lyricSidecar },
    outputName: 'lagu-meinsert.flac',
  });
  assert.ok(plan.operations.some((op) => op.kind === 'field' && op.id === 'lyrics'));
  const after = createSnapshot({ adapter: lyricAdapter, detection: lyricDetection, readResult: lyricReadResult(NEW_LYRICS) });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.findings.some((finding) => finding.code === 'FIELD_CHANGED_UNEXPECTED'), false);
  assert.equal(result.findings.some((finding) => finding.code === 'METADATA_CHANGED_UNEXPECTED'), false);
  assert.notEqual(result.status, 'failed');
});
test('a sidecar-only lyric payload downgrades lyric findings to known notes', () => {
  const baseline = createSnapshot({ adapter: lyricAdapter, detection: lyricDetection, readResult: lyricReadResult(OLD_LYRICS) });
  const plan = buildChangePlan({
    adapter: lyricAdapter,
    detection: lyricDetection,
    baseline,
    payload: { sidecar: lyricSidecar },
    outputName: 'lagu-meinsert.flac',
  });
  assert.ok(plan.operations.some((op) => op.kind === 'sidecar' && op.lyricLines === 1));
  const after = createSnapshot({ adapter: lyricAdapter, detection: lyricDetection, readResult: lyricReadResult(NEW_LYRICS) });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.findings.some((finding) => finding.severity === 'error'), false);
  assert.ok(result.findings.some((finding) => finding.code === 'SIDECAR_LYRICS_REWRITTEN'));
  assert.equal(result.status, 'warning');
});
test('a rewritten container without a raw inventory is unverified, not a mass metadata loss', () => {
  const mp4Adapter = {
    meta: { id: 'mp4', label: 'MP4' },
    fields: [{ id: 'title', label: 'Judul', type: 'text', native: 'Title' }],
  };
  const mp4Detection = { id: 'mp4', subtype: 'mp4', label: 'MP4' };
  const beforeRead = {
    fields: { title: 'Judul' },
    custom: [],
    raw: [{ group: 'ItemList', tag: 'ItemList:Title', value: 'Judul' }],
    info: { kind: 'video' },
    warnings: [],
  };
  const baseline = createSnapshot({ adapter: mp4Adapter, detection: mp4Detection, readResult: beforeRead });
  const plan = buildChangePlan({
    adapter: mp4Adapter,
    detection: mp4Detection,
    baseline,
    payload: { sidecar: { lyrics: null, subtitles: { lang: 'id', cues: [{ id: '1', start: 0, end: 900, text: 'Halo', settings: '' }] } } },
    outputName: 'klip-meinsert.mp4',
  });
  const after = createSnapshot({
    adapter: mp4Adapter,
    detection: mp4Detection,
    readResult: { ...beforeRead, raw: [] },
  });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.findings.some((finding) => finding.code === 'METADATA_LOST'), false);
  assert.ok(result.findings.some((finding) => finding.code === 'RAW_UNVERIFIED'));
  assert.notEqual(result.status, 'failed');
});
const rereadCases = [
  { name: 'tone.ogg', adapter: ogg, detection: { id: 'ogg', subtype: 'vorbis', ext: 'ogg', mime: 'audio/ogg' }, options: {} },
  { name: 'tone.opus', adapter: ogg, detection: { id: 'ogg', subtype: 'opus', ext: 'opus', mime: 'audio/opus' }, options: { extension: 'opus', mime: 'audio/opus' } },
  { name: 'tone.mp3', adapter: mp3, detection: { id: 'mp3', subtype: 'mp3', ext: 'mp3', mime: 'audio/mpeg' }, options: {} },
  { name: 'clip.mkv', adapter: mkv, detection: { id: 'mkv', subtype: 'mkv', ext: 'mkv', mime: 'video/x-matroska' }, options: {} },
];
test('write re-reads its own blob so media info matches read and integrity keeps structure', async () => {
  for (const { name, adapter: testAdapter, detection, options } of rereadCases) {
    const file = new File([readFileSync(`tests/fixtures/${name}`)], name);
    const before = await testAdapter.read(file);
    const baseline = createSnapshot({ adapter: testAdapter, detection, readResult: before });
    const plan = buildChangePlan({
      adapter: testAdapter,
      detection,
      baseline,
      payload: { set: { title: 'Info reread' } },
      outputName: `result.${detection.ext}`,
    });
    const written = await testAdapter.write(file, plan.payload, options, () => {});
    const output = new File([written.blob], `result.${detection.ext}`, { type: detection.mime });
    const reread = await testAdapter.read(output);
    assert.deepEqual(written.info, reread.info, `${name}: write info must match re-read info`);
    if (testAdapter.meta.id === 'ogg' || testAdapter.meta.id === 'mp3') {
      for (const key of ['sampleRate', 'channels', 'codec']) {
        assert.ok(written.info[key], `${name}: ${key} missing from write info`);
        assert.equal(written.info[key], reread.info[key], `${name}: ${key} mismatch`);
      }
    } else {
      assert.ok(written.info.videoCodec || written.info.audioCodec, `${name}: codec missing from write info`);
    }
    const result = verifyIntegrity(plan, createSnapshot({ adapter: testAdapter, detection, readResult: written }));
    assert.equal(result.findings.some((finding) => finding.code === 'STRUCTURE_LOST' && ['sampleRate', 'channels'].includes(finding.target)), false,
      `${name}: unexpected STRUCTURE_LOST for sampleRate/channels`);
    assert.notEqual(result.status, 'failed', `${name}: ${JSON.stringify(result.findings)}`);
    if (testAdapter.meta.id === 'ogg') {
      assert.equal(result.findings.some((finding) => finding.code === 'ENGINE_VENDOR_CHANGED'), false,
        `${name}: targeted rewrite must preserve the vendor`);
      const vendorBefore = before.raw.find((row) => row.tag === 'vendor')?.value;
      const vendorAfter = written.raw.find((row) => row.tag === 'vendor')?.value;
      assert.equal(vendorAfter, vendorBefore, `${name}: vendor must be byte-identical`);
      for (const key of ['duration', 'sampleRate', 'channels', 'codec']) {
        assert.equal(written.info[key], before.info[key], `${name}: ${key} must be unchanged`);
      }
    }
  }
});