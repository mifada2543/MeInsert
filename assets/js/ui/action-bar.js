/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Bar aksi kompak di layar kecil: satu baris utama + panel Opsi yang bisa dibuka. */
import { bindTranslation, t } from '../i18n/index.js';
import { el, qs } from './dom.js';
import { icon } from './icons.js';
const DESKTOP_QUERY = '(min-width: 701px)';
/**
 * @returns {HTMLButtonElement|null} the options toggle, or null when inapplicable
 */
export function initActionBar() {
  if (typeof document === 'undefined') return null;
  const bar = qs('#actionBar') || qs('.action-bar');
  if (!bar) return null;
  const existing = qs('#actionOptionsToggle', bar);
  if (existing) return existing;
  const toggle = el('button', {
    type: 'button',
    id: 'actionOptionsToggle',
    className: 'action-options-toggle',
    'aria-expanded': 'false',
    'aria-controls': 'actionOptions',
  },
    icon('chevron', 'action-options-chevron'),
    el('span', {
      className: 'action-options-label',
    }),
  );
  bindTranslation(qs('.action-options-label', toggle), 'textContent', () => t('ui.options'));
  const panel = el('div', {
    id: 'actionOptions',
    className: 'action-options',
    hidden: true,
  });
  const summary = qs('.action-summary', bar);
  if (summary) summary.after(toggle);
  else bar.prepend(toggle);
  toggle.after(panel);
  const secondary = [
    () => qs('.output-name-wrap', bar),
    () => qs('#resetBtn', bar),
    () => qs('.quick-save-toggle', bar),
    () => qs('.clean-metadata-btn', bar) || qs('#cleanMetadataBtn', bar),
  ];
  for (const find of secondary) {
    const node = find();
    if (node && node.parentNode) panel.append(node);
  }
  const desktop = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP_QUERY)
    : null;
  function focusFirstControl() {
    const focusable = panel.querySelector(
      'input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable && typeof focusable.focus === 'function') focusable.focus();
  }
  function openPanel() {
    if (desktop?.matches) return;
    panel.hidden = false;
    panel.classList.add('is-open');
    toggle.classList.add('is-expanded');
    toggle.setAttribute('aria-expanded', 'true');
    document.body?.classList.add('action-options-open');
    focusFirstControl();
  }
  function closePanel() {
    if (panel.hidden) return;
    document.body?.classList.remove('action-options-open');
    panel.classList.remove('is-open');
    panel.hidden = true;
    toggle.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded', 'false');
    if (typeof toggle.focus === 'function') {
      try { toggle.focus(); } catch {}
    }
  }
  function applyViewportState() {
    const isDesktop = Boolean(desktop?.matches);
    document.body?.classList.remove('action-options-open');
    panel.classList.remove('is-open');
    toggle.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded', 'false');
    panel.hidden = !isDesktop;
  }
  toggle.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  function onDocumentClick(event) {
    if (desktop?.matches || panel.hidden) return;
    const target = event.target;
    if (target && typeof target === 'object' && 'nodeType' in target && bar.contains(target)) return;
    closePanel();
  }
  function onDocumentKeydown(event) {
    if (event.key !== 'Escape' || desktop?.matches || panel.hidden) return;
    event.preventDefault();
    closePanel();
  }
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
  desktop?.addEventListener?.('change', applyViewportState);
  applyViewportState();
  return toggle;
}