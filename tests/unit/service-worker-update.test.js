/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setReloadUnsafe, isReloadSafe, onReloadSafeChange } from '../../assets/js/core/reload-guard.js';
import { CURRENT_VERSION, ENGINE_VERSION } from '../../assets/js/core/build.js';
test('reload guard blocks while work is pending and releases again', () => {
  setReloadUnsafe('test-dirty', false);
  assert.equal(isReloadSafe(), true);
  setReloadUnsafe('test-dirty', true);
  assert.equal(isReloadSafe(), false);
  setReloadUnsafe('test-other', true);
  setReloadUnsafe('test-dirty', false);
  assert.equal(isReloadSafe(), false, 'one remaining reason must still block');
  setReloadUnsafe('test-other', false);
  assert.equal(isReloadSafe(), true);
});
test('reload guard notifies subscribers and allows unsubscribing', () => {
  const seen = [];
  const stop = onReloadSafeChange((safe) => seen.push(safe));
  setReloadUnsafe('test-notify', true);
  setReloadUnsafe('test-notify', false);
  assert.deepEqual(seen, [false, true]);
  stop();
  setReloadUnsafe('test-notify', true);
  setReloadUnsafe('test-notify', false);
  assert.equal(seen.length, 2);
});
test('service worker takes over immediately so a stale cache cannot keep serving old assets', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /await self\.skipWaiting\(\)/, 'install must activate the new worker without waiting for every tab to close');
  assert.match(sw, /await self\.clients\.claim\(\)/, 'activate must claim open clients');
});
test('page and service worker agree on the build marker and can probe each other', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, new RegExp(`const CACHE_VERSION = '${CURRENT_VERSION}'`), 'sw.js and build.js must share one version marker');
  assert.match(sw, /GET_VERSION/, 'the worker must answer a version probe');
  assert.match(sw, /cache: 'reload'/, 'the shell must be precached without the HTTP cache');
  const pwa = await readFile(new URL('../../assets/js/core/pwa.js', import.meta.url), 'utf8');
  assert.match(pwa, /GET_VERSION/);
  assert.match(pwa, /CURRENT_VERSION/);
});
test('shell and optional engines use independent cache versions', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, new RegExp(`const ENGINE_VERSION = '${ENGINE_VERSION}'`),
    'sw.js and build.js must share one engine cache marker');
  assert.notEqual(ENGINE_VERSION, CURRENT_VERSION, 'the engine cache must not be tied to the shell build marker');
  assert.match(sw, /const LEGACY_SHELL_VERSION = 'meinsert-v51'/, 'the previous single cache must be known for migration');
});
test('cache routing keeps shell assets and optional engines apart', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /async function networkFirst\(event\) \{[\s\S]*?caches\.open\(CACHE_VERSION\)/,
    'navigations must read and write the shell cache');
  assert.match(sw, /async function cacheFirst\(request\) \{\s*const cache = await caches\.open\(isShellRequest\(request\) \? CACHE_VERSION : ENGINE_VERSION\)/,
    'asset requests must be routed by shell membership');
  for (const fn of ['cacheOptional', 'clearOptional', 'optionalStatus']) {
    const block = sw.match(new RegExp(`async function ${fn}\\(event\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(block, `${fn} must exist in sw.js`);
    assert.match(block[0], /caches\.open\(ENGINE_VERSION\)/, `${fn} must use the engine cache`);
    assert.doesNotMatch(block[0], /CACHE_VERSION/, `${fn} must not use the shell version`);
  }
  assert.match(sw, /event\.data\.version !== ENGINE_VERSION/,
    'optional caching must validate against the engine version');
  assert.match(sw, /version: CACHE_VERSION, engineVersion: ENGINE_VERSION/,
    'GET_VERSION must report the shell version and the engine version');
});
test('the optional-cache UI sends the engine version, not the shell version', async () => {
  const ui = await readFile(new URL('../../assets/js/ui/offline-settings.js', import.meta.url), 'utf8');
  assert.match(ui, /import \{ ENGINE_VERSION \} from '\.\.\/core\/build\.js'/);
  for (const type of ['OPTIONAL_STATUS', 'CACHE_OPTIONAL', 'CLEAR_OPTIONAL']) {
    assert.match(ui, new RegExp(`type: '${type}',[^}]*version: ENGINE_VERSION`),
      `${type} must send ENGINE_VERSION`);
  }
  assert.doesNotMatch(ui, /version: CURRENT_VERSION/, 'optional cache messages must not use the shell marker');
});
test('activation migrates optional entries once and keeps both active caches', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  const activate = sw.match(/self\.addEventListener\('activate'[\s\S]*?\n\}\);/);
  assert.ok(activate, 'activate handler must exist');
  assert.match(activate[0], /await migrateLegacyCache\(\)/, 'migration must run before cleanup');
  assert.match(activate[0], /key !== CACHE_VERSION && key !== ENGINE_VERSION/,
    'cleanup must preserve both active caches');
  const migration = sw.match(/async function migrateLegacyCache\(\) \{[\s\S]*?\n\}/);
  assert.ok(migration, 'migration helper must exist');
  assert.match(migration[0], /keys\.includes\(LEGACY_SHELL_VERSION\)/, 'migration must be guarded by cache presence');
  assert.match(migration[0], /if \(shell\.has\(pathname\)\) return/, 'shell entries must not be copied into the engine cache');
  assert.match(migration[0], /engine\.put\(request, response\.clone\(\)\)/, 'optional entries must be copied into the engine cache');
});
test('registration bypasses the HTTP cache so a normal reload revalidates sw.js', async () => {
  const pwa = await readFile(new URL('../../assets/js/core/pwa.js', import.meta.url), 'utf8');
  assert.match(pwa, /navigator\.serviceWorker\.register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/,
    'register must pass updateViaCache: none');
});
test('navigations are network-first so a normal reload gets fresh HTML', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /async function networkFirst\(/, 'worker must define a networkFirst helper');
  assert.match(sw, /request\.mode === 'navigate'\)\s*\{\s*event\.respondWith\(networkFirst\(event\)\)/,
    'navigate branch must use networkFirst');
  assert.match(sw, /await fetch\(request\)/, 'networkFirst must try the network first');
  assert.match(sw, /cache\.match\(request, \{ ignoreSearch: true \}\)/, 'offline fallback must read the cached request');
  assert.match(sw, /cache\.match\('\.\/index\.html'\)/, 'offline fallback must try cached index.html');
  assert.match(sw, /cache\.match\('\.\/'\)/, 'offline fallback must try cached ./');
  assert.match(sw, /status: 503/, 'offline fallback must return an offline 503 response');
});
test('policy links are HTML pages in both the served shell and the runtime language switch', async () => {
  const shell = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(shell, /href="\.\/Terms\.html" data-policy="terms"/);
  assert.match(shell, /href="\.\/privacy\.html" data-policy="privacy"/);
  assert.doesNotMatch(shell, /data-policy="terms"[^>]*>\s*<span[^>]*>\s*<\/span>\s*<\/a>\s*·\s*<a href="\.\/TERMS\.md"/);
  const i18n = await readFile(new URL('../../assets/js/i18n/index.js', import.meta.url), 'utf8');
  assert.match(i18n, /link\.dataset\.policy === 'terms' \? '\.\/Terms\.html' : '\.\/privacy\.html'/);
  assert.doesNotMatch(i18n, /TERMS\.md|PRIVACY\.md/);
});
test('shell precache and simulated update have bounded waits', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const INSTALL_FETCH_TIMEOUT_MS = 15_000/, 'shell precache needs an explicit timeout');
  assert.match(sw, /async function precacheShellUrl\(cache, url\)/, 'precache must go through a bounded helper');
  assert.match(sw, /signal: controller\.signal/, 'precache fetch must be abortable');
  assert.match(sw, /Promise\.allSettled\(SHELL_URLS\.map\(\(url\) => precacheShellUrl\(cache, url\)\)\)/);
  const e2e = await readFile(new URL('../e2e/offline-real.mjs', import.meta.url), 'utf8');
  assert.ok(e2e.includes('withTimeout(page.evaluate'), 'registration.update() must be time-bounded in E2E');
  assert.ok(e2e.includes("60_000, 'registration.update()'"), 'update timeout must be explicit');
  assert.ok(e2e.includes('STAGE: (f)'), 'update scenario needs stage logging for slow CI runs');
});