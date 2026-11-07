/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, mkdtempSync, copyFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.pdf', 'application/pdf'],
]);

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

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('Chrome/Chromium not found. Set CHROME_BIN to the browser executable path.');
  }
  return found;
}

const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ serviceWorkers: 'allow', acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 60000 });
  console.log('homeTitle', await page.title());
  console.log('modeCards', await page.locator('.mode-card').count());

  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('singleEditorInputs', await page.locator('#fileInput').count());
  console.log('singleHeaderNav', await page.locator('.header-link[data-nav="batch"]').count());

  await page.goto(`${base}/batch.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('batchTitle', await page.title());
  await page.waitForFunction(() => Boolean(navigator.serviceWorker), null, { timeout: 30000 });
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state === 'activated';
  }, null, { timeout: 120000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });

  const sampleDir = mkdtempSync(join(tmpdir(), 'meinsert-e2e-'));
  const sample = join(sampleDir, 'icon-512.png');
  copyFileSync(join(root, 'assets/img/icon-512.png'), sample);
  await page.locator('#batchFileInput').setInputFiles(sample);
  await page.waitForSelector('.batch-group', { timeout: 30000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('.batch-file-status')?.textContent || '';
    return text === 'Siap' || text === 'Gagal';
  }, null, { timeout: 60000 });
  console.log('batchAddTiles', await page.locator('.batch-add-tile').count());
  console.log('batchStatus', await page.locator('#batchStatus').innerText());

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('offlineBatchGroup', await page.locator('.batch-groups').count());
  console.log('offlineSingleLink', await page.locator('.header-link[data-nav="single"]').count());
  await context.setOffline(false);

  // Mobile pass: bottom glass nav, sticky preview, no horizontal overflow.
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  try {
    await mobilePage.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const navStyles = await mobilePage.evaluate(() => {
      const nav = document.querySelector('.header-nav');
      const cs = getComputedStyle(nav);
      const rect = nav.getBoundingClientRect();
      return {
        position: cs.position,
        bottom: cs.bottom,
        rectTop: Math.round(rect.top),
        height: Math.round(rect.height),
        ariaCurrent: nav.querySelector('[aria-current]')?.getAttribute('aria-current') || null,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    console.log('mobileNav', JSON.stringify(navStyles));
    if (navStyles.position !== 'fixed') throw new Error('Bottom nav should be position:fixed on mobile');
    if (navStyles.scrollWidth !== navStyles.innerWidth) throw new Error('Horizontal overflow on single.html (mobile)');

    const mobileSampleDir = mkdtempSync(join(tmpdir(), 'meinsert-e2e-mobile-'));
    const mobileSample = join(mobileSampleDir, 'icon-512.png');
    copyFileSync(join(root, 'assets/img/icon-512.png'), mobileSample);
    await mobilePage.locator('#fileInput').setInputFiles(mobileSample);
    await mobilePage.waitForFunction(() => /tag terbaca|gagal|Gagal/.test(document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 60000 });
    await mobilePage.waitForFunction(() => {
      const img = document.querySelector('#previewFrame img');
      return !img || (img.complete && img.naturalWidth > 0);
    }, null, { timeout: 30000 });
    await mobilePage.waitForTimeout(250);
    const frameProbe = await mobilePage.evaluate(() => {
      const frame = document.querySelector('#previewFrame');
      const rect = frame?.getBoundingClientRect();
      return rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null;
    });
    console.log('mobileFrameSquare', JSON.stringify(frameProbe));
    if (!frameProbe || Math.abs(frameProbe.width / frameProbe.height - 1) > 0.05) {
      throw new Error(`Expected near-square preview frame, got ${JSON.stringify(frameProbe)}`);
    }
    await mobilePage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await mobilePage.waitForTimeout(400);
    const pinned = await mobilePage.evaluate(() => document.querySelector('#previewDock')?.classList.contains('is-pinned'));
    console.log('mobileDockPinned', pinned);
    await mobilePage.locator('.header-link[data-nav="batch"]').click();
    await mobilePage.waitForLoadState('domcontentloaded');
    console.log('mobileBatchNav', mobilePage.url().endsWith('batch.html'));
    const batchScroll = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    console.log('mobileBatchOverflow', batchScroll !== 390);
  } finally {
    await mobileContext.close();
  }

  if (errors.length) {
    throw new Error(`Page errors:\n${errors.join('\n')}`);
  }
} finally {
  await browser.close();
  server.close();
}
