/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString, fileBaseName, safeOutputName, toDateInput } from '../core/tag-utils.js';
import { createHistory } from '../core/history.js';
export const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024;
export const PDF_STANDARD_KEYS = new Set([
  'Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer',
  'CreationDate', 'ModDate', 'Trapped', 'Metadata',
]);
export function createEditorState() {
  const state = {
    file: null,
    detection: null,
    adapter: null,
    status: 'idle',
    readResult: null,
    baselineSnapshot: null,
    readError: null,
    values: {},
    originalValues: {},
    removedFields: new Set(),
    customRows: [],
    customBaseline: [],
    removedCustom: new Set(),
    customUid: 0,
    outputName: '',
    outputBase: '',
    result: null,
    saveError: null,
    activeTab: 'metadata',
    processing: false,
    readToken: 0,
    previewUrl: null,
    previewMinimized: false,
    detectionWarning: '',
    sideSignature: '',
    coverOriginal: null,
    coverOriginalBytes: null,
    coverPreviewUrl: null,
    coverAction: 'keep',
    coverChosen: null,
  };
  // The undo/redo stack only knows about the editable surface. The baselines
  // (originalValues, customBaseline, coverOriginal, coverOriginalBytes) and
  // the loaded file (file, readResult, detection, adapter) are never part of a
  // snapshot, so undoing can never roll the file back to another file.
  state.history = createHistory({
    snapshot: () => ({
      values: { ...state.values },
      removedFields: [...state.removedFields],
      customRows: cloneRows(state.customRows),
      removedCustom: [...state.removedCustom],
      coverAction: state.coverAction,
      coverChosen: state.coverChosen ? { ...state.coverChosen } : null,
      outputBase: state.outputBase,
    }),
    restore: (snapshot) => {
      state.values = { ...snapshot.values };
      state.removedFields = new Set(snapshot.removedFields);
      state.customRows = cloneRows(snapshot.customRows);
      state.removedCustom = new Set(snapshot.removedCustom);
      state.coverAction = snapshot.coverAction;
      state.coverChosen = snapshot.coverChosen ? { ...snapshot.coverChosen } : null;
      state.outputBase = snapshot.outputBase;
    },
  });
  return state;
}
export function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}
export function valuesFromFields(adapter, fields = {}) {
  const values = {};
  for (const field of adapter?.fields || []) {
    const value = fields[field.id];
    if (value === undefined || value === null) {
      values[field.id] = '';
    } else if (field.type === 'tags') {
      values[field.id] = asArray(value).join(', ');
    } else if (field.type === 'date') {
      values[field.id] = toDateInput(value);
    } else {
      values[field.id] = asString(value);
    }
  }
  return values;
}
export function makeRows(state, custom = []) {
  return (custom || []).filter(Boolean).map((row) => ({
    uid: ++state.customUid,
    key: asString(row.key),
    value: asString(row.value),
    originalKey: row.originalKey === undefined ? asString(row.key) : asString(row.originalKey),
    originalValue: row.originalValue === undefined ? asString(row.value) : asString(row.originalValue),
  }));
}
export function sanitizeBasename(value) {
  const base = safeOutputName(value, '')
    .replace(/^[. ]+/, '')
    .replace(/[. ]+$/, '')
    .trim();
  return base || 'file';
}
export function defaultOutputName(file) {
  const base = fileBaseName(file?.name || 'file');
  return `${safeOutputName(base, 'file')}-meinsert`;
}