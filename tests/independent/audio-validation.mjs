/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../../assets/js/core/registry.js';
import { detectFile } from '../../assets/js/core/detector.js';
const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = join(root, 'tests', 'fixtures');
const names = ['tone.ogg', 'tone.opus'];
const hasBinary = (name) => spawnSync(name, ['-version'], { stdio: 'ignore', timeout: 15_000 }).status === 0;
let failures = 0;
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`); };
if (!hasBinary('ffmpeg') || !hasBinary('ffprobe')) {
  console.log('SKIP: FFmpeg/FFprobe not installed; independent audio verification not executed.');
} else {
  const work = mkdtempSync(join(tmpdir(), 'meinsert-audio-'));
  try {
    for (const name of names) {
      const bytes = readFileSync(join(fixtures, name));
      const file = new File([bytes], name);
      const detection = await detectFile(file);
      const adapter = await getAdapter(detection.id);
      const options = { subtype: detection.subtype, extension: detection.ext, mime: detection.mime };
      const result = await adapter.write(file, { set: { title: 'Independent verify' } }, options, () => {});
      const afterPath = join(work, `after-${name}`);
      writeFileSync(afterPath, new Uint8Array(await result.blob.arrayBuffer()));
      const beforePath = join(fixtures, name);
      const stream = (path) => {
        const output = spawnSync('ffprobe', [
          '-v', 'error', '-select_streams', 'a:0',
          '-show_entries', 'stream=codec_name,sample_rate,channels,duration',
          '-of', 'default=nw=1', path,
        ], { encoding: 'utf8', timeout: 60_000 });
        if (output.status !== 0) throw new Error(`ffprobe failed for ${path}: ${output.stderr.trim()}`);
        return output.stdout.trim();
      };
      const pcmHash = (path) => {
        const output = spawnSync('ffmpeg', [
          '-v', 'error', '-i', path, '-map', '0:a:0', '-f', 'md5', '-',
        ], { encoding: 'utf8', timeout: 60_000 });
        if (output.status !== 0) throw new Error(`ffmpeg failed for ${path}: ${output.stderr.trim()}`);
        return output.stdout.trim();
      };
      if (stream(beforePath) !== stream(afterPath)) fail(`${name}: stream information changed`);
      if (pcmHash(beforePath) !== pcmHash(afterPath)) fail(`${name}: decoded PCM hash changed`);
      console.log(`PASS: ${name} stream information and decoded PCM hash are unchanged`);
    }
    console.log(`Independent audio validation finished with ${failures} failure(s).`);
    if (failures) process.exitCode = 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
