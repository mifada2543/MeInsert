/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { extname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (!path.startsWith(root + sep) || req.method !== 'GET') { res.writeHead(403).end(); return; }
  if (!existsSync(path) || !statSync(path).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(path).pipe(res);
});

// Verify genuine detached CMS against the ORIGINAL PDF, independently of pdf-lib.
function verifyOriginalSignature() {
  const pdf = readFileSync(join(root, 'tests/fixtures/signed.pdf'));
  const text = pdf.toString('latin1');
  const range = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text)?.slice(1).map(Number);
  const hex = /\/Contents\s*<([a-f0-9]+)>/i.exec(text)?.[1];
  if (!range || !hex || range[0] !== 0 || range[2] + range[3] !== pdf.length) throw new Error('Invalid signature fixture ByteRange');
  const padded = Buffer.from(hex, 'hex');
  const count = padded[1] & 0x7f;
  const length = padded[1] & 0x80 ? 2 + count + padded.readUIntBE(2, count) : 2 + padded[1];
  const temp = mkdtempSync(join(root, 'tests/tmp-compat-sign-'));
  try {
    writeFileSync(join(temp, 'sig.der'), padded.subarray(0, length));
    writeFileSync(join(temp, 'data'), Buffer.concat([pdf.subarray(0, range[1]), pdf.subarray(range[2])]));
    execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(temp, 'sig.der'),
      '-content', join(temp, 'data'), '-noverify', '-out', join(temp, 'verified')], { stdio: 'pipe' });
    console.log('Original signed.pdf: detached CMS signature verified (self-signed; trust not asserted).');
  } finally { rmSync(temp, { recursive: true }); }
}

verifyOriginalSignature();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const rows = [], forbidden = [], pageErrors = [];
try {
  const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
  if (!chrome) throw new Error('Set CHROME_BIN to Chrome/Chromium executable');
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const request = route.request();
    if (request.url().startsWith(`${origin}/`) && request.method() === 'GET') return route.continue();
    forbidden.push(`${request.method()} ${request.url()}`); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${origin}/single.html`, { waitUntil: 'load' });
  const fixtures = [
    'pattern.jpg', 'pattern.png', 'pattern.webp', 'pattern.tif', 'mislabeled.jpg',
    'tone.mp3', 'tone.flac', 'tone.opus', 'tone.ogg', 'clip.mp4', 'clip.mkv', 'clip.webm', 'clip.mov', 'tone.m4a',
    'document.pdf', 'signed.pdf', 'reject-flac.ogg', 'reject-speex.ogg',
  ];
  for (const name of fixtures) {
    console.log(`Testing ${name}…`);
    const row = await page.evaluate(async (name) => {
      const harness = await import('/tests/compat/browser.mjs');
      return harness.runFixture(name, { reject: name.startsWith('reject-'), cover: ['tone.opus', 'tone.ogg'].includes(name), signed: name === 'signed.pdf' });
    }, name);
    rows.push(row);
  }
  rows.push(...await page.evaluate(async () => (await import('/tests/compat/browser.mjs')).coverPolicy()));
  await page.evaluate(async () => (await import('/tests/compat/browser.mjs')).dispose());
  // UI integration: detector-owned default extension, review, save and download.
  const uiRow = { fixture: 'UI mislabeled PNG download', invariants: 'FAIL' };
  try {
    await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/mislabeled.jpg'));
    await page.waitForFunction(() => /tag terbaca/.test(globalThis.document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 90000 });
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
  } catch (error) { uiRow.error = error.message; }
  rows.push(uiRow);
  for (const ext of ['gif', 'bmp']) {
    const row = { fixture: `UI MP4 rejects ${ext}`, invariants: 'FAIL' };
    try {
      await page.goto(`${origin}/single.html`, { waitUntil: 'load' });
      await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/clip.mp4'));
      await page.waitForFunction(() => /tag terbaca/.test(globalThis.document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 90000 });
      await page.locator('.cover-block input[type=file]').setInputFiles(join(root, `tests/fixtures/cover.${ext}`));
      await page.locator('.toast.is-error').filter({ hasText: 'Format gambar tidak didukung' }).waitFor();
      if (!(await page.locator('#saveBtn').isDisabled())) throw new Error('Rejected cover dirtied the document');
      row.invariants = 'ok';
    } catch (error) { row.error = error.message; }
    rows.push(row);
  }
  console.table(rows.map(({ fixture, format = '-', read = '-', write = '-', reread = '-', invariants }) => ({ fixture, format, read, write, reread, invariants })));
  for (const row of rows) if (row.error || row.notes) console.log(`${row.fixture}: ${row.error || row.notes}`);
  for (const row of rows) if (row.coverBytes || row.signatureContents) console.log(`${row.fixture}: ${JSON.stringify({ coverBytes: row.coverBytes, signatureContents: row.signatureContents, signedRanges: row.signedRanges })}`);
  if (forbidden.length || pageErrors.length) throw new Error(JSON.stringify({ forbidden, pageErrors }));
  const failures = rows.filter((r) => r.invariants !== 'ok');
  console.log(`${rows.length - failures.length}/${rows.length} compatibility cases passed; no upload/external requests.`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
