/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { extname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { jobs } from './jobs.mjs';
const job = jobs.find((entry) => entry.id === process.argv[2]);
if (!job) throw new Error('Unknown compatibility job');
const started = performance.now();
let localBytes = 0, localRequests = 0;
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (!path.startsWith(root + sep) || req.method !== 'GET') { res.writeHead(403).end(); return; }
  if (!existsSync(path) || !statSync(path).isFile()) { res.writeHead(404).end(); return; }
  localBytes += statSync(path).size; localRequests++;
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(path).pipe(res);
});
function verifySignature(pdf) {
  const text = pdf.toString('latin1');
  const range = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text)?.slice(1).map(Number);
  const hex = /\/Contents\s*<([a-f0-9]+)>/i.exec(text)?.[1];
  if (!range || !hex || range[0] !== 0 || range.some((value) => !Number.isSafeInteger(value) || value < 0)
    || range[1] > range[2] || range[2] + range[3] !== pdf.length) return false;
  const padded = Buffer.from(hex, 'hex');
  const count = padded[1] & 0x7f;
  const length = padded[1] & 0x80 ? 2 + count + padded.readUIntBE(2, count) : 2 + padded[1];
  const temp = mkdtempSync(join(root, 'tests/tmp-compat-sign-'));
  try {
    writeFileSync(join(temp, 'sig.der'), padded.subarray(0, length));
    writeFileSync(join(temp, 'data'), Buffer.concat([pdf.subarray(0, range[1]), pdf.subarray(range[2])]));
    try {
      execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(temp, 'sig.der'),
        '-content', join(temp, 'data'), '-noverify', '-out', join(temp, 'verified')], { stdio: 'pipe' });
      return true;
    } catch { return false; }
  } finally { rmSync(temp, { recursive: true }); }
}
if (job.id === 'pdf') {
  if (!verifySignature(readFileSync(join(root, 'tests/fixtures/signed.pdf')))) throw new Error('Original signed PDF signature invalid');
  console.log('Original signed.pdf: detached CMS signature verified (self-signed; trust not asserted).');
}
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const rows = [], forbidden = [], pageErrors = [];
let stopping = false;
process.on('SIGTERM', async () => {
  if (stopping) return;
  stopping = true;
  await browser?.close().catch(() => {});
  server.close();
});
function independentlyCheck(row, name) {
  if (!row.outputBase64) return;
  const temp = mkdtempSync(join(root, 'tests/tmp-compat-probe-'));
  try {
    const original = join(root, 'tests/fixtures', name), output = join(temp, name);
    const bytes = Buffer.from(row.outputBase64, 'base64'); writeFileSync(output, bytes);
    if (name === 'signed.pdf') {
      if (verifySignature(bytes)) throw new Error('Signed PDF output unexpectedly verifies; re-evaluate signature expectations');
      row.signatureValidity = 'INVALIDATED (independent CMS check)';
      return;
    }
    const probe = (path) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_packets', '-show_streams',
      '-show_data_hash', 'sha256', '-of', 'json', path], { encoding: 'utf8' }));
    const before = probe(original), after = probe(output);
    if (name.endsWith('.tif')) {
      const pixels = (path) => execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'hash', '-hash', 'sha256', '-'], { encoding: 'utf8' });
      if (pixels(original) !== pixels(output)) throw new Error('Independent decoded TIFF pixel hash changed');
    } else {
      const tracks = (data) => data.streams.map((stream) => [stream.codec_type, stream.codec_name, stream.width, stream.height, stream.sample_rate, stream.channels]);
      if (JSON.stringify(tracks(before)) !== JSON.stringify(tracks(after))) throw new Error('Independent track properties changed');
      const packets = (data) => data.packets.map((packet) => [packet.stream_index, packet.data_hash, packet.pts_time, packet.duration_time]);
      if (JSON.stringify(packets(before)) !== JSON.stringify(packets(after))) throw new Error('Independent packet payload/timestamp inventory changed');
    }
    row.notes = [row.notes, 'INDEPENDENT_PAYLOAD_VERIFIED'].filter(Boolean).join(', ');
  } catch (error) {
    row.invariants = 'FAIL'; row.error = [row.error, error.message].filter(Boolean).join('; ');
  } finally {
    delete row.outputBase64;
    rmSync(temp, { recursive: true });
  }
}
try {
  if (job.suite) {
    if (job.id === 'mkv-timing') await (await import('./mkv-duration.mjs')).runMkvDurationChecks();
    else if (job.id === 'office-preservation') await (await import('./office-preservation.mjs')).runOfficePreservationChecks();
    else await import('./vorbis-preservation.mjs');
    rows.push({ fixture: job.id, invariants: 'ok' });
  } else {
  const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
  if (!chrome) throw new Error('Set CHROME_BIN to Chrome/Chromium executable');
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', locale: job.locale || 'en-US' });
  await context.route('**/*', (route) => {
    const request = route.request();
    if (request.url().startsWith(`${origin}/`) && request.method() === 'GET') return route.continue();
    forbidden.push(`${request.method()} ${request.url()}`); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${origin}/single.html`, { waitUntil: 'load' });
  const uiFailure = async (row, error) => {
    row.error = error.message;
    const directory = join(root, 'tests/tmp-compat-artifacts', job.id);
    mkdirSync(directory, { recursive: true });
    row.diagnostics = await page.evaluate(() => ({ language: globalThis.document.documentElement.lang,
      status: globalThis.document.querySelector('#readStatus')?.textContent, titleField: Boolean(globalThis.document.querySelector('#field-title')) })).catch(() => ({}));
    row.diagnostics.pageErrors = [...pageErrors];
    const path = join(directory, `${rows.length}.png`);
    await page.screenshot({ path, fullPage: true }).catch(() => {});
    writeFileSync(join(directory, `${rows.length}.json`), JSON.stringify({ error: row.error, ...row.diagnostics }, null, 2));
    row.error += `; diagnostics: ${directory}`;
  };
  const fixtures = job.fixtures;
  for (const name of fixtures) {
    console.log(`Testing ${name}…`);
    const row = await page.evaluate(async (name) => {
      const harness = await import('/tests/compat/browser.mjs');
      return harness.runFixture(name, { reject: name.startsWith('reject-'), cover: ['tone.opus', 'tone.ogg'].includes(name), signed: name === 'signed.pdf' });
    }, name);
    independentlyCheck(row, name);
    rows.push(row);
  }
  rows.push(...await page.evaluate(async (options) => (await import('/tests/compat/browser.mjs')).coverPolicy(options),
    { names: job.covers || [], mp4Policy: job.mp4Policy || false }));
  await page.evaluate(async () => (await import('/tests/compat/browser.mjs')).dispose());
  if (job.locale) {
  const suffix = job.locale.startsWith('id') ? 'ID' : 'EN';
  const uiRow = { fixture: `UI mislabeled PNG download (${suffix})`, invariants: 'FAIL' };
  try {
    await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/mislabeled.jpg'));
    await page.locator('#field-title').waitFor({ timeout: 90000 });
    if ((await page.locator('#outputExt').innerText()) !== '.png') throw new Error('UI extension did not follow detected PNG');
    await page.locator('#field-title').fill('UI compatibility title');
    await page.locator('#saveBtn').click();
    await page.locator('.review-btn-confirm').click();
    await page.locator('.result-card').waitFor({ timeout: 90000 });
    const downloadButton = page.locator('.result-card button').first();
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    if (!download.suggestedFilename().endsWith('.png')) throw new Error('Downloaded extension was not PNG');
    uiRow.invariants = 'ok';
  } catch (error) { await uiFailure(uiRow, error); }
  rows.push(uiRow);
  for (const ext of ['gif', 'bmp']) {
    const row = { fixture: `UI MP4 rejects ${ext} (${suffix})`, invariants: 'FAIL' };
    try {
      await page.goto(`${origin}/single.html`, { waitUntil: 'load' });
      await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/clip.mp4'));
      await page.locator('#field-title').waitFor({ timeout: 90000 });
      await page.locator('.cover-block input[type=file]').setInputFiles(join(root, `tests/fixtures/cover.${ext}`));
      await page.locator('.toast.is-error').waitFor();
      if (!(await page.locator('#saveBtn').isDisabled())) throw new Error('Rejected cover dirtied the document');
      row.invariants = 'ok';
    } catch (error) { await uiFailure(row, error); }
    rows.push(row);
  }
  }
  if (forbidden.length || pageErrors.length) throw new Error(JSON.stringify({ forbidden, pageErrors }));
  }
} catch (error) {
  rows.push({ fixture: `${job.id}: infrastructure`, invariants: 'FAIL', error: error.stack || error.message });
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  const result = { id: job.id, rows, elapsedMs: Math.round(performance.now() - started), peakNodeRssKb: process.resourceUsage().maxRSS,
    localRequests: job.suite ? null : localRequests, localBytes: job.suite ? null : localBytes };
  if (process.send) await new Promise((resolve) => process.send(result, resolve));
  else console.log(JSON.stringify(result, null, 2));
}