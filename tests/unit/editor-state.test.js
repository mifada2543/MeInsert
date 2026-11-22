/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState, setTrim } from '../../assets/js/editor/editor-state.js';
import { beginChange, endChange, redo, undo } from '../../assets/js/core/history.js';
test('createEditorState starts without a trim', () => {
  const state = createEditorState();
  assert.equal(state.trim, null);
});
test('setTrim stores a copy and clears with null', () => {
  const state = createEditorState();
  const trim = { start: 2, end: 5, mode: 'copy' };
  setTrim(state, trim);
  assert.deepEqual(state.trim, trim);
  assert.notEqual(state.trim, trim);
  trim.start = 99;
  assert.equal(state.trim.start, 2);
  assert.equal(setTrim(state, null), null);
  assert.equal(state.trim, null);
});
test('trim participates in undo and redo as a cloned plain object', () => {
  const state = createEditorState();
  beginChange(state.history, 'trim');
  setTrim(state, { start: 2, end: 5, mode: 'precise' });
  endChange(state.history);
  assert.deepEqual(state.trim, { start: 2, end: 5, mode: 'precise' });
  assert.equal(undo(state.history), true);
  assert.equal(state.trim, null);
  assert.equal(redo(state.history), true);
  assert.deepEqual(state.trim, { start: 2, end: 5, mode: 'precise' });
  assert.notEqual(state.trim, state.history.snapshot().trim);
});