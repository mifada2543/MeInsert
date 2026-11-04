import { serializeError } from '../core/errors.js';

export function runWorker(adapters) {
  self.onmessage = async (event) => {
    const message = event.data || {};
    const { id, action, format, file, payload, options } = message;
    const post = (data) => self.postMessage({ id, ...data });
    if (action === 'dispose') {
      try {
        await Promise.all(Object.values(adapters).map((item) => (
          item && typeof item.dispose === 'function' ? item.dispose() : undefined
        )));
        post({ type: 'result', result: { ok: true } });
      } catch (error) {
        post({ type: 'error', error: serializeError(error) });
      }
      return;
    }
    const adapter = adapters[format];
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
