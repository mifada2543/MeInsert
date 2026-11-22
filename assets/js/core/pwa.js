/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { showToast } from '../ui/toast.js';
import { isReloadSafe, onReloadSafeChange } from './reload-guard.js';
import { CURRENT_VERSION } from './build.js';
let hadController = false;
let promptShown = false;
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((registration) => {
    watchForUpdate(registration);
  }).catch((error) => {
    console.warn('MeInsert gagal mendaftarkan service worker:', error);
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    refreshWhenSafe();
  });
  probeActiveWorker();
}
function probeActiveWorker() {
  const worker = navigator.serviceWorker.controller;
  if (!worker) return;
  const channel = new MessageChannel();
  const timer = setTimeout(() => channel.port1.close(), 3000);
  channel.port1.onmessage = (event) => {
    clearTimeout(timer);
    if (event.data?.type !== 'VERSION') return;
    if (!event.data.version || event.data.version === CURRENT_VERSION) return;
    navigator.serviceWorker.getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {})
      .finally(() => refreshWhenSafe());
  };
  worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
}
function watchForUpdate(registration) {
  if (!registration) return;
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' && hadController) refreshWhenSafe();
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      registration.update().catch(() => {});
    }
  });
}
function refreshWhenSafe() {
  if (isReloadSafe()) {
    window.location.reload();
    return;
  }
  if (promptShown) return;
  promptShown = true;
  const stop = onReloadSafeChange(() => {
    if (!isReloadSafe()) return;
    stop();
    window.location.reload();
  });
  showToast('Versi baru MeInsert sudah tersedia.', 'info', 0, {
    label: 'Muat ulang',
    onClick: () => window.location.reload(),
  });
}