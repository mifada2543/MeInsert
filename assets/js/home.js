/*
 * Home entry: the landing page only needs the theme toggle, the footer year and
 * the service worker. The editor UI and format adapters are not loaded here.
 */
import { qs } from './ui/dom.js';
import { initTheme } from './ui/theme.js';
import { registerServiceWorker } from './core/pwa.js';

registerServiceWorker();
initTheme();

const year = qs('#year');
if (year) year.textContent = String(new Date().getFullYear());
