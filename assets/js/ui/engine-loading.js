/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindText, t, translated } from '../i18n/index.js';
import { clear, el, formatBytes } from './dom.js';
import { getProfile } from '../core/offline-manifest.js';
const VENDOR_DIR = new URL('../../vendor/exiftool-wasm/', import.meta.url);
const FALLBACK_WASM_URL = new URL('zeroperl-twnm61dk.wasm', VENDOR_DIR).href;
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
    if (!resolved.pathname.endsWith('.wasm')) return;
    if (!observedWasmUrl) observedWasmUrl = resolved.href;
  } catch { /* biarkan fetch memakai nilai asli */ }
}
export function engineWasmUrl() {
  return observedWasmUrl || FALLBACK_WASM_URL;
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