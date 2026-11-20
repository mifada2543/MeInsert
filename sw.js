/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* MeInsert service worker.*/
// The shell and the optional engines use separate caches: bumping the shell
// must never throw away engines the user already downloaded. ENGINE_VERSION is
// mirrored by core/build.js (this worker is a classic script, so it cannot use
// a static import); tests/unit/service-worker-update.test.js keeps them in sync.
const CACHE_VERSION = 'meinsert-v55';
const ENGINE_VERSION = 'meinsert-engine-v1';
const LEGACY_SHELL_VERSION = 'meinsert-v51';
const INSTALL_FETCH_TIMEOUT_MS = 15_000;
const DOCUMENT_URLS = ['./NOTICE.md', './NOTICE-en.md', './TERMS.md', './TERMS-en.md', './PRIVACY.md', './PRIVACY-en.md'];
const SHELL_URLS = [
  ...DOCUMENT_URLS,
  './',
  './index.html',
  './single.html',
  './batch.html',
  './about.html',
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
  './assets/js/core/format-capabilities.js',
  './assets/js/core/history.js',
  './assets/js/core/image-utils.js',
  './assets/js/core/integrity-rules.js',
  './assets/js/core/integrity.js',
  './assets/js/core/media-proof.js',
  './assets/js/core/memory-estimate.js',
  './assets/js/core/metadata-snapshot.js',
  './assets/js/core/offline-manifest.js',
  './assets/js/core/office-zip.js',
  './assets/js/core/office-xml.js',
  './assets/js/core/office-package.js',
  './assets/js/core/zip-directory.js',
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
  './assets/js/ui/mobile-menu.js',
  './assets/js/ui/editing-navigation.js',
  './assets/js/ui/action-bar.js',
  './assets/js/ui/batch-action-bar.js',
  './assets/js/ui/engine-loading.js',
  './assets/js/ui/file-card.js',
  './assets/js/ui/office-preview.js',
  './assets/js/ui/format-chips.js',
  './assets/js/ui/form-view.js',
  './assets/js/ui/icons.js',
  './assets/js/ui/lightbox.js',
  './assets/js/ui/media-session.js',
  './assets/js/ui/quick-save.js',
  './assets/js/ui/policy-notice.js',
  './assets/js/ui/offline-settings.js',
  './assets/js/ui/raw-view.js',
  './assets/js/ui/result-view.js',
  './assets/js/ui/review-dialog.js',
  './assets/js/ui/scroll-reveal.js',
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
  './assets/img/logo-96.webp',
  './assets/img/icon-192.webp',
  './assets/img/icon-512.webp',
  './assets/img/icon-maskable-512.webp',
];
const KNOWN_OPTIONAL_URLS = Object.freeze([
  './assets/vendor/mediabunny.mjs',
  './assets/js/workers/media.worker.js',
  './assets/js/formats/mp3.js',
  './assets/js/formats/flac.js',
  './assets/js/formats/ogg.js',
  './assets/js/formats/mkv.js',
  './assets/js/formats/vorbis-common.js',
  './assets/js/formats/vorbis-pictures.js',
  './assets/js/core/ogg-comment.js',
  './assets/vendor/browser-id3-writer.mjs',
  './assets/vendor/exiftool-wasm/index.js',
  './assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm.gz',
  './assets/js/workers/exiftool.worker.js',
  './assets/js/formats/image.js',
  './assets/js/formats/mp4.js',
  './assets/js/engines/exiftool.js',
  './assets/vendor/pdf-lib.esm.js',
  './assets/js/workers/pdf.worker.js',
  './assets/js/formats/pdf.js',
  './assets/vendor/fflate.mjs',
  './assets/js/core/office-zip.js',
  './assets/js/core/zip-directory.js',
  './assets/js/workers/office.worker.js',
  './assets/js/formats/office.js',
  './assets/js/core/office-xml.js',
  './assets/js/core/office-package.js',
]);
let cachedShellPaths = null;
function shellPathSet() {
  if (!cachedShellPaths) {
    cachedShellPaths = new Set(SHELL_URLS.map((path) => {
      try { return new URL(path, self.registration.scope).pathname; } catch { return null; }
    }).filter(Boolean));
  }
  return cachedShellPaths;
}
function isShellRequest(request) {
  try { return shellPathSet().has(new URL(request.url).pathname); } catch { return false; }
}
function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}
async function migrateLegacyCache() {
  const keys = await caches.keys();
  if (!keys.includes(LEGACY_SHELL_VERSION)) return;
  const legacy = await caches.open(LEGACY_SHELL_VERSION);
  const engine = await caches.open(ENGINE_VERSION);
  const shell = shellPathSet();
  const requests = await legacy.keys();
  await Promise.all(requests.map(async (request) => {
    let pathname = null;
    try { pathname = new URL(request.url).pathname; } catch { return; }
    if (shell.has(pathname)) return;
    try {
      const response = await legacy.match(request);
      if (response) await engine.put(request, response.clone());
    } catch { /* best-effort migration */ }
  }));
}
async function precacheShellUrl(cache, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INSTALL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: 'reload', credentials: 'same-origin', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Precache gagal untuk ${url}`);
    await cache.put(url, response);
  } finally {
    clearTimeout(timer);
  }
}
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const results = await Promise.allSettled(SHELL_URLS.map((url) => precacheShellUrl(cache, url)));
    const failed = results
      .map((result, index) => (result.status === 'rejected' ? SHELL_URLS[index] : null))
      .filter(Boolean);
    if (failed.length) {
      console.warn('MeInsert: sebagian aset gagal di-precache:', failed);
    }
    await self.skipWaiting();
  })());
});
// Reuse only the pinned upstream binary. No raw WASM is shipped or fetched.
async function migrateRawWasmCache() {
  const cache = await caches.open(ENGINE_VERSION);
  const raw = new URL('./assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm', self.registration.scope).href;
  const compressed = `${raw}.gz`;
  try {
    const legacy = await cache.match(raw);
    if (!legacy) return;
    // Prefer a verified legacy binary, even if an existing gzip entry is corrupt.
    if (!legacy.ok || typeof globalThis.crypto?.subtle?.digest !== 'function') return;
    const bytes = await legacy.arrayBuffer();
    if (bytes.byteLength !== 27_651_111) return;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (hex !== 'f854cbb7b6b014d2816a89428fcb217162bb0d7e65f2078f3bbd4b72eaa412ce') return;
    const canCompress = typeof globalThis.CompressionStream === 'function';
    const body = canCompress ? new Response(bytes).body.pipeThrough(new CompressionStream('gzip')) : bytes;
    await cache.put(compressed, new Response(body, { headers: {
      'content-type': canCompress ? 'application/gzip' : 'application/wasm',
      [ENGINE_HEADER]: ENGINE_VERSION,
    } }));
    await cache.delete(raw);
  } catch { /* Keep the old entry if migration fails; never block activation. */ }
}
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await migrateLegacyCache();
    await migrateRawWasmCache();
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('meinsert-') && key !== CACHE_VERSION && key !== ENGINE_VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
function isCacheableAsset(pathname) {
  return /\.(css|js|mjs|wasm|gz|woff2|png|jpg|jpeg|webp|tif|tiff|json|svg|ico)$/i.test(pathname);
}
async function networkFirst(event) {
  const { request } = event;
  const cachePromise = caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await cachePromise;
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await cachePromise;
    const cached = await cache.match(request, { ignoreSearch: true })
      || await cache.match('./index.html')
      || await cache.match('./');
    if (cached) return cached;
    return new Response('MeInsert tidak tersedia offline / MeInsert is unavailable offline.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
async function cacheFirst(request) {
  const cache = await caches.open(isShellRequest(request) ? CACHE_VERSION : ENGINE_VERSION);
  const optional = !isShellRequest(request) && optionalPathSet().has(new URL(request.url).pathname) && !new URL(request.url).search;
  if (optional) {
    const absolute = request.url;
    const existing = await cachedOptionalResponse(cache, absolute);
    if (existing) return existing;
    await fetchAndStore(cache, absolute);
    return cache.match(absolute);
  }
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
    event.respondWith(networkFirst(event));
    return;
  }
  if (isCacheableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
function replyTo(event, message) {
  if (event.ports?.[0]) event.ports[0].postMessage(message);
  else event.source?.postMessage(message);
}
const KNOWN_MESSAGE_TYPES = new Set([
  'SKIP_WAITING', 'GET_VERSION', 'CACHE_OPTIONAL', 'CLEAR_OPTIONAL', 'OPTIONAL_STATUS', 'CANCEL_OPTIONAL',
]);
const ENGINE_HEADER = 'x-meinsert-engine-version';
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_OPTIONAL_URLS = 128;
const MAX_OPTIONAL_BYTES = 96 * 1024 * 1024;
let cachedOptionalPaths = null;
function optionalPathSet() {
  if (!cachedOptionalPaths) {
    cachedOptionalPaths = new Set(KNOWN_OPTIONAL_URLS.map((path) => {
      try { return new URL(path, self.registration.scope).pathname; } catch { return null; }
    }).filter(Boolean));
  }
  return cachedOptionalPaths;
}
function validJobId(value) {
  return typeof value === 'string' && JOB_ID_PATTERN.test(value);
}
function validVersion(value) {
  return value === undefined || value === ENGINE_VERSION;
}
function failJob(event, error, jobId = '') {
  replyTo(event, { type: 'OPTIONAL_ERROR', jobId, error, version: ENGINE_VERSION });
}
const pendingFetches = new Map();
const activeJobs = new Map();
async function cachedOptionalResponse(cache, absolute) {
  try {
    const response = await cache.match(absolute);
    if (response && response.ok && (!response.headers.has(ENGINE_HEADER) || response.headers.get(ENGINE_HEADER) === ENGINE_VERSION)) return response;
  } catch { /* a corrupt cache entry must trigger a fresh fetch */ }
  return null;
}
async function fetchAndStore(cache, absolute, signal, progress = () => {}) {
  let job = pendingFetches.has(absolute) ? pendingFetches.get(absolute) : null;
  if (!job) {
    const controller = new AbortController();
    job = { controller, listeners: new Set(), bytes: 0, task: null };
    const current = job;
    current.task = (async () => {
      const response = await fetch(absolute, { cache: 'reload', credentials: 'same-origin', signal: controller.signal });
      if (!response || !response.ok || response.status !== 200 || !response.body) throw new Error('optional asset download failed');
      const declared = Number(response.headers.get('content-length')) || 0;
      if (declared > MAX_OPTIONAL_BYTES) throw new Error('optional asset exceeds the size limit');
      const headers = new Headers(response.headers);
      headers.set(ENGINE_HEADER, ENGINE_VERSION);
      headers.delete('content-encoding');
      headers.delete('content-length');
      const reader = response.body.getReader();
      const stream = new ReadableStream({
        async pull(target) {
          try {
            const { done, value } = await reader.read();
            if (done) { target.close(); return; }
            current.bytes += value.byteLength;
            if (current.bytes > MAX_OPTIONAL_BYTES) throw new Error('optional asset exceeds the size limit');
            for (const listener of current.listeners) listener(current.bytes);
            target.enqueue(value);
          } catch (error) { target.error(error); await reader.cancel().catch(() => {}); }
        },
        cancel(reason) { return reader.cancel(reason); },
      });
      await cache.put(absolute, new Response(stream, { status: response.status, statusText: response.statusText, headers }));
      return current.bytes;
    })().finally(() => { if (pendingFetches.get(absolute) === current) pendingFetches.delete(absolute); });
    pendingFetches.set(absolute, current);
  }
  const listener = (bytes) => progress(bytes);
  job.listeners.add(listener);
  if (job.bytes) listener(job.bytes);
  let abort;
  try {
    if (!signal) return await job.task;
    return await Promise.race([job.task, new Promise((resolve, reject) => {
      abort = () => reject(new Error('cancelled'));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    job.listeners.delete(listener);
    if (signal?.aborted && !job.listeners.size) job.controller.abort();
  }
}
async function cacheOptional(event) {
  const payload = event.data || {};
  const jobId = payload.jobId;
  if (!validJobId(jobId)) {
    failJob(event, 'invalid_job', typeof jobId === 'string' ? jobId.slice(0, 64) : '');
    return;
  }
  if (!validVersion(payload.version)) {
    failJob(event, 'version', jobId);
    return;
  }
  const requested = Array.isArray(payload.urls) ? payload.urls : [];
  if (requested.length < 1 || requested.length > MAX_OPTIONAL_URLS) {
    failJob(event, 'invalid_urls', jobId);
    return;
  }
  const urls = [];
  for (const raw of requested) {
    let absolute = null;
    if (typeof raw === 'string' && raw.length <= 512 && !/^(blob|data|file|filesystem|javascript):/i.test(raw.trim())) {
      try {
        const url = new URL(raw, self.registration.scope);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          if (url.origin === self.location.origin && optionalPathSet().has(url.pathname) && !url.search && !url.hash) absolute = url.href;
        }
      } catch { /* invalid URL — reject the whole job */ }
    }
    if (!absolute) {
      failJob(event, 'invalid_urls', jobId);
      return;
    }
    urls.push(absolute);
  }
  replyTo(event, {
    type: 'OPTIONAL_START', jobId, cached: 0, failed: 0, total: urls.length, version: ENGINE_VERSION,
  });
  const controller = new AbortController();
  activeJobs.set(jobId, controller);
  const cache = await caches.open(ENGINE_VERSION);
  let cached = 0;
  let failed = 0;
  let bytes = 0;
  try {
    for (const absolute of urls) {
      if (controller.signal.aborted) break;
      let ok = false;
      let used = 0;
      try {
        if (await cachedOptionalResponse(cache, absolute)) {
          ok = true;
        } else {
          used = await fetchAndStore(cache, absolute, controller.signal, (received) => {
            replyTo(event, { type: 'OPTIONAL_BYTES', jobId, url: absolute,
              totalBytes: bytes + received, version: ENGINE_VERSION });
          });
          bytes += used;
          ok = true;
        }
      } catch {
        if (controller.signal.aborted) break;
      }
      if (ok) cached += 1;
      else failed += 1;
      replyTo(event, {
        type: 'OPTIONAL_PROGRESS', jobId, url: absolute, ok, cached, failed,
        total: urls.length, bytes: used, totalBytes: bytes, version: ENGINE_VERSION,
      });
    }
  } finally {
    activeJobs.delete(jobId);
    replyTo(event, {
      type: 'OPTIONAL_DONE', jobId, cached, failed, total: urls.length, bytes,
      cancelled: controller.signal.aborted, version: ENGINE_VERSION,
    });
  }
}
function cancelOptional(event) {
  const jobId = event.data?.jobId;
  if (!validJobId(jobId)) {
    failJob(event, 'invalid_job', typeof jobId === 'string' ? jobId.slice(0, 64) : '');
    return;
  }
  const controller = activeJobs.get(jobId);
  if (controller) controller.abort();
  replyTo(event, { type: 'OPTIONAL_CANCELLED', jobId, version: ENGINE_VERSION });
}
async function clearOptional(event) {
  const cache = await caches.open(ENGINE_VERSION);
  const optional = (await cache.keys()).filter((request) => isSameOrigin(request.url));
  await Promise.all(optional.map((request) => cache.delete(request)));
  replyTo(event, {
    type: 'OPTIONAL_CLEARED', cached: optional.length, failed: 0, deleted: optional.length, version: ENGINE_VERSION,
  });
}
async function optionalStatus(event) {
  const cache = await caches.open(ENGINE_VERSION);
  const allowed = optionalPathSet();
  const urls = [];
  for (const request of await cache.keys()) {
    const href = request.url;
    if (isSameOrigin(href) && allowed.has(new URL(href).pathname) && !new URL(href).search
      && await cachedOptionalResponse(cache, href)) urls.push(href);
  }
  replyTo(event, { type: 'OPTIONAL_STATUS_RESULT', urls, cached: urls.length, failed: 0, version: ENGINE_VERSION });
}
self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (!KNOWN_MESSAGE_TYPES.has(type)) {
    failJob(event, 'unknown_type', validJobId(event.data?.jobId) ? event.data.jobId : '');
    return;
  }
  if (type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type === 'GET_VERSION') {
    replyTo(event, { type: 'VERSION', version: CACHE_VERSION, engineVersion: ENGINE_VERSION });
    return;
  }
  if (event.data?.version !== undefined && event.data.version !== ENGINE_VERSION) {
    failJob(event, 'version', validJobId(event.data?.jobId) ? event.data.jobId : '');
    return;
  }
  if (type === 'CACHE_OPTIONAL') event.waitUntil(cacheOptional(event));
  else if (type === 'CLEAR_OPTIONAL') event.waitUntil(clearOptional(event));
  else if (type === 'OPTIONAL_STATUS') event.waitUntil(optionalStatus(event));
  else if (type === 'CANCEL_OPTIONAL') cancelOptional(event);
});