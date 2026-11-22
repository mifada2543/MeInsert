/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// A small undo/redo stack shared by the single-file editor and the batch
// format groups. The stack mechanics are generic; the snapshot and restore
// functions are supplied by the caller so each surface can decide what
// "one change" means for its own state.
//
// Beside every snapshot we keep a human-readable label and a timestamp, so a
// change list can be shown to the user. The three arrays are always moved and
// trimmed together: past[i], pastLabels[i] and pastTimes[i] describe the same
// entry (same for the future/redo stack).
import { t } from '../i18n/index.js';

const MAX_HISTORY = 120;

/** Label generik bila sebuah entri riwayat tidak membawa label eksplisit. */
function genericLabel() {
  try {
    const key = 'ui.changeHistoryCurrent';
    const value = t(key);
    if (value && value !== key && !value.includes('{')) return value;
  } catch { /* i18n tidak tersedia */ }
  return 'Perubahan';
}

/** Label untuk entri "kembali ke" yang dibuat rollbackTo(). */
function rollbackLabel(labelAsal) {
  const source = labelAsal == null ? '' : String(labelAsal);
  try {
    const key = 'ui.changeHistoryRollbackTo';
    const value = t(key, { v0: source });
    // t() mengembalikan key apa adanya bila key belum terdaftar di katalog.
    if (value && value !== key && !value.includes('{v0}')) return value;
  } catch { /* i18n tidak tersedia */ }
  return `Kembali ke: ${source}`;
}

export function createHistory({ snapshot, restore } = {}) {
  return {
    past: [],
    future: [],
    pastLabels: [],
    futureLabels: [],
    pastTimes: [],
    futureTimes: [],
    lastKey: null,
    snapshot: typeof snapshot === 'function' ? snapshot : () => null,
    restore: typeof restore === 'function' ? restore : () => {},
  };
}

/**
 * Record the state before a change. Consecutive changes sharing the same key
 * (for example typing in one field) collapse into a single history entry, so
 * the stack mirrors what the user perceives as one action.
 *
 * `label` is optional and is stored next to the snapshot; `key` keeps its
 * existing coalescing meaning.
 */
export function beginChange(history, key = null, label = null) {
  if (!history) return;
  if (key && history.lastKey === key) return;
  const before = history.snapshot();
  if (!before) return;
  history.past.push(before);
  history.pastLabels.push(label ?? null);
  history.pastTimes.push(Date.now());
  if (history.past.length > MAX_HISTORY) {
    history.past.shift();
    history.pastLabels.shift();
    history.pastTimes.shift();
  }
  history.future.length = 0;
  history.futureLabels.length = 0;
  history.futureTimes.length = 0;
  history.lastKey = key || null;
}

/** Close the current coalescing run without recording anything. */
export function endChange(history) {
  if (!history) return;
  history.lastKey = null;
}

export function undo(history) {
  if (!history || !history.past.length) return false;
  const current = history.snapshot();
  const previous = history.past.pop();
  const previousLabel = history.pastLabels?.pop();
  const previousTime = history.pastTimes?.pop();
  if (current) {
    // Label/waktu mengikuti snapshot "current" yang kini menjadi entri redo.
    history.future.push(current);
    history.futureLabels?.push(previousLabel ?? null);
    history.futureTimes?.push(previousTime ?? null);
  }
  history.restore(previous);
  history.lastKey = null;
  return true;
}

export function redo(history) {
  if (!history || !history.future.length) return false;
  const current = history.snapshot();
  const next = history.future.pop();
  const nextLabel = history.futureLabels?.pop();
  const nextTime = history.futureTimes?.pop();
  if (current) {
    // Label/waktu mengikuti snapshot "current" yang kini menjadi entri undo.
    history.past.push(current);
    history.pastLabels?.push(nextLabel ?? null);
    history.pastTimes?.push(nextTime ?? null);
  }
  history.restore(next);
  history.lastKey = null;
  return true;
}

export function canUndo(history) {
  return Boolean(history?.past.length);
}

export function canRedo(history) {
  return Boolean(history?.future.length);
}

/**
 * Kembalikan state ke entri `index` di history.past (0 = paling tua).
 * Entri rollback sendiri tetap bisa di-undo: state sebelum rollback didorong
 * ke past dengan label "Kembali ke: ..." dan waktu baru.
 */
export function rollbackTo(history, index) {
  if (!history || !Array.isArray(history.past)) return false;
  const at = Number(index);
  if (!Number.isInteger(at) || at < 0 || at >= history.past.length) return false;
  const target = history.past[at];
  const current = typeof history.snapshot === 'function' ? history.snapshot() : null;
  const sourceLabel = history.pastLabels?.[at] ?? genericLabel();
  const label = rollbackLabel(sourceLabel);

  history.future.length = 0;
  if (history.futureLabels) history.futureLabels.length = 0;
  if (history.futureTimes) history.futureTimes.length = 0;

  if (current) {
    history.past.push(current);
    history.pastLabels?.push(label);
    history.pastTimes?.push(Date.now());
    if (history.past.length > MAX_HISTORY) {
      history.past.shift();
      history.pastLabels?.shift();
      history.pastTimes?.shift();
    }
  }
  history.restore(target);
  history.lastKey = null;
  return true;
}

/** Daftar entri past dari yang tertua ke yang terbaru. */
export function historyEntries(history) {
  if (!history || !Array.isArray(history.past)) return [];
  return history.past.map((snapshot, index) => ({
    index,
    label: history.pastLabels?.[index] ?? null,
    at: history.pastTimes?.[index] ?? null,
    snapshot,
  }));
}

export function clearHistory(history) {
  if (!history) return;
  history.past.length = 0;
  history.future.length = 0;
  if (history.pastLabels) history.pastLabels.length = 0;
  if (history.futureLabels) history.futureLabels.length = 0;
  if (history.pastTimes) history.pastTimes.length = 0;
  if (history.futureTimes) history.futureTimes.length = 0;
  history.lastKey = null;
}
