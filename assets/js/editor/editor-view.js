/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, clear } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { renderFileCard, setCardMinimized, previewKind } from '../ui/file-card.js';
import { renderForm, renderCoverBlock } from '../ui/form-view.js';
import { renderRaw } from '../ui/raw-view.js';
import { renderResultCard } from '../ui/result-view.js';
import { fieldsBySection } from '../core/registry.js';
import { coverFormatsLabelFor, isSupportedCover, mimeOf } from '../core/image-utils.js';
import { setEditorBadge, skeletonPanel, errorCard } from './editor-shell.js';
import { syncActionBar } from './editor-changes.js';
import { normalizeRawTag } from '../core/metadata-snapshot.js';
import { isCommittedResult } from '../core/write-guard.js';
import { cloneRows } from './editor-state.js';
import { beginChange, redo, undo } from '../core/history.js';
import { t } from '../i18n/index.js';

/** Label manusiawi untuk sebuah field, jatuh ke id bila label tidak ada. */
function fieldLabel(state, id) {
  const field = state.adapter?.fields?.find((item) => item.id === id);
  return field?.label || id;
}

export function previewUrlFor(file, detection) {
  if (!file || !detection) return null;
  const previewable = ['image', 'pdf', 'mp3', 'flac', 'ogg', 'mp4', 'mkv'];
  return previewable.includes(detection.id) ? URL.createObjectURL(file) : null;
}
export function revokePreview(state) {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
}
export function revokeCoverPreview(state) {
  if (state.coverPreviewUrl) {
    URL.revokeObjectURL(state.coverPreviewUrl);
    state.coverPreviewUrl = null;
  }
}
export function coverBytesForPreview(state) {
  if (state.coverAction === 'set' && state.coverChosen?.data) return state.coverChosen.data;
  if (state.coverAction === 'keep' && state.coverOriginalBytes) return state.coverOriginalBytes;
  return null;
}
export function refreshCoverPreview(state) {
  revokeCoverPreview(state);
  const bytes = coverBytesForPreview(state);
  if (!bytes) return;
  const mime = state.coverAction === 'set' ? state.coverChosen?.mimeType : state.coverOriginal?.mimeType;
  state.coverPreviewUrl = URL.createObjectURL(new Blob([bytes], { type: mime || 'image/jpeg' }));
}
export function resetCoverState(state) {
  state.coverOriginal = null;
  state.coverOriginalBytes = null;
  state.coverAction = 'keep';
  state.coverChosen = null;
  revokeCoverPreview(state);
}
export function applyReadCover(state, result) {
  state.coverOriginal = result.cover || null;
  state.coverOriginalBytes = result.coverBytes || null;
  state.coverAction = 'keep';
  state.coverChosen = null;
  refreshCoverPreview(state);
}
export function cleanupUrls(state) {
  revokePreview(state);
  resetCoverState(state);
}
export function computeSideSignature(state) {
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
export function renderSide(ctx) {
  const { els, state } = ctx;
  if (!state.file || !state.detection) return;
  const signature = computeSideSignature(state);
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
    onToggleMinimize: () => togglePreviewMinimized(ctx),
    cover: {
      previewUrl: state.coverPreviewUrl,
      action: state.coverAction,
      original: state.coverOriginal,
      chosen: state.coverChosen
        ? { name: state.coverChosen.name, size: state.coverChosen.data?.byteLength || 0 }
        : null,
    },
    onCoverChooseFile: ctx.handlers.onCoverChooseFile,
    onCoverRemove: ctx.handlers.onCoverRemove,
    onCoverUndo: ctx.handlers.onCoverUndo,
  });
}
export function togglePreviewMinimized(ctx) {
  const { els, state } = ctx;
  state.previewMinimized = !state.previewMinimized;
  setCardMinimized(els.fileCard, state.previewMinimized);
  ctx.dock.schedule();
}
export function refreshCoverUI(ctx) {
  const { els, state } = ctx;
  const block = els.panel.querySelector('.cover-block');
  if (block) block.replaceWith(renderCoverBlock(state.adapter, state, ctx.handlers));
  renderSide(ctx);
  ctx.dock.schedule();
}
export function renderTabs(ctx) {
  const { els, state } = ctx;
  let activeTab = els.tabs[0];
  for (const tab of els.tabs) {
    const active = tab.dataset.tab === state.activeTab;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) activeTab = tab;
  }
  if (activeTab) els.panel.setAttribute('aria-labelledby', activeTab.id);
  els.rawCount.textContent = String(state.readResult?.raw?.length || 0);
}
export function renderReadError(ctx) {
  const { els, state } = ctx;
  clear(els.panel);
  els.panel.append(errorCard(state.readError, {
    title: 'File tidak bisa dibaca',
    onRetry: ctx.onRetry,
  }));
}
export function renderWorkspace(ctx) {
  const { els, state } = ctx;
  if (isCommittedResult(state.result) && state.rawRemove.size) {
    const present = new Set((state.readResult?.raw || []).map((row) => normalizeRawTag(row?.tag)));
    for (const tag of [...state.rawRemove]) {
      if (!present.has(normalizeRawTag(tag))) state.rawRemove.delete(tag);
    }
  }
  renderSide(ctx);
  renderTabs(ctx);
  if (state.status === 'loading') {
    clear(els.panel);
    els.panel.append(skeletonPanel());
    setEditorBadge(els, 'Membaca…');
    return;
  }
  if (state.status === 'error') {
    renderReadError(ctx);
    setEditorBadge(els, 'Gagal', false);
    return;
  }
  if (!state.adapter || !state.readResult) return;
  if (state.activeTab === 'raw') {
    clear(els.panel);
    renderRaw(els.panel, { raw: state.readResult.raw || [] });
    setEditorBadge(els, `${state.detection.label} · ${state.readResult.raw?.length || 0} tag`, true);
    return;
  }
  clear(els.panel);
  if (state.result) {
    els.panel.append(renderResultCard(state.result, { onDownload: ctx.onDownload }));
  }
  if (state.saveError) {
    const card = errorCard(state.saveError, {
      title: 'Gagal menyimpan metadata',
      onClose: () => {
        state.saveError = null;
        renderWorkspace(ctx);
      },
    });
    if (state.saveError?.isMemoryLimit) card.classList.add('is-memory');
    els.panel.append(card);
  }
  const form = el('div', { className: 'form-root' });
  els.panel.append(form);
  const sections = fieldsBySection(state.adapter, state.detection.subtype);
  renderForm(form, {
    adapter: state.adapter,
    sections,
    state,
    handlers: ctx.handlers,
    coverInCard: previewKind(state.detection) === 'audio',
  });
  setEditorBadge(els, `${state.detection.label} · ${state.readResult.raw?.length || 0} tag`, true);
}
export function resetChanges(ctx) {
  const { els, state } = ctx;
  if (state.processing) return;
  beginChange(state.history, null, t('ui.changeHistoryCurrent'));
  state.values = { ...state.originalValues };
  state.removedFields.clear();
  state.rawRemove.clear();
  state.customRows = cloneRows(state.customBaseline);
  state.removedCustom.clear();
  state.coverAction = 'keep';
  state.coverChosen = null;
  refreshCoverPreview(state);
  state.saveError = null;
  state.result = null;
  renderWorkspace(ctx);
  syncActionBar(els, state);
  showToast('Perubahan dibatalkan.', 'info', 2800);
}
export function undoChange(ctx) {
  const { els, state } = ctx;
  if (state.processing) return false;
  if (!undo(state.history)) return false;
  refreshCoverPreview(state);
  renderWorkspace(ctx);
  syncActionBar(els, state);
  return true;
}
export function redoChange(ctx) {
  const { els, state } = ctx;
  if (state.processing) return false;
  if (!redo(state.history)) return false;
  refreshCoverPreview(state);
  renderWorkspace(ctx);
  syncActionBar(els, state);
  return true;
}
export function createHandlers(ctx) {
  const { els, state } = ctx;
  return {
    onFieldChange(id, value) {
      beginChange(state.history, `field:${id}`, t('ui.changeHistoryField', { v0: fieldLabel(state, id) }));
      state.values[id] = value;
      state.removedFields.delete(id);
      syncActionBar(els, state);
    },
    onFieldClear(id) {
      beginChange(state.history, null, t('ui.changeHistoryField', { v0: fieldLabel(state, id) }));
      state.values[id] = '';
      state.removedFields.add(id);
      syncActionBar(els, state);
    },
    onAddCustom() {
      beginChange(state.history, null, t('ui.changeHistoryCurrent'));
      state.customRows.push({
        uid: ++state.customUid,
        key: '',
        value: '',
        originalKey: null,
        originalValue: '',
      });
      syncActionBar(els, state);
    },
    onCustomChange(uid, part, value) {
      const row = state.customRows.find((item) => item.uid === uid);
      if (!row) return;
      beginChange(state.history, `custom:${uid}:${part}`, t('ui.changeHistoryCustom', {
        v0: part === 'key' ? value : row.key,
      }));
      row[part] = value;
      syncActionBar(els, state);
    },
    onCustomDelete(uid) {
      const index = state.customRows.findIndex((item) => item.uid === uid);
      if (index < 0) return;
      const rowKey = state.customRows[index].key;
      beginChange(state.history, null, t('ui.changeHistoryCustom', { v0: rowKey }));
      const [row] = state.customRows.splice(index, 1);
      if (row.originalKey) state.removedCustom.add(row.originalKey);
      syncActionBar(els, state);
    },
    onCoverChooseFile(file) {
      const readToken = state.readToken;
      (async () => {
        const bytes = await file.arrayBuffer();
        if (readToken !== state.readToken || state.processing) return;
        const u8 = new Uint8Array(bytes);
        if (file.size > 10 * 1024 * 1024 || bytes.byteLength > 10 * 1024 * 1024) {
          showToast('Gambar terlalu besar. Maksimal 10 MB.', 'error', 6000);
          return;
        }
        const detectionId = state.detection?.id;
        if (!isSupportedCover(u8, detectionId)) {
          showToast(`Format gambar tidak didukung. Gunakan ${coverFormatsLabelFor(detectionId)}.`, 'error', 6000);
          return;
        }
        beginChange(state.history, null, t('ui.changeHistoryCover'));
        state.coverChosen = { data: u8, mimeType: file.type || mimeOf(u8), name: file.name };
        state.coverAction = 'set';
        refreshCoverPreview(state);
        refreshCoverUI(ctx);
        syncActionBar(els, state);
      })().catch((error) => showToast(`Gagal membaca gambar: ${error?.message || error}`, 'error', 6000));
    },
    onCoverRemove() {
      beginChange(state.history, null, t('ui.changeHistoryCover'));
      state.coverAction = 'remove';
      state.coverChosen = null;
      refreshCoverPreview(state);
      refreshCoverUI(ctx);
      syncActionBar(els, state);
    },
    onCoverUndo() {
      beginChange(state.history, null, t('ui.changeHistoryCover'));
      state.coverAction = 'keep';
      state.coverChosen = null;
      refreshCoverPreview(state);
      refreshCoverUI(ctx);
      syncActionBar(els, state);
    },
  };
}