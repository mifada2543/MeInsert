/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { qs } from './ui/dom.js';
import { initTheme } from './ui/theme.js';
import { registerServiceWorker } from './core/pwa.js';
import { initLanguage } from './i18n/index.js';
import { initPolicyToc } from './ui/policy-toc.js';
import { scheduleEnginePrefetch } from './ui/engine-loading.js';
import { initPolicyNotice } from './ui/policy-notice.js';
import { initFormatChips } from './ui/format-chips.js';
import { initScrollReveal } from './ui/scroll-reveal.js';
import { initMobileMenu } from './ui/mobile-menu.js';
import './ui/offline-settings.js';
initLanguage();
registerServiceWorker();
initTheme();
initPolicyToc();
scheduleEnginePrefetch();
initFormatChips();
initScrollReveal();
initMobileMenu();
if (document.body?.dataset.page === 'home') initPolicyNotice();
const year = qs('#year');
if (year) year.textContent = String(new Date().getFullYear());