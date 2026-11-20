/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindText, t, translated } from '../i18n/index.js';
import { clear, el, formatBytes } from './dom.js';
import { getProfile } from '../core/offline-manifest.js';
const VENDOR_DIR = new URL('../../vendor/exiftool-wasm/', import.meta.url);
const ENGINE_WASM_NAME = 'zeroperl-twnm61dk.wasm';
const ENGINE_WASM_GZ_NAME = `${ENGINE_WASM_NAME}.gz`;
const ENGINE_WASM_PATTERN = /zeroperl-twnm61dk\.wasm(?:\.(?:gz|br))?$/i;
const ENGINE_WASM_BYTES = 27_651_111;
const ENGINE_WASM_SHA256 = 'f854cbb7b6b014d2816a89428fcb217162bb0d7e65f2078f3bbd4b72eaa412ce';
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
const GZIP_MAGIC = [0x1f, 0x8b];
const MAX_GZIP_LAYERS = 2;
const MAX_ENGINE_BYTES = 64 * 1024 * 1024;
function startsWith(bytes, prefix) {
  return Boolean(bytes?.byteLength >= prefix.length)
    && prefix.every((value, index) => bytes[index] === value);
}
export function isWasmBinary(bytes) {
  return startsWith(bytes, WASM_MAGIC);
}
export function isGzipBinary(bytes) {
  return startsWith(bytes, GZIP_MAGIC);
}
function hasNativeGunzip() {
  return typeof globalThis.DecompressionStream === 'function';
}
const FALLBACK_WASM_URL = new URL(ENGINE_WASM_GZ_NAME, VENDOR_DIR).href;
let observedWasmUrl = null;
let activeLoads = 0;
let prefetchPromise = null;
let scheduledPromise = null;
let prefetchController = null;
function resolveEngineUrl(url) {
  if (url instanceof URL) return url.href;
  const text = String(url);
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith('//')) return text;
  try {
    return new URL(text, VENDOR_DIR).href;
  } catch {
    return text;
  }
}
export function noteEngineUrl(url) {
  if (!url) return;
  try {
    const resolved = new URL(resolveEngineUrl(url));
    if (!ENGINE_WASM_PATTERN.test(resolved.pathname)) return;
    if (!observedWasmUrl || /\.wasm\.(?:gz|br)$/i.test(resolved.pathname)) observedWasmUrl = resolved.href;
  } catch { /* biarkan fetch memakai nilai asli */ }
}
export function engineWasmUrl() {
  return observedWasmUrl || FALLBACK_WASM_URL;
}
export function engineRequestUrl(url) {
  const text = String(url);
  return ENGINE_WASM_PATTERN.test(text) && !/\.wasm\.(?:gz|br)$/i.test(text)
    ? `${text.slice(0, -ENGINE_WASM_NAME.length)}${ENGINE_WASM_GZ_NAME}`
    : text;
}
async function gunzipEngine(bytes) {
  if (hasNativeGunzip()) {
    const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { gunzipSync } = await import('../../vendor/fflate.mjs');
  return gunzipSync(bytes);
}
export async function verifyEngineIntegrity(bytes) {
  // Web Crypto needs a secure context; structural validation still applies
  // when it is unavailable (e.g. a local HTTP host).
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') return false;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  if (hex !== ENGINE_WASM_SHA256) throw new Error(`WASM integrity mismatch: ${hex}`);
  return true;
}
export async function decodeEngineBytes(bytes) {
  let current = bytes;
  for (let layer = 0; layer <= MAX_GZIP_LAYERS; layer += 1) {
    if (isWasmBinary(current)) {
      if (current.byteLength === ENGINE_WASM_BYTES) await verifyEngineIntegrity(current);
      return current;
    }
    if (!isGzipBinary(current)) throw new Error('Engine payload is neither WASM nor gzip.');
    current = await gunzipEngine(current);
    if (current.byteLength > MAX_ENGINE_BYTES) throw new Error('Decompressed engine exceeds the size limit.');
  }
  throw new Error('Engine payload has too many gzip layers.');
}
export async function decodeEngineResponse(response) {
  if (!response) return response;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const plain = await decodeEngineBytes(bytes);
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.set('content-length', String(plain.byteLength));
  headers.set('content-type', 'application/wasm');
  return new Response(plain, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
function joinChunks(chunks, length) {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export function createProgressFetch({ onProgress, onError, buffer = true } = {}) {
  return async function progressFetch(url, init) {
    const target = resolveEngineUrl(url);
    noteEngineUrl(target);
    if (onProgress && prefetchController) {
      try { prefetchController.abort(); } catch { /* best effort */ }
      prefetchController = null;
    }
    activeLoads += 1;
    try {
      const response = await fetch(target, init);
      const rawLength = response.headers?.get?.('content-length');
      const total = rawLength == null ? null : (Number(rawLength) || 0);
      if (!response.body || typeof response.body.getReader !== 'function') {
        onProgress?.({ loaded: total ?? 0, total });
        return response;
      }
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.byteLength) {
            loaded += value.byteLength;
            if (buffer) chunks.push(value);
            onProgress?.({ loaded, total });
          }
        }
      } finally {
        try { reader.releaseLock?.(); } catch { /* best effort */ }
      }
      if (!buffer) return new Response(null, { status: 200 });
      return new Response(joinChunks(chunks, loaded), {
        status: response.status >= 200 ? response.status : 200,
        headers: response.headers,
      });
    } catch (error) {
      onError?.(error);
      throw error;
    } finally {
      activeLoads -= 1;
    }
  };
}
export function prefetchEngine() {
  if (prefetchPromise) return prefetchPromise;
  if (typeof fetch !== 'function' || activeLoads > 0) return Promise.resolve(false);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  prefetchController = controller;
  const fetchOnce = createProgressFetch({ buffer: false });
  prefetchPromise = Promise.resolve()
    .then(() => fetchOnce(engineWasmUrl(), controller ? { signal: controller.signal } : undefined))
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      if (prefetchController === controller) prefetchController = null;
    });
  return prefetchPromise;
}
export function scheduleEnginePrefetch() {
  if (scheduledPromise) return scheduledPromise;
  scheduledPromise = new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const connection = globalThis.navigator?.connection;
    if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
      resolve(false);
      return;
    }
    const profile = getProfile(globalThis.localStorage);
    const wantsImageOffline = profile.mode === 'all'
      || (profile.mode === 'selected' && profile.features.includes('image'));
    if (!wantsImageOffline) {
      resolve(false);
      return;
    }
    const run = () => { resolve(prefetchEngine()); };
    if (typeof globalThis.requestIdleCallback === 'function') {
      globalThis.requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 2000);
    }
  });
  return scheduledPromise;
}
const loads = new Map();
let container = null;
let uiState = null;
function ensureContainer() {
  if (typeof document === 'undefined') return null;
  if (container?.isConnected) return container;
  container = el('div', {
    className: 'engine-loading',
    role: 'status',
    'aria-live': 'polite',
  });
  document.body.append(container);
  return container;
}
function removeContainer() {
  loads.clear();
  if (container) {
    container.remove();
    container = null;
  }
  uiState = null;
}
function renderProgress(root, progress) {
  if (uiState?.mode !== 'progress') {
    clear(root);
    root.classList.remove('is-error');
    const text = el('span', { className: 'engine-loading__text' });
    const bar = el('span', { className: 'engine-loading__bar', 'aria-hidden': 'true' });
    const fill = el('span', { className: 'engine-loading__fill' });
    bar.append(fill);
    root.append(text, bar);
    uiState = { mode: 'progress', progress, text, fill };
    bindText(text, () => {
      const current = uiState?.progress || {};
      return current.total && current.total > 0
        ? t('ui.engineDownloadProgress', { v0: formatBytes(current.loaded), v1: formatBytes(current.total) })
        : t('ui.engineLoadingMetadata');
    });
  }
  uiState.progress = progress;
  const pct = progress.total && progress.total > 0
    ? Math.max(0, Math.min(100, (progress.loaded / progress.total) * 100))
    : 0;
  uiState.fill.style.width = `${pct}%`;
}
function renderError(root) {
  if (uiState?.mode === 'error') return;
  clear(root);
  root.classList.add('is-error');
  const retry = el('button', {
    className: 'engine-loading__button',
    type: 'button',
    on: {
      click: () => {
        removeContainer();
        if (typeof CustomEvent === 'function') {
          globalThis.dispatchEvent?.(new CustomEvent('meinsert:engine-retry', { detail: {} }));
        }
      },
    },
  }, translated(() => t('ui.retry')));
  const close = el('button', {
    className: 'engine-loading__button',
    type: 'button',
    'aria-label': translated(() => t('ui.close')),
    on: { click: removeContainer },
  }, '\u00d7');
  root.append(
    el('span', { className: 'engine-loading__text' }, translated(() => t('ui.engineLoadFailed'))),
    retry,
    close,
  );
  uiState = { mode: 'error' };
}
function render() {
  if (typeof document === 'undefined') return;
  if (loads.size === 0) {
    removeContainer();
    return;
  }
  const entries = [...loads.values()];
  const root = ensureContainer();
  if (!root) return;
  if (entries.some((entry) => entry.failed)) {
    renderError(root);
    return;
  }
  const loaded = entries.reduce((sum, entry) => sum + (entry.loaded || 0), 0);
  const totals = entries.map((entry) => entry.total).filter((value) => Number.isFinite(value) && value > 0);
  const total = totals.length === entries.length ? totals.reduce((sum, value) => sum + value, 0) : null;
  renderProgress(root, { loaded, total });
}
export function handleEngineProgress(message = {}) {
  const source = message.source || 'engine';
  const phase = message.phase;
  if (phase === 'loading') {
    loads.set(source, { loaded: 0, total: message.total ?? null, failed: false });
  } else if (phase === 'downloading') {
    const entry = loads.get(source) || { failed: false };
    entry.loaded = message.loaded || 0;
    entry.total = message.total ?? entry.total ?? null;
    loads.set(source, entry);
  } else if (phase === 'ready') {
    loads.delete(source);
  } else if (phase === 'error') {
    const entry = loads.get(source) || { loaded: 0, total: null };
    entry.failed = true;
    loads.set(source, entry);
  } else {
    return;
  }
  render();
}