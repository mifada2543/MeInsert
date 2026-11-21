/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { serializeError } from '../core/errors.js';
function collectTransferables(value, found = new Set()) {
  if (!value || typeof value !== 'object' || found.has(value)) return [...found];
  found.add(value);
  if (value instanceof ArrayBuffer) {
    found.add(value);
  } else if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
    found.add(value.buffer);
  } else if (Array.isArray(value)) {
    for (const item of value) collectTransferables(item, found);
  } else {
    for (const item of Object.values(value)) collectTransferables(item, found);
  }
  return [...found].filter((item) => item instanceof ArrayBuffer);
}
export function runWorker(adapters) {
  self.onmessage = async (event) => {
    const message = event.data || {};
    const { id, action, format, file, payload, options } = message;
    const post = (data) => {
      const payload = { id, ...data };
      self.postMessage(payload, collectTransferables(payload.result));
    };
    if (action === 'dispose') {
      try {
        await Promise.all(Object.values(adapters).map((item) => (
          item && typeof item.dispose === 'function' ? item.dispose() : undefined
        )));
        post({ type: 'result', result: { ok: true } });
      } catch (error) {
        post({ type: 'error', error: { ...serializeError(error), name: error?.name || 'Error' } });
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
      post({ type: 'error', error: { ...serializeError(error), name: error?.name || 'Error' } });
    }
  };
}