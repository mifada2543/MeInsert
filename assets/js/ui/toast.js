import { el } from './dom.js';
import { icon } from './icons.js';

const region = document.getElementById('toastRegion');

export function showToast(message, type = 'info', timeout = 4200) {
  if (!region) return;
  const toast = el('div', { className: `toast is-${type}`, role: 'status' },
    el('span', { className: 'toast-icon' }, icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info')),
    el('p', { textContent: message }),
  );
  region.append(toast);
  const remove = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 180);
  };
  if (timeout > 0) setTimeout(remove, timeout);
  return { remove, element: toast };
}
