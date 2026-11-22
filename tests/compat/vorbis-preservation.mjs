/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Standalone targeted test: node tests/compat/vorbis-preservation.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const root = resolve(new URL('../..', import.meta.url).pathname);
const server = createServer(async (req, res) => {
  const path = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
  if (!path.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const content = await readFile(path);
    res.setHeader('content-type', ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'text/html');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const temp = await mkdtemp(join(tmpdir(), 'meinsert-vorbis-preservation-'));
let browser;
try {
  const executablePath = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => path && existsSync(path));
  browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-dev-shm-usage'] });
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const forbidden = [], pageErrors = [];
  await page.route('**/*', (route) => {
    if (route.request().method() === 'GET' && route.request().url().startsWith(`${origin}/`)) return route.continue();
    forbidden.push(route.request().url()); return route.abort();
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${origin}/single.html`);
  const results = await page.evaluate(async () => {
    const { MetadataClient } = await import('/assets/js/core/worker-client.js');
    const { commentPictures, flacPictures, pictureBase64, repairFlacMetadata, serializePicture } = await import('/assets/js/formats/vorbis-pictures.js');
    const { Input, BlobSource, ALL_FORMATS } = await import('/assets/vendor/mediabunny.mjs');
    const client = new MetadataClient({ idleTimeout: 0 });
    const results = [];
    const check = (value, message) => { if (!value) throw new Error(message); };
    const equal = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
    const tags = (file) => new Input({ source: new BlobSource(file), formats: ALL_FORMATS }).getMetadataTags();
    try {
      const image = new Uint8Array(await (await fetch('/tests/fixtures/pattern.png')).arrayBuffer());
      const pictures = [1, 3, 4, 4].map((type, index) => {
        const bytes = serializePicture({ data: image, mimeType: 'image/png', kind: 'coverFront', description: `日本語 ${index}` });
        const data = new DataView(bytes.buffer);
        data.setUint32(0, type);
        const mimeLength = data.getUint32(4), descriptionLength = data.getUint32(8 + mimeLength);
        const offset = 12 + mimeLength + descriptionLength;
        [32, 24, 32, 17].forEach((value, i) => data.setUint32(offset + i * 4, value + index));
        return bytes;
      });
      for (const extension of ['flac', 'opus', 'ogg']) {
        const format = extension === 'flac' ? 'flac' : 'ogg';
        const original = new File([await (await fetch(`/tests/fixtures/tone.${extension}`)).arrayBuffer()], `tone.${extension}`);
        const options = { extension, mime: extension === 'flac' ? 'audio/flac' : 'audio/ogg' };
        const write = async (file, payload) => {
          const result = await client.write('media', format, file, payload, options);
          return new File([result.blob], `result.${extension}`);
        };
        const inspect = async (file) => extension === 'flac' ? flacPictures(file) : commentPictures((await tags(file)).raw);
        let source = extension === 'flac'
          ? new File([repairFlacMetadata(new Uint8Array(await original.arrayBuffer()), pictures, (await tags(original)).raw.vendor)], original.name)
          : original;
        if (extension !== 'flac') {
          const { Output, BufferTarget, Conversion, OggOutputFormat } = await import('/assets/vendor/mediabunny.mjs');
          const input = new Input({ source: new BlobSource(original), formats: ALL_FORMATS });
          const metadata = await input.getMetadataTags();
          delete metadata.images;
          metadata.raw.METADATA_BLOCK_PICTURE = pictures.map(pictureBase64);
          const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
          const conversion = await Conversion.init({ input, output, tags: metadata, copy: { mode: 'forced', shiftTolerance: Infinity }, showWarnings: false });
          check(conversion.isValid, 'Ogg seed cannot copy');
          await conversion.execute();
          source = new File([output.target.buffer], original.name);
        }
        const beforeVendor = (await tags(source)).raw.vendor;
        const edited = await write(source, { set: { title: 'Picture preservation title' }, cover: { action: 'keep' } });
        const kept = await inspect(edited);
        check(kept.length === pictures.length && kept.every((bytes, i) => equal(bytes, pictures[i])), `${extension}: picture metadata changed`);
        check((await tags(edited)).title === 'Picture preservation title', 'Title missing');
        if (extension === 'flac') check((await tags(edited)).raw.vendor === beforeVendor, 'FLAC vendor changed');
        const removed = await write(source, { cover: { action: 'remove' } });
        const remaining = await inspect(removed);
        check(remaining.length === 2 && remaining.every((bytes, i) => equal(bytes, pictures[i + 2])), `${extension}: remove damaged back covers`);
        const replaced = await write(source, { cover: { action: 'set', data: image, mimeType: 'image/png' } });
        const afterSet = await inspect(replaced);
        check(afterSet.length === 3 && afterSet.slice(0, 2).every((bytes, i) => equal(bytes, pictures[i + 2])), `${extension}: set damaged back covers`);
        check(equal(afterSet[2], serializePicture({ data: image, mimeType: 'image/png', kind: 'coverFront' })), `${extension}: replacement picture changed`);
        for (const [action, file] of [['keep', edited], ['remove', removed], ['set', replaced]]) {
          results.push({ extension, action, original: Array.from(new Uint8Array(await original.arrayBuffer())), bytes: Array.from(new Uint8Array(await file.arrayBuffer())) });
        }
      }
      return results;
    } finally { client.dispose(); }
  });
  const packets = (path) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_packets', '-show_data_hash', 'sha256', '-show_entries', 'packet=data_hash', '-of', 'json', path], { encoding: 'utf8' })).packets.map((packet) => packet.data_hash);
  for (const row of results) {
    const original = join(temp, `original.${row.extension}`), output = join(temp, `${row.action}.${row.extension}`);
    await writeFile(original, Uint8Array.from(row.original));
    await writeFile(output, Uint8Array.from(row.bytes));
    assert.deepEqual(packets(output), packets(original), `${row.extension}/${row.action}: audio packet payload changed`);
    console.log(`${row.extension}/${row.action}: exact pictures/back covers; ffprobe audio packet SHA-256 unchanged`);
  }
  assert.deepEqual(forbidden, []);
  assert.deepEqual(pageErrors, []);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  await rm(temp, { recursive: true, force: true });
}