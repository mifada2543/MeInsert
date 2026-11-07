/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { qs } from './ui/dom.js';
import { initTheme } from './ui/theme.js';
import { registerServiceWorker } from './core/pwa.js';
registerServiceWorker();
initTheme();
const year = qs('#year');
if (year) year.textContent = String(new Date().getFullYear());
