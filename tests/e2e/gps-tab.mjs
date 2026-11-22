/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = [process.env.CHROME_BIN, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log('SKIP gps-tab: Chrome/Chromium tidak ditemukan.');
  process.exit(0);
}
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'], ['.gz', 'application/gzip'], ['.wasm', 'application/wasm'],
  ['.jpg', 'image/jpeg'], ['.pdf', 'application/pdf'],
]);
const server = await createStaticServer({ root, contentTypes, traversalStatus: 403 });
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = await getBrowser({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ locale: 'id-ID' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/pattern.jpg'));
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''));
  assert.equal(await page.locator('#tabGps').isVisible(), true);
  await page.locator('#tabGps').click();
  const gpsText = await page.locator('#panel').innerText();
  assert.match(gpsText, /Lintang|Bujur/);
  assert.doesNotMatch(gpsText, /Judul/);
  await page.locator('#tabMetadata').click();
  const metadataText = await page.locator('#panel').innerText();
  assert.match(metadataText, /Judul/);
  assert.doesNotMatch(metadataText, /Lintang/);
  await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
  await page.waitForFunction(() => /PDF.*tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''));
  assert.equal(await page.locator('#tabGps').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: GPS fields live in a dedicated tab and hide for non-image formats');
} finally {
  await context.close();
  await browser.close();
  server.close();
}
