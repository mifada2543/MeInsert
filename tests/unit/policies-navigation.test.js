/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPolicies } from '../../scripts/build-policies.mjs';
import { singleEditing, batchDraftKey } from '../../assets/js/ui/editing-navigation.js';
test('policy HTML is synchronized with Markdown and shared site chrome', async () => {
  await buildPolicies({ check: true });
});
test('single mobile nav hides for pending sessions/busy/dirty and returns on clean results or exit', () => {
  assert.equal(singleEditing({ status: 'idle' }, 0), false);
  const state = { file: {}, status: 'ready', processing: false };
  assert.equal(singleEditing(state, 0), true);
  assert.equal(singleEditing({ ...state, result: {} }, 0), false);
  assert.equal(singleEditing({ ...state, navigationHasResult: true }, 0), false);
  assert.equal(singleEditing({ ...state, result: {} }, 1), true);
  assert.equal(singleEditing({ ...state, result: {}, processing: true }, 0), true);
  assert.equal(singleEditing({ ...state, status: 'error' }, 0), false);
});
test('batch navigation draft tracks values and raw removals, not progress updates', () => {
  const controller = { cross: { values: {}, remove: new Set() }, groups: [{ key: 'pdf', values: {}, remove: new Set() }], items: [{ id: 1, removeRaw: new Set() }] };
  const initial = batchDraftKey(controller);
  controller.items[0].progress = 80;
  assert.equal(batchDraftKey(controller), initial);
  controller.groups[0].values.title = 'Changed';
  assert.notEqual(batchDraftKey(controller), initial);
  delete controller.groups[0].values.title;
  controller.items[0].removeRaw.add('/Author');
  assert.notEqual(batchDraftKey(controller), initial);
});