import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGroupHistoryController,
  groupFieldChangeKey,
  groupRemoveChangeKey,
  groupResetChangeKey,
  restoreGroupState,
  snapshotGroupState,
} from '../../assets/js/batch/batch-history.js';

function makeGroup(key, label) {
  return {
    key,
    label,
    fields: [],
    values: { title: '', artist: '' },
    remove: new Set(),
    items: [],
  };
}

/**
 * Dua grup format (MP3 dan PDF) plus state lintas format dan penghapusan
 * tag mentah per file — keduanya di luar cakupan riwayat.
 */
function setup() {
  const mp3 = makeGroup('mp3:mp3', 'MP3');
  const pdf = makeGroup('pdf:pdf', 'PDF');
  const groups = new Map([[mp3.key, mp3], [pdf.key, pdf]]);
  const controller = createGroupHistoryController({
    getGroup: (key) => groups.get(key) || null,
  });
  const cross = { values: { title: 'Lintas format' }, remove: new Set(['artist']) };
  const item = { id: 'file-1', removeRaw: new Set(['TXXX:custom']) };
  mp3.items.push(item);
  return { mp3, pdf, groups, controller, cross, item };
}

test('change keys are namespaced per group, field, and action', () => {
  assert.equal(groupFieldChangeKey('mp3:mp3', 'title'), 'group:mp3:mp3:title');
  assert.equal(groupRemoveChangeKey('mp3:mp3', 'title'), 'group:mp3:mp3:remove:title');
  assert.equal(groupResetChangeKey('mp3:mp3'), 'group:mp3:mp3:reset');
});

test('each format group keeps an independent undo stack', () => {
  const { mp3, pdf, controller } = setup();
  pdf.values.title = 'PDF Lama';

  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  mp3.values.title = 'MP3 Baru';

  assert.equal(controller.canUndo(mp3.key), true);
  assert.equal(controller.canUndo(pdf.key), false);

  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '', 'undo harus mengembalikan nilai grup MP3');
  assert.equal(pdf.values.title, 'PDF Lama', 'undo grup MP3 tidak boleh menyentuh grup PDF');
  assert.equal(controller.canUndo(pdf.key), false);
});

test('undo in one group never applies the snapshot of another group', () => {
  const { mp3, pdf, controller } = setup();
  controller.begin(pdf.key, groupFieldChangeKey(pdf.key, 'title'));
  pdf.values.title = 'PDF Baru';
  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  mp3.values.title = 'MP3 Baru';

  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '');
  assert.equal(pdf.values.title, 'PDF Baru');

  assert.equal(controller.undo(pdf.key), true);
  assert.equal(pdf.values.title, '');
});

test('snapshot and restore never write cross fields or per-file raw removals', () => {
  const { mp3, controller, cross, item } = setup();
  const crossValuesBefore = { ...cross.values };
  const crossRemoveBefore = [...cross.remove];
  const removeRawBefore = [...item.removeRaw];

  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  mp3.values.title = 'MP3 Baru';
  mp3.remove.add('artist');
  assert.equal(controller.undo(mp3.key), true);

  assert.deepEqual(cross.values, crossValuesBefore, 'cross.values tidak boleh ditulis undo');
  assert.deepEqual([...cross.remove], crossRemoveBefore, 'cross.remove tidak boleh ditulis undo');
  assert.deepEqual([...item.removeRaw], removeRawBefore, 'removeRaw tidak boleh ditulis undo');
  assert.equal(item.removeRaw.size, 1);
  assert.equal(cross.remove.has('artist'), true);
  assert.deepEqual([...mp3.remove], [], 'undo hanya menyentuh flag remove milik grup');
});

test('restore keeps everything outside the group values and remove flags', () => {
  const { mp3 } = setup();
  mp3.label = 'MP3';
  const snapshot = snapshotGroupState(mp3);
  mp3.values.title = 'Berubah';
  mp3.remove.add('artist');
  mp3.label = 'Label lain';

  assert.equal(restoreGroupState(mp3, snapshot), true);
  assert.equal(mp3.values.title, '');
  assert.equal(mp3.remove.size, 0);
  assert.equal(mp3.label, 'Label lain', 'label grup bukan bagian dari snapshot');
  assert.equal(mp3.items.length, 1, 'item grup bukan bagian dari snapshot');
});

test('clearHistory empties the stack of one group only', () => {
  const { mp3, pdf, controller } = setup();
  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  mp3.values.title = 'MP3 Baru';
  controller.begin(pdf.key, groupFieldChangeKey(pdf.key, 'title'));
  pdf.values.title = 'PDF Baru';

  controller.clear(mp3.key);
  assert.equal(controller.canUndo(mp3.key), false);
  assert.equal(controller.canRedo(mp3.key), false);
  assert.equal(controller.undo(mp3.key), false);
  assert.equal(mp3.values.title, 'MP3 Baru', 'undo tidak boleh bekerja setelah stack dikosongkan');

  assert.equal(controller.canUndo(pdf.key), true, 'stack grup lain tetap utuh');
  assert.equal(controller.undo(pdf.key), true);
  assert.equal(pdf.values.title, '');
});

