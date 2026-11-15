/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { MetadataClient } from './core/worker-client.js';
import { initLanguage } from './i18n/index.js';
import { registerServiceWorker } from './core/pwa.js';
import { initTheme } from './ui/theme.js';
import { createEditorState } from './editor/editor-state.js';
import { createShell, setIcons, createPreviewDock } from './editor/editor-shell.js';
import { syncActionBar } from './editor/editor-changes.js';
import {
  createHandlers,
  redoChange,
  renderTabs,
  renderWorkspace,
  resetChanges,
  undoChange,
} from './editor/editor-view.js';
import { openFile, setupDropzone, goHome } from './editor/editor-file.js';
import { ensureOutputName, saveMetadata, downloadResult } from './editor/editor-save.js';
import { beginChange, endChange } from './core/history.js';
initLanguage();
registerServiceWorker();
const client = new MetadataClient();
const page = document.body?.dataset.page || 'single';
if (page === 'batch') {
  import('./batch/batch-view.js')
    .then(({ BatchController }) => new BatchController(client))
    .catch((error) => {
      console.error('MeInsert gagal memuat mode batch:', error);
    });
}
const state = createEditorState();
const els = createShell();
const dock = createPreviewDock(els);
const ctx = {
  client,
  els,
  state,
  dock,
  handlers: null,
  onDownload: null,
  onRetry: null,
};
ctx.handlers = createHandlers(ctx);
ctx.onRetry = () => openFile(ctx, ctx.state.file);
ctx.onDownload = () => downloadResult(ctx);

/** True when the event target accepts text, so the browser handles undo itself. */
function isEditableTarget(target) {
  if (!target || target.nodeType !== 1) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function setupShortcuts() {
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    // Inside a field the native text undo applies; it still fires input
    // events, so the editor history stays in sync with the text.
    if (isEditableTarget(event.target)) return;
    if (state.processing) return;
    const isRedo = key === 'y' || event.shiftKey;
    const handled = isRedo ? redoChange(ctx) : undoChange(ctx);
    if (handled) event.preventDefault();
  });
}

function setupEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      renderWorkspace(ctx);
    });
  });
  els.resetBtn.addEventListener('click', () => resetChanges(ctx));
  els.saveBtn.addEventListener('click', () => saveMetadata(ctx));
  els.newFileBtn.addEventListener('click', () => goHome(ctx));
  els.undoBtn?.addEventListener('click', () => undoChange(ctx));
  els.redoBtn?.addEventListener('click', () => redoChange(ctx));
  els.outputBase.addEventListener('input', () => {
    beginChange(state.history, 'outputName');
    state.outputBase = els.outputBase.value;
    syncActionBar(els, state);
  });
  els.panel.addEventListener('focusout', () => endChange(state.history));
  els.outputBase.addEventListener('blur', () => {
    endChange(state.history);
    ensureOutputName(ctx);
  });
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
    setupDropzone(ctx);
    setupEvents();
    setupShortcuts();
    dock.attach();
    renderTabs(ctx);
    syncActionBar(els, state);
  }
}
boot();
