/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t, translated } from '../i18n/index.js';
import { el, qs } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
export function createShell() {
  return {
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
    undoBtn: qs('#undoBtn'),
    redoBtn: qs('#redoBtn'),
    historyBtn: qs('#historyBtn'),
    progress: qs('#progress'),
    progressBar: qs('#progressBar'),
    progressLabel: qs('#progressLabel'),
    toastRegion: qs('#toastRegion'),
  };
}
export function setIcons() {
  qs('#newFileBtn .icon')?.replaceChildren(icon('arrowLeft'));
  qs('#saveBtn .icon')?.replaceChildren(icon('download'));
  qs('#undoBtn .icon')?.replaceChildren(icon('undo'));
  qs('#redoBtn .icon')?.replaceChildren(icon('redo'));
  qs('#historyBtn .icon')?.replaceChildren(icon('history'));
  const undoBtn = qs('#undoBtn');
  const redoBtn = qs('#redoBtn');
  const historyBtn = qs('#historyBtn');
  if (undoBtn) {
    bindTranslation(undoBtn, 'aria-label', () => (t('ui.undoLastChange')));
    bindTranslation(undoBtn, 'title', () => (t('ui.undoLastChange')));
  }
  if (redoBtn) {
    bindTranslation(redoBtn, 'aria-label', () => (t('ui.redoLastChange')));
    bindTranslation(redoBtn, 'title', () => (t('ui.redoLastChange')));
  }
  if (historyBtn) {
    bindTranslation(historyBtn, 'aria-label', () => (t('ui.changeHistoryOpen')));
    bindTranslation(historyBtn, 'title', () => (t('ui.changeHistoryOpen')));
  }
  bindTranslation(qs('#year'), 'textContent', () => (String(new Date().getFullYear())));
}
export function setStatus(els, text, isError = false) {
  bindTranslation(els.readStatus, 'textContent', () => (text));
  els.readStatus.classList.toggle('is-error', isError);
}
export function setProgress(els, percent, label) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  els.progressBar.style.width = `${pct}%`;
  if (label) bindTranslation(els.progressLabel, 'textContent', () => (label));
}
export function showProgress(els, show) {
  els.progress.hidden = !show;
}
export function setEditorBadge(els, text, ready = false) {
  bindTranslation(els.editorBadge, 'textContent', () => (text));
  els.editorBadge.classList.toggle('is-ready', ready);
}
export function skeletonPanel() {
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
export function errorCard(error, { title = 'Terjadi kesalahan', onRetry, onClose } = {}) {
  const actions = el('div', { className: 'error-actions' });
  if (onRetry) {
    actions.append(el('button', {
      className: 'button ghost small',
      type: 'button',
      on: { click: onRetry },
    }, icon('refresh'), translated(() => (t('ui.retry')))));
  }
  if (onClose) {
    actions.append(el('button', {
      className: 'button ghost small',
      type: 'button',
      on: { click: onClose },
    }, translated(() => (t('ui.close')))));
  }
  return el('div', { className: 'error-card', role: 'alert' },
    el('div', { className: 'error-icon' }, icon('alert')),
    el('div', { className: 'error-body' },
      el('h2', { textContent: translated(() => (title)) }),
      el('p', { textContent: translated(() => (error?.message || t('ui.cannotProcessFile2'))) }),
      error?.detail ? el('pre', { textContent: String(error.detail).slice(0, 700) }) : null,
      actions.childNodes.length ? actions : null,
    ),
  );
}
export function createPreviewDock(els) {
  let frame = 0;
  function update() {
    frame = 0;
    if (!els.previewDock) return;
    if (els.workspace?.hidden) {
      els.previewDock.classList.remove('is-pinned');
      return;
    }
    const top = els.previewDock.getBoundingClientRect().top;
    els.previewDock.classList.toggle('is-pinned', top <= 13);
  }
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(update);
  }
  function attach() {
    if (!els.previewDock) return;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }
  return { schedule, update, attach };
}