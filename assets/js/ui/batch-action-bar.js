/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t } from '../i18n/index.js';
import { qs } from './dom.js';
import { icon } from './icons.js';
const DESKTOP_QUERY = '(min-width: 701px)';
const READY_KEY = 'batchActionBarReady';
/**
 * @returns {HTMLButtonElement|null} the options toggle, or null when inapplicable
 */
export function initBatchActionBar() {
  if (typeof document === 'undefined') return null;
  const footer = qs('.batch-footer');
  if (!footer) return null;
  const existing = qs('#batchOptionsToggle', footer);
  if (existing) return existing;
  const toggle = document.createElement('button');
  toggle.id = 'batchOptionsToggle';
  toggle.className = 'batch-options-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'batchOptions');
  toggle.dataset[READY_KEY] = 'true';
  toggle.append(icon('chevron'));
  const label = document.createElement('span');
  toggle.append(label);
  bindTranslation(label, 'textContent', () => t('ui.options'));

  const panel = document.createElement('div');
  panel.id = 'batchOptions';
  panel.className = 'batch-options';
  panel.hidden = true;
  const copy = qs('.batch-footer-copy', footer);
  const controls = [
    qs('#batchOperationCount', footer),
    qs('#batchRetryBtn', footer),
    qs('.batch-stop-after', footer),
  ];
  for (const node of controls) {
    if (node) panel.append(node);
  }
  footer.prepend(toggle);
  if (copy) copy.after(panel);
  else footer.append(panel);
  const desktop = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(DESKTOP_QUERY)
    : null;
  const isDesktop = () => (desktop ? desktop.matches : (window?.innerWidth || 0) > 700);
  let open = false;
  const focusables = () => [...panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
    .filter((node) => !node.hidden && !node.disabled && node.getAttribute('tabindex') !== '-1');
  const setOpen = (next) => {
    open = isDesktop() ? false : Boolean(next);
    document.body?.classList.toggle('batch-options-open', open);
    panel.hidden = !open;
    panel.classList.toggle('is-open', open);
    toggle.classList.toggle('is-expanded', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  const openPanel = () => {
    if (open || isDesktop()) return;
    setOpen(true);
    focusables()[0]?.focus();
  };
  const closePanel = ({ restoreFocus = true } = {}) => {
    if (!open) return;
    const focusInside = panel.contains(document.activeElement);
    setOpen(false);
    if (focusInside) {
      if (restoreFocus) toggle.focus();
      else if (document.activeElement?.blur) document.activeElement.blur();
    }
  };
  const syncBreakpoint = () => {
    if (isDesktop()) {
      open = false;
      panel.hidden = false;
      panel.classList.remove('is-open');
      toggle.classList.remove('is-expanded');
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      setOpen(false);
    }
  };
  toggle.addEventListener('click', () => (open ? closePanel() : openPanel()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closePanel();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!open || panel.contains(event.target) || toggle.contains(event.target)) return;
    closePanel({ restoreFocus: false });
  });
  if (desktop?.addEventListener) desktop.addEventListener('change', syncBreakpoint);
  else desktop?.addListener?.(syncBreakpoint);
  syncBreakpoint();
  return toggle;
}
export default initBatchActionBar;