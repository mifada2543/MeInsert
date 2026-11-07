/*
 * Theme handling shared by every page entry. Loaded after theme-init.js, which
 * applies the saved theme before first paint; this module keeps it in sync and
 * animates manual/system switches.
 */
import { qs } from './dom.js';
import { icon } from './icons.js';

const STORAGE_KEY = 'meinsert-theme';

function themeToggle() {
  return qs('#themeToggle');
}

function syncThemeButton(theme) {
  const toggle = themeToggle();
  if (!toggle) return;
  const label = theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap';
  toggle.title = label;
  toggle.setAttribute('aria-label', label);
}

function preferredTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be disabled; the theme still applies for this page.
  }
  syncThemeButton(theme);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function themeTransitionOrigin(toggle) {
  const rect = toggle.getBoundingClientRect();
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

function applyThemeWithTransition(theme) {
  const root = document.documentElement;
  const toggle = themeToggle();
  if (toggle) {
    const origin = themeTransitionOrigin(toggle);
    root.style.setProperty('--vt-x', `${origin.x}px`);
    root.style.setProperty('--vt-y', `${origin.y}px`);
  }
  if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
    root.classList.add('theme-anim');
    applyTheme(theme);
    window.setTimeout(() => root.classList.remove('theme-anim'), 480);
    return;
  }
  document.startViewTransition(() => applyTheme(theme));
}

function setThemeIcons() {
  qs('#themeIconSun')?.replaceChildren(icon('sun'));
  qs('#themeIconMoon')?.replaceChildren(icon('moon'));
}

export function initTheme() {
  setThemeIcons();
  const toggle = themeToggle();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = preferredTheme();
  if (document.documentElement.dataset.theme !== theme) {
    // Rare mismatch (e.g. theme-init.js unreachable); align without animating.
    applyTheme(theme);
  } else {
    syncThemeButton(theme);
  }
  media.addEventListener?.('change', (event) => {
    let hasStored = false;
    try {
      hasStored = Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      hasStored = false;
    }
    if (!hasStored) applyThemeWithTransition(event.matches ? 'dark' : 'light');
  });
  toggle?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    applyThemeWithTransition(current === 'dark' ? 'light' : 'dark');
  });
}
