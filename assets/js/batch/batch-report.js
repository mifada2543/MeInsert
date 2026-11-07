/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { categoryLabel } from './batch-limits.js';

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function operationsOf(item) {
  const ops = item?.operations || {};
  return {
    set: ops.set || 0,
    remove: ops.remove || 0,
    rawRemove: ops.rawRemove || 0,
    custom: ops.custom || 0,
  };
}

export function makeReport(items) {
  const safeItems = items || [];
  const summary = {
    generatedAt: new Date().toISOString(),
    app: 'MeInsert',
    limit: 'Laporan tidak menyimpan isi file atau path asli.',
    totals: {
      files: safeItems.length,
      ready: safeItems.filter((item) => item.status === 'ready' || item.status === 'done').length,
      done: safeItems.filter((item) => item.status === 'done').length,
      failed: safeItems.filter((item) => item.status === 'error').length,
      skipped: safeItems.filter((item) => item.excluded || item.status === 'skipped').length,
      bytes: safeItems.reduce((sum, item) => sum + (Number(item.file?.size) || 0), 0),
    },
  };
  const files = safeItems.map((item) => {
    const raw = item.readResult?.raw || [];
    const operation = operationsOf(item);
    return {
      name: item.file?.name || '',
      size: Number(item.file?.size) || 0,
      category: categoryLabel(item.category),
      format: item.detection?.label || '',
      subtype: item.detection?.subtype || '',
      status: item.status || '',
      skippedReason: item.skipReason || '',
      duration: Number.isFinite(Number(item.readResult?.info?.duration))
        ? Number(item.readResult.info.duration)
        : null,
      rawTagCount: raw.length,
      operations: operation,
      warnings: item.warnings || [],
      error: item.error?.message || item.error || '',
      outputName: item.outputName || '',
    };
  });
  return { ...summary, files };
}

export function makeJsonReport(items) {
  return JSON.stringify(makeReport(items), null, 2);
}

export function makeCsvReport(items) {
  const rows = [
    ['Nama file', 'Kategori', 'Format', 'Subtype', 'Ukuran (byte)', 'Durasi (detik)', 'Status', 'Alasan dilewati', 'Jumlah tag', 'Ubah', 'Hapus', 'Hapus tag mentah', 'Warning', 'Error', 'Nama hasil'],
  ];
  for (const item of makeReport(items).files) {
    rows.push([
      item.name,
      item.category,
      item.format,
      item.subtype,
      item.size,
      item.duration ?? '',
      item.status,
      item.skippedReason,
      item.rawTagCount,
      item.operations.set,
      item.operations.remove,
      item.operations.rawRemove,
      item.warnings.join(' | '),
      item.error,
      item.outputName,
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}
