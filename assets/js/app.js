import { detectFile } from './core/detector.js';
import { adapterForDetection, fieldsBySection } from './core/registry.js';
import { MetadataClient } from './core/worker-client.js';
import {
  asArray,
  asString,
  fileBaseName,
  safeOutputName,
  sameValue,
  toDateInput,
  validateCustomKey,
} from './core/tag-utils.js';
import { el, clear, qs, formatBytes } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { renderFileCard, setCardMinimized, previewKind } from './ui/file-card.js';
import { renderForm, syncFormState, renderCoverBlock } from './ui/form-view.js';
import { renderRaw } from './ui/raw-view.js';
import { renderResultCard } from './ui/result-view.js';
import { showToast } from './ui/toast.js';
import { isSupportedCover, mimeOf } from './core/image-utils.js';
import { initTheme } from './ui/theme.js';
import { registerServiceWorker } from './core/pwa.js';

registerServiceWorker();

const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024;
const PDF_STANDARD_KEYS = new Set([
  'Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer',
  'CreationDate', 'ModDate', 'Trapped', 'Metadata',
]);

const els = {
  landing: qs('#landing'),
  workspace: qs('#workspace'),
  dropCard: qs('#dropCard'),
  fileInput: qs('#fileInput'),
  browseBtn: qs('#browseBtn'),
  newFileBtn: qs('#newFileBtn'),
  readStatus: qs('#readStatus'),

  fileCard: qs('#fileCard'),
  previewDock: qs('#previewDock'),
  panel: qs('#panel'),
  tabs: [...document.querySelectorAll('#workspace .tab')],
  rawCount: qs('#rawCount'),
  editorBadge: qs('#editorBadge'),
  actionBar: qs('#actionBar'),
  dirtyDot: qs('#dirtyDot'),
  dirtyState: qs('#dirtyState'),
  outputBase: qs('#outputBase'),
  outputExt: qs('#outputExt'),
  resetBtn: qs('#resetBtn'),
  saveBtn: qs('#saveBtn'),
  saveLabel: qs('#saveLabel'),
  progress: qs('#progress'),
  progressBar: qs('#progressBar'),
  progressLabel: qs('#progressLabel'),

  toastRegion: qs('#toastRegion'),
};

const client = new MetadataClient();
const page = document.body?.dataset.page || 'single';
if (page === 'batch') {
  // Batch UI + ZIP tooling are only needed on the batch page. Keep them out of
  // the single-file entry so that page stays small.
  import('./batch/batch-view.js')
    .then(({ BatchController }) => new BatchController(client))
    .catch((error) => {
      console.error('Meinsert gagal memuat mode batch:', error);
    });
}

