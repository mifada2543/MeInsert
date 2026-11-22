/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */

import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { firefox, webkit } from 'playwright-core';
import { createStaticServer } from './server.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((candidate) => existsSync(candidate));
const alternate = { firefox, webkit }[process.env.MEINSERT_WASM_BROWSER];
if (!chrome && !alternate) {
  console.log('SKIP wasm-integrity: Chrome/Chromium tidak ditemukan.');
  process.exit(0);
}
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.br', 'application/octet-stream'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.woff2', 'font/woff2'],
]);
const enginePath = `/assets/vendor/exiftool-wasm/${exiftoolBuild.name}`;
let httpBrotli = false;
const brotliBytes = readFileSync(join(root, `${enginePath.slice(1)}.br`));
const requests = [];
let gzipRequested = false;
const server = await createStaticServer({
  root, contentTypes, traversalStatus: 403,
  intercept(path, response) {
    if (!path.startsWith(enginePath)) return false;
    requests.push(path);
    if (path.endsWith('.gz')) {
      gzipRequested = true;
      response.writeHead(404).end();
      return true;
    }
    if (httpBrotli && path.endsWith('.br')) {
      response.writeHead(200, {
        'content-type': 'application/wasm', 'content-encoding': 'br', vary: 'Accept-Encoding',
      }).end(brotliBytes);
      return true;
    }
    return false;
  },
});
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = alternate ? await alternate.launch() : await getBrowser();
const sample = {
  name: 'pattern.png',
  mimeType: 'image/png',
  buffer: readFileSync(join(root, 'tests/fixtures/pattern.png')),
};
async function openAndExpectTags(page, label) {
  await page.locator('#fileInput').setInputFiles(sample);
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''),
    null, { timeout: 120000 });
  console.log(`PASS: ${label} — ${await page.locator('#readStatus').innerText()}`);
}
async function engineScenario({ encoded = false } = {}) {
  httpBrotli = encoded;
  requests.length = 0;
  gzipRequested = false;
  const context = await browser.newContext({ locale: 'id-ID' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30000 });
    const label = encoded ? 'HTTP Content-Encoding Brotli' : 'raw Brotli';
    if (requests.length) throw new Error('WASM was requested before the first image.');
    await openAndExpectTags(page, label);
    const expected = [`${enginePath}.br`];
    assert.deepEqual(requests, expected);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openAndExpectTags(page, `${label} cache reuse across reload`);
    assert.deepEqual(requests, expected);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openAndExpectTags(page, `${label} cache reuse offline`);
    assert.deepEqual(requests, expected);
    assert.deepEqual(errors, []);
    assert.equal(gzipRequested, false, 'no gzip asset may be requested');
  } finally {
    await context.close();
  }
}
try {
  await engineScenario();
  await engineScenario({ encoded: true });
  console.log('ALL wasm-integrity scenarios passed (Service Worker active, no gzip or raw WASM requests)');
} finally {
  await browser.close();
  server.close();
}
