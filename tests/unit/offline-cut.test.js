/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { featureFor } from '../../assets/js/core/format-capabilities.js';
import { ENGINE_VERSION } from '../../assets/js/core/build.js';
const cachedResponse = { ok: true, headers: { has: () => true, get: () => ENGINE_VERSION } };
function cacheFor(urls) {
  const known = new Set([...urls].map(String));
  return {
    open: async (name) => {
      assert.equal(name, ENGINE_VERSION);
      return { match: async (url) => (known.has(String(url)) ? cachedResponse : undefined) };
    },
  };
}
function stubEnvironment() {
  globalThis.document = {
    getElementById: () => null,
    addEventListener: () => {},
    querySelector: () => null,
    body: { dataset: {} },
    readyState: 'complete',
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
    writable: true,
  });
  globalThis.addEventListener = () => {};
}
test('offline cut gate hydrates at init and rechecks Cache Storage when its memory is empty', async () => {
  stubEnvironment();
  globalThis.caches = cacheFor(featureFor('audio').urls);
  const { ensureFeatureOffline } = await import('../../assets/js/ui/offline-settings.js');
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Hydration at module init must survive Cache Storage becoming unavailable.
  globalThis.caches = { open: async () => { throw new Error('Cache Storage unavailable'); } };
  assert.equal(await ensureFeatureOffline('audio'), true);
  // A feature that was not hydrated must not be accepted on an empty cache.
  assert.equal(await ensureFeatureOffline('pdf'), false);
  // A fresh Cache Storage check must recover readiness for a cached feature.
  globalThis.caches = cacheFor(featureFor('pdf').urls);
  assert.equal(await ensureFeatureOffline('pdf'), true);
});
