/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaProof, sameMediaProof } from '../../assets/js/core/media-proof.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
import { fields as mp4Fields } from '../../assets/js/formats/mp4.js';
function box(type, data) {
  const bytes = new Uint8Array(8 + data.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode(type), 4); bytes.set(data, 8);
  return bytes;
}
function tiff(offset = 40, little = true, tile = false) {
  const bytes = new Uint8Array(offset + 4), view = new DataView(bytes.buffer);
  view.setUint16(0, little ? 0x4949 : 0x4d4d); view.setUint16(2, 42, little); view.setUint32(4, 8, little);
  view.setUint16(8, 2, little);
  for (const [index, tag, value] of [[0, tile ? 324 : 273, offset], [1, tile ? 325 : 279, 4]]) {
    const at = 10 + index * 12;
    view.setUint16(at, tag, little); view.setUint16(at + 2, 4, little);
    view.setUint32(at + 4, 1, little); view.setUint32(at + 8, value, little);
  }
  bytes.set([1, 2, 3, 4], offset); return bytes;
}
test('MP4 relocation compares mdat payloads, rejects corruption and truncated boxes', async () => {
  const original = new Blob([box('mdat', [1, 2, 3, 4])]);
  const moved = new Blob([box('free', [0, 0]), box('mdat', [1, 2, 3, 4])]);
  const before = await mediaProof(original, 'mp4');
  assert.equal(sameMediaProof(before, await mediaProof(moved, 'mp4')), true);
  assert.equal(sameMediaProof(before, await mediaProof(new Blob([box('mdat', [1, 2, 3, 5])]), 'mp4')), false);
  assert.equal((await mediaProof(new Blob([box('mdat', [1, 2]).slice(0, 9)]), 'mp4')).valid, false);
  assert.equal((await mediaProof(new Blob([box('free', [1])]), 'mp4')).valid, false);
});
test('classic TIFF strips/tiles, both byte orders: only identical valid payload earns relocation proof', async () => {
  for (const little of [true, false]) for (const tile of [true, false]) {
    const before = await mediaProof(new Blob([tiff(40, little, tile)]), 'tiff');
    assert.equal(before.valid, true);
    assert.equal(sameMediaProof(before, await mediaProof(new Blob([tiff(80, little, tile)]), 'tiff')), true);
    const corrupt = tiff(80, little, tile); corrupt[80] = 99;
    assert.equal(sameMediaProof(before, await mediaProof(new Blob([corrupt]), 'tiff')), false);
    const invalid = tiff(80, little, tile); new DataView(invalid.buffer).setUint32(18, 900, little);
    assert.equal((await mediaProof(new Blob([invalid]), 'tiff')).valid, false);
  }
});
function verify({ format = 'mp4', subtype = format, tag = 'QuickTime:MediaDataOffset', beforeValue = '8', afterValue = '88', proof, afterProof = proof, native = 'ItemList:Title', titleChanged = true }) {
  const adapter = { meta: { id: format }, fields: [{ id: 'title', label: 'Title', type: 'text', native }] };
  const detection = { id: format, subtype };
  const snapshot = (value, title, evidence) => createSnapshot({ adapter, detection,
    readResult: { fields: { title }, raw: [{ tag, value }], mediaProof: evidence } });
  const plan = buildChangePlan({ adapter, detection, baseline: snapshot(beforeValue, 'old', proof),
    payload: titleChanged ? { set: { title: 'new' } } : {}, outputName: 'output' });
  return verifyIntegrity(plan, snapshot(afterValue, titleChanged ? 'new' : 'old', afterProof));
}
test('offset exemptions require proof; payload corruption still fails even with identical raw tags', async () => {
  const proof = await mediaProof(new Blob([box('mdat', [1, 2])]), 'mp4');
  assert.equal(verify({ proof }).status, 'warning'); // visible informational relocation
  assert.ok(verify({ proof }).findings.some((finding) => finding.code === 'MEDIA_RELOCATED'));
  assert.equal(verify({}).status, 'failed');
  const corrupt = await mediaProof(new Blob([box('mdat', [1, 3])]), 'mp4');
  assert.equal(verify({ proof, afterProof: corrupt, afterValue: '8' }).status, 'failed');
  assert.equal(verify({ proof, tag: 'QuickTime:ArbitraryTag' }).status, 'failed');
});
test('MOV title alias is expected only when the title is explicitly changed', () => {
  const native = mp4Fields.find((field) => field.id === 'title').native;
  assert.notEqual(verify({ tag: 'UserData:Title', beforeValue: 'old', afterValue: 'new', native }).status, 'failed');
  assert.equal(verify({ tag: 'UserData:Title', beforeValue: 'old', afterValue: 'new', native, titleChanged: false }).status, 'failed');
});
test('engine vendor warning is narrowly scoped; missing vendor, other vendor changes and ENCODER remain failures', () => {
  for (const format of ['flac', 'ogg']) {
    const result = verify({ format, tag: 'vendor', beforeValue: 'Lavf', afterValue: 'Mediabunny v1.65.0' });
    assert.equal(result.status, 'warning');
    assert.ok(result.findings.some((finding) => finding.code === 'ENGINE_VENDOR_CHANGED'));
    for (const [tag, afterValue] of [['vendor', 'Other'], ['vendor', ''], ['ENCODER', 'Mediabunny v1.65.0']]) {
      assert.equal(verify({ format, tag, beforeValue: 'Lavf', afterValue }).status, 'failed');
    }
  }
  assert.equal(verify({ format: 'mp4', tag: 'vendor', beforeValue: 'Lavf', afterValue: 'Mediabunny v1.65.0' }).status, 'failed');
});