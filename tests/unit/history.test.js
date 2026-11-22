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
  historyEntries,
  redo,
  rollbackTo,
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
  // Label dan waktu ikut tergeser bersama snapshot saat trim.
  assert.equal(history.pastLabels.length, 120);
  assert.equal(history.pastTimes.length, 120);
  assert.ok(history.pastTimes.every((time) => typeof time === 'number'));
});

test('createHistory exposes the new label and timestamp arrays', () => {
  const { history } = createEditor();
  assert.deepEqual(history.pastLabels, []);
  assert.deepEqual(history.futureLabels, []);
  assert.deepEqual(history.pastTimes, []);
  assert.deepEqual(history.futureTimes, []);
});

test('beginChange stores an optional label next to the snapshot', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title', 'Edit Judul');
  state.value = 'baru';
  assert.deepEqual(history.pastLabels, ['Edit Judul']);
  assert.equal(history.pastTimes.length, 1);
  assert.equal(typeof history.pastTimes[0], 'number');
  beginChange(history, 'artist');
  assert.deepEqual(history.pastLabels, ['Edit Judul', null]);
});

test('labels and timestamps follow their snapshots through undo and redo', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title', 'Edit Judul');
  state.value = 'satu';
  beginChange(history, 'artist', 'Edit Artis');
  state.value = 'dua';

  assert.deepEqual(history.pastLabels, ['Edit Judul', 'Edit Artis']);
  const timesAtStart = [...history.pastTimes];

  assert.equal(undo(history), true);
  assert.equal(state.value, 'satu');
  assert.deepEqual(history.pastLabels, ['Edit Judul']);
  assert.deepEqual(history.futureLabels, ['Edit Artis']);
  assert.equal(history.futureTimes.length, 1);
  assert.equal(history.futureTimes[0], timesAtStart[1]);

  assert.equal(undo(history), true);
  assert.equal(state.value, 'awal');
  assert.deepEqual(history.pastLabels, []);
  assert.deepEqual(history.futureLabels, ['Edit Artis', 'Edit Judul']);
  assert.equal(history.futureTimes.length, 2);

  assert.equal(redo(history), true);
  assert.equal(state.value, 'satu');
  assert.deepEqual(history.pastLabels, ['Edit Judul']);
  assert.deepEqual(history.futureLabels, ['Edit Artis']);

  assert.equal(redo(history), true);
  assert.equal(state.value, 'dua');
  assert.deepEqual(history.pastLabels, ['Edit Judul', 'Edit Artis']);
  assert.deepEqual(history.futureLabels, []);
  assert.deepEqual(history.futureTimes, []);
});

test('historyEntries lists past snapshots oldest to newest with index, label and time', () => {
  const { state, history } = createEditor('a');
  beginChange(history, 'x', 'Pertama');
  state.value = 'b';
  beginChange(history, 'y', 'Kedua');
  state.value = 'c';

  const entries = historyEntries(history);
  assert.deepEqual(entries.map((entry) => entry.index), [0, 1]);
  assert.deepEqual(entries.map((entry) => entry.label), ['Pertama', 'Kedua']);
  assert.deepEqual(entries.map((entry) => entry.snapshot.value), ['a', 'b']);
  assert.ok(entries[0].at > 0);
  assert.ok(entries[1].at >= entries[0].at);

  undo(history);
  assert.deepEqual(historyEntries(history).map((entry) => entry.label), ['Pertama']);
  assert.deepEqual(historyEntries({ past: [], pastLabels: [], pastTimes: [] }), []);
});

test('rollbackTo restores an older snapshot, clears redo and stays undoable', () => {
  const { state, history } = createEditor('v0');
  beginChange(history, 'a', 'Ubah A');
  state.value = 'v1';
  beginChange(history, 'b', 'Ubah B');
  state.value = 'v2';
  beginChange(history, 'c', 'Ubah C');
  state.value = 'v3';
  // past = [v0, v1, v2], state = v3

  assert.equal(rollbackTo(history, 0), true);
  assert.equal(state.value, 'v0');
  assert.equal(history.future.length, 0);
  assert.deepEqual(history.futureLabels, []);
  assert.deepEqual(history.futureTimes, []);
  assert.equal(history.lastKey, null);
  assert.deepEqual(history.past.map((snap) => snap.value), ['v0', 'v1', 'v2', 'v3']);

  const entries = historyEntries(history);
  assert.equal(entries.length, 4);
  assert.equal(entries[3].snapshot.value, 'v3');
  assert.equal(typeof entries[3].label, 'string');
  assert.ok(entries[3].label.includes('Ubah A'), `rollback label: ${entries[3].label}`);
  assert.equal(typeof entries[3].at, 'number');

  // Undo setelah rollback mengembalikan state sebelum rollback.
  assert.equal(undo(history), true);
  assert.equal(state.value, 'v3');
  assert.equal(history.past.length, 3);
  assert.equal(canRedo(history), true);
  assert.equal(redo(history), true);
  assert.equal(state.value, 'v0');
});

test('rollbackTo rejects invalid indices without touching the stack', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title', 'Edit Judul');
  state.value = 'baru';
  assert.equal(rollbackTo(history, -1), false);
  assert.equal(rollbackTo(history, 2), false);
  assert.equal(rollbackTo(history, 'nope'), false);
  assert.equal(state.value, 'baru');
  assert.equal(history.past.length, 1);
  assert.deepEqual(history.pastLabels, ['Edit Judul']);
});

test('clearHistory empties the label and timestamp arrays too', () => {
  const { state, history } = createEditor('awal');
  beginChange(history, 'title', 'Edit Judul');
  state.value = 'satu';
  undo(history);
  clearHistory(history);
  assert.deepEqual(history.pastLabels, []);
  assert.deepEqual(history.futureLabels, []);
  assert.deepEqual(history.pastTimes, []);
  assert.deepEqual(history.futureTimes, []);
});
