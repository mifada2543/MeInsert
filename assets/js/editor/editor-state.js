/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
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
    fileReadyAnnounced: false,
    readResult: null,
    baselineSnapshot: null,
    readError: null,
    values: {},
    originalValues: {},
    removedFields: new Set(),
    rawRemove: new Set(),
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
    sidecar: null,
    originalSidecar: null,
    trim: null,
    coverOriginal: null,
    coverOriginalBytes: null,
    coverPreviewUrl: null,
    coverAction: 'keep',
    coverChosen: null,
  };
  state.history = createHistory({
    snapshot: () => ({
      values: { ...state.values },
      removedFields: [...state.removedFields],
      rawRemove: [...state.rawRemove],
      customRows: cloneRows(state.customRows),
      removedCustom: [...state.removedCustom],
      coverAction: state.coverAction,
      coverChosen: state.coverChosen ? { ...state.coverChosen } : null,
      sidecar: cloneSidecar(state.sidecar),
      trim: cloneTrim(state.trim),
      outputBase: state.outputBase,
    }),
    restore: (snapshot) => {
      state.values = { ...snapshot.values };
      state.removedFields = new Set(snapshot.removedFields);
      state.rawRemove = new Set(snapshot.rawRemove || []);
      state.customRows = cloneRows(snapshot.customRows);
      state.removedCustom = new Set(snapshot.removedCustom);
      state.coverAction = snapshot.coverAction;
      state.coverChosen = snapshot.coverChosen ? { ...snapshot.coverChosen } : null;
      state.sidecar = cloneSidecar(snapshot.sidecar);
      state.trim = cloneTrim(snapshot.trim);
      state.outputBase = snapshot.outputBase;
    },
  });
  return state;
}
export function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}
function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = cloneValue(item);
    return out;
  }
  return value;
}
export function cloneSidecar(sidecar) {
  return sidecar && typeof sidecar === 'object' ? cloneValue(sidecar) : null;
}
export function cloneTrim(trim) {
  if (!trim || typeof trim !== 'object') return null;
  return { start: trim.start, end: trim.end, mode: trim.mode };
}
export function setTrim(state, trim) {
  state.trim = cloneTrim(trim);
  return state.trim;
}
export function setSidecar(state, sidecar) {
  state.sidecar = cloneSidecar(sidecar);
  return state.sidecar;
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