/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t } from '../i18n/index.js';
import { asArray, asString, validateCustomKey } from '../core/tag-utils.js';
import { canRedo, canUndo } from '../core/history.js';
import { PDF_STANDARD_KEYS } from './editor-state.js';
import { setEditingNavigation, singleEditing } from '../ui/editing-navigation.js';
import { setReloadUnsafe } from '../core/reload-guard.js';
export function inputSame(a, b, field) {
  if (field.type === 'tags') return JSON.stringify(asArray(a)) === JSON.stringify(asArray(b));
  return asString(a).trim() === asString(b).trim();
}
export function collectChanges(state, { validate = false } = {}) {
  const errors = [];
  const set = {};
  const remove = [];
  const fields = typeof state.adapter.fieldsFor === 'function'
    ? state.adapter.fieldsFor(state.detection.subtype)
    : (state.adapter?.fields || []);
  for (const field of fields) {
    const original = asString(state.originalValues[field.id]).trim();
    if (state.removedFields.has(field.id)) {
      if (original) remove.push(field.id);
      continue;
    }
    const current = asString(state.values[field.id]);
    if (inputSame(current, state.originalValues[field.id], field)) continue;
    if (!current.trim()) {
      if (original) remove.push(field.id);
    } else {
      set[field.id] = field.type === 'tags' ? asArray(current) : current;
    }
  }
  const custom = [];
  const customRemove = new Set(state.removedCustom);
  const seen = new Map();
  for (const row of state.customRows) {
    const key = asString(row.key).trim();
    const value = asString(row.value);
    if (!key && !value.trim()) continue;
    if (!key) {
      errors.push('Nama tag kustom belum diisi.');
      continue;
    }
    if (validate) {
      const keyError = validateCustomKey(key);
      if (keyError) errors.push(`Tag "${key}": ${keyError}`);
      if (state.adapter.meta.id === 'pdf' && PDF_STANDARD_KEYS.has(key)) {
        errors.push(`Key "${key}" adalah metadata standar PDF. Gunakan field yang tersedia.`);
      }
      const lower = key.toLowerCase();
      if (seen.has(lower)) {
        errors.push(`Tag kustom "${key}" ditulis lebih dari sekali.`);
      }
      seen.set(lower, true);
    }
    const originalKey = row.originalKey ? asString(row.originalKey) : '';
    const keyChanged = Boolean(originalKey && originalKey !== key);
    const valueChanged = asString(row.originalValue) !== value;
    const isNew = !originalKey;
    if (keyChanged) customRemove.add(originalKey);
    if (key && (isNew || keyChanged || valueChanged)) {
      if (value.trim()) custom.push({ key, value });
      else if (originalKey) customRemove.add(originalKey);
    }
  }
  const customKeys = new Set(custom.map((item) => item.key.toLowerCase()));
  for (const key of [...customRemove]) {
    if (customKeys.has(String(key).toLowerCase())) customRemove.delete(key);
  }
  const cover = state.coverAction === 'keep'
    ? null
    : state.coverAction === 'remove'
      ? { action: 'remove' }
      : {
        action: 'set',
        data: state.coverChosen?.data,
        mimeType: state.coverChosen?.mimeType,
        name: state.coverChosen?.name,
        kind: 'coverFront',
      };
  const coverCount = cover ? 1 : 0;
  const count = Object.keys(set).length + new Set(remove).size + custom.length + customRemove.size + coverCount;
  return {
    payload: { set, remove: [...new Set(remove)], custom, customRemove: [...customRemove], ...(cover ? { cover } : {}) },
    errors,
    count,
  };
}
export function syncActionBar(els, state) {
  const ready = state.status === 'ready';
  const changes = ready ? collectChanges(state) : { count: 0 };
  const count = changes.count;
  state.dirtyCount = count;
  setEditingNavigation(singleEditing(state, count));
  setReloadUnsafe('editor-dirty', state.processing || count > 0);
  const canSave = state.processing || (ready && count > 0);

  bindTranslation(els.dirtyState, 'textContent', () => (state.processing
    ? t('ui.processing')
    : count > 0
      ? t('ui.changesReadyToSave', { v0: count })
      : t('ui.noChangesYet')));
  els.dirtyDot.classList.toggle('is-dirty', count > 0 && !state.processing);
  els.saveBtn.disabled = !canSave;
  els.saveBtn.classList.toggle('is-spinning', false);
  bindTranslation(els.saveLabel, 'textContent', () => (state.processing ? t('ui.cancel2') : t('ui.saveDownload')));
  els.resetBtn.disabled = state.processing || !ready || count === 0;
  els.outputBase.disabled = state.processing;
  if (els.undoBtn) els.undoBtn.disabled = state.processing || !canUndo(state.history);
  if (els.redoBtn) els.redoBtn.disabled = state.processing || !canRedo(state.history);
  if (state.detection) {
    els.outputBase.value = state.outputBase;
    els.outputExt.textContent = `.${state.detection.ext}`;
  }
}
