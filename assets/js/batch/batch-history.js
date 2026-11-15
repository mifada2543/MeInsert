/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Riwayat undo/redo per grup format pada mode batch.
//
// Setiap grup format punya stack sendiri, jadi membatalkan perubahan di grup
// MP3 tidak boleh menyentuh grup PDF. Cakupan snapshot sengaja hanya memuat
// nilai field milik grup dan flag "hapus tag" grup. Field lintas format
// (this.cross), penghapusan tag mentah per file (item.removeRaw), dan centang
// file berada di luar riwayat — undo tidak boleh menimpa atau membersihkannya.
//
// Modul ini murni logika (tanpa DOM) supaya bisa diuji unit tanpa browser.
import { beginChange, canRedo, canUndo, clearHistory, createHistory, endChange, redo, undo } from '../core/history.js';

/** Kunci perubahan untuk coalescing riwayat: satu field grup. */
export function groupFieldChangeKey(groupKey, fieldId) {
  return `group:${groupKey}:${fieldId}`;
}

/** Kunci perubahan untuk coalescing riwayat: tombol hapus tag satu field. */
export function groupRemoveChangeKey(groupKey, fieldId) {
  return `group:${groupKey}:remove:${fieldId}`;
}

/** Kunci perubahan untuk coalescing riwayat: tombol "Bersihkan input". */
export function groupResetChangeKey(groupKey) {
  return `group:${groupKey}:reset`;
}

/**
 * Ambil snapshot state sebuah grup. Mengembalikan `null` kalau grup sudah
 * tidak ada, sehingga `beginChange` tidak mencatat apa pun.
 */
export function snapshotGroupState(group) {
  if (!group) return null;
  return {
    values: { ...(group.values || {}) },
    remove: [...(group.remove || [])],
  };
}

/**
 * Terapkan snapshot ke grup yang sedang aktif. Hanya `values` dan `remove`
 * yang ditulis; tidak ada state lain yang disentuh.
 */
export function restoreGroupState(group, snapshot) {
  if (!group || !snapshot) return false;
  group.values = { ...(snapshot.values || {}) };
  group.remove = new Set(snapshot.remove || []);
  return true;
}

/**
 * Controller riwayat untuk semua grup format.
 *
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
    /** Stack riwayat milik satu grup (dibuat saat pertama kali dipakai). */
    history: (key) => historyFor(key),
    /** Catat state sebelum perubahan; key sama digabung jadi satu entri. */
    begin(key, changeKey) {
      beginChange(historyFor(key), changeKey);
    },
    /** Tutup rentang coalescing tanpa mencatat apa pun. */
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
    /** Kosongkan stack satu grup. */
    clear(key) {
      clearHistory(histories.get(key));
    },
    /** Kosongkan stack semua grup. */
    clearAll() {
      for (const history of histories.values()) clearHistory(history);
    },
  };
}
