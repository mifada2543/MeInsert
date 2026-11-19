/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* MeInsert service worker.*/
const CACHE_VERSION = 'meinsert-v47';
const DOCUMENT_URLS = ['./NOTICE.md', './NOTICE-en.md', './TERMS.md', './TERMS-en.md', './PRIVACY.md', './PRIVACY-en.md'];
const SHELL_URLS = [
  ...DOCUMENT_URLS,
  './',
  './index.html',
  './single.html',
  './batch.html',
  './privacy.html',
  './Terms.html',
  './manifest.json',
  './assets/css/app.bundle.css',
  './assets/js/theme-init.js',
  './assets/js/home.js',
  './assets/js/ui/policy-toc.js',
  './assets/js/app.js',
  './assets/js/i18n/index.js',
  './assets/js/i18n/id.js',
  './assets/js/i18n/en.js',
  './assets/js/editor/editor-state.js',
  './assets/js/editor/editor-shell.js',
  './assets/js/editor/editor-changes.js',
  './assets/js/editor/editor-view.js',
  './assets/js/editor/editor-file.js',
  './assets/js/editor/editor-save.js',
  './assets/js/core/change-plan.js',
  './assets/js/core/detector.js',
  './assets/js/core/errors.js',
  './assets/js/core/format-map.js',
  './assets/js/core/history.js',
  './assets/js/core/image-utils.js',
  './assets/js/core/integrity-rules.js',
  './assets/js/core/integrity.js',
  './assets/js/core/media-proof.js',
  './assets/js/core/memory-estimate.js',
  './assets/js/core/metadata-snapshot.js',
  './assets/js/core/office-zip.js',
  './assets/js/core/privacy-categories.js',
  './assets/js/core/pwa.js',
  './assets/js/core/build.js',
  './assets/js/core/reload-guard.js',
  './assets/js/core/registry.js',
  './assets/js/core/tag-utils.js',
  './assets/js/core/worker-client.js',
  './assets/js/ui/batch-clean.js',
  './assets/js/ui/clean-metadata.js',
  './assets/js/ui/confirm.js',
  './assets/js/ui/dom.js',
  './assets/js/ui/editing-navigation.js',
  './assets/js/ui/engine-loading.js',
  './assets/js/ui/file-card.js',
  './assets/js/ui/form-view.js',
  './assets/js/ui/icons.js',
  './assets/js/ui/lightbox.js',
  './assets/js/ui/media-session.js',
  './assets/js/ui/quick-save.js',
  './assets/js/ui/policy-notice.js',
  './assets/js/ui/raw-view.js',
  './assets/js/ui/result-view.js',
  './assets/js/ui/review-dialog.js',
  './assets/js/ui/theme.js',
  './assets/js/ui/toast.js',
  './assets/js/formats/office.js',
  './assets/js/workers/exiftool.worker.js',
  './assets/js/workers/media.worker.js',
  './assets/js/workers/office.worker.js',
  './assets/js/workers/pdf.worker.js',
  './assets/js/workers/rpc.js',
  './assets/js/batch/batch-folder-drop.js',
  './assets/js/batch/batch-limits.js',
  './assets/js/batch/batch-processor.js',
  './assets/js/batch/batch-report.js',
  './assets/js/batch/batch-view.js',
  './assets/js/batch/batch-item.js',
  './assets/js/batch/batch-groups-view.js',
  './assets/js/batch/batch-history.js',
  './assets/js/batch/batch-save-flow.js',
  './assets/js/batch/batch-detail-view.js',
  './assets/js/batch/batch-preview.js',
  './assets/js/batch/batch-zip.js',
  './assets/fonts/ibm-plex-mono-400-latin.woff2',
  './assets/fonts/ibm-plex-mono-500-latin.woff2',
  './assets/fonts/ibm-plex-sans-condensed-500-latin.woff2',
  './assets/fonts/ibm-plex-sans-condensed-600-latin.woff2',
  './assets/fonts/ibm-plex-sans-condensed-700-latin.woff2',
  './assets/fonts/ibm-plex-sans-latin.woff2',
  './assets/img/apple-touch-icon.png',
  './assets/img/favicon-64.png',
  './assets/img/logo-96.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const results = await Promise.allSettled(SHELL_URLS.map(async (url) => {
      const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Precache gagal untuk ${url}`);
      await cache.put(url, response);
    }));
    const failed = results
      .map((result, index) => (result.status === 'rejected' ? SHELL_URLS[index] : null))
      .filter(Boolean);
    if (failed.length) {
      console.warn('MeInsert: sebagian aset gagal di-precache:', failed);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('meinsert-') && key !== CACHE_VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
function isCacheableAsset(pathname) {
  return /\.(css|js|mjs|wasm|woff2|png|jpg|jpeg|webp|tif|tiff|json|svg|ico)$/i.test(pathname);
}
function staleWhileRevalidate(event) {
  const { request } = event;
  const cachePromise = caches.open(CACHE_VERSION);
  const network = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await cachePromise;
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  event.waitUntil(network);
  return (async () => {
    const cache = await cachePromise;
    const cached = await cache.match(request, { ignoreSearch: true })
      || await cache.match('./index.html')
      || await cache.match('./');
    if (cached) return cached;
    const response = await network;
    if (response) return response;
    return new Response('MeInsert tidak tersedia offline / MeInsert is unavailable offline.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  })();
}
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const policyDocument = DOCUMENT_URLS.some((path) => new URL(path, self.registration.scope).pathname === url.pathname);
  if (policyDocument) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (/\.md$/i.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }
  if (isCacheableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    const reply = { type: 'VERSION', version: CACHE_VERSION };
    if (event.ports?.[0]) event.ports[0].postMessage(reply);
    else event.source?.postMessage(reply);
  }
});
