/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { MetadataClient } from './core/worker-client.js';
import { initLanguage } from './i18n/index.js';
import { registerServiceWorker } from './core/pwa.js';
import { initTheme } from './ui/theme.js';
import { qs } from './ui/dom.js';
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
import { mountQuickSaveToggle } from './ui/quick-save.js';
import { mountCleanButton, openCleanPanel } from './ui/clean-metadata.js';
import { initActionBar } from './ui/action-bar.js';
import { beginChange, endChange } from './core/history.js';
import { initPolicyNotice } from './ui/policy-notice.js';
import { initFormatChips } from './ui/format-chips.js';
import { initScrollReveal } from './ui/scroll-reveal.js';
import { initMobileMenu } from './ui/mobile-menu.js';
import './ui/offline-settings.js';
import { mountTimedTextButton } from './ui/timed-text-editor.js';
initLanguage();
registerServiceWorker();
const client = new MetadataClient();
const page = document.body?.dataset.page || 'single';
if (page === 'batch') {
  import('./batch/batch-view.js')
    .then(({ BatchController }) => {
      const controller = new BatchController(client);
      const input = controller.els.batchFileInput;
      const pending = [...(input?.files || [])];
      if (pending.length && input) {
        input.value = '';
        void controller.addFiles(pending);
      }
      return controller;
    })
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
    if (isEditableTarget(event.target)) return;
    if (state.processing) return;
    const isRedo = key === 'y' || event.shiftKey;
    const handled = isRedo ? redoChange(ctx) : undoChange(ctx);
    if (handled) event.preventDefault();
  });
}
function setupEvents() {
  els.tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      renderWorkspace(ctx);
    });
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step || !els.tabs.length) return;
      event.preventDefault();
      const next = els.tabs[(index + step + els.tabs.length) % els.tabs.length];
      next.focus();
      state.activeTab = next.dataset.tab;
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
function setupCleanMetadata() {
  mountCleanButton({ container: els.actionBar, ctx });
  const params = new URLSearchParams(location.search);
  if (params.get('clean') !== '1') return;
  params.delete('clean');
  const query = params.toString();
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${query ? `?${query}` : ''}${location.hash}`,
  );
  let opened = false;
  window.addEventListener('meinsert:fileReady', () => {
    if (opened) return;
    opened = true;
    void openCleanPanel(ctx);
  });
}
function boot() {
  initTheme();
  initPolicyNotice();
  initFormatChips();
  initScrollReveal();
  initMobileMenu();
  setIcons();
  qs('#main')?.setAttribute('tabindex', '-1');
  if (page === 'single') {
    setupDropzone(ctx);
    setupEvents();
    setupShortcuts();
    mountQuickSaveToggle({ container: els.actionBar });
    mountTimedTextButton({ container: els.actionBar, ctx });
    setupCleanMetadata();
    initActionBar();
    dock.attach();
    renderTabs(ctx);
    syncActionBar(els, state);
  }
}
boot();