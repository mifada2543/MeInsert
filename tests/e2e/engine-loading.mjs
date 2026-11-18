/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.woff2', 'font/woff2'],
]);
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean)
  .find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log('SKIP engine-loading: Chrome/Chromium tidak ditemukan.');
  process.exit(0);
}

function serve() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
// SW diblokir supaya unduhan WASM benar-benar terjadi dan progres bisa muncul.
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const sample = join(mkdtempSync(join(tmpdir(), 'meinsert-engine-')), 'icon-512.png');
  copyFileSync(join(root, 'assets/img/icon-512.png'), sample);
  await page.locator('#fileInput').setInputFiles(sample);
  await page.waitForFunction(() => /tag terbaca|gagal|Gagal/.test(document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 120000 });
  // Status progres bersifat sementara: jika sempat muncul, harus hilang.
  await page.waitForFunction(() => document.querySelectorAll('.engine-loading').length === 0, null, { timeout: 30000 });
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
  console.log('engine-loading e2e OK; readStatus =', await page.locator('#readStatus').innerText());
} finally {
  await context.close();
  await browser.close();
  server.close();
}
