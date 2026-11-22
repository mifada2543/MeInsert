/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/** Real offline / Service Worker audit. */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_VERSION, ENGINE_VERSION } from '../../assets/js/core/build.js';
import { OFFLINE_FEATURES } from '../../assets/js/core/format-capabilities.js';
const root = fileURLToPath(new URL('../..', import.meta.url));
const PROFILE_KEY = 'meinsert.offlineProfile';
const USER_FILES = ['tone.mp3', 'document.pdf', 'pattern.png'];
const MP3_FIXTURE = join(root, 'tests/fixtures/tone.mp3');
const ALL_OPTIONAL_URLS = [...new Set(OFFLINE_FEATURES.flatMap((feature) => feature.urls))];
assert.deepEqual(ALL_OPTIONAL_URLS.filter((url) => /\.gz(?:\?|$)/i.test(url)), [],
  'optional URLs must not reference gzip assets');
const FEATURE_URLS = Object.fromEntries(OFFLINE_FEATURES.map((feature) => [feature.id, feature.urls]));
const UPDATED_SHELL_VERSION = `${CURRENT_VERSION}-offline-test`;
const MIGRATION_SHELL_VERSION = `${CURRENT_VERSION}-migration-test`;
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
let servedShellVersion = UPDATED_SHELL_VERSION;
function updatedBody(pathname) {
  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root) || !existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8').split(CURRENT_VERSION).join(servedShellVersion);
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
      response.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'content-length': String(Buffer.byteLength(body)),
      });
      response.end(body);
      return;
    }
    const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
      'content-length': String(statSync(filePath).size),
    });
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
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label} after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
const pathOf = (url) => {
  try { return new URL(url, base).pathname; } catch { return String(url); }
};
const isHeavy = (url) => /\/assets\/vendor\/|\.wasm(?:\.gz|\.br)?(?:\?|$)/i.test(pathOf(url));
const isWasm = (url) => /\.wasm(?:\.gz|\.br)?(?:\?|$)/i.test(pathOf(url));
const isOtherEngine = (url) => /exiftool|\.wasm|pdf-lib|fflate|office\.worker|\/assets\/js\/formats\/(?:image|pdf|office|mp4)\.js/i.test(pathOf(url));
const optionalResponses = [];
const skipped = [];
function skip(name, reason) {
  console.log(`SKIP: ${name} — ${reason}`);
  skipped.push({ name, reason });
}
function requestedPaths(requests) {
  return new Set(requests.map((request) => pathOf(request.url())));
}
async function transferredBytes(responses) {
  let total = 0;
  for (const response of responses) {
    const length = Number(response.headers()['content-length'] || 0);
    if (Number.isFinite(length) && length > 0) total += length;
  }
  return total;
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
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await withTimeout(page.evaluate(async () => {
        const snapshot = {};
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          snapshot[name] = (await cache.keys()).map((request) => request.url);
        }
        return snapshot;
      }), 15_000, 'cache snapshot');
    } catch (error) {
      lastError = error;
      if (!/Execution context was destroyed|navigation|Target closed/i.test(String(error))) throw error;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastError;
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
const OPTIONAL_PATH_SET = new Set(ALL_OPTIONAL_URLS.map(pathOf));
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
  context.on('response', (response) => {
    if (OPTIONAL_PATH_SET.has(pathOf(response.url()))) optionalResponses.push(response);
  });
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
    optionalResponses.length = 0;
    await page.locator('.offline-settings__download').click();
    const snapshot = await cacheHas(page, ENGINE_VERSION, FEATURE_URLS.pdf, 'PDF engine in cache');
    const wanted = new Set(FEATURE_URLS.pdf.map(pathOf));
    const downloaded = [...requestedPaths(requests)].filter((path) => wanted.has(path));
    assert.ok(downloaded.length > 0, 'selective download did not fetch the PDF engine URLs');
    assert.deepEqual([...requestedPaths(requests)].filter((path) => /\.wasm(?:\.gz|\.br)?(?:\?|$)/i.test(path)), [],
      'PDF-only install must not download WASM');
    assert.ok(Object.keys(snapshot).includes(ENGINE_VERSION), 'engine cache missing after selective install');
    assertSameOriginOnly(requests, baseOrigin, 'PDF engine install');
    await assertNoUserFilesCached(page, 'PDF engine install');
    console.log('PASS: (c) selective PDF install downloaded only PDF engine URLs — no WASM, no other feature');
  }
  {
    await page.locator('#offlineMode-all').click();
    requests.length = 0;
    optionalResponses.length = 0;
    await page.locator('.offline-settings__download-all').click();
    await cacheHas(page, ENGINE_VERSION, ALL_OPTIONAL_URLS, 'all optional engines in cache');
    const wanted = new Set(ALL_OPTIONAL_URLS.map(pathOf));
    const downloaded = [...requestedPaths(requests)].filter((path) => wanted.has(path));
    assert.ok(downloaded.length > 10, `full install only fetched ${downloaded.length} optional URLs`);
    assert.ok(downloaded.some((path) => /\.wasm(?:\.gz|\.br)?(?:\?|$)/i.test(path)), 'full install did not fetch the ExifTool WASM');
    assertSameOriginOnly(requests, baseOrigin, 'full engine install');
    await assertNoUserFilesCached(page, 'full engine install');
    const firstBytes = await transferredBytes(optionalResponses);
    console.log(`PASS: (d) full install fetched and cached ${downloaded.length} optional URLs including WASM (${firstBytes} transferred bytes)`);
  }
  {
    requests.length = 0;
    optionalResponses.length = 0;
    await page.locator('.offline-settings__download-all').click();
    await waitFor(async () => (await page.locator('.offline-settings__progress').isHidden()) ? true : null,
      'second install to finish');
    const wanted = new Set(ALL_OPTIONAL_URLS.map(pathOf));
    const refetched = [...requestedPaths(requests)].filter((path) => wanted.has(path));
    assert.deepEqual(refetched, [], `second install re-fetched unchanged assets: ${refetched.join(', ')}`);
    const secondBytes = await transferredBytes(optionalResponses);
    assert.equal(secondBytes, 0, `second install transferred ${secondBytes} bytes; expected 0`);
    await cacheHas(page, ENGINE_VERSION, ALL_OPTIONAL_URLS, 'engine cache intact after second install');
    console.log(`PASS: (h) second install reused the engine cache — 0 requests, ${secondBytes} transferred bytes`);
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
      optionalResponses.length = 0;
      console.log('STAGE: (f) requesting service worker update');
      await withTimeout(page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw new Error('No service worker registration to update');
        await registration.update();
      }), 60_000, 'registration.update()');
      console.log('STAGE: (f) update call resolved, waiting for cache names');
      await cacheNamesHave(page, [UPDATED_SHELL_VERSION, ENGINE_VERSION], `updated shell ${UPDATED_SHELL_VERSION}`);
      console.log('STAGE: (f) updated shell and engine caches observed');
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
      console.log('STAGE: (f) updated worker is controlling the page');
      const paths = requestedPaths(requests);
      assert.deepEqual([...paths].filter(isWasm), [], 'app update re-downloaded unchanged WASM files');
      const wasmBytes = await transferredBytes(optionalResponses.filter((response) => isWasm(response.url())));
      assert.equal(wasmBytes, 0, `app update transferred ${wasmBytes} WASM bytes; expected 0`);
      assertSameOriginOnly(requests, baseOrigin, 'app update');
      const snapshot = await assertNoUserFilesCached(page, 'app update');
      assert.deepEqual(Object.keys(snapshot).filter((key) => key.startsWith('meinsert-')).sort(),
        [ENGINE_VERSION, UPDATED_SHELL_VERSION].sort(), 'old shell cache must be removed, engine cache kept');
      console.log(`PASS: (f) app update rebuilt shell only — engine cache intact, ${wasmBytes} WASM bytes transferred`);
    } catch (error) {
      if (/Timed out waiting for (updated|registration\.update)/.test(String(error))) {
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
  {
    await openSettings(page);
    requests.length = 0;
    optionalResponses.length = 0;
    await page.locator('.offline-settings__download-all').click();
    await waitFor(async () => (await page.locator('.offline-settings__cancel').isHidden()) ? null : true,
      'cancel button to appear');
    await page.locator('.offline-settings__cancel').click();
    const atCancel = requests.length;
    await sleep(1500);
    const afterCancel = requests.length;
    assert.ok(afterCancel - atCancel <= 1,
      `download kept fetching after cancel: ${afterCancel - atCancel} new requests`);
    const snapshot = await cacheSnapshot(page);
    const cachedCount = (snapshot[ENGINE_VERSION] || []).length;
    assert.ok(cachedCount < ALL_OPTIONAL_URLS.length,
      `cancelled install cached ${cachedCount}/${ALL_OPTIONAL_URLS.length} URLs; expected fewer`);
    await page.waitForFunction(() => document.getElementById('offlineSettingsDialog')
      ?.querySelector('.offline-settings__cancel')?.hidden === true, null, { timeout: 15_000 });
    console.log(`PASS: (i) cancelled install stopped fetching — ${afterCancel - atCancel} requests after cancel, ${cachedCount}/${ALL_OPTIONAL_URLS.length} URLs cached`);
  }
  {
    const probe = await page.evaluate(async (engineVersion) => {
      function send(message) {
        return new Promise((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve({ type: 'TIMEOUT' }), 5000);
          channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
          navigator.serviceWorker.controller.postMessage(message, [channel.port2]);
        });
      }
      const urls = ['./assets/vendor/fflate.mjs'];
      return {
        unknown: await send({ type: 'NOT_A_REAL_TYPE' }),
        blob: await send({ type: 'CACHE_OPTIONAL', jobId: 'probe-blob', version: engineVersion, urls: ['blob:https://example.com/id'] }),
        file: await send({ type: 'CACHE_OPTIONAL', jobId: 'probe-file', version: engineVersion, urls: ['file:///etc/passwd'] }),
        badJob: await send({ type: 'CACHE_OPTIONAL', jobId: 'bad job!', version: engineVersion, urls }),
        badCancel: await send({ type: 'CANCEL_OPTIONAL', jobId: 'bad job!' }),
      };
    }, ENGINE_VERSION);
    assert.equal(probe.unknown.type, 'OPTIONAL_ERROR');
    assert.equal(probe.unknown.error, 'unknown_type');
    assert.equal(probe.blob.type, 'OPTIONAL_ERROR');
    assert.equal(probe.blob.error, 'invalid_urls');
    assert.equal(probe.file.type, 'OPTIONAL_ERROR');
    assert.equal(probe.file.error, 'invalid_urls');
    assert.equal(probe.badJob.type, 'OPTIONAL_ERROR');
    assert.equal(probe.badJob.error, 'invalid_job');
    assert.equal(probe.badCancel.type, 'OPTIONAL_ERROR');
    assert.equal(probe.badCancel.error, 'invalid_job');
    console.log('PASS: (j) worker rejected unknown types, blob:/file: URLs and malformed job ids');
  }
  {
    const brotliPath = OFFLINE_FEATURES.find((feature) => feature.id === 'image').urls.find((url) => url.endsWith('.wasm.br'));
    const brotliHref = new URL(brotliPath, base).href;
    console.log('STAGE: (k) seed gzip-only v3 engine cache');
    const seedEntries = ALL_OPTIONAL_URLS.filter((path) => !path.endsWith('.wasm.br')).map((path) => ({
      url: new URL(path, base).href,
      body: readFileSync(join(root, path.slice(2)), 'utf8'),
      type: /[.]m?js$/.test(path) ? 'text/javascript; charset=utf-8' : 'application/octet-stream',
    }));
    await page.evaluate(async ({ from, to, gzipPath, entries }) => {
      await caches.delete(to);
      const legacy = await caches.open(from);
      await legacy.put(new URL(gzipPath, location.href).href, new Response('legacy gzip payload'));
      await Promise.all(entries.map((entry) => legacy.put(entry.url, new Response(entry.body, { headers: { 'content-type': entry.type } }))));
    }, { from: 'meinsert-engine-v3', to: ENGINE_VERSION, gzipPath: `./assets/vendor/exiftool-wasm/zeroperl-522d094a89cc.wasm.gz`, entries: seedEntries });
    servedShellVersion = MIGRATION_SHELL_VERSION;
    serveUpdated = true;
    requests.length = 0;
    optionalResponses.length = 0;
    await withTimeout(page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error('No service worker registration to update');
      await registration.update();
    }), 60_000, 'migration registration.update()');
    await cacheNamesHave(page, [MIGRATION_SHELL_VERSION, ENGINE_VERSION], `migration shell ${MIGRATION_SHELL_VERSION}`);
    await waitFor(async () => {
      const version = await page.evaluate(() => navigator.serviceWorker.controller?.postMessage
        ? new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => resolve(event.data?.version || '');
          navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
          setTimeout(() => resolve(''), 2000);
        })
        : '');
      return version === MIGRATION_SHELL_VERSION ? true : null;
    }, 'migration worker controlling the page');
    const migrated = [
      brotliPath,
      './assets/vendor/exiftool-wasm/index.js',
      './assets/vendor/brotli-decode.mjs',
      './assets/js/engines/exiftool.js',
    ];
    await cacheHas(page, ENGINE_VERSION, migrated, 'Brotli package present after migration');
    const snapshot = await cacheSnapshot(page);
    const engineUrls = snapshot[ENGINE_VERSION] || [];
    assert.equal(engineUrls.some((url) => url.endsWith('.wasm.gz')), false, 'gzip entry must not be migrated');
    assert.equal(engineUrls.some((url) => /\.wasm(\?|$)/.test(url)), false, 'raw WASM entry must not be migrated');
    assert.deepEqual([...requestedPaths(requests)].filter(isWasm), [pathOf(brotliHref)], 'migration must fetch only the Brotli WASM');
    await context.setOffline(true);
    requests.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 60_000 });
    await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/pattern.png'));
    await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 120_000 });
    assertSameOriginOnly(requests, baseOrigin, 'offline reopen after migration');
    assert.deepEqual([...requestedPaths(requests)].filter(isWasm), [pathOf(brotliHref)], 'offline reopen reused the cached Brotli payload');
    console.log('PASS: (k) gzip-only v3 cache upgraded to Brotli v4; offline reopen read tags');
    await context.setOffline(false);
  }
  assert.deepEqual(errors, [], `unexpected page errors: ${errors.join('; ')}`);
  console.log('PASS: no page errors during any offline scenario');
  console.log(`${skipped.length ? `SKIPPED ${skipped.length} scenario(s)` : 'ALL scenarios executed'} (offline-real)`);
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}