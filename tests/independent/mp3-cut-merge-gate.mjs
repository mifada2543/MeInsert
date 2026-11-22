// MeInsert — Edit metadata file tanpa upload, 100% di browser.
// Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert
// reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2
// Copy this test into the repository root and run: node meinsert-v15-merge-gate.mjs
// Requires ffmpeg and ffprobe in PATH. Does not alter production files.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sliceMp3Range } from '../../assets/js/core/mp3-cut.js';
import { mediaRangeProof } from '../../assets/js/core/media-cut.js';
const dir = mkdtempSync(join(tmpdir(), 'meinsert-merge-gate-'));
try {
  const sourcePath = join(dir, 'source.mp3');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=44100:duration=10', '-c:a', 'libmp3lame', '-b:a', '192k', '-y', sourcePath]);
  const file = new Blob([readFileSync(sourcePath)]);
  let failures = 0;
  for (const [start, end] of [[0, 1], [0.5, 2.5], [3, 5]]) {
    const cut = await sliceMp3Range(file, start, end);
    assert.ok(cut, 'slice should produce output');
    const outputPath = join(dir, `cut-${start}-${end}.mp3`);
    writeFileSync(outputPath, Buffer.from(await cut.blob.arrayBuffer()));
    const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outputPath], { encoding: 'utf8' }).trim());
    const expected = end - start;
    const durationOk = Math.abs(duration - expected) <= 0.15;
    const proofBefore = await mediaRangeProof(file, start, end);
    const proofAfter = await mediaRangeProof(cut.blob, 0, expected);
    const proofOk = proofBefore.valid && proofAfter.valid && JSON.stringify(proofBefore.regions) === JSON.stringify(proofAfter.regions);
    console.log(`${start}-${end}s: ffprobe=${duration.toFixed(3)}s (expected ${expected}s) duration=${durationOk?'PASS':'FAIL'} range-proof=${proofOk?'PASS':'FAIL'}`);
    if (!durationOk || !proofOk) failures++;
  }
  if (failures) { console.error(`MERGE GATE FAIL: ${failures} scenarios failed`); process.exitCode = 1; }
  else console.log('MERGE GATE PASS');
} finally { rmSync(dir, { recursive: true, force: true }); }