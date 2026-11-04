const WORKER_URLS = {
  exiftool: new URL('../workers/exiftool.worker.js', import.meta.url),
  media: new URL('../workers/media.worker.js', import.meta.url),
  pdf: new URL('../workers/pdf.worker.js', import.meta.url),
};

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
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.worker = null;
      this.onActivity();
    };
    worker.onmessageerror = () => {
      const error = new Error('Data dari worker tidak bisa dibaca.');
      error.code = 'WORKER_MESSAGE_ERROR';
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }

  request(message, onProgress) {
    const worker = this.ensure();
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ id, ...message });
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const pending of this.pending.values()) {
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

  read(engine, format, file, options, onProgress) {
    return this.workerFor(engine).request({ action: 'read', format, file, options }, onProgress);
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
      // A busy or crashed worker is still safe to terminate.
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
