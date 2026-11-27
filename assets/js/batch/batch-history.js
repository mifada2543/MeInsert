/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Riwayat undo/redo per grup format pada mode batch.
// Modul ini murni logika (tanpa DOM) supaya bisa diuji unit tanpa browser.
import { beginChange, canRedo, canUndo, clearHistory, createHistory, endChange, redo, undo } from '../core/history.js';
import { t } from '../i18n/index.js';
export function groupFieldChangeKey(groupKey, fieldId) {
  return `group:${groupKey}:${fieldId}`;
}
export function groupRemoveChangeKey(groupKey, fieldId) {
  return `group:${groupKey}:remove:${fieldId}`;
}
export function groupResetChangeKey(groupKey) {
  return `group:${groupKey}:reset`;
}
export function snapshotGroupState(group) {
  if (!group) return null;
  return {
    values: { ...(group.values || {}) },
    remove: [...(group.remove || [])],
    ...(group.itemPatches ? { itemPatches: structuredClone(group.itemPatches) } : {}),
    ...(group.itemRawRemovals ? { itemRawRemovals: structuredClone(group.itemRawRemovals) } : {}),
  };
}
export function restoreGroupState(group, snapshot) {
  if (!group || !snapshot) return false;
  group.values = { ...(snapshot.values || {}) };
  group.remove = new Set(snapshot.remove || []);
  group.itemPatches = snapshot.itemPatches ? structuredClone(snapshot.itemPatches) : undefined;
  group.itemRawRemovals = snapshot.itemRawRemovals ? structuredClone(snapshot.itemRawRemovals) : undefined;
  return true;
}
/**
 * Controller riwayat untuk semua grup format.
 * @param {object} options
 * @param {(key: string) => object|null} options.getGroup resolver grup saat ini
 *   berdasarkan kunci grup (dipakai agar snapshot/restore selalu bekerja
 *   pada objek grup yang aktif, bukan salinan lama).
 * @param {Map<string, object>} [options.histories] map stack yang dipakai;
 *   bila diisi, stack yang sama dipakai controller (cocok untuk
 *   `this.groupHistories`).
 */
export function createGroupHistoryController({ getGroup, histories = new Map() } = {}) {
  const resolve = typeof getGroup === 'function' ? getGroup : () => null;
  function historyFor(key) {
    let history = histories.get(key);
    if (!history) {
      history = createHistory({
        snapshot: () => snapshotGroupState(resolve(key)),
        restore: (snapshot) => restoreGroupState(resolve(key), snapshot),
      });
      histories.set(key, history);
    }
    return history;
  }
  return {
    histories,
    history: (key) => historyFor(key),
    begin(key, changeKey) {
      beginChange(historyFor(key), changeKey, t('ui.changeHistoryField', { v0: 'Batch' }));
    },
    end(key) {
      endChange(historyFor(key));
    },
    undo(key) {
      const history = histories.get(key);
      return history ? undo(history) : false;
    },
    redo(key) {
      const history = histories.get(key);
      return history ? redo(history) : false;
    },
    canUndo(key) {
      return canUndo(histories.get(key));
    },
    canRedo(key) {
      return canRedo(histories.get(key));
    },
    clear(key) {
      clearHistory(histories.get(key));
    },
    clearAll() {
      for (const history of histories.values()) clearHistory(history);
    },
  };
}