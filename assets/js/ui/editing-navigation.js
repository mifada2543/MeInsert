/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
export function singleEditing(state, dirtyCount) {
  return Boolean(state.processing || state.file && (state.status === 'loading' || state.status === 'ready')
    && (!(state.navigationHasResult || state.result) || dirtyCount > 0));
}
export function batchDraftKey(controller) {
  return JSON.stringify([controller.crossEnabled, controller.cross?.values,
    [...(controller.cross?.remove || [])].sort(),
    controller.groups.map((group) => [group.key, group.values, [...group.remove].sort()]),
    controller.items.map((item) => [item.id, [...(item.removeRaw || [])].sort()])]);
}
export function setEditingNavigation(editing) {
  if (typeof document !== 'undefined') document.body.classList.toggle('is-editing', Boolean(editing));
}