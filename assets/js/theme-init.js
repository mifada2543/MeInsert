/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/*
 * Applies the saved theme to <html> before the first paint.
 * Loaded as a classic script in <head> so the page never flashes the wrong theme.
 * Keep in sync with the theme handling in assets/js/app.js (same storage key).
 */
(function applyInitialTheme() {
  try {
    var stored = null;
    try {
      stored = window.localStorage.getItem('meinsert-theme');
    } catch (error) {
      stored = null;
    }
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    // The app will apply the theme when it boots; ignore failures here.
  }
}());
