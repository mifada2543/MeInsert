/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { mediaKind } from '../core/media-kind.js';
export function isSelectedItem(item) {
  return Boolean(item?.included) && !item?.excluded;
}
export function groupKey(item) {
  return `${item.detection?.id || 'unknown'}:${item.detection?.subtype || 'unknown'}`;
}
export function hasVerifiedBatchOutput(integrity) {
  return integrity?.status === 'ok' || integrity?.status === 'warning';
}
export function needsIntegrityReview(item) {
  return item?.status === 'done' && !hasVerifiedBatchOutput(item.integrity);
}
export function statusLabel(item) {
  if (needsIntegrityReview(item)) return 'Perlu diperiksa';
  if (item?.status === 'done' && item.integrity?.status === 'warning') return 'Selesai · catatan';
  if (item?.status === 'ready' && item.warnings?.length) return 'Siap · catatan';
  switch (item?.status) {
    case 'queued': return 'Menunggu';
    case 'scanning': return 'Memeriksa';
    case 'ready': return 'Siap';
    case 'processing': return 'Memproses';
    case 'done': return 'Selesai';
    case 'error': return 'Gagal';
    case 'skipped': return 'Dilewati';
    case 'cancelled': return 'Dibatalkan';
    default: return 'Menunggu';
  }
}
export function statusClass(item) {
  const status = item?.status || 'queued';
  if (needsIntegrityReview(item)) return 'is-error';
  if (status === 'done' && item.integrity?.status === 'warning') return 'is-skipped';
  if (status === 'skipped' || status === 'cancelled') return 'is-skipped';
  if (status === 'error') return 'is-error';
  if (status === 'done' || status === 'ready') return 'is-ready';
  return 'is-busy';
}
export function zipEligible(item) {
  return Boolean(item?.outputFile) && (hasVerifiedBatchOutput(item.integrity) || (needsIntegrityReview(item) && Boolean(item.includeFailedInZip)));
}
export function fileIconName(item) {
  const id = item?.detection?.id;
  if (id === 'image') return 'image';
  if (id === 'pdf') return 'pdf';
  const kind = mediaKind(item?.detection);
  if (kind === 'audio') return 'audio';
  if (kind === 'video') return 'video';
  return 'file';
}
export function durationOf(item) {
  const value = Number(item?.readResult?.info?.duration);
  return Number.isFinite(value) && value > 0 ? value : null;
}
export function tagCountOf(item) {
  return item?.readResult?.raw?.length || 0;
}