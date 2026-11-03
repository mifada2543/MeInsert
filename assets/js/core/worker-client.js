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
  }

  ensure() {
    if (this.worker) return this.worker;
    const worker = new Worker(this.url, { type: 'module', name: `meinsert-${this.url.pathname.split('/').pop()}` });
    worker.onmessage = (event) => {
      const message = event.data || {};
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
  constructor() {
    this.workers = new Map();
  }

  workerFor(engine) {
    const url = WORKER_URLS[engine];
    if (!url) throw new Error(`Mesin ${engine} tidak tersedia.`);
    if (!this.workers.has(engine)) this.workers.set(engine, new EngineWorker(url));
    return this.workers.get(engine);
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

  dispose() {
    for (const worker of this.workers.values()) worker.terminate();
    this.workers.clear();
  }
}
