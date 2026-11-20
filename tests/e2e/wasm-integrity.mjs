/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Real Service Worker: validates magic-byte decoding, double-gzip handling,
// engine-cache reuse and offline decoding of the only distributed WASM asset.
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log('SKIP wasm-integrity: Chrome/Chromium tidak ditemukan.');
  process.exit(0);
}
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.gz', 'application/gzip'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.woff2', 'font/woff2'],
]);
const server = await createStaticServer({ root, contentTypes, traversalStatus: 403 });
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = await getBrowser({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ locale: 'id-ID' });
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (/wasm/i.test(request.url())) requests.push(request.url().replace(base, ''));
});
const sample = join(root, 'tests/fixtures/pattern.png');
const localCopy = '/tmp/opencode/wasm-integrity-pattern.png';
copyFileSync(sample, localCopy);
const doubleGzip = gzipSync(readFileSync(join(root, 'assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm.gz')));
async function openAndExpectTags(label) {
  await page.locator('#fileInput').setInputFiles(localCopy);
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''),
    null, { timeout: 120000 });
  console.log(`PASS: ${label} — ${await page.locator('#readStatus').innerText()}`);
}
try {
  await page.route('**/zeroperl-twnm61dk.wasm.gz', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/gzip', body: doubleGzip });
  });
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30000 });
  await openAndExpectTags('double-gzipped engine decoded with an active Service Worker');
  await page.unroute('**/zeroperl-twnm61dk.wasm.gz');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30000 });
  await openAndExpectTags('engine cache reuse across reload');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30000 });
  await openAndExpectTags('offline decode from the cached gzip engine');
  if (requests.some((url) => /zeroperl-twnm61dk\.wasm(\?|$)/.test(url))) {
    throw new Error(`raw WASM was requested: ${requests.join(', ')}`);
  }
  console.log('PASS: no raw WASM request; WASM requests:', [...new Set(requests)]);
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
  console.log('ALL wasm-integrity scenarios passed (Service Worker active)');
} finally {
  await context.close();
  await browser.close();
  server.close();
}