const state = {
  file: null,
  detection: null,
  adapter: null,
  status: 'idle',
  readResult: null,
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

const handlers = {
  onFieldChange(id, value) {
    state.values[id] = value;
    state.removedFields.delete(id);
    syncActionBar();
  },
  onFieldClear(id) {
    state.values[id] = '';
    state.removedFields.add(id);
    syncActionBar();
  },
  onAddCustom() {
    state.customRows.push({
      uid: ++state.customUid,
      key: '',
      value: '',
      originalKey: null,
      originalValue: '',
    });
    syncActionBar();
  },
  onCustomChange(uid, part, value) {
    const row = state.customRows.find((item) => item.uid === uid);
    if (!row) return;
    row[part] = value;
    syncActionBar();
  },
  onCustomDelete(uid) {
    const index = state.customRows.findIndex((item) => item.uid === uid);
    if (index < 0) return;
    const [row] = state.customRows.splice(index, 1);
    if (row.originalKey) state.removedCustom.add(row.originalKey);
    syncActionBar();
  },
  onCoverChooseFile(file) {
    (async () => {
      const bytes = await file.arrayBuffer();
      const u8 = new Uint8Array(bytes);
      if (file.size > 10 * 1024 * 1024 || bytes.byteLength > 10 * 1024 * 1024) {
        showToast('Gambar terlalu besar. Maksimal 10 MB.', 'error', 6000);
        return;
      }
      if (!isSupportedCover(u8)) {
        showToast('Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP.', 'error', 6000);
        return;
      }
      state.coverChosen = { data: u8, mimeType: file.type || mimeOf(u8), name: file.name };
      state.coverAction = 'set';
      refreshCoverPreview();
      refreshCoverUI();
      syncActionBar();
    })().catch((error) => showToast(`Gagal membaca gambar: ${error?.message || error}`, 'error', 6000));
  },
  onCoverRemove() {
    state.coverAction = 'remove';
    state.coverChosen = null;
    refreshCoverPreview();
    refreshCoverUI();
    syncActionBar();
  },
  onCoverUndo() {
    state.coverAction = 'keep';
    state.coverChosen = null;
    refreshCoverPreview();
    refreshCoverUI();
    syncActionBar();
  },
};

function revokeCoverPreview() {
  if (state.coverPreviewUrl) {
    URL.revokeObjectURL(state.coverPreviewUrl);
    state.coverPreviewUrl = null;
  }
}

function coverBytesForPreview() {
  if (state.coverAction === 'set' && state.coverChosen?.data) return state.coverChosen.data;
  if (state.coverAction === 'keep' && state.coverOriginalBytes) return state.coverOriginalBytes;
  return null;
}

function refreshCoverPreview() {
  revokeCoverPreview();
  const bytes = coverBytesForPreview();
  if (!bytes) return;
  const mime = state.coverAction === 'set' ? state.coverChosen?.mimeType : state.coverOriginal?.mimeType;
  state.coverPreviewUrl = URL.createObjectURL(new Blob([bytes], { type: mime || 'image/jpeg' }));
}

function resetCoverState() {
  state.coverOriginal = null;
  state.coverOriginalBytes = null;
  state.coverAction = 'keep';
  state.coverChosen = null;
  revokeCoverPreview();
}

function applyReadCover(result) {
  state.coverOriginal = result.cover || null;
  state.coverOriginalBytes = result.coverBytes || null;
  state.coverAction = 'keep';
  state.coverChosen = null;
  refreshCoverPreview();
}

function refreshCoverUI() {
  const block = els.panel.querySelector('.cover-block');
  if (block) block.replaceWith(renderCoverBlock(state.adapter, state, handlers));
  // Audio cards host the thumbnail next to the player, so refresh that too.
  renderSide();
  scheduleDockUpdate();
}

function setIcons() {
  qs('#newFileBtn .icon')?.replaceChildren(icon('arrowLeft'));
  qs('#saveBtn .icon')?.replaceChildren(icon('download'));
  qs('#year').textContent = String(new Date().getFullYear());
}

function setStatus(text, isError = false) {
  els.readStatus.textContent = text;
  els.readStatus.classList.toggle('is-error', isError);
}

function setProgress(percent, label) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  els.progressBar.style.width = `${pct}%`;
  if (label) els.progressLabel.textContent = label;
}

function showProgress(show) {
  els.progress.hidden = !show;
}

