/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginChange,
  canRedo,
  canUndo,
  clearHistory,
  createHistory,
  endChange,
  redo,
  undo,
} from '../../assets/js/core/history.js';

// A minimal editor state: one editable field plus a log of every restore call.
function createEditor(initial = 'awal') {
  const state = { value: initial, restored: [] };
  const history = createHistory({
    snapshot: () => ({ value: state.value }),
    restore: (snap) => {
      state.restored.push(snap.value);
      state.value = snap.value;
    },
  });
  return { state, history };
}

test('beginChange records the state before the change, not after it', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'baru';
  assert.equal(history.past.length, 1);
  assert.deepEqual(history.past[0], { value: 'awal' });
  assert.notDeepEqual(history.past[0], { value: 'baru' });
});

test('consecutive changes sharing one key coalesce into a single entry', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'satu';
  beginChange(history, 'title');
  state.value = 'dua';
  beginChange(history, 'title');
  assert.equal(history.past.length, 1);
  assert.deepEqual(history.past[0], { value: 'awal' });
});

test('a different key starts a new history entry', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'satu';
  beginChange(history, 'artist');
  state.value = 'dua';
  beginChange(history, 'year');
  assert.equal(history.past.length, 3);
  assert.deepEqual(history.past.map((snap) => snap.value), ['awal', 'satu', 'dua']);
});

test('endChange closes the run so the same key starts a new entry', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'satu';
  endChange(history);
  beginChange(history, 'title');
  assert.equal(history.past.length, 2);
  assert.deepEqual(history.past.map((snap) => snap.value), ['awal', 'satu']);
});

test('endChange records nothing on its own', () => {
  const { history } = createEditor('awal');
  endChange(history);
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);
});

test('undo restores the earlier snapshot and pushes the current state to redo', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'satu';
  beginChange(history, 'artist');
  state.value = 'dua';

  assert.equal(undo(history), true);
  assert.equal(state.value, 'satu');
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);
  assert.deepEqual(history.future[0], { value: 'dua' });

  assert.equal(undo(history), true);
  assert.equal(state.value, 'awal');
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 2);
});

test('redo restores the undone state again', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'satu';
  beginChange(history, 'artist');
  state.value = 'dua';

  undo(history);
  undo(history);
  assert.equal(state.value, 'awal');

  assert.equal(redo(history), true);
  assert.equal(state.value, 'satu');
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);

  assert.equal(redo(history), true);
  assert.equal(state.value, 'dua');
  assert.equal(history.past.length, 2);
  assert.equal(history.future.length, 0);
});

test('undo and redo report false when there is nothing to undo or redo', () => {
  const { history } = createEditor('awal');
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
  assert.equal(undo(history), false);
  assert.equal(redo(history), false);
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);
});

test('canUndo and canRedo follow the stack contents', () => {
  const { state, history } = createEditor('awal');
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);

  beginChange(history, 'title');
  assert.equal(canUndo(history), true);
  assert.equal(canRedo(history), false);

  state.value = 'satu';
  undo(history);
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), true);
});

test('clearHistory empties both stacks and resets the coalescing key', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title');
  state.value = 'satu';
  beginChange(history, 'artist');
  state.value = 'dua';
  undo(history);
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);

  clearHistory(history);
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);
  assert.equal(history.lastKey, null);
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
});

test('clearHistory lets the same key start a fresh entry', () => {
  const { history } = createEditor('awal');
  beginChange(history, 'title');
  beginChange(history, 'title');
  assert.equal(history.past.length, 1);

  clearHistory(history);
  beginChange(history, 'title');
  assert.equal(history.past.length, 1);
});

test('a null snapshot records nothing', () => {
  const history = createHistory({ snapshot: () => null, restore: () => {} });
  beginChange(history, 'title');
  assert.equal(history.past.length, 0);
  assert.equal(canUndo(history), false);
  assert.equal(undo(history), false);
});

test('a history without callbacks records nothing and stays inert', () => {
  const history = createHistory();
  beginChange(history, 'title');
  assert.equal(history.past.length, 0);
  assert.equal(undo(history), false);
  assert.equal(redo(history), false);
});

test('the history stack is capped at 120 entries', () => {
  const { state, history } = createEditor('v0');
  for (let i = 1; i <= 130; i += 1) {
    state.value = `v${i}`;
    beginChange(history, `key-${i}`);
  }
  assert.equal(history.past.length, 120);
  assert.equal(history.past[0].value, 'v11');
  assert.equal(history.past[119].value, 'v130');
});