test('two consecutive edits to the same field collapse into one history entry', () => {
  const { mp3, controller } = setup();
  const key = groupFieldChangeKey(mp3.key, 'title');

  controller.begin(mp3.key, key);
  mp3.values.title = 'a';
  controller.begin(mp3.key, key);
  mp3.values.title = 'ab';

  assert.equal(controller.histories.get(mp3.key).past.length, 1, 'dua edit berurutan jadi satu entri');
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '', 'undo satu kali mengembalikan nilai awal');
  assert.equal(controller.canUndo(mp3.key), false);
});

test('edits to different fields of the same group produce separate entries', () => {
  const { mp3, controller } = setup();
  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  mp3.values.title = 'Judul';
  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'artist'));
  mp3.values.artist = 'Artis';

  assert.equal(controller.histories.get(mp3.key).past.length, 2);
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.artist, '');
  assert.equal(mp3.values.title, 'Judul');
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '');
});

test('remove flags and the clear action are undoable', () => {
  const { mp3, controller } = setup();
  controller.begin(mp3.key, groupRemoveChangeKey(mp3.key, 'artist'));
  mp3.remove.add('artist');
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.remove.has('artist'), false);

  controller.begin(mp3.key, groupResetChangeKey(mp3.key));
  mp3.values.title = 'Judul';
  mp3.values.artist = 'Artis';
  mp3.remove.add('artist');
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '');
  assert.equal(mp3.values.artist, '');
  assert.equal(mp3.remove.size, 0);
});

test('redo replays the undone change of the same group only', () => {
  const { mp3, pdf, controller } = setup();
  pdf.values.title = 'PDF Lama';
  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  mp3.values.title = 'MP3 Baru';

  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '');
  assert.equal(controller.canRedo(mp3.key), true);
  assert.equal(controller.canRedo(pdf.key), false);

  assert.equal(controller.redo(mp3.key), true);
  assert.equal(mp3.values.title, 'MP3 Baru');
  assert.equal(pdf.values.title, 'PDF Lama');
});

test('history of a vanished group records nothing', () => {
  const { mp3, groups, controller } = setup();
  groups.delete(mp3.key);
  controller.begin(mp3.key, groupFieldChangeKey(mp3.key, 'title'));
  assert.equal(controller.canUndo(mp3.key), false);
  assert.equal(snapshotGroupState(null), null);
});

test('ending a typing session separates subsequent edits to the same field', () => {
  const { mp3, controller } = setup();
  const key = groupFieldChangeKey(mp3.key, 'title');
  controller.begin(mp3.key, key);
  mp3.values.title = 'First';
  controller.begin(mp3.key, key);
  mp3.values.title = 'First session';
  controller.end(mp3.key);
  controller.begin(mp3.key, key);
  mp3.values.title = 'Second session';
  controller.end(mp3.key);

  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, 'First session');
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '');
  assert.equal(controller.canUndo(mp3.key), false);
});

test('ending discrete remove actions preserves every consecutive click', () => {
  const { mp3, pdf, controller } = setup();
  const key = groupRemoveChangeKey(mp3.key, 'title');
  for (let click = 0; click < 2; click += 1) {
    controller.end(mp3.key);
    controller.begin(mp3.key, key);
    if (mp3.remove.has('title')) mp3.remove.delete('title');
    else mp3.remove.add('title');
    controller.end(mp3.key);
  }
  assert.equal(controller.histories.get(mp3.key).past.length, 2);
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.remove.has('title'), true);
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.remove.has('title'), false);
  assert.equal(controller.redo(mp3.key), true);
  assert.equal(mp3.remove.has('title'), true);
  assert.equal(controller.redo(mp3.key), true);
  assert.equal(mp3.remove.has('title'), false);
  assert.equal(controller.canUndo(pdf.key), false);
});

test('ending discrete reset actions prevents consecutive clears coalescing', () => {
  const { mp3, controller } = setup();
  mp3.values.title = 'Original';
  mp3.remove.add('artist');
  for (let click = 0; click < 2; click += 1) {
    controller.end(mp3.key);
    controller.begin(mp3.key, groupResetChangeKey(mp3.key));
    mp3.values.title = '';
    mp3.remove.clear();
    controller.end(mp3.key);
  }
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, '');
  assert.equal(controller.undo(mp3.key), true);
  assert.equal(mp3.values.title, 'Original');
  assert.deepEqual([...mp3.remove], ['artist']);
});
