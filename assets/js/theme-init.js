/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
(function preventFraming() {
  if (window.top === window.self) return;
  try {
    window.top.location.replace(window.self.location.href);
  } catch {}
  setTimeout(function () {
    if (window.top !== window.self) {
      document.documentElement.style.setProperty('display', 'none', 'important');
    }
  }, 100);
}());
(function applyInitialTheme() {
  let stored = null;
  try {
    stored = window.localStorage.getItem('meinsert-theme');
  } catch {
    stored = null;
  }
  const prefersDark = window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
  try {
    document.documentElement.dataset.theme = theme;
  } catch {}
}());