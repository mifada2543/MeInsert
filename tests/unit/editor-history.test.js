/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../assets/js/editor/editor-state.js';
import {
  beginChange,
  canRedo,
  canUndo,
  clearHistory,
  endChange,
  redo,
  undo,
} from '../../assets/js/core/history.js';

function seededState() {
  const state = createEditorState();
  state.values = { title: 'Asli', artist: 'Artis' };
  state.originalValues = { title: 'Asli', artist: 'Artis' };
  state.customRows = [{ uid: 1, key: 'MOOD', value: 'Calm', originalKey: 'MOOD', originalValue: 'Calm' }];
  state.customBaseline = [{ uid: 1, key: 'MOOD', value: 'Calm', originalKey: 'MOOD', originalValue: 'Calm' }];
  state.coverOriginal = { mimeType: 'image/jpeg', kind: 'coverFront', name: 'cover.jpg', size: 10 };
  state.coverOriginalBytes = new Uint8Array([1, 2, 3]);
  state.outputBase = 'file-meinsert';
  state.detection = { id: 'mp3', label: 'MP3' };
  state.adapter = { meta: { id: 'mp3' }, fields: [] };
  state.readResult = { fields: { title: 'Asli' }, raw: [] };
  state.file = { name: 'file.mp3', size: 3 };
  return state;
}

test('editor state exposes an empty undo/redo history', () => {
  const state = createEditorState();
  assert.ok(state.history);
  assert.equal(canUndo(state.history), false);
  assert.equal(canRedo(state.history), false);
  assert.equal(state.history.past.length, 0);
  assert.equal(state.history.future.length, 0);
  assert.deepEqual(state.history.pastLabels, []);
  assert.deepEqual(state.history.futureLabels, []);
  assert.deepEqual(state.history.pastTimes, []);
  assert.deepEqual(state.history.futureTimes, []);
});

test('snapshot keeps every editable value and restore writes them back', () => {
  const state = seededState();
  state.removedFields = new Set(['artist']);
  state.removedCustom = new Set(['MOOD']);
  state.coverAction = 'set';
  state.coverChosen = { data: new Uint8Array([9]), mimeType: 'image/png', name: 'new.png' };
  state.outputBase = 'lain';

  const snapshot = state.history.snapshot();
  assert.deepEqual(snapshot.values, { title: 'Asli', artist: 'Artis' });
  assert.deepEqual(snapshot.removedFields, ['artist']);
  assert.equal(snapshot.customRows.length, 1);
  assert.deepEqual(snapshot.removedCustom, ['MOOD']);
  assert.equal(snapshot.coverAction, 'set');
  assert.equal(snapshot.coverChosen.name, 'new.png');
  assert.equal(snapshot.outputBase, 'lain');

  state.values = { title: 'Ubah' };
  state.removedFields = new Set();
  state.customRows = [];
  state.removedCustom = new Set();
  state.coverAction = 'keep';
  state.coverChosen = null;
  state.outputBase = 'rusak';

  state.history.restore(snapshot);
  assert.deepEqual(state.values, { title: 'Asli', artist: 'Artis' });
  assert.ok(state.removedFields instanceof Set);
  assert.deepEqual([...state.removedFields], ['artist']);
  assert.equal(state.customRows.length, 1);
  assert.equal(state.customRows[0].key, 'MOOD');
  assert.ok(state.removedCustom instanceof Set);
  assert.deepEqual([...state.removedCustom], ['MOOD']);
  assert.equal(state.coverAction, 'set');
  assert.equal(state.coverChosen.name, 'new.png');
  assert.equal(state.outputBase, 'lain');
});

test('snapshot and restore never touch the baselines or the loaded file', () => {
  const state = seededState();
  const snapshot = state.history.snapshot();
  for (const key of ['originalValues', 'customBaseline', 'coverOriginal', 'coverOriginalBytes', 'file', 'readResult', 'detection', 'adapter']) {
    assert.equal(Object.hasOwn(snapshot, key), false, `${key} must not be part of a snapshot`);
  }
  state.values = { title: 'Ubah' };
  state.customRows = [];
  state.coverAction = 'remove';
  state.history.restore(snapshot);
  assert.deepEqual(state.originalValues, { title: 'Asli', artist: 'Artis' });
  assert.equal(state.customBaseline.length, 1);
  assert.equal(state.coverOriginal.name, 'cover.jpg');
  assert.deepEqual([...state.coverOriginalBytes], [1, 2, 3]);
  assert.equal(state.file.name, 'file.mp3');
  assert.equal(state.readResult.fields.title, 'Asli');
  assert.equal(state.detection.id, 'mp3');
  assert.equal(state.adapter.meta.id, 'mp3');
});

test('restored rows and sets are copies, not shared references', () => {
  const state = seededState();
  const snapshot = state.history.snapshot();
  state.customRows[0].value = 'Berubah';
  state.removedFields.add('artist');
  state.history.restore(snapshot);
  assert.equal(state.customRows[0].value, 'Calm');
  state.customRows[0].value = 'Ubah lagi';
  assert.equal(snapshot.customRows[0].value, 'Calm');
});

test('consecutive edits with the same key collapse into one history entry', () => {
  const state = seededState();
  beginChange(state.history, 'field:title');
  state.values.title = 'a';
  beginChange(state.history, 'field:title');
  state.values.title = 'ab';
  beginChange(state.history, 'field:title');
  state.values.title = 'abc';
  assert.equal(state.history.past.length, 1);
  assert.equal(undo(state.history), true);
  assert.equal(state.values.title, 'Asli');
});

