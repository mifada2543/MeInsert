/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// A small undo/redo stack shared by the single-file editor and the batch group editor.
import { t } from '../i18n/index.js';
const MAX_HISTORY = 120;
function genericLabel() {
  try {
    const key = 'ui.changeHistoryCurrent';
    const value = t(key);
    if (value && value !== key && !value.includes('{')) return value;
  } catch { /* i18n tidak tersedia */ }
  return 'Perubahan';
}
function rollbackLabel(labelAsal) {
  const source = labelAsal == null ? '' : String(labelAsal);
  try {
    const key = 'ui.changeHistoryRollbackTo';
    const value = t(key, { v0: source });
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