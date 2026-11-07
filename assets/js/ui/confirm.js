/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el } from './dom.js';
import { icon } from './icons.js';
let current = null;
let pendingResolve = null;
let currentCleanup = null;
export function confirmNavigation({
  title = 'Perubahan belum disimpan',
  message = 'Progres Anda akan hilang. Lanjutkan meninggalkan?',
  confirmLabel = 'Ya, tinggalkan',
  cancelLabel = 'Tetap di sini',
} = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  closeConfirm();
  const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const promise = new Promise((resolve) => { pendingResolve = resolve; });
  const cancelButton = el('button', {
    className: 'button ghost confirm-btn-cancel',
    type: 'button',
    textContent: cancelLabel,
  });
  const confirmButton = el('button', {
    className: 'button confirm-btn-confirm',
    type: 'button',
    textContent: confirmLabel,
  });
  const card = el('div', {
    className: 'confirm-card',
    role: 'alertdialog',
    'aria-modal': 'true',
    'aria-labelledby': 'confirmTitle',
    'aria-describedby': 'confirmMessage',
  },
    el('div', { className: 'confirm-icon', 'aria-hidden': 'true' }, icon('alert')),
    el('h2', { className: 'confirm-title', id: 'confirmTitle', textContent: title }),
    el('p', { className: 'confirm-message', id: 'confirmMessage', textContent: message }),
    el('div', { className: 'confirm-actions' }, cancelButton, confirmButton),
  );
  const backdrop = el('div', { className: 'confirm-backdrop' }, card);
  document.body.append(backdrop);
  const cleanup = () => {
    document.removeEventListener('keydown', onKeydown, true);
    document.body.style.overflow = prevOverflow || '';
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    if (current === backdrop) current = null;
    currentCleanup = null;
    if (focusBefore && typeof focusBefore.focus === 'function') {
      try { focusBefore.focus(); } catch { /* noop */ }
    }
  };
  currentCleanup = cleanup;
  const finish = (value) => {
    if (!pendingResolve) return;
    const resolve = pendingResolve;
    pendingResolve = null;
    cleanup();
    resolve(value);
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    } else if (event.key === 'Tab') {
      const focusables = [cancelButton, confirmButton];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKeydown, true);
  cancelButton.addEventListener('click', (event) => {
    event.stopPropagation();
    finish(false);
  });
  confirmButton.addEventListener('click', (event) => {
    event.stopPropagation();
    finish(true);
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) finish(false);
  });
  current = backdrop;
  cancelButton.focus();
  return promise;
}
export function closeConfirm() {
  if (!current) {
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      try { resolve(false); } catch { /* noop */ }
    }
    return;
  }
  const resolve = pendingResolve;
  pendingResolve = null;
  if (currentCleanup) {
    const run = currentCleanup;
    currentCleanup = null;
    run();
  }
  if (resolve) {
    try { resolve(false); } catch { /* noop */ }
  }
}
export function isConfirmOpen() {
  return Boolean(current);
}
