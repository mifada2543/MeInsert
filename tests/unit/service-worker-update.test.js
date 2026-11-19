/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setReloadUnsafe, isReloadSafe, onReloadSafeChange } from '../../assets/js/core/reload-guard.js';
import { CURRENT_VERSION } from '../../assets/js/core/build.js';
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