test('a different key starts a new history entry', () => {
  const state = seededState();
  beginChange(state.history, 'field:title');
  state.values.title = 'a';
  beginChange(state.history, 'field:artist');
  state.values.artist = 'b';
  assert.equal(state.history.past.length, 2);
  assert.equal(undo(state.history), true);
  assert.equal(state.values.artist, 'Artis');
  assert.equal(state.values.title, 'a');
});

test('endChange closes the coalescing run so the next edit is recorded again', () => {
  const state = seededState();
  beginChange(state.history, 'field:title');
  state.values.title = 'a';
  endChange(state.history);
  beginChange(state.history, 'field:title');
  state.values.title = 'b';
  assert.equal(state.history.past.length, 2);
  assert.equal(undo(state.history), true);
  assert.equal(state.values.title, 'a');
  assert.equal(undo(state.history), true);
  assert.equal(state.values.title, 'Asli');
});

test('undo and redo walk the changes in order', () => {
  const state = seededState();
  beginChange(state.history, 'field:title');
  state.values.title = 'satu';
  beginChange(state.history, 'field:artist');
  state.values.artist = 'dua';
  beginChange(state.history, 'cover:set');
  state.coverAction = 'set';
  state.coverChosen = { name: 'a.png' };

  assert.equal(canUndo(state.history), true);
  assert.equal(canRedo(state.history), false);
  assert.equal(undo(state.history), true);
  assert.equal(state.coverAction, 'keep');
  assert.equal(state.coverChosen, null);
  assert.equal(undo(state.history), true);
  assert.equal(state.values.artist, 'Artis');
  assert.equal(canRedo(state.history), true);
  assert.equal(undo(state.history), true);
  assert.equal(state.values.title, 'Asli');
  assert.equal(undo(state.history), false);

  assert.equal(redo(state.history), true);
  assert.equal(state.values.title, 'satu');
  assert.equal(redo(state.history), true);
  assert.equal(state.values.artist, 'dua');
  assert.equal(redo(state.history), true);
  assert.equal(state.coverAction, 'set');
  assert.equal(state.coverChosen.name, 'a.png');
  assert.equal(redo(state.history), false);
});

test('a new change drops the redo stack', () => {
  const state = seededState();
  beginChange(state.history, 'field:title');
  state.values.title = 'satu';
  undo(state.history);
  assert.equal(canRedo(state.history), true);
  beginChange(state.history, 'field:artist');
  state.values.artist = 'baru';
  assert.equal(canRedo(state.history), false);
  assert.equal(state.history.future.length, 0);
});

test('clearHistory empties both stacks', () => {
  const state = seededState();
  beginChange(state.history, 'field:title');
  state.values.title = 'satu';
  undo(state.history);
  assert.equal(canUndo(state.history), false);
  assert.equal(canRedo(state.history), true);
  clearHistory(state.history);
  assert.equal(canUndo(state.history), false);
  assert.equal(canRedo(state.history), false);
  assert.equal(state.history.past.length, 0);
  assert.equal(state.history.future.length, 0);
});

test('editor history keeps label and timestamp arrays in sync with undo and clear', () => {
  const state = seededState();
  beginChange(state.history, 'field:title', 'Edit Judul');
  state.values.title = 'Ubah';
  assert.equal(state.history.past.length, 1);
  assert.deepEqual(state.history.pastLabels, ['Edit Judul']);
  assert.equal(state.history.pastTimes.length, 1);
  assert.equal(typeof state.history.pastTimes[0], 'number');

  assert.equal(undo(state.history), true);
  assert.equal(state.values.title, 'Asli');
  assert.deepEqual(state.history.pastLabels, []);
  assert.deepEqual(state.history.futureLabels, ['Edit Judul']);
  assert.equal(state.history.futureTimes.length, 1);

  clearHistory(state.history);
  assert.deepEqual(state.history.pastLabels, []);
  assert.deepEqual(state.history.futureLabels, []);
  assert.deepEqual(state.history.pastTimes, []);
  assert.deepEqual(state.history.futureTimes, []);
});

test('trim and sidecar are copied into and restored from the snapshot', () => {
  const state = seededState();
  state.trim = { start: 1.5, end: 4.5, mode: 'keep' };
  state.sidecar = { cues: [{ start: 0, end: 1, text: 'halo' }], nested: { v: 2 } };

  const snapshot = state.history.snapshot();
  assert.deepEqual(snapshot.trim, { start: 1.5, end: 4.5, mode: 'keep' });
  assert.deepEqual(snapshot.sidecar, { cues: [{ start: 0, end: 1, text: 'halo' }], nested: { v: 2 } });

  state.trim = null;
  state.sidecar = null;
  state.history.restore(snapshot);
  assert.deepEqual(state.trim, { start: 1.5, end: 4.5, mode: 'keep' });
  assert.deepEqual(state.sidecar, { cues: [{ start: 0, end: 1, text: 'halo' }], nested: { v: 2 } });

  // Salinan, bukan referensi bersama dengan snapshot.
  state.sidecar.cues[0].text = 'diubah';
  state.trim.start = 99;
  assert.equal(snapshot.sidecar.cues[0].text, 'halo');
  assert.equal(snapshot.trim.start, 1.5);
});
