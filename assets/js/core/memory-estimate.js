/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */

/** Kasar dan jujur: browser tidak memberi angka memori yang konsisten. */
export const MEMORY_WARN_MB = 350;
export const MEMORY_BLOCK_MB = 900;

function budgetFor(peakMb) {
  if (peakMb >= MEMORY_BLOCK_MB) return 'block';
  if (peakMb >= MEMORY_WARN_MB) return 'warn';
  return 'ok';
}

export function formatMemoryMb(bytes) {
  const mb = (Number(bytes) || 0) / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

/**
 * Totestimate peak browser memory for a write plan.
 * Peak ≈ inputs*copyFactor + held outputs + cover + engine overhead.
 * Bukan jaminan — hanya sinyal untuk dialog review.
 */
export function estimateMemory({
  inputSizes = [],
  heldOutputSizes = [],
  coverBytes = 0,
  copyFactor = 1.5,
  engineOverheadMb = 30,
} = {}) {
  const inputs = (inputSizes || []).reduce((s, v) => s + (Number(v) || 0), 0);
  const held = (heldOutputSizes || []).reduce((s, v) => s + (Number(v) || 0), 0);
  const cover = Number(coverBytes) || 0;
  const peakBytes = inputs * Math.max(1, copyFactor) + held + cover + engineOverheadMb * 1024 * 1024;
  const peakMb = peakBytes / (1024 * 1024);
  const level = budgetFor(peakMb);
  const message = level === 'ok'
    ? ''
    : level === 'warn'
      ? `Perkiraan memori tinggi (~${formatMemoryMb(peakBytes)}). Estimasi kasar; browser tidak memberi angka pasti.`
      : `Perkiraan memori sangat tinggi (~${formatMemoryMb(peakBytes)}). Estimasi kasar; browser tidak memberi angka pasti. Pertimbangkan modus hemat memori.`;
  return {
    level,
    estimatedBytes: Math.round(peakBytes),
    estimatedMb: Math.round(peakMb),
    estimatedLabel: formatMemoryMb(peakBytes),
    message,
    breakdown: { inputs, held, cover, copyFactor, engineOverheadMb },
  };
}

export function estimateForSingle({ fileSize = 0, coverBytes = 0 } = {}) {
  return estimateMemory({
    inputSizes: [fileSize],
    heldOutputSizes: [fileSize],
    coverBytes,
    copyFactor: 1.2,
    engineOverheadMb: 30,
  });
}

export function estimateForBatch(items = []) {
  const sizes = (items || []).map((item) => Number(item?.file?.size) || 0);
  return estimateMemory({
    inputSizes: sizes,
    heldOutputSizes: sizes,
    coverBytes: 0,
    copyFactor: 1.15,
    engineOverheadMb: 32,
  });
}
