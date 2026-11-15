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
  renderTabs,
  renderWorkspace,
  resetChanges,
} from './editor/editor-view.js';
import { openFile, setupDropzone, goHome } from './editor/editor-file.js';
import { ensureOutputName, saveMetadata, downloadResult } from './editor/editor-save.js';
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
  els.outputBase.addEventListener('input', () => {
    state.outputBase = els.outputBase.value;
  });
  els.outputBase.addEventListener('blur', () => ensureOutputName(ctx));
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
    dock.attach();
    renderTabs(ctx);
    syncActionBar(els, state);
  }
}
boot();