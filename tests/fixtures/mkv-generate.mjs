/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Separate, reproducible timing corpus; never modifies the shared fixtures.
export function generateMkvFixtures(directory) {
  mkdirSync(directory, { recursive: true });
  const cases = [
    { name: 'bframes-short', duration: '0.3' },
    { name: 'bframes-long', duration: '1.1' },
    { name: 'no-bframes', duration: '0.7', bframes: 0 },
    { name: 'nonzero-start', duration: '0.7', offset: '1.2' },
    { name: 'nonzero-offgrid', duration: '0.3', offset: '1.25', reject: true },
    { name: 'audio-only', duration: '0.7', audio: true, video: false, reject: true },
    { name: 'audio-video', duration: '0.7', audio: true, reject: true },
    { name: 'variable-bframes', duration: '0.7', variable: true, reject: true },
  ];
  for (const item of cases) {
    item.path = join(directory, `${item.name}.mkv`);
    const args = ['-v', 'error', '-y'];
    if (item.video !== false) args.push('-f', 'lavfi', '-i', 'testsrc2=size=32x32:rate=10');
    if (item.audio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000');
    args.push('-t', item.duration);
    if (item.video !== false) {
      args.push('-c:v', 'libx264', '-bf', String(item.bframes ?? 2));
      if (item.variable) args.push('-vf', "setpts='if(gte(N,3),PTS+2,PTS)'", '-fps_mode', 'vfr');
    }
    if (item.audio) args.push('-c:a', 'aac', '-avoid_negative_ts', 'make_zero');
    if (item.offset) args.push('-output_ts_offset', item.offset);
    execFileSync('ffmpeg', [...args, item.path], { stdio: 'pipe' });
  }
  return cases;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node tests/fixtures/mkv-generate.mjs OUTPUT_DIRECTORY');
  console.log(generateMkvFixtures(resolve(process.argv[2])));
}
