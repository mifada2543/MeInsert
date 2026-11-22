/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { detectFile } from '../core/detector.js';
import { adapterForDetection } from '../core/registry.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import { clearHistory } from '../core/history.js';
import { fileBaseName, safeOutputName } from '../core/tag-utils.js';
import { showToast } from '../ui/toast.js';
import { confirmNavigation } from '../ui/confirm.js';
import { clear } from '../ui/dom.js';
import { MAX_FILE_SIZE, cloneRows, makeRows, setSidecar, valuesFromFields } from './editor-state.js';
import { setStatus, setProgress, showProgress, setEditorBadge } from './editor-shell.js';
import { syncActionBar } from './editor-changes.js';
import {
  applyReadCover,
  cleanupUrls,
  previewUrlFor,
  renderTabs,
  renderWorkspace,
  resetCoverState,
} from './editor-view.js';
export async function openFile(ctx, file) {
  const { client, els, state } = ctx;
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
  cleanupUrls(state);
  state.readToken += 1;
  const token = state.readToken;
  clearHistory(state.history);
  state.file = file;
  state.detection = detection;
  state.adapter = adapter;
  state.status = 'loading';
  state.navigationHasResult = false;
  state.readResult = null;
  state.baselineSnapshot = null;
  state.readError = null;
  state.saveError = null;
  state.result = null;
  state.values = {};
  state.originalValues = {};
  state.removedFields.clear();
  state.customRows = [];
  state.customBaseline = [];
  state.removedCustom.clear();
  setSidecar(state, null);
  state.outputBase = `${safeOutputName(fileBaseName(file.name), 'file')}-meinsert`;
  state.outputName = `${state.outputBase}.${detection.ext}`;
  els.outputBase.value = state.outputBase;
  els.outputExt.textContent = `.${detection.ext}`;
  state.previewUrl = previewUrlFor(file, detection);
  state.previewMinimized = false;
  els.landing.hidden = true;
  els.workspace.hidden = false;
  setStatus(els, `Membaca ${detection.label}…`);
  renderWorkspace(ctx);
  syncActionBar(els, state);
  ctx.dock.schedule();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try {
    const result = await client.read(
      adapter.meta.engine,
      adapter.meta.id,
      file,
      { extension: detection.ext, subtype: detection.subtype, mime: detection.mime },
      (progress) => {
        if (token !== state.readToken) return;
        if (progress.stage) setStatus(els, progress.stage);
      },
    );
    if (token !== state.readToken) return;
    result.warnings = [...new Set([detection.warning, ...(result.warnings || [])].filter(Boolean))];
    state.readResult = result;
    state.baselineSnapshot = createSnapshot({ adapter, detection, readResult: result });
    state.values = valuesFromFields(adapter, result.fields || {});
    state.originalValues = { ...state.values };
    state.customRows = makeRows(state, result.custom);
    state.customBaseline = cloneRows(state.customRows);
    state.removedFields.clear();
    state.removedCustom.clear();
    setSidecar(state, result?.sidecar || null);
    state.saveError = null;
    applyReadCover(state, result);
    state.status = 'ready';
    setStatus(els, `${detection.label} · ${result.raw?.length || 0} tag terbaca`);
    renderWorkspace(ctx);
    syncActionBar(els, state);
    if (result.warnings?.length) {
      showToast(result.warnings[0], 'info', 8000);
    }
  } catch (error) {
    if (token !== state.readToken) return;
    state.status = 'error';
    state.readError = error;
    setStatus(els, error?.message || 'Gagal membaca file.', true);
    renderWorkspace(ctx);
    syncActionBar(els, state);
    showToast(error?.message || 'File gagal dibaca.', 'error', 7000);
  }
}
export function setupDropzone(ctx) {
  const { els } = ctx;
  els.fileInput.accept = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf,.mp3,.flac,.ogg,.oga,.opus,.mp4,.m4a,.m4v,.mov,.mkv,.webm,.docx,.docm,.xlsx,.xlsm,.pptx,.pptm,.odt,.ods,.odp,.heic,.heif,.dng,.cr2,.cr3,.nef,.arw,.orf,.rw2,.raf,.braw,.r3d,.ari,.mxf';
  const pick = () => els.fileInput.click();
  els.browseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    pick();
  });
  els.dropCard.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input')) return;
    pick();
  });
  els.fileInput.addEventListener('change', () => {
    const file = els.fileInput.files?.[0];
    if (file) openFile(ctx, file);
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
    if (file) openFile(ctx, file);
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}
export function resetWorkspaceDom(ctx) {
  const { els, state } = ctx;
  clear(els.panel);
  clear(els.fileCard);
  els.fileInput.value = '';
  state.sideSignature = '';
  resetCoverState(state);
  showProgress(els, false);
  setProgress(els, 0, 'Menyiapkan…');
  setStatus(els, '');
  setEditorBadge(els, 'Belum dibaca');
  state.activeTab = 'metadata';
  renderTabs(ctx);
  syncActionBar(els, state);
}
export async function goHome(ctx) {
  const { client, els, state } = ctx;
  const busy = Boolean(state.processing);
  const dirty = (state.dirtyCount || 0) > 0;
  if (busy) {
    const shouldCancel = await confirmNavigation({
      title: 'Pemrosesan masih berjalan',
      message: 'Progres pemrosesan ini akan dibatalkan. Lanjutkan mengganti file?',
      confirmLabel: 'Ya, batalkan',
      cancelLabel: 'Tetap di sini',
    });
    if (!shouldCancel) return;
    if (state.adapter) client.cancel(state.adapter.meta.engine);
  } else if (dirty) {
    const shouldLeave = await confirmNavigation({
      title: 'Perubahan belum disimpan',
      message: `Perubahan yang belum Anda simpan (${state.dirtyCount} perubahan) akan hilang. Lanjutkan meninggalkan?`,
      confirmLabel: 'Ya, tinggalkan',
      cancelLabel: 'Tetap di sini',
    });
    if (!shouldLeave) return;
  }
  state.readToken += 1;
  cleanupUrls(state);
  clearHistory(state.history);
  state.file = null;
  state.detection = null;
  state.adapter = null;
  state.status = 'idle';
  state.readResult = null;
  state.baselineSnapshot = null;
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
  resetWorkspaceDom(ctx);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}