/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { read, write } from '../../assets/js/formats/mkv.js';
import { generateMkvFixtures } from '../fixtures/mkv-generate.mjs';
export function probeMkv(path) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_packets', '-show_streams', '-show_format',
    '-show_data_hash', 'sha256', '-of', 'json', path], { encoding: 'utf8' }));
}
function frameCounts(path) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries',
    'stream=index,nb_read_frames', '-of', 'json', path], { encoding: 'utf8' })).streams;
}
export async function checkMkvRoundTrip(path, directory, subtype = 'mkv') {
  const file = new File([readFileSync(path)], `source.${subtype}`);
  const before = await read(file);
  const result = await write(file, { set: { title: 'Timing regression' } }, { subtype });
  const after = await read(new File([result.blob], `result.${subtype}`));
  assert.equal(after.fields.title, 'Timing regression');
  assert.ok(Math.abs(after.info.duration - before.info.duration) < 1e-6, 'Adapter duration changed');
  const output = join(directory, 'result.mkv');
  writeFileSync(output, new Uint8Array(await result.blob.arrayBuffer()));
  const a = probeMkv(path), b = probeMkv(output);
  assert.deepEqual(frameCounts(output), frameCounts(path), 'Decoded frame count changed');
  assert.equal(b.packets.length, a.packets.length);
  for (let i = 0; i < a.packets.length; i++) {
    assert.equal(b.packets[i].stream_index, a.packets[i].stream_index);
    assert.equal(b.packets[i].data_hash, a.packets[i].data_hash, `Compressed packet ${i} changed`);
    for (const key of ['pts_time', 'duration_time']) {
      assert.equal(b.packets[i][key] !== undefined, a.packets[i][key] !== undefined, `${key} disappeared`);
      if (a.packets[i][key] !== undefined) assert.ok(Math.abs(Number(a.packets[i][key]) - Number(b.packets[i][key])) <= .001000001,
        `Packet ${i} ${key} changed: ${a.packets[i][key]} -> ${b.packets[i][key]}`);
    }
  }
  assert.ok(Math.abs(Number(a.format.duration) - Number(b.format.duration)) <= .001000001, 'ffprobe duration changed');
  return { duration: [before.info.duration, after.info.duration], packets: a.packets.length,
    frames: frameCounts(output), tail: b.packets.map((p) => ({ stream: p.stream_index, pts: p.pts_time, duration: p.duration_time })).slice(-3) };
}
export async function runMkvDurationChecks() {
  const directory = mkdtempSync(join(tmpdir(), 'meinsert-mkv-duration-'));
  try {
    for (const name of ['clip.mkv', 'clip.webm']) {
      console.log(name, JSON.stringify(await checkMkvRoundTrip(resolve('tests/fixtures', name), directory, name.split('.')[1])));
    }
    for (const item of generateMkvFixtures(directory)) {
      if (item.reject) {
        await assert.rejects(() => write(new File([readFileSync(item.path)], 'variable.mkv'), { set: { title: 'No unsafe success' } }),
          (error) => error.code === 'WRITE_FAILED' && /timing/i.test(error.detail));
        console.log(item.name, 'safely rejected: packet timing cannot be preserved by this library');
      } else console.log(item.name, JSON.stringify(await checkMkvRoundTrip(item.path, directory)));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runMkvDurationChecks();