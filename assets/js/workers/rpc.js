import { serializeError } from '../core/errors.js';

export function runWorker(adapters) {
  self.onmessage = async (event) => {
    const message = event.data || {};
    const { id, action, format, file, payload, options } = message;
    const adapter = adapters[format];
    const post = (data) => self.postMessage({ id, ...data });
    if (!adapter) {
      post({ type: 'error', error: { code: 'UNSUPPORTED', message: `Format ${format} tidak dikenali.` } });
      return;
    }
    const report = (progress) => post({ type: 'progress', ...progress });
    try {
      if (action === 'read') {
        report({ stage: 'Membaca metadata…', pct: 20 });
        const result = await adapter.read(file, options || {});
        post({ type: 'result', result });
      } else if (action === 'write') {
        const result = await adapter.write(file, payload || {}, options || {}, report);
        post({ type: 'result', result });
      } else {
        post({ type: 'error', error: { code: 'BAD_ACTION', message: 'Aksi tidak dikenali.' } });
      }
    } catch (error) {
      post({ type: 'error', error: serializeError(error) });
    }
  };
}
