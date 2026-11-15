/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { showToast } from '../ui/toast.js';

/** Set true hanya setelah pengguna meminta muat ulang versi baru. */
let updateRequested = false;
let updatePrompted = false;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((registration) => {
    watchForUpdate(registration);
  }).catch((error) => {
    console.warn('MeInsert gagal mendaftarkan service worker:', error);
  });
}

function watchForUpdate(registration) {
  if (!registration) return;
  // SW versi baru sudah menunggu (halaman dibuka ulang setelah update terunduh).
  if (registration.waiting) promptUpdate(registration);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    // Kalau belum ada SW aktif, ini pemasangan pertama — bukan pembaruan.
    const hadActiveWorker = Boolean(registration.active);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && hadActiveWorker) promptUpdate(registration);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      registration.update().catch(() => {});
    }
  });
}

function promptUpdate(registration) {
  if (updatePrompted) return;
  updatePrompted = true;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Hanya muat ulang jika pengguna sendiri yang meminta — bukan saat SW
    // baru mengambil alih halaman untuk pertama kalinya.
    if (!updateRequested) return;
    updateRequested = false;
    window.location.reload();
  });
  showToast('Versi baru MeInsert sudah tersedia.', 'info', 0, {
    label: 'Muat ulang',
    onClick: () => {
      updateRequested = true;
      const waiting = registration.waiting;
      if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
      else window.location.reload();
    },
  });
}
