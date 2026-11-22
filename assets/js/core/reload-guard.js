/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// A new service worker can take over while the user is mid-edit. Reloading
// then would discard unsaved work, so pages mark unsafe states here and the
// update handler waits for a safe moment (or asks the user to reload).
const reasons = new Set();
const listeners = new Set();
export function setReloadUnsafe(reason, value = true) {
  if (value) reasons.add(reason);
  else reasons.delete(reason);
  for (const listener of listeners) listener(isReloadSafe());
}
export function isReloadSafe() {
  return reasons.size === 0;
}
export function onReloadSafeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}