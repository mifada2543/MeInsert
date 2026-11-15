/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { translated } from '../i18n/index.js';
import { el } from './dom.js';
import { icon } from './icons.js';
const region = document.getElementById('toastRegion');
/**
 * @param {string} message
 * @param {'info'|'success'|'error'} [type]
 * @param {number} [timeout] ms sebelum toast hilang; 0 = tidak otomatis.
 * @param {{label: string, onClick: () => void}} [action] tombol aksi (mis. "Muat ulang").
 */
export function showToast(message, type = 'info', timeout = 4200, action = null) {
  if (!region) return;
  const toast = el('div', { className: `toast is-${type}`, role: 'status' },
    el('span', { className: 'toast-icon' }, icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info')),
    el('p', { textContent: translated(() => (message)) }),
  );
  const remove = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 180);
  };
  if (action && action.label) {
    const button = el('button', { type: 'button', className: 'toast-action', textContent: translated(() => (action.label)) });
    button.addEventListener('click', () => {
      try {
        action.onClick?.();
      } finally {
        remove();
      }
    });
    toast.append(button);
  }
  region.append(toast);
  if (timeout > 0) setTimeout(remove, timeout);
  return { remove, element: toast };
}