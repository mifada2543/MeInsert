/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
const WORKER_URLS = {
  exiftool: new URL('../workers/exiftool.worker.js', import.meta.url),
  media: new URL('../workers/media.worker.js', import.meta.url),
  pdf: new URL('../workers/pdf.worker.js', import.meta.url),
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
class EngineWorker {
  constructor(url) {
    this.url = url;
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
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.type === 'progress') {
        pending.onProgress?.(message);
        return;
      }
      this.pending.delete(message.id);
      if (message.type === 'result') {
        pending.resolve(message.result);
      } else if (message.type === 'error') {
        const error = new Error(message.error?.message || 'Terjadi kesalahan di worker.');
        error.code = message.error?.code || 'WORKER_ERROR';
        error.detail = message.error?.detail || '';
        pending.reject(error);
      } else {
        pending.reject(new Error('Respons worker tidak dikenali.'));
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Worker berhenti secara tidak terduga.');
      error.code = 'WORKER_CRASH';
      error.detail = event.filename ? `${event.filename}:${event.lineno}` : '';
      for (const pending of [...this.pending.values()]) pending.reject(error);
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
    const timeoutMs = timeoutForAction(message?.action);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        const error = new Error('Mesin metadata tidak menjawab (timeout). Mesin dimulai ulang.');
        error.code = 'WATCHDOG_TIMEOUT';
        error.detail = `action=${message?.action || 'unknown'} timeout=${timeoutMs}ms`;
        // Restart a hung engine so the next request gets a fresh worker.
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
        worker.postMessage({ id, ...message });
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
  }
  workerFor(engine) {
    const url = WORKER_URLS[engine];
    if (!url) throw new Error(`Mesin ${engine} tidak tersedia.`);
    if (!this.workers.has(engine)) {
      const worker = new EngineWorker(url);
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
      // Retry read exactly once after a hang/crash; writes never auto-retry.
      if (!retryableReadError(error)) throw error;
      try { onProgress?.({ stage: 'Mesin metadata dimulai ulang…', pct: 1 }); } catch { /* UI best-effort */ }
      try { this.cancel(engine); } catch { /* fresh worker below */ }
      return await attempt();
    }
  }
  write(engine, format, file, payload, options, onProgress) {
    return this.workerFor(engine).request({ action: 'write', format, file, payload, options }, onProgress);
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
  }
  disposeAllSync() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    for (const worker of this.workers.values()) worker.terminate();
    this.workers.clear();
  }
  dispose() {
    this.disposeAllSync();
  }
}
