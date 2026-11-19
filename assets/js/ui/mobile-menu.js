/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import id from '../i18n/id.js';
import { bindText, bindTranslation } from '../i18n/index.js';
const MENU_ID = 'mobileMenu';
const READY_KEY = 'mobileMenuReady';
const DESKTOP_QUERY = '(min-width: 701px)';
const ITEMS = [
  { key: 'ui.cleanMetadata', href: './single.html?clean=1', page: 'single.html', clean: true },
  { key: 'ui.about', href: './about.html', page: 'about.html', clean: false },
  { key: 'ui.privacy', href: './privacy.html', page: 'privacy.html', clean: false },
  { key: 'ui.termsOfUse', href: './Terms.html', page: 'terms.html', clean: false },
];
const GEAR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 0 1-2.69 2.69l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.9 1.9 0 0 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 0 1-2.69-2.69l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3.9a1.9 1.9 0 0 1 0-3.8h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 0 1 2.69-2.69l.06.06a1.6 1.6 0 0 0 1.77.32h.09a1.6 1.6 0 0 0 .97-1.47V3.9a1.9 1.9 0 0 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.9 1.9 0 0 1 2.69 2.69l-.06.06a1.6 1.6 0 0 0-.32 1.77v.09a1.6 1.6 0 0 0 1.47.97h.17a1.9 1.9 0 0 1 0 3.8h-.09a1.6 1.6 0 0 0-1.47.97Z"/></svg>';
const THEME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LANGUAGE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6M4 14l6-6M2 5h12M7 2h1"/><path d="M22 22l-5-10-5 10M14 18h6"/></svg>';
function actionButton({ id: buttonId, key, icon, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = buttonId;
  button.className = 'mobile-menu-action';
  const slot = document.createElement('span');
  slot.className = 'mobile-menu-action-icon';
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = icon;
  const label = document.createElement('span');
  label.className = 'mobile-menu-action-label';
  bindText(label, () => id[key]);
  button.append(slot, label);
  button.addEventListener('click', onClick);
  return button;
}
function pageName() {
  return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
}
function isCurrent(item, page, search) {
  if (item.page !== page) return false;
  const clean = /(?:^|&)clean=1(?:&|$)/.test(search);
  return Boolean(item.clean) === clean;
}
function makeLink(item, page, search) {
  const link = document.createElement('a');
  link.className = 'mobile-menu-link';
  link.href = item.href;
  link.dataset.i18n = item.key;
  bindText(link, () => id[item.key]);
  if (isCurrent(item, page, search)) link.setAttribute('aria-current', 'page');
  return link;
}
function buildMenu(page, search) {
  const menu = document.createElement('nav');
  menu.id = MENU_ID;
  menu.className = 'mobile-menu';
  menu.hidden = true;
  bindTranslation(menu, 'aria-label', () => id['ui.openMenu']);
  const list = document.createElement('ul');
  list.className = 'mobile-menu-list';
  for (const item of ITEMS) {
    const row = document.createElement('li');
    row.className = 'mobile-menu-item';
    row.append(makeLink(item, page, search));
    list.append(row);
  }
  menu.append(list);
  const divider = document.createElement('div');
  divider.className = 'mobile-menu-divider';
  divider.setAttribute('aria-hidden', 'true');
  menu.append(divider);
  return menu;
}
let initialized = false;
/**
 * @returns {HTMLElement|null} the menu element, or null when inapplicable
 */
export function initMobileMenu() {
  if (typeof document === 'undefined') return null;
  if (initialized) return document.getElementById(MENU_ID) || null;
  const toggle = document.getElementById('menuToggle');
  if (!toggle) return null;
  if (toggle.dataset[READY_KEY]) {
    initialized = true;
    return document.getElementById(MENU_ID) || null;
  }
  initialized = true;
  toggle.dataset[READY_KEY] = 'true';
  // Split the three static lines into independent paths so CSS can morph the
  // hamburger into an X while the menu is open (no extra markup in HTML).
  const toggleSvg = toggle.querySelector('svg');
  if (toggleSvg) {
    toggleSvg.innerHTML = '<path class="menu-line menu-line--top" d="M4 7h16"/><path class="menu-line menu-line--middle" d="M4 12h16"/><path class="menu-line menu-line--bottom" d="M4 17h16"/>';
  }
  const menu = buildMenu(pageName(), location.search.replace(/^\?/, ''));
  const appearance = document.createElement('div');
  appearance.className = 'mobile-menu-actions';
  appearance.append(
    actionButton({
      id: 'mobileTheme',
      key: 'ui.changeTheme',
      icon: THEME_ICON,
      onClick: () => document.getElementById('themeToggle')?.click(),
    }),
    actionButton({
      id: 'mobileLanguage',
      key: 'ui.language',
      icon: LANGUAGE_ICON,
      onClick: () => document.querySelector('[data-language-toggle]')?.click(),
    }),
    actionButton({
      id: 'mobileSettings',
      key: 'ui.storageOffline',
      icon: GEAR_ICON,
      onClick: () => {
        hide();
        window.dispatchEvent(new CustomEvent('meinsert:open-settings'));
      },
    }),
  );
  menu.append(appearance);
  const header = toggle.closest('.site-header') || toggle.parentElement || document.body;
  header.append(menu);
  let open = false;
  const items = () => [...menu.querySelectorAll('a[href], button:not([disabled])')];
  const labelRead = () => id[open ? 'ui.closeMenu' : 'ui.openMenu'];
  const syncLabels = () => {
    bindTranslation(toggle, 'aria-label', labelRead);
    bindTranslation(toggle, 'title', labelRead);
  };
  syncLabels();
  const focusFirst = () => items()[0]?.focus();
  const show = () => {
    if (open) return;
    open = true;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    syncLabels();
    focusFirst();
  };
  const hide = ({ restoreFocus = true } = {}) => {
    if (!open) return;
    open = false;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    syncLabels();
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => (open ? hide() : show()));
  menu.addEventListener('keydown', (event) => {
    if (!open) return;
    const list = items();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % list.length;
    else if (event.key === 'ArrowUp') next = current <= 0 ? list.length - 1 : current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    if (next < 0) return;
    event.preventDefault();
    list[next].focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      hide();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!open || menu.contains(event.target) || toggle.contains(event.target)) return;
    hide({ restoreFocus: false });
  });
  const desktop = window.matchMedia?.(DESKTOP_QUERY);
  desktop?.addEventListener?.('change', (event) => {
    if (event.matches) hide({ restoreFocus: false });
  });
  return menu;
}
export default initMobileMenu;