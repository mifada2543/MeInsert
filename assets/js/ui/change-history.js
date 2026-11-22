/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Panel riwayat perubahan editor satu file.
import { clear, el } from './dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { confirmNavigation } from './confirm.js';
import { historyEntries, rollbackTo } from '../core/history.js';
import { renderWorkspace } from '../editor/editor-view.js';
import { syncActionBar } from '../editor/editor-changes.js';
let dialog = null;
let refs = null;
let host = null;
function formatTime(at) {
  const value = Number(at);
  if (!Number.isFinite(value) || value <= 0) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try { return date.toLocaleTimeString(); } catch { return ''; }
}
function labelOf(entry) {
  const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
  return label || t('ui.changeHistoryCurrent');
}
function closeDialog() {
  if (dialog?.open) dialog.close();
}
function buildDialog() {
  if (dialog) return dialog;
  const title = el('h2', { id: 'changeHistoryTitle', className: 'history-title' });
  bindTranslation(title, 'textContent', () => (t('ui.changeHistory')));
  const closeBtn = el('button', {
    className: 'history-close',
    type: 'button',
    title: translated(() => (t('ui.close'))),
    'aria-label': translated(() => (t('ui.close'))),
    on: { click: () => closeDialog() },
  }, icon('x'));
  const list = el('ul', { className: 'history-list', id: 'changeHistoryList' });
  const empty = el('p', { className: 'history-empty' });
  bindTranslation(empty, 'textContent', () => (t('ui.changeHistoryEmpty')));
  const note = el('p', { className: 'history-note' });
  bindTranslation(note, 'textContent', () => (t('ui.changeHistoryUndoable')));
  dialog = el('dialog', {
    id: 'changeHistoryDialog',
    className: 'history-dialog',
    role: 'dialog',
    'aria-labelledby': 'changeHistoryTitle',
    'aria-modal': 'true',
    on: {
      cancel: (event) => { event.preventDefault(); closeDialog(); },
      click: (event) => { if (event.target === dialog) closeDialog(); },
      close: () => { host?.els?.historyBtn?.focus(); },
    },
  }, el('div', { className: 'history-card' },
    el('header', { className: 'history-head' },
      el('span', { className: 'history-head-icon', 'aria-hidden': 'true' }, icon('history')),
      el('div', { className: 'history-head-copy' }, title),
      closeBtn,
    ),
    el('div', { className: 'history-body' }, empty, list),
    el('footer', { className: 'history-foot' }, note),
  ));
  document.body.append(dialog);
  refs = { title, closeBtn, list, empty, note };
  return dialog;
}
function currentEntry() {
  return el('li', { className: 'history-entry is-current', 'aria-current': 'true' },
    el('span', { className: 'history-entry-mark is-current', 'aria-hidden': 'true' }),
    el('div', { className: 'history-entry-body' },
      el('strong', { className: 'history-entry-label', textContent: t('ui.changeHistoryCurrent') }),
    ),
  );
}
function changeEntry(ctx, entry) {
  const time = formatTime(entry.at);
  const rollback = el('button', {
    className: 'button ghost small history-rollback',
    type: 'button',
    title: translated(() => (t('ui.changeHistoryRollback'))),
    'aria-label': translated(() => (t('ui.changeHistoryRollback'))),
    on: { click: () => { void requestRollback(ctx, entry); } },
  }, translated(() => (t('ui.changeHistoryRollback'))));
  return el('li', { className: 'history-entry' },
    el('span', { className: 'history-entry-mark', 'aria-hidden': 'true' }),
    el('div', { className: 'history-entry-body' },
      el('strong', { className: 'history-entry-label', textContent: labelOf(entry) }),
      time ? el('span', { className: 'history-entry-time', textContent: time }) : null,
    ),
    rollback,
  );
}
function renderEntries(ctx) {
  if (!refs) return;
  const entries = historyEntries(ctx?.state?.history).slice().reverse();
  clear(refs.list);
  refs.empty.hidden = entries.length > 0;
  refs.list.append(currentEntry());
  for (const entry of entries) refs.list.append(changeEntry(ctx, entry));
}
function openDialog() {
  if (!host) return;
  if (!dialog) buildDialog();
  renderEntries(host);
  if (!dialog.open) dialog.showModal();
  refs.closeBtn.focus();
}
async function requestRollback(ctx, entry) {
  const label = labelOf(entry);
  const wasOpen = Boolean(dialog?.open);
  closeDialog();
  const confirmed = await confirmNavigation({
    title: t('ui.changeHistoryRollback'),
    message: t('ui.changeHistoryRollbackConfirm', { v0: label }),
    confirmLabel: t('ui.changeHistoryRollback'),
    cancelLabel: t('ui.cancel'),
  });
  if (!confirmed) {
    if (wasOpen) openDialog();
    return;
  }
  const moved = rollbackTo(ctx?.state?.history, entry.index);
  closeDialog();
  if (!moved) return;
  syncActionBar(ctx.els, ctx.state);
  renderWorkspace(ctx);
  showToast(t('ui.changeHistoryRollbackDone'));
}
export function mountChangeHistory({ ctx, els } = {}) {
  if (typeof document === 'undefined') return null;
  host = ctx || { els };
  const button = ctx?.els?.historyBtn || els?.historyBtn || document.getElementById('historyBtn');
  if (!button || button.dataset.historyMounted === '1') return dialog;
  button.dataset.historyMounted = '1';
  button.addEventListener('click', () => openDialog());
  if (!dialog) buildDialog();
  return dialog;
}