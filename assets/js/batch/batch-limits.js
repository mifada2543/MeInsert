/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
const GIB = 1024 ** 3;
export const BATCH_LIMITS = {
  video: { label: 'Video', maxFiles: 10, maxDuration: 60 * 60, maxBytes: 2 * GIB },
  audio: { label: 'Audio', maxFiles: 20, maxDuration: 30 * 60, maxBytes: 1 * GIB },
  light: { label: 'Gambar / PDF / dokumen', maxFiles: 50, maxDuration: null, maxBytes: 1 * GIB },
  totalWithVideo: 2 * GIB,
  totalWithoutVideo: 1 * GIB,
};
export function categoryForDetection(detection) {
  if (!detection) return 'light';
  if (detection.id === 'mp4' && detection.subtype === 'm4a') return 'audio';
  if (detection.id === 'mp3' || detection.id === 'flac' || detection.id === 'ogg') return 'audio';
  if (detection.id === 'mkv' || detection.id === 'mp4') return 'video';
  return 'light';
}
export function categoryLabel(category) {
  return BATCH_LIMITS[category]?.label || 'Lainnya';
}
export function isSelected(item) {
  return Boolean(item?.included) && !item?.excluded;
}
export function selectionTotals(items) {
  const totals = {
    count: 0,
    bytes: 0,
    byCategory: { video: { count: 0, bytes: 0 }, audio: { count: 0, bytes: 0 }, light: { count: 0, bytes: 0 } },
    hasVideo: false,
  };
  for (const item of items || []) {
    if (!isSelected(item)) continue;
    const category = item.category || categoryForDetection(item.detection);
    const bytes = Number(item.file?.size) || 0;
    totals.count += 1;
    totals.bytes += bytes;
    totals.byCategory[category].count += 1;
    totals.byCategory[category].bytes += bytes;
    if (category === 'video') totals.hasVideo = true;
  }
  return totals;
}
export function validateSelection(items) {
  const totals = selectionTotals(items);
  const messages = [];
  for (const category of Object.keys(totals.byCategory)) {
    const limit = BATCH_LIMITS[category];
    const usage = totals.byCategory[category];
    if (usage.count > limit.maxFiles) {
      messages.push(`${limit.label}: maksimal ${limit.maxFiles} file, saat ini ${usage.count}.`);
    }
    if (usage.bytes > limit.maxBytes) {
      messages.push(`${limit.label}: maksimal ${formatLimitBytes(limit.maxBytes)}, saat ini ${formatLimitBytes(usage.bytes)}.`);
    }
  }
  const totalLimit = totals.hasVideo ? BATCH_LIMITS.totalWithVideo : BATCH_LIMITS.totalWithoutVideo;
  if (totals.bytes > totalLimit) {
    messages.push(`Total ukuran batch maksimal ${formatLimitBytes(totalLimit)}, saat ini ${formatLimitBytes(totals.bytes)}.`);
  }
  return { ok: messages.length === 0, messages, totals };
}
export function applyDurationLimits(item) {
  const category = item?.category || categoryForDetection(item?.detection);
  const limit = BATCH_LIMITS[category];
  if (!limit.maxDuration) return null;
  const raw = item?.readResult?.info?.duration;
  const duration = Number(raw);
  if (!Number.isFinite(duration) || duration <= 0) {
    item.excluded = true;
    item.included = false;
    item.limitLocked = true;
    item.skipReason = 'Durasi tidak terbaca; file ini tidak bisa diproses massal.';
    return item.skipReason;
  }
  if (duration > limit.maxDuration) {
    item.excluded = true;
    item.included = false;
    item.limitLocked = true;
    item.skipReason = `Durasi ${formatDuration(duration)} melebihi batas ${formatDuration(limit.maxDuration)}.`;
    return item.skipReason;
  }
  return null;
}
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}
export function formatLimitBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= GIB) return `${(n / GIB).toFixed(n % GIB === 0 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
export function usageRows(items) {
  const totals = selectionTotals(items);
  return Object.entries(totals.byCategory).map(([category, usage]) => ({
    category,
    label: BATCH_LIMITS[category].label,
    count: usage.count,
    bytes: usage.bytes,
    maxFiles: BATCH_LIMITS[category].maxFiles,
    maxBytes: BATCH_LIMITS[category].maxBytes,
    ok: usage.count <= BATCH_LIMITS[category].maxFiles && usage.bytes <= BATCH_LIMITS[category].maxBytes,
  }));
}
