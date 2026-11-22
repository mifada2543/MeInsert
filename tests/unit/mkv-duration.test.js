/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { read, write } from '../../assets/js/formats/mkv.js';
import { Input, ALL_FORMATS, BlobSource, EncodedPacketSink } from '../../assets/vendor/mediabunny.mjs';
import { createHash } from 'node:crypto';
test('Matroska reordered B-frame copy preserves duration, packet count, payload hashes and timestamps', async () => {
  const original = new File([readFileSync('tests/fixtures/clip.mkv')], 'clip.mkv');
  const before = await read(original);
  const result = await write(original, { set: { title: 'Timing regression' } });
  const output = new File([result.blob], 'result.mkv');
  assert.equal((await read(output)).info.duration, before.info.duration);
  const packets = async (file) => {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const values = [];
    for await (const packet of new EncodedPacketSink(await input.getPrimaryVideoTrack()).packets()) {
      values.push([packet.timestamp, packet.duration, createHash('sha256').update(packet.data).digest('hex')]);
    }
    input.dispose(); return values;
  };
  assert.deepEqual(await packets(output), await packets(original));
});
test('DefaultDuration survives a second edit (not merely a duration read workaround)', async () => {
  let file = new File([readFileSync('tests/fixtures/clip.mkv')], 'clip.mkv');
  for (let i = 0; i < 2; i++) {
    const { blob } = await write(file, { set: { title: `Edit ${i}` } });
    file = new File([blob], 'clip.mkv');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const packets = [];
    for await (const packet of new EncodedPacketSink(track).packets()) packets.push(packet);
    assert.deepEqual(packets.map((p) => p.timestamp), [0, .2, .1]);
    assert.ok(packets.every((p) => Math.abs(p.duration - .1) < 1e-9));
    assert.equal(await input.computeDuration(), .3);
  }
});