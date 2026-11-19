/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function serve() {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to the browser executable path.');
  return found;
}
async function openActionOptions(page) {
  const toggle = page.locator('#actionOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#actionOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}
const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await getBrowser({ executablePath: findChrome(), headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ locale: 'id-ID' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await openActionOptions(page);
  const toggle = page.locator('.quick-save-toggle');
  await toggle.waitFor({ state: 'attached', timeout: 15000 });
  const checkbox = page.locator('#quickSaveToggle');
  assert.equal(await checkbox.isChecked(), false, 'quick save defaults to the full review');
  assert.equal(await checkbox.getAttribute('aria-label'), 'Simpan cepat', 'toggle has an accessible name');
  assert.equal(await checkbox.getAttribute('aria-describedby'), 'quickSaveHint');
  assert.equal(await page.locator('#main').getAttribute('tabindex'), '-1', 'skip link target is focusable');
  assert.equal(await page.locator('.drop-folder-hint').count(), 0, 'folder hint is batch-only');
  const sample = join(root, 'assets/img/icon-512.png');
  await page.locator('#fileInput').setInputFiles(sample);
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  await checkbox.check();
  assert.equal(await page.evaluate(() => localStorage.getItem('meinsert.quickSave')), 'true');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await openActionOptions(page);
  await page.locator('#quickSaveToggle').waitFor({ state: 'attached', timeout: 15000 });
  assert.equal(await page.locator('#quickSaveToggle').isChecked(), true, 'preference survives a reload');
  await page.locator('#fileInput').setInputFiles(sample);
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  await page.locator('#field-title').fill('Judul simpan cepat');
  await page.locator('#field-title').blur();
  await page.locator('#saveBtn').click();
  await page.waitForFunction(() => /diperbarui|diperiksa/.test(document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 90000 });
  assert.equal(await page.locator('.review-backdrop').count(), 0, 'quick save skips the review dialog');
  assert.equal(await page.locator('#progress').isVisible(), false, 'processing finished');
  console.log('PASS: quick save toggle is accessible and persists');
  console.log('PASS: field-only quick save writes and verifies without the review dialog');
  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
} finally {
  await browser.close();
  server.close();
}