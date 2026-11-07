/* Meinsert service worker: precaches the app shell + vendor libraries so the
 * editor works offline. The 27 MB ExifTool WASM is deliberately NOT precached;
 * it is cached on first use (format pages that need it keep working offline
 * afterwards). This keeps the first visit light instead of downloading 29 MB. */
const CACHE_VERSION = 'meinsert-v15';
const PRECACHE_URLS = [
  './',
  './index.html',
  './single.html',
  './batch.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/theme-init.js',

  './assets/js/home.js',
  './assets/js/app.js',
  './assets/js/core/detector.js',
  './assets/js/core/errors.js',
  './assets/js/core/image-utils.js',
  './assets/js/core/pwa.js',
  './assets/js/core/registry.js',
  './assets/js/core/tag-utils.js',
  './assets/js/core/worker-client.js',
  './assets/js/engines/exiftool.js',
  './assets/js/formats/flac.js',
  './assets/js/formats/image.js',
  './assets/js/formats/mkv.js',
  './assets/js/formats/mp3.js',
  './assets/js/formats/mp4.js',
  './assets/js/formats/ogg.js',
  './assets/js/formats/pdf.js',
  './assets/js/formats/vorbis-common.js',
  './assets/js/ui/dom.js',
  './assets/js/ui/file-card.js',
  './assets/js/ui/form-view.js',
  './assets/js/ui/icons.js',
  './assets/js/ui/raw-view.js',
  './assets/js/ui/result-view.js',
  './assets/js/ui/theme.js',
  './assets/js/ui/toast.js',
  './assets/js/workers/exiftool.worker.js',
  './assets/js/workers/media.worker.js',
  './assets/js/workers/pdf.worker.js',
  './assets/js/workers/rpc.js',
  './assets/js/batch/batch-limits.js',
  './assets/js/batch/batch-processor.js',
  './assets/js/batch/batch-report.js',
  './assets/js/batch/batch-view.js',
  './assets/js/batch/batch-zip.js',

  './assets/vendor/browser-id3-writer.mjs',
  './assets/vendor/mediabunny.mjs',
  './assets/vendor/pdf-lib.esm.js',
  './assets/vendor/fflate.mjs',

  './assets/fonts/ibm-plex-mono-400-latin-ext.woff2',
  './assets/fonts/ibm-plex-mono-400-latin.woff2',
  './assets/fonts/ibm-plex-mono-500-latin-ext.woff2',
  './assets/fonts/ibm-plex-mono-500-latin.woff2',
  './assets/fonts/ibm-plex-sans-condensed-500-latin-ext.woff2',
  './assets/fonts/ibm-plex-sans-condensed-500-latin.woff2',
  './assets/fonts/ibm-plex-sans-condensed-600-latin-ext.woff2',
  './assets/fonts/ibm-plex-sans-condensed-600-latin.woff2',
  './assets/fonts/ibm-plex-sans-condensed-700-latin-ext.woff2',
  './assets/fonts/ibm-plex-sans-condensed-700-latin.woff2',
  './assets/fonts/ibm-plex-sans-latin-ext.woff2',
  './assets/fonts/ibm-plex-sans-latin.woff2',

  './assets/img/apple-touch-icon.png',
  './assets/img/favicon-64.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const results = await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    const failed = results
      .map((result, index) => (result.status === 'rejected' ? PRECACHE_URLS[index] : null))
      .filter(Boolean);
    if (failed.length) {
      console.warn('Meinsert: sebagian aset gagal di-precache:', failed);
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

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true })
      || await cache.match('./index.html')
      || await cache.match('./');
    if (cached) return cached;
    return new Response('Meinsert tidak tersedia offline.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
