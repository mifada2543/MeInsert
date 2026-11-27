/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t } from '../i18n/index.js';
import { handleEngineProgress, scheduleEnginePrefetch } from '../ui/engine-loading.js';
import { noteMessage, noteResult, memorySnapshot } from '../core/memory-meter.js';
const WORKER_URLS = {
  exiftool: new URL('../workers/exiftool.worker.js', import.meta.url),
  media: new URL('../workers/media.worker.js', import.meta.url),
  pdf: new URL('../workers/pdf.worker.js', import.meta.url),
  document: new URL('../workers/document.worker.js', import.meta.url),
  office: new URL('../workers/office.worker.js', import.meta.url),
};
export function timeoutForAction(action) {
  if (action === 'write') return 300_000;
  if (action === 'dispose') return 10_000;
  return 90_000;
}
export function retryableReadError(error) {
  const code = error?.code;
  return code === 'WATCHDOG_TIMEOUT' || code === 'WORKER_CRASH';
}
const MEMORY_MESSAGE = /out of memory|allocation failed|invalid array length|array buffer allocation failed|memory limit|maximum call stack/i;
const MEMORY_CODES = new Set(['OOM', 'OUT_OF_MEMORY', 'ALLOCATION_FAILED', 'RANGE_ERROR', 'MEMORY_LIMIT']);
export function isMemoryError(error) {
  if (!error) return false;
  if (error instanceof RangeError) return true;
  if (error.name === 'RangeError') return true;
  if (MEMORY_CODES.has(String(error.code || '').toUpperCase())) return true;
  return MEMORY_MESSAGE.test(String(error.message || ''));
}
export function friendlyMemoryError(error) {
  if (!isMemoryError(error)) return error;
  const keys = ['ui.memoryLimitFriendly', 'ui.memoryLimitAdvice'];
  const friendly = new Error(`${t(keys[0])} ${t(keys[1])}`);
  friendly.name = error.name || 'RangeError';
  friendly.code = error.code || 'MEMORY_LIMIT';
  friendly.detail = error.detail || error.message || String(error);
  friendly.originalMessage = error.message || String(error);
  friendly.friendlyKeys = keys;
  friendly.isMemoryLimit = true;
  return friendly;
}
function transferableMessage(message) {
  const transfer = [];
  let payload = message?.payload;
  if (!payload || typeof payload !== 'object' || typeof structuredClone !== 'function') {
    return { data: message, transfer };
  }
  try {
    payload = structuredClone(payload);
  } catch {
    return { data: message, transfer };
  }
  const seen = new Set();
  const collect = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value instanceof ArrayBuffer) {
      transfer.push(value);
      return;
    }
    if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
      transfer.push(value.buffer);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    for (const item of Object.values(value)) collect(item);
  };
  collect(payload);
  return { data: { ...message, payload }, transfer };
}
const liveClients = new Set();
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('meinsert:engine-retry', (event) => {
    const engine = event?.detail?.source;
    for (const client of liveClients) {
      const engines = engine ? [engine] : [...client.workers.keys()];
      for (const name of engines) {
        if (client.workers.has(name)) client.cancel(name);
      }
    }
  });
}
if (typeof document !== 'undefined') {
  try { scheduleEnginePrefetch(); } catch { /* prefetch bersifat opsional */ }
}
class EngineWorker {
  constructor(url, engine = '') {
    this.url = url;
    this.engine = engine;
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
    this.onActivity = () => {};
  }
  ensure() {
    if (this.worker) return this.worker;
    const worker = new Worker(this.url, { type: 'module', name: `meinsert-${this.url.pathname.split('/').pop()}` });
    worker.onmessage = (event) => {
      const message = event.data || {};
      this.onActivity();
      if (message.type === 'engine-progress') {
        try { handleEngineProgress({ ...message, source: this.engine || 'engine' }); } catch { /* UI terbaik */ }
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.type === 'progress') {
        pending.onProgress?.(message);
        return;
      }
      this.pending.delete(message.id);
      if (message.type === 'result') {
        noteResult({ action: message.action }, message.result);
        pending.resolve(message.result);
      } else if (message.type === 'error') {
        const error = new Error(message.error?.message || 'Terjadi kesalahan di worker.');
        error.name = message.error?.name || 'Error';
        error.code = message.error?.code || 'WORKER_ERROR';
        error.detail = message.error?.detail || '';
        pending.reject(friendlyMemoryError(error));
      } else {
        pending.reject(new Error('Respons worker tidak dikenali.'));
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Worker berhenti secara tidak terduga.');
      error.code = 'WORKER_CRASH';
      error.detail = event.filename ? `${event.filename}:${event.lineno}` : '';
      const finalError = friendlyMemoryError(error);
      for (const pending of [...this.pending.values()]) pending.reject(finalError);
      this.pending.clear();
      this.worker = null;
      this.onActivity();
    };
    worker.onmessageerror = () => {
      const error = new Error('Data dari worker tidak bisa dibaca.');
      error.code = 'WORKER_MESSAGE_ERROR';
      for (const pending of [...this.pending.values()]) pending.reject(error);
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }
  request(message, onProgress) {
    const worker = this.ensure();
    const id = ++this.sequence;
    const timeoutMs = message?.timeoutMs ?? timeoutForAction(message?.action);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        const error = new Error('Mesin metadata tidak menjawab (timeout). Mesin dimulai ulang.');
        error.code = 'WATCHDOG_TIMEOUT';
        error.detail = `action=${message?.action || 'unknown'} timeout=${timeoutMs}ms`;
        try {
          this.worker?.terminate();
        } catch { /* ignore */ }
        this.worker = null;
        this.onActivity();
        reject(error);
      }, timeoutMs);
      const settle = (fn, value) => {
        clearTimeout(timer);
        this.pending.delete(id);
        fn(value);
      };
      this.pending.set(id, {
        onProgress: (msg) => { onProgress?.(msg); },
        resolve: (value) => settle(resolve, value),
        reject: (err) => settle(reject, err),
        timer,
      });
      try {
        noteMessage(message);
        const prepared = transferableMessage(message);
        worker.postMessage({ id, ...prepared.data }, prepared.transfer);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      const error = new Error('Pemrosesan dibatalkan.');
      error.code = 'CANCELLED';
      pending.reject(error);
    }
    this.pending.clear();
  }
}
export class MetadataClient {
  constructor({ idleTimeout = 8 * 60 * 1000 } = {}) {
    this.workers = new Map();
    this.idleTimeout = idleTimeout;
    this.idleTimer = null;
    liveClients.add(this);
  }
  memoryStats() {
    return memorySnapshot();
  }
  workerFor(engine) {
    const url = WORKER_URLS[engine];
    if (!url) throw new Error(`Mesin ${engine} tidak tersedia.`);
    if (!this.workers.has(engine)) {
      const worker = new EngineWorker(url, engine);
      worker.onActivity = () => this.noteActivity();
      this.workers.set(engine, worker);
    }
    return this.workers.get(engine);
  }
  noteActivity() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.idleTimeout || this.idleTimeout <= 0) return;
    this.idleTimer = setTimeout(() => {
      for (const worker of this.workers.values()) {
        if (worker.pending.size > 0) {
          this.idleTimer = setTimeout(() => this.noteActivity(), this.idleTimeout);
          return;
        }
      }
      this.disposeAllSync();
    }, this.idleTimeout);
  }
  async read(engine, format, file, options, onProgress) {
    const attempt = () => this.workerFor(engine).request({ action: 'read', format, file, options }, onProgress);
    try {
      return await attempt();
    } catch (error) {
      if (!retryableReadError(error)) throw error;
      try { onProgress?.({ stage: 'Mesin metadata dimulai ulang…', pct: 1 }); } catch { /* UI best-effort */ }
      try { this.cancel(engine); } catch { /* fresh worker below */ }
      return await attempt();
    }
  }
  write(engine, format, file, payload, options, onProgress) {
    const message = { action: 'write', format, file, payload, options };
    if (options?.timeoutMs !== undefined && options?.timeoutMs !== null) {
      message.timeoutMs = options.timeoutMs;
    }
    return this.workerFor(engine).request(message, onProgress);
  }
  cancel(engine) {
    this.workers.get(engine)?.terminate();
    this.workers.delete(engine);
  }
  async disposeEngine(engine) {
    const entry = this.workers.get(engine);
    if (!entry) return;
    try {
      await entry.request({ action: 'dispose' });
    } catch {
    } finally {
      entry.terminate();
      this.workers.delete(engine);
    }
  }
  async disposeAll() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const engines = [...this.workers.keys()];
    await Promise.all(engines.map((engine) => this.disposeEngine(engine)));
    liveClients.delete(this);
  }
  disposeAllSync() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    for (const worker of this.workers.values()) worker.terminate();
    this.workers.clear();
    liveClients.delete(this);
  }
  dispose() {
    this.disposeAllSync();
  }
}