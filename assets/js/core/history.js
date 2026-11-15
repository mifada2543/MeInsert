/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// A small undo/redo stack shared by the single-file editor and the batch
// format groups. The stack mechanics are generic; the snapshot and restore
// functions are supplied by the caller so each surface can decide what
// "one change" means for its own state.
const MAX_HISTORY = 120;

export function createHistory({ snapshot, restore } = {}) {
  return {
    past: [],
    future: [],
    lastKey: null,
    snapshot: typeof snapshot === 'function' ? snapshot : () => null,
    restore: typeof restore === 'function' ? restore : () => {},
  };
}

/**
 * Record the state before a change. Consecutive changes sharing the same key
 * (for example typing in one field) collapse into a single history entry, so
 * the stack mirrors what the user perceives as one action.
 */
export function beginChange(history, key = null) {
  if (!history) return;
  if (key && history.lastKey === key) return;
  const before = history.snapshot();
  if (!before) return;
  history.past.push(before);
  if (history.past.length > MAX_HISTORY) history.past.shift();
  history.future.length = 0;
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
  if (current) history.future.push(current);
  history.restore(previous);
  history.lastKey = null;
  return true;
}

export function redo(history) {
  if (!history || !history.future.length) return false;
  const current = history.snapshot();
  const next = history.future.pop();
  if (current) history.past.push(current);
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

export function clearHistory(history) {
  if (!history) return;
  history.past.length = 0;
  history.future.length = 0;
  history.lastKey = null;
}
