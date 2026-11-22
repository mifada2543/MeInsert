/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mediaProof, mediaPacketProof, sameMediaProof } from '../../assets/js/core/media-proof.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
import { write as writeMp4 } from '../../assets/js/formats/mp4.js';
import { read as readMkv, write as writeMkv } from '../../assets/js/formats/mkv.js';
const workdir = mkdtempSync(join(tmpdir(), 'meinsert-timed-text-'));
const fixture = (name) => new File([readFileSync(`tests/fixtures/${name}`)], name);
const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');
const sidecar = {
  lyrics: { lang: 'id', lines: [{ time: 0, text: 'baris satu' }, { time: 1000, text: 'baris dua' }] },
  subtitles: { lang: 'id', cues: [{ id: '1', start: 0, end: 900, text: 'subtitle satu', settings: '' }] },
};
test('mediaPacketProof equals on a copied A/V file and detects changed packets', async (t) => {
  for (const name of ['clip.mkv', 'clip.mp4']) {
    await t.test(name, async () => {
      const original = fixture(name);
      const copy = new File([await original.arrayBuffer()], `copy-${name}`);
      const before = await mediaPacketProof(original);
      assert.equal(before.valid, true);
      assert.equal(before.algorithm, 'av-packets-v1');
      assert.ok(before.regions.length > 0);
      assert.equal(sameMediaProof(before, await mediaPacketProof(copy)), true);
      const bytes = new Uint8Array(await original.arrayBuffer());
      const index = latin1(bytes).indexOf(name.endsWith('mkv') ? 'S_TEXT/WEBVTT' : 'mdat');
      bytes[index < 0 ? Math.floor(bytes.length / 2) : Math.min(bytes.length - 1, index + 12)] ^= 0xff;
      assert.equal(sameMediaProof(before, await mediaPacketProof(new File([bytes], `changed-${name}`))), false);
      assert.equal((await mediaPacketProof(new Blob(['not media']))).valid, false);
    });
  }
});
test('sameMediaProof accepts matching av-packets-v1 proofs and keeps sha256-chunks-v1 strict', () => {
  const proof = (algorithm, region) => ({
    valid: true, kind: 'mp4', algorithm, regions: [region],
  });
  const region = { length: 3, hash: 'a'.repeat(64) };
  assert.equal(sameMediaProof(proof('av-packets-v1', region), proof('av-packets-v1', { ...region })), true);
  assert.equal(sameMediaProof(proof('av-packets-v1', region), proof('av-packets-v1', { length: 4, hash: region.hash })), false);
  assert.equal(sameMediaProof(proof('av-packets-v1', region), proof('av-packets-v1', { ...region, hash: 'b'.repeat(64) })), false);
  assert.equal(sameMediaProof(proof('sha256-chunks-v1', region), proof('sha256-chunks-v1', { ...region })), true);
  assert.equal(sameMediaProof(proof('av-packets-v1', region), proof('sha256-chunks-v1', region)), false);
  assert.equal(sameMediaProof({ ...proof('av-packets-v1', region), valid: false }, proof('av-packets-v1', region)), false);
  assert.equal(sameMediaProof(proof('av-packets-v1', region), { ...proof('av-packets-v1', region), regions: [] }), false);
});
test('composable subtitle embedding writes raw WebVTT markers and preserves A/V packets', async (t) => {
  const mp4 = fixture('clip.mp4');
  const originalPacketProof = await mediaPacketProof(mp4);
  await t.test('clip.mkv', async () => {
    const result = await writeMkv(fixture('clip.mkv'), { sidecar }, {}, () => {});
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const path = join(workdir, 'clip-out.mkv');
    writeFileSync(path, bytes);
    assert.equal(latin1(bytes).includes('S_TEXT/WEBVTT'), true);
    const reread = await readMkv(new File([bytes], 'clip-out.mkv'));
    assert.deepEqual(reread.sidecar.lyrics.lines, sidecar.lyrics.lines);
    assert.ok(reread.warnings.some((warning) => /subtitle/i.test(warning)));
  });
  await t.test('clip.mp4', async () => {
    const result = await writeMp4(mp4, { sidecar }, {}, () => {});
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    writeFileSync(join(workdir, 'clip-out.mp4'), bytes);
    assert.equal(latin1(bytes).includes('wvtt'), true);
    assert.equal(sameMediaProof(originalPacketProof, result.packetProof), true);
    assert.equal(sameMediaProof(await mediaProof(mp4, 'mp4'), result.mediaProof), false);
    assert.ok(result.warnings.some((warning) => /ditulis ulang/.test(warning)));
  });
});
test('integrity accepts relocated bytes backed by an equal packet proof', async () => {
  const adapter = {
    meta: { id: 'mp4' },
    fields: [{ id: 'title', label: 'Title', type: 'text', native: 'ItemList:Title' }],
  };
  const detection = { id: 'mp4', subtype: 'mp4' };
  const box = (type, data) => {
    const bytes = new Uint8Array(8 + data.length);
    new DataView(bytes.buffer).setUint32(0, bytes.length);
    bytes.set(new TextEncoder().encode(type), 4);
    bytes.set(data, 8);
    return bytes;
  };
  const beforeBytes = await mediaProof(new Blob([box('mdat', [1, 2])]), 'mp4');
  const afterBytes = await mediaProof(new Blob([box('mdat', [3, 4])]), 'mp4');
  const packetProof = await mediaPacketProof(fixture('clip.mp4'));
  const snapshot = (title, byteProof, packets) => {
    const value = createSnapshot({ adapter, detection, readResult: { fields: { title }, mediaProof: byteProof } });
    value.packetProof = packets;
    return value;
  };
  const plan = buildChangePlan({
    adapter, detection,
    baseline: snapshot('old', beforeBytes, packetProof),
    payload: { set: { title: 'new' } },
    outputName: 'out.mp4',
  });
  const relocated = verifyIntegrity(plan, snapshot('new', afterBytes, packetProof));
  assert.equal(relocated.findings.some((finding) => finding.code === 'MEDIA_PAYLOAD_CHANGED'), false);
  assert.ok(relocated.findings.some((finding) => finding.code === 'MEDIA_RELOCATED_BY_SIDECAR' && finding.target === 'media'));
  assert.equal(relocated.status, 'warning');
  const corrupted = verifyIntegrity(plan, snapshot('new', afterBytes, { ...packetProof, regions: [] }));
  assert.equal(corrupted.findings.some((finding) => finding.code === 'MEDIA_PAYLOAD_CHANGED'), true);
});
test.after(() => rmSync(workdir, { recursive: true, force: true }));