function setEditorBadge(text, ready = false) {
  els.editorBadge.textContent = text;
  els.editorBadge.classList.toggle('is-ready', ready);
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function valuesFromFields(fields = {}) {
  const values = {};
  for (const field of state.adapter?.fields || []) {
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

function makeRows(custom = []) {
  return (custom || []).filter(Boolean).map((row) => ({
    uid: ++state.customUid,
    key: asString(row.key),
    value: asString(row.value),
    originalKey: row.originalKey === undefined ? asString(row.key) : asString(row.originalKey),
    originalValue: row.originalValue === undefined ? asString(row.value) : asString(row.originalValue),
  }));
}

function sanitizeBasename(value) {
  const base = safeOutputName(value, '')
    .replace(/^[. ]+/, '')      // no leading dots/spaces (hidden files)
    .replace(/[. ]+$/, '')      // no trailing dots/spaces before the extension
    .trim();
  return base || 'file';
}

function defaultOutputName() {
  const base = fileBaseName(state.file?.name || 'file');
  return `${safeOutputName(base, 'file')}-meinsert`;
}

function ensureOutputName() {
  const ext = state.detection?.ext || 'bin';
  const base = sanitizeBasename(state.outputBase || defaultOutputName());
  const name = `${base}.${ext}`; // extension is always the detected format, never user input
  state.outputBase = base;
  state.outputName = name;
  els.outputBase.value = base;
  if (els.outputExt) els.outputExt.textContent = `.${ext}`;
  return name;
}

function previewUrlFor(file, detection) {
  if (!file || !detection) return null;
  // Every supported format has an inline preview: image, PDF, audio, video.
  const previewable = ['image', 'pdf', 'mp3', 'flac', 'ogg', 'mp4', 'mkv'];
  return previewable.includes(detection.id) ? URL.createObjectURL(file) : null;
}

function revokePreview() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
}

function computeSideSignature() {
  if (!state.file || !state.detection) return '';
  const info = state.readResult?.info || {};
  const warnings = [
    state.detection.warning,
    ...(state.readResult?.warnings || []),
  ].filter(Boolean);
  return [
    state.file.name,
    state.file.size,
    state.file.lastModified || '',
    state.detection.id,
    state.detection.subtype,
    state.detection.label,
    state.status,
    state.previewMinimized ? 'min' : 'full',
    state.previewUrl || '',
    state.coverPreviewUrl || '',
    state.coverAction,
    state.coverOriginal?.name || '',
    state.coverChosen?.name || '',
    state.readResult?.raw?.length || 0,
    JSON.stringify(info),
    warnings.join(' '),
  ].join('|');
}

function renderSide() {
  if (!state.file || !state.detection) return;
  const signature = computeSideSignature();
  if (signature && signature === state.sideSignature) {
    return;
  }
  state.sideSignature = signature;
  renderFileCard(els.fileCard, {
    file: state.file,
    detection: state.detection,
    readResult: state.readResult,
    previewUrl: state.previewUrl,
    status: state.status,
    minimized: state.previewMinimized,
    onToggleMinimize: togglePreviewMinimized,
    cover: {
      previewUrl: state.coverPreviewUrl,
      action: state.coverAction,
      original: state.coverOriginal,
      chosen: state.coverChosen
        ? { name: state.coverChosen.name, size: state.coverChosen.data?.byteLength || 0 }
        : null,
    },
    onCoverChooseFile: handlers.onCoverChooseFile,
    onCoverRemove: handlers.onCoverRemove,
    onCoverUndo: handlers.onCoverUndo,
  });
}

function togglePreviewMinimized() {
  state.previewMinimized = !state.previewMinimized;
  setCardMinimized(els.fileCard, state.previewMinimized);
  scheduleDockUpdate();
}

// Keep the preview pinned under the top edge, and shrink it while pinned so the
// form underneath stays reachable. Class-based so it follows scroll and resize.
let dockFrame = 0;
function updateDockState() {
  dockFrame = 0;
  if (!els.previewDock) return;
  if (els.workspace?.hidden) {
    els.previewDock.classList.remove('is-pinned');
    return;
  }
  const top = els.previewDock.getBoundingClientRect().top;
  els.previewDock.classList.toggle('is-pinned', top <= 13);
}

function scheduleDockUpdate() {
  if (dockFrame) return;
  dockFrame = requestAnimationFrame(updateDockState);
}

function setupPreviewDock() {
  if (!els.previewDock) return;
  window.addEventListener('scroll', scheduleDockUpdate, { passive: true });
  window.addEventListener('resize', scheduleDockUpdate);
  updateDockState();
}

function renderTabs() {
  let activeTab = els.tabs[0];
  for (const tab of els.tabs) {
    const active = tab.dataset.tab === state.activeTab;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) activeTab = tab;
  }
  // The panel is labelled by whichever tab is currently selected.
  if (activeTab) els.panel.setAttribute('aria-labelledby', activeTab.id);
  els.rawCount.textContent = String(state.readResult?.raw?.length || 0);
}

function skeletonPanel() {
  return el('div', { className: 'panel-loading' },
    el('div', { className: 'skeleton-head' },
      el('div', { style: { flex: '1' } },
        el('div', { className: 'skeleton title' }),
        el('div', { className: 'skeleton sub' }),
      ),
    ),
    el('div', { className: 'skeleton line' }),
    el('div', { className: 'skeleton line' }),
    el('div', { className: 'skeleton line short' }),
    el('div', { className: 'skeleton line' }),
    el('div', { className: 'skeleton line short' }),
  );
}

function errorCard(error, { title = 'Terjadi kesalahan', onRetry, onClose } = {}) {
  const actions = el('div', { className: 'error-actions' });
  if (onRetry) {
    actions.append(el('button', {
      className: 'button ghost small',
      type: 'button',
      on: { click: onRetry },
    }, icon('refresh'), 'Coba lagi'));
  }
  if (onClose) {
    actions.append(el('button', {
      className: 'button ghost small',
      type: 'button',
      on: { click: onClose },
    }, 'Tutup'));
  }
  return el('div', { className: 'error-card', role: 'alert' },
    el('div', { className: 'error-icon' }, icon('alert')),
    el('div', { className: 'error-body' },
      el('h2', { textContent: title }),
      el('p', { textContent: error?.message || 'File tidak bisa diproses.' }),
      error?.detail ? el('pre', { textContent: String(error.detail).slice(0, 700) }) : null,
      actions.childNodes.length ? actions : null,
    ),
  );
}

function renderReadError() {
  clear(els.panel);
  els.panel.append(errorCard(state.readError, {
    title: 'File tidak bisa dibaca',
    onRetry: () => openFile(state.file),
  }));
}

function renderWorkspace() {
  renderSide();
  renderTabs();
  if (state.status === 'loading') {
    clear(els.panel);
    els.panel.append(skeletonPanel());
    setEditorBadge('Membaca…');
    return;
  }
  if (state.status === 'error') {
    renderReadError();
    setEditorBadge('Gagal', false);
    return;
  }
  if (!state.adapter || !state.readResult) return;

  if (state.activeTab === 'raw') {
    clear(els.panel);
    renderRaw(els.panel, { raw: state.readResult.raw || [] });
    setEditorBadge(`${state.detection.label} · ${state.readResult.raw?.length || 0} tag`, true);
    return;
  }

  clear(els.panel);
  if (state.result) {
    els.panel.append(renderResultCard(state.result, { onDownload: downloadResult }));
  }
  if (state.saveError) {
    els.panel.append(errorCard(state.saveError, {
      title: 'Gagal menyimpan metadata',
      onClose: () => {
        state.saveError = null;
        renderWorkspace();
      },
    }));
  }
  const form = el('div', { className: 'form-root' });
  els.panel.append(form);
  const sections = fieldsBySection(state.adapter, state.detection.subtype);
  renderForm(form, {
    adapter: state.adapter,
    sections,
    state,
    handlers,
    coverInCard: previewKind(state.detection) === 'audio',
  });
  setEditorBadge(`${state.detection.label} · ${state.readResult.raw?.length || 0} tag`, true);
}

function inputSame(a, b, field) {
  if (field.type === 'tags') return JSON.stringify(asArray(a)) === JSON.stringify(asArray(b));
  return asString(a).trim() === asString(b).trim();
}

function collectChanges({ validate = false } = {}) {
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

function syncActionBar() {
  const ready = state.status === 'ready';
  const changes = ready ? collectChanges() : { count: 0 };
  const count = changes.count;
  state.dirtyCount = count;
  const canSave = state.processing || (ready && count > 0);

  els.dirtyState.textContent = state.processing
    ? 'Sedang memproses…'
    : count > 0
      ? `${count} perubahan siap disimpan`
      : 'Belum ada perubahan';
  els.dirtyDot.classList.toggle('is-dirty', count > 0 && !state.processing);
  els.saveBtn.disabled = !canSave;
  els.saveBtn.classList.toggle('is-spinning', false);
  els.saveLabel.textContent = state.processing ? 'Batalkan' : 'Simpan metadata';
  els.resetBtn.disabled = state.processing || !ready || count === 0;
  els.outputBase.disabled = state.processing;
  if (state.detection) {
    els.outputBase.value = state.outputBase;
    els.outputExt.textContent = `.${state.detection.ext}`;
  }
}

function cleanupUrls() {
  revokePreview();
  resetCoverState();
}

function resetWorkspaceDom() {
  clear(els.panel);
  clear(els.fileCard);
  els.fileInput.value = '';
  state.sideSignature = '';
  resetCoverState();
  showProgress(false);
  setProgress(0, 'Menyiapkan…');
  setStatus('');
  setEditorBadge('Belum dibaca');
  state.activeTab = 'metadata';
  renderTabs();
  syncActionBar();
}

async function openFile(file) {
  if (!file || state.processing) return;
  if (file.size > MAX_FILE_SIZE) {
    showToast('File melebihi batas 4 GB. Pilih file yang lebih kecil.', 'error', 6000);
    return;
  }
  const detection = await detectFile(file);
  if (!detection) {
    showToast('Format file tidak dikenali. Gunakan JPG, PNG, WebP, TIFF, PDF, MP3, FLAC, OGG/Opus, MP4, M4A, MKV, atau WebM.', 'error', 7000);
    return;
  }
  const adapter = await adapterForDetection(detection);
  if (!adapter) {
    showToast(`Format ${detection.label} belum didukung.`, 'error', 5000);
    return;
  }

  cleanupUrls();
  state.readToken += 1;
  const token = state.readToken;
  state.file = file;
  state.detection = detection;
  state.adapter = adapter;
  state.status = 'loading';
  state.readResult = null;
  state.readError = null;
  state.saveError = null;
  state.result = null;
  state.values = {};
  state.originalValues = {};
  state.removedFields.clear();
  state.customRows = [];
  state.customBaseline = [];
  state.removedCustom.clear();
  state.outputBase = `${safeOutputName(fileBaseName(file.name), 'file')}-meinsert`;
  state.outputName = `${state.outputBase}.${detection.ext}`;
  els.outputBase.value = state.outputBase;
  els.outputExt.textContent = `.${detection.ext}`;
  state.previewUrl = previewUrlFor(file, detection);
  state.previewMinimized = false;
  els.landing.hidden = true;
  els.workspace.hidden = false;
  setStatus(`Membaca ${detection.label}…`);
  renderWorkspace();
  syncActionBar();
  scheduleDockUpdate();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const result = await client.read(
      adapter.meta.engine,
      adapter.meta.id,
      file,
      { extension: detection.ext, subtype: detection.subtype, mime: detection.mime },
      (progress) => {
        if (token !== state.readToken) return;
        if (progress.stage) setStatus(progress.stage);
      },
    );
    if (token !== state.readToken) return;
    state.readResult = result;
    state.values = valuesFromFields(result.fields || {});
    state.originalValues = { ...state.values };
    state.customRows = makeRows(result.custom);
    state.customBaseline = cloneRows(state.customRows);
    state.removedFields.clear();
    state.removedCustom.clear();
    state.saveError = null;
    applyReadCover(result);
    state.status = 'ready';
    setStatus(`${detection.label} · ${result.raw?.length || 0} tag terbaca`);
    renderWorkspace();
    syncActionBar();
    if (result.warnings?.length) {
      showToast(result.warnings[0], 'info', 8000);
    }
  } catch (error) {
    if (token !== state.readToken) return;
    state.status = 'error';
    state.readError = error;
    setStatus(error?.message || 'Gagal membaca file.', true);
    renderWorkspace();
    syncActionBar();
    showToast(error?.message || 'File gagal dibaca.', 'error', 7000);
  }
}

function applyOutput(result) {
  const file = new File([result.blob], result.filename, {
    type: result.blob.type || state.file.type || state.detection.mime,
  });
  revokePreview();
  state.file = file;
  state.previewUrl = previewUrlFor(file, state.detection);
  state.values = valuesFromFields(result.fields || state.values);
  state.originalValues = { ...state.values };
  state.removedFields.clear();

  // Normalize thumbnail state after save: preview now reflects the output file.
  if (state.coverAction === 'set' && state.coverChosen) {
    state.coverOriginal = {
      mimeType: state.coverChosen.mimeType,
      kind: 'coverFront',
      name: state.coverChosen.name || 'cover',
      size: state.coverChosen.data?.byteLength || 0,
    };
    const bytes = state.coverChosen.data;
    state.coverOriginalBytes = bytes?.buffer?.slice
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;
  } else if (state.coverAction === 'remove') {
    state.coverOriginal = null;
    state.coverOriginalBytes = null;
  }
  state.coverAction = 'keep';
  state.coverChosen = null;
  refreshCoverPreview();

  const rows = Array.isArray(result.custom)
    ? result.custom
    : state.customRows.filter((row) => asString(row.key).trim() && asString(row.value).trim());
  state.customRows = makeRows(rows.map((row) => ({
    key: row.key,
    value: row.value,
    originalKey: row.originalKey === undefined ? row.key : row.originalKey,
    originalValue: row.originalValue === undefined ? row.value : row.originalValue,
  })));
  state.customBaseline = cloneRows(state.customRows);
  state.removedCustom.clear();

  const warnings = result.warnings || [];
  state.readResult = {
    ...(state.readResult || {}),
    fields: result.fields || state.values,
    custom: Array.isArray(result.custom) ? result.custom : state.readResult?.custom,
    raw: result.raw?.length ? result.raw : state.readResult?.raw || [],
    info: { ...(state.readResult?.info || {}), ...(result.info || {}) },
    warnings,
  };
  state.result = {
    ...result,
    filename: result.filename || state.outputName,
    warnings,
  };
  state.outputName = result.filename || state.outputName;
  if (state.detection) els.outputExt.textContent = `.${state.detection.ext}`;
}

async function saveMetadata() {
  if (state.processing) {
    if (state.adapter) client.cancel(state.adapter.meta.engine);
    setProgress(0, 'Membatalkan…');
    return;
  }
  if (!state.adapter || state.status !== 'ready') return;
  const { payload, errors, count } = collectChanges({ validate: true });
  if (errors.length) {
    showToast(errors[0], 'error', 7500);
    return;
  }
  if (!count) {
    showToast('Belum ada perubahan. Ubah minimal satu field terlebih dahulu.', 'info', 4200);
    return;
  }
  const filename = ensureOutputName();
  state.outputName = filename;
  state.saveError = null;
  state.result = null;
  qs('.result-card', els.panel)?.remove();
  state.processing = true;
  syncActionBar();
  showProgress(true);
  setProgress(4, 'Menyiapkan…');
  setStatus(`Memproses ${state.detection.label}…`);

  try {
    const result = await client.write(
      state.adapter.meta.engine,
      state.adapter.meta.id,
      state.file,
      payload,
      {
        extension: state.detection.ext,
        subtype: state.detection.subtype,
        mime: state.detection.mime,
        outputName: filename,
      },
      (progress) => {
        if (progress.pct !== undefined) {
          setProgress(progress.pct, progress.stage || 'Memproses…');
        } else if (progress.stage) {
          els.progressLabel.textContent = progress.stage;
        }
        if (progress.stage) setStatus(progress.stage);
      },
    );
    result.filename = filename;
    applyOutput(result);
    state.processing = false;
    state.status = 'ready';
    state.saveError = null;
    renderWorkspace();
    syncActionBar();
    showProgress(false);
    setStatus(`${state.detection.label} · metadata diperbarui`);
    if (result.warnings?.length) {
      showToast(result.warnings[0], 'info', 9000);
    } else {
      showToast('Metadata tersimpan dan sudah diverifikasi. Unduh file hasil di atas.', 'success', 6000);
    }
  } catch (error) {
    state.processing = false;
    showProgress(false);
    if (error?.code === 'CANCELLED') {
      setStatus(`${state.detection.label} · dibatalkan`);
      showToast('Pemrosesan dibatalkan.', 'info', 3500);
    } else {
      state.saveError = error;
      setStatus(error?.message || 'Gagal menyimpan metadata.', true);
      renderWorkspace();
      showToast(error?.message || 'Gagal menyimpan metadata.', 'error', 8000);
    }
    syncActionBar();
  }
}

function downloadResult() {
  if (!state.result?.blob) return;
  const url = URL.createObjectURL(state.result.blob);
  const link = el('a', {
    href: url,
    download: state.result.filename || state.outputName || 'file',
  });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function resetChanges() {
  if (state.processing) return;
  state.values = { ...state.originalValues };
  state.removedFields.clear();
  state.customRows = cloneRows(state.customBaseline);
  state.removedCustom.clear();
  state.coverAction = 'keep';
  state.coverChosen = null;
  refreshCoverPreview();
  state.saveError = null;
  state.result = null;
  renderWorkspace();
  syncActionBar();
  showToast('Perubahan dibatalkan.', 'info', 2800);
}

function goHome() {
  if (state.processing) {
    const shouldCancel = window.confirm('Pemrosesan masih berjalan. Batalkan dan ganti file?');
    if (!shouldCancel) return;
    if (state.adapter) client.cancel(state.adapter.meta.engine);
  }
  state.readToken += 1;
  cleanupUrls();
  state.file = null;
  state.detection = null;
  state.adapter = null;
  state.status = 'idle';
  state.readResult = null;
  state.readError = null;
  state.values = {};
  state.originalValues = {};
  state.removedFields.clear();
  state.customRows = [];
  state.customBaseline = [];
  state.removedCustom.clear();
  state.result = null;
  state.saveError = null;
  state.processing = false;
  state.activeTab = 'metadata';
  state.previewMinimized = false;
  els.landing.hidden = false;
  els.workspace.hidden = true;
  resetWorkspaceDom();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupDropzone() {
  els.fileInput.accept = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf,.mp3,.flac,.ogg,.oga,.opus,.mp4,.m4a,.m4v,.mov,.mkv,.webm';
  const pick = () => els.fileInput.click();
  els.browseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    pick();
  });
  // The whole drop card is the upload target, like the batch add tile.
  els.dropCard.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input')) return;
    pick();
  });
  els.fileInput.addEventListener('change', () => {
    const file = els.fileInput.files?.[0];
    if (file) openFile(file);
  });

  let dragDepth = 0;
  const enter = (event) => {
    event.preventDefault();
    dragDepth += 1;
    els.dropCard.classList.add('is-dragging');
  };
  const leave = (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.dropCard.classList.remove('is-dragging');
  };
  els.dropCard.addEventListener('dragenter', enter);
  els.dropCard.addEventListener('dragover', (event) => event.preventDefault());
  els.dropCard.addEventListener('dragleave', leave);
  els.dropCard.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    els.dropCard.classList.remove('is-dragging');
    const file = event.dataTransfer?.files?.[0];
    if (file) openFile(file);
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}

function setupEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      renderWorkspace();
    });
  });

  els.resetBtn.addEventListener('click', resetChanges);
  els.saveBtn.addEventListener('click', saveMetadata);

  els.newFileBtn.addEventListener('click', goHome);

  els.outputBase.addEventListener('input', () => {
    state.outputBase = els.outputBase.value;
  });
  els.outputBase.addEventListener('blur', () => ensureOutputName());

  window.addEventListener('beforeunload', (event) => {
    if (state.processing || state.dirtyCount > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('pagehide', () => client.disposeAllSync());
}

function boot() {
  initTheme();
  setIcons();
  if (page === 'single') {
    setupDropzone();
    setupEvents();
    setupPreviewDock();
    renderTabs();
    syncActionBar();
  }
}

boot();
