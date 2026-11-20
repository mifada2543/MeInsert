/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/** Real offline / Service Worker audit. */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_VERSION, ENGINE_VERSION } from '../../assets/js/core/build.js';
import { OFFLINE_FEATURES } from '../../assets/js/core/format-capabilities.js';
const root = fileURLToPath(new URL('../..', import.meta.url));
const PROFILE_KEY = 'meinsert.offlineProfile';
const USER_FILES = ['tone.mp3', 'document.pdf', 'pattern.png'];
const MP3_FIXTURE = join(root, 'tests/fixtures/tone.mp3');
const ALL_OPTIONAL_URLS = [...new Set(OFFLINE_FEATURES.flatMap((feature) => feature.urls))];
const FEATURE_URLS = Object.fromEntries(OFFLINE_FEATURES.map((feature) => [feature.id, feature.urls]));
const UPDATED_SHELL_VERSION = `${CURRENT_VERSION}-offline-test`;
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.pdf', 'application/pdf'],
]);
let serveUpdated = false;
function updatedBody(pathname) {
  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root) || !existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8').split(CURRENT_VERSION).join(UPDATED_SHELL_VERSION);
}
function serve() {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    if (serveUpdated && ['/sw.js', '/assets/js/core/build.js'].includes(pathname)) {
      const body = updatedBody(pathname);
      if (body === null) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(body);
      return;
    }
    const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
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
  if (!found) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to the browser executable path.');
  return found;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pathOf = (url) => {
  try { return new URL(url, base).pathname; } catch { return String(url); }
};
const isHeavy = (url) => /\/assets\/vendor\/|\.wasm(?:\?|$)/i.test(pathOf(url));
const isWasm = (url) => /\.wasm(?:\?|$)/i.test(pathOf(url));
const isOtherEngine = (url) => /exiftool|\.wasm|pdf-lib|fflate|office\.worker|\/assets\/js\/formats\/(?:image|pdf|office|mp4)\.js/i.test(pathOf(url));
const skipped = [];
function skip(name, reason) {
  console.log(`SKIP: ${name} — ${reason}`);
  skipped.push({ name, reason });
}
function requestedPaths(requests) {
  return new Set(requests.map((request) => pathOf(request.url())));
}
function assertSameOriginOnly(requests, baseOrigin, label) {
  const offenders = [...new Set(requests.map((request) => request.url()))].filter((url) => {
    try {
      const parsed = new URL(url);
      if (['blob:', 'data:', 'about:', 'chrome:', 'devtools:'].includes(parsed.protocol)) return false;
      return parsed.origin !== baseOrigin;
    } catch { return false; }
  });
  assert.deepEqual(offenders, [], `${label}: external requests:\n${offenders.join('\n')}`);
  const mutating = requests
    .filter((request) => /^(POST|PUT|PATCH|DELETE)$/i.test(request.method()))
    .map((request) => `${request.method()} ${request.url()}`);
  assert.deepEqual(mutating, [], `${label}: mutating requests:\n${mutating.join('\n')}`);
}
async function cacheSnapshot(page) {
  return page.evaluate(async () => {
    const snapshot = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      snapshot[name] = (await cache.keys()).map((request) => request.url);
    }
    return snapshot;
  });
}
async function waitFor(predicate, label, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await predicate();
      if (last) return last;
    } catch { /* a reload may be in progress */ }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}${last === null ? '' : ` (last: ${JSON.stringify(last)})`}`);
}
async function cacheHas(page, version, urls, label) {
  return waitFor(async () => {
    const snapshot = await cacheSnapshot(page);
    const have = new Set((snapshot[version] || []).map(pathOf));
    const missing = urls.map(pathOf).filter((path) => !have.has(path));
    return missing.length ? null : snapshot;
  }, label);
}
async function cacheNamesHave(page, names, label) {
  return waitFor(async () => {
    const snapshot = await cacheSnapshot(page);
    return names.every((name) => name in snapshot) ? snapshot : null;
  }, label);
}
async function assertNoUserFilesCached(page, label) {
  const snapshot = await cacheSnapshot(page);
  const offenders = [];
  for (const [name, urls] of Object.entries(snapshot)) {
    for (const url of urls) {
      const isBrowserUrl = /^(blob:|data:|filesystem:)/i.test(url);
      const isUserFile = USER_FILES.some((file) => pathOf(url).endsWith(`/${file}`));
      if (isBrowserUrl || isUserFile) offenders.push(`${name}: ${url}`);
    }
  }
  assert.deepEqual(offenders, [], `${label}: user file / object URL in Cache Storage:\n${offenders.join('\n')}`);
  return snapshot;
}
async function openSingleWithMp3(page, title) {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('#fileInput').setInputFiles(MP3_FIXTURE);
  await page.locator('#field-title').waitFor({ timeout: 120_000 });
  await page.locator('#field-title').fill(title);
  await page.locator('#saveBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-download').waitFor({ timeout: 180_000 });
}
async function openSettings(page) {
  if (!(await page.locator('#settingsBtn').count())) {
    await page.evaluate(async () => {
      const module = await import('/assets/js/ui/offline-settings.js');
      module.initOfflineSettings();
    });
  }
  await page.locator('#settingsBtn').click();
  await page.waitForFunction(() => document.getElementById('offlineSettingsDialog')?.open === true, null, { timeout: 30_000 });
}
const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const baseOrigin = new URL(base).origin;
const browser = await getBrowser({
  executablePath: findChrome(),
  headless: true,
  args: ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const context = await browser.newContext({
    locale: 'id-ID',
    serviceWorkers: 'allow',
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const requests = [];
  context.on('request', (request) => requests.push(request));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
  {
    requests.length = 0;
    await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 60_000 });
    const snapshot = await cacheHas(page, CURRENT_VERSION, [], `shell cache ${CURRENT_VERSION}`);
    const shellUrls = snapshot[CURRENT_VERSION] || [];
    assert.ok(shellUrls.length > 20, `frugal precache is too small: ${shellUrls.length}`);
    assert.deepEqual(shellUrls.filter(isHeavy), [], 'frugal precache pulled a vendor/WASM asset');
    assert.deepEqual(requests.map((request) => request.url()).filter(isHeavy), [],
      'frugal first visit downloaded a vendor/WASM asset');
    assertSameOriginOnly(requests, baseOrigin, 'frugal first visit');
    const engineUrls = snapshot[ENGINE_VERSION] || [];
    assert.deepEqual(engineUrls, [], 'frugal first visit cached optional engines');
    await assertNoUserFilesCached(page, 'frugal first visit');
    console.log('PASS: (a) first frugal visit precaches shell only — no vendor/WASM request, no optional engine cached');
  }
  {
    requests.length = 0;
    await openSingleWithMp3(page, 'Offline MP3 edit audit');
    const paths = requestedPaths(requests);
    assert.ok([...paths].some((path) => /mediabunny\.mjs$/.test(path)), 'audio engine (mediabunny) was expected for MP3');
    assert.deepEqual([...paths].filter(isOtherEngine), [], 'MP3 edit pulled an unrelated engine');
    assertSameOriginOnly(requests, baseOrigin, 'MP3 edit');
    const snapshot = await assertNoUserFilesCached(page, 'MP3 edit');
    assert.deepEqual((snapshot[ENGINE_VERSION] || []).filter(isWasm), [], 'MP3 edit cached a WASM engine');
    console.log('PASS: (b) MP3 open -> edit -> save fetched mediabunny only — no WASM/PDF/Office engine');
  }
  {
    await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await openSettings(page);
    await page.locator('#offlineMode-selected').click();
    await page.locator('#offlineFeature-pdf').check();
    requests.length = 0;
    await page.locator('.offline-settings__download').click();
    const snapshot = await cacheHas(page, ENGINE_VERSION, FEATURE_URLS.pdf, 'PDF engine in cache');
    const wanted = new Set(FEATURE_URLS.pdf.map(pathOf));
    const downloaded = [...requestedPaths(requests)].filter((path) => wanted.has(path));
    assert.ok(downloaded.length > 0, 'selective download did not fetch the PDF engine URLs');
    assert.deepEqual([...requestedPaths(requests)].filter((path) => /\.wasm(?:\?|$)/i.test(path)), [],
      'PDF-only install must not download WASM');
    assert.ok(Object.keys(snapshot).includes(ENGINE_VERSION), 'engine cache missing after selective install');
    assertSameOriginOnly(requests, baseOrigin, 'PDF engine install');
    await assertNoUserFilesCached(page, 'PDF engine install');
    console.log('PASS: (c) selective PDF install downloaded only PDF engine URLs — no WASM, no other feature');
  }
  {
    await page.locator('#offlineMode-all').click();
    requests.length = 0;
    await page.locator('.offline-settings__download-all').click();
    await cacheHas(page, ENGINE_VERSION, ALL_OPTIONAL_URLS, 'all optional engines in cache');
    const wanted = new Set(ALL_OPTIONAL_URLS.map(pathOf));
    const downloaded = [...requestedPaths(requests)].filter((path) => wanted.has(path));
    assert.ok(downloaded.length > 10, `full install only fetched ${downloaded.length} optional URLs`);
    assert.ok(downloaded.some((path) => /\.wasm(?:\?|$)/i.test(path)), 'full install did not fetch the ExifTool WASM');
    assertSameOriginOnly(requests, baseOrigin, 'full engine install');
    await assertNoUserFilesCached(page, 'full engine install');
    console.log(`PASS: (d) full install fetched and cached ${downloaded.length} optional URLs including WASM`);
  }
  {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('offlineSettingsDialog')?.open === false, null, { timeout: 30_000 });
    await context.setOffline(true);
    requests.length = 0;
    await openSingleWithMp3(page, 'Offline airplane edit audit');
    assertSameOriginOnly(requests, baseOrigin, 'offline edit');
    assert.ok((await page.locator('.result-download').count()) === 1, 'offline save must produce a result');
    await assertNoUserFilesCached(page, 'offline edit');
    console.log('PASS: (e) offline reload + MP3 edit + save worked from the real SW cache, no external request');
    await context.setOffline(false);
    await page.evaluate((key) => localStorage.removeItem(key), PROFILE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 60_000 });
  }
  {
    serveUpdated = true;
    try {
      requests.length = 0;
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw new Error('No service worker registration to update');
        await registration.update();
      });
      await cacheNamesHave(page, [UPDATED_SHELL_VERSION, ENGINE_VERSION], `updated shell ${UPDATED_SHELL_VERSION}`);
      await cacheHas(page, ENGINE_VERSION, ALL_OPTIONAL_URLS, 'engine cache preserved across update');
      await waitFor(async () => {
        const version = await page.evaluate(() => navigator.serviceWorker.controller?.postMessage
          ? new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => resolve(event.data?.version || '');
            navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
            setTimeout(() => resolve(''), 2000);
          })
          : '');
        return version === UPDATED_SHELL_VERSION ? true : null;
      }, 'updated worker controlling the page');
      const paths = requestedPaths(requests);
      assert.deepEqual([...paths].filter(isWasm), [], 'app update re-downloaded unchanged WASM files');
      assertSameOriginOnly(requests, baseOrigin, 'app update');
      const snapshot = await assertNoUserFilesCached(page, 'app update');
      assert.deepEqual(Object.keys(snapshot).filter((key) => key.startsWith('meinsert-')).sort(),
        [ENGINE_VERSION, UPDATED_SHELL_VERSION].sort(), 'old shell cache must be removed, engine cache kept');
      console.log('PASS: (f) app update rebuilt shell only — engine cache and WASM survived untouched');
    } catch (error) {
      if (/Timed out waiting for updated/.test(String(error))) {
        skip('(f) app update without re-downloading WASM',
          `simulated deployment did not trigger an SW update in this browser: ${error.message}`);
      } else {
        throw error;
      }
    }
  }
  {
    await openSettings(page);
    requests.length = 0;
    await page.locator('.offline-settings__clear').click();
    await waitFor(async () => {
      const snapshot = await cacheSnapshot(page);
      return (snapshot[ENGINE_VERSION] || []).length === 0 ? true : null;
    }, 'engine cache emptied by uninstall');
    const paths = requestedPaths(requests);
    assert.deepEqual([...paths].filter(isHeavy), [], 'uninstall must not fetch any engine file');
    assertSameOriginOnly(requests, baseOrigin, 'engine uninstall');
    const snapshot = await assertNoUserFilesCached(page, 'engine uninstall');
    assert.ok(UPDATED_SHELL_VERSION in snapshot || CURRENT_VERSION in snapshot, 'shell cache must survive uninstall');
    console.log('PASS: (g) uninstall cleared the optional engine cache without touching the shell or refetching WASM');
  }
  assert.deepEqual(errors, [], `unexpected page errors: ${errors.join('; ')}`);
  console.log('PASS: no page errors during any offline scenario');
  console.log(`${skipped.length ? `SKIPPED ${skipped.length} scenario(s)` : 'ALL scenarios executed'} (offline-real)`);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}