/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Optional, dev-only instrumentation. Enabled with ?mem=1. Never throws and
// adds no work in normal use, so it is safe to import from the hot RPC path.
let enabled = false;
try {
  enabled = typeof globalThis.location !== 'undefined' && /(?:^|[?&])mem=1(?:&|$)/.test(globalThis.location.search || '');
} catch { /* location may be unavailable in workers/tests */ }
const entries = new Map();
let peakBytes = 0;
function countBytes(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.buffer instanceof ArrayBuffer ? value.buffer.byteLength : 0;
  if (value instanceof Blob) return value.size;
  if (value instanceof File) return value.size;
  let total = 0;
  if (Array.isArray(value)) {
    for (const item of value) total += countBytes(item, seen);
    return total;
  }
  for (const item of Object.values(value)) total += countBytes(item, seen);
  return total;
}
export function noteBytes(label, value, extra = 0) {
  if (!enabled) return;
  const bytes = countBytes(value) + (Number(extra) || 0);
  entries.set(String(label), Math.max(entries.get(String(label)) || 0, bytes));
  peakBytes = Math.max(peakBytes, bytes);
}
export function noteMessage(message) {
  if (!enabled || !message) return;
  noteBytes(`${message.action || 'message'}:payload`, message.payload);
  noteBytes(`${message.action || 'message'}:file`, message.file);
}
export function noteResult(message, result) {
  if (!enabled) return;
  noteBytes(`${message?.action || 'result'}:result`, result);
}
export function memorySnapshot() {
  return {
    enabled,
    peakBytes,
    peakMb: Math.round((peakBytes / (1024 * 1024)) * 10) / 10,
    entries: Object.fromEntries(entries),
  };
}
export function resetMemoryMeter() {
  entries.clear();
  peakBytes = 0;
}