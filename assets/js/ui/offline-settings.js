/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Settings panel for the optional engine cache. The shell precache stays small;
import { bindText, bindTranslation, t } from '../i18n/index.js';
import { clear, el, formatBytes } from './dom.js';
import { showToast } from './toast.js';
import { ENGINE_VERSION } from '../core/build.js';
import { features } from '../core/format-capabilities.js';
import {
  OFFLINE_PROFILE_KEY,
  estimatedBytes,
  getProfile,
  optionalUrls,
  setProfile,
} from '../core/offline-manifest.js';
const PAGES = new Set(['home', 'single', 'batch']);
const MODE_KEYS = { frugal: 'Habit', selected: 'Selected', all: 'All' };
const EXIT_MS = 160;
const EXIT_SAFETY_MS = EXIT_MS + 100;
const INACTIVITY_MS = 60_000;
const TERMINAL_STATES = new Set(['cached', 'failed', 'cancelled']);
let trigger = null;
let dialog = null;
let refs = null;
let draft = null;
let listening = false;
let lastFocused = null;
let download = {
  active: false, jobId: '', state: 'idle', cached: 0, failed: 0, total: 0, bytes: 0, totalBytes: 0,
};
let inactivityTimer = 0;
let jobCounter = 0;
let closeTimer = 0;
let closeFinish = null;
let closeAnimationEnd = null;
const cachedUrls = new Set();
function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
function saveDataEnabled() {
  return Boolean(globalThis.navigator?.connection?.saveData);
}
function absoluteUrl(value) {
  try {
    return new URL(value, globalThis.document?.baseURI || globalThis.location?.href).href;
  } catch {
    return String(value);
  }
}
function rememberCached(url) {
  if (url) cachedUrls.add(absoluteUrl(url));
}
function featureReady(feature) {
  return feature.urls.every((url) => cachedUrls.has(absoluteUrl(url)));
}
function newJobId() {
  jobCounter += 1;
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '')
    || Math.random().toString(36).slice(2);
  return `job${Date.now().toString(36)}${jobCounter}${random}`;
}
function matchesJob(data) {
  return Boolean(download.jobId) && data?.jobId === download.jobId;
}
function clearInactivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = 0;
}
function resetInactivity() {
  clearInactivity();
  if (!download.active) return;
  const jobId = download.jobId;
  inactivityTimer = setTimeout(() => {
    inactivityTimer = 0;
    if (!download.active || download.jobId !== jobId) return;
    postToSw({ type: 'CANCEL_OPTIONAL', jobId, version: ENGINE_VERSION });
    endDownload('failed', t('ui.engineDownloadStalled'), 'warn');
  }, INACTIVITY_MS);
}
function reduceMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
}
function cancelClose() {
  clearTimeout(closeTimer);
  closeTimer = 0;
  if (dialog && closeAnimationEnd) dialog.removeEventListener('animationend', closeAnimationEnd);
  closeAnimationEnd = null;
  closeFinish = null;
  dialog?.classList.remove('is-closing');
}
function requestClose() {
  if (!dialog?.open || dialog.classList.contains('is-closing')) return;
  if (reduceMotion()) {
    dialog.close();
    return;
  }
  const instance = dialog;
  instance.classList.add('is-closing');
  const finish = () => {
    if (!closeFinish) return;
    cancelClose();
    if (instance.open) instance.close();
  };
  const onEnd = (event) => {
    if (event.target === instance && event.animationName === 'offline-settings-out') finish();
  };
  closeAnimationEnd = onEnd;
  closeFinish = finish;
  instance.addEventListener('animationend', onEnd);
  closeTimer = setTimeout(finish, EXIT_SAFETY_MS);
}
function gearIcon() {
  const span = document.createElement('span');
  span.className = 'icon offline-settings__icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    + '<circle cx="12" cy="12" r="3"/>'
    + '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'
    + '</svg>';
  return span;
}
function swController() {
  try { return globalThis.navigator?.serviceWorker?.controller || null; } catch { return null; }
}
function postToSw(message) {
  const controller = swController();
  if (!controller) return false;
  try {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => handleSwMessage(event.data);
    controller.postMessage(message, [channel.port2]);
    return true;
  } catch {
    try { controller.postMessage(message); return true; } catch { return false; }
  }
}
function askOptionalStatus() {
  postToSw({ type: 'OPTIONAL_STATUS', version: ENGINE_VERSION });
}
function setStatus(message, kind = 'info') {
  if (!refs) return;
  clear(refs.status);
  refs.status.textContent = message;
  refs.status.dataset.kind = kind;
}
function renderProgress() {
  if (!refs) return;
  const done = download.cached + download.failed;
  let text = t('ui.engineLoadingMetadata');
  if (download.state === 'queued') {
    text = t('ui.engineDownloadQueued');
  } else if (download.total > 0) {
    const args = { v0: String(done), v1: String(download.total) };
    text = download.bytes > 0
      ? t('ui.engineDownloadProgressBytes', { ...args, v2: formatBytes(download.bytes) })
      : t('ui.engineDownloadProgress', args);
  }
  refs.progressText.textContent = text;
  refs.fill.style.width = download.total > 0 ? `${Math.min(100, (done / download.total) * 100)}%` : '0%';
  refs.progress.classList.toggle('is-indeterminate', download.total === 0);
}
function endDownload(state, message, kind) {
  clearInactivity();
  download.active = false;
  download.state = state;
  download.jobId = '';
  if (refs) refs.progress.hidden = true;
  setStatus(message, kind);
  showToast(message, state === 'cached' ? 'success' : 'error');
  askOptionalStatus();
  render();
}
function finishDownload(data) {
  if (!matchesJob(data)) return;
  download.cached = data.cached || 0;
  download.failed = data.failed || 0;
  download.total = data.total || download.total;
  download.totalBytes = data.bytes || data.totalBytes || 0;
  if (data.cancelled) endDownload('cancelled', t('ui.engineDownloadCancelled'), 'info');
  else if (download.failed > 0 && download.cached > 0) endDownload('failed', t('ui.offlinePartial'), 'warn');
  else if (download.failed > 0) endDownload('failed', t('ui.engineDownloadFailed'), 'warn');
  else endDownload('cached', t('ui.engineDownloadCached'), 'ok');
}
function handleSwMessage(data) {
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
  if (data.type === 'OPTIONAL_CLEARED') {
    if (download.active) return;
    cachedUrls.clear();
    setStatus(t('ui.offlineSaved'), 'ok');
    showToast(t('ui.offlineSaved'), 'success');
    render();
    return;
  }
  if (data.type === 'OPTIONAL_STATUS_RESULT') {
    if (download.active) return;
    cachedUrls.clear();
    for (const url of data.urls || []) rememberCached(url);
    render();
    return;
  }
  if (!matchesJob(data)) return;
  if (data.type === 'OPTIONAL_START') {
    download.cached = 0;
    download.failed = 0;
    download.total = data.total || 0;
    download.bytes = 0;
    download.state = 'downloading';
    if (refs) refs.progress.hidden = false;
    resetInactivity();
    renderProgress();
    setStatus(t('ui.engineLoadingMetadata'));
    render();
  } else if (data.type === 'OPTIONAL_BYTES') {
    if (data.totalBytes > download.bytes) {
      download.bytes = data.totalBytes;
      resetInactivity();
      renderProgress();
    }
  } else if (data.type === 'OPTIONAL_PROGRESS') {
    download.cached = data.cached || 0;
    download.failed = data.failed || 0;
    download.total = data.total || download.total;
    download.bytes = data.totalBytes || download.bytes;
    download.totalBytes = data.totalBytes || download.totalBytes;
    if (data.ok) rememberCached(data.url);
    resetInactivity();
    renderProgress();
  } else if (data.type === 'OPTIONAL_CANCELLED') {
    endDownload('cancelled', t('ui.engineDownloadCancelled'), 'info');
  } else if (data.type === 'OPTIONAL_ERROR') {
    endDownload('failed', t('ui.engineDownloadInvalid'), 'warn');
  } else if (data.type === 'OPTIONAL_DONE') {
    finishDownload(data);
  }
}
globalThis.addEventListener?.('message', (event) => {
  if (event.source === swController()) handleSwMessage(event.data);
});
function setStatusFromPersistence(ok) {
  setStatus(t(ok ? 'ui.offlineSaved' : 'ui.offlinePartial'), ok ? 'ok' : 'warn');
}
function saveDraft(next) {
  draft = next;
  setStatusFromPersistence(setProfile(storage(), draft));
  render();
}
function onModeChange(mode) {
  if (saveDataEnabled() && mode !== 'frugal') return;
  const selected = mode === 'all' ? features().map((feature) => feature.id)
    : mode === 'selected' ? [...draft.features] : [];
  saveDraft({ ...draft, mode, features: selected, updatedAt: Date.now() });
}
function onFeatureChange(id, checked) {
  if (saveDataEnabled()) return;
  const selected = new Set(draft.features);
  if (checked) selected.add(id);
  else selected.delete(id);
  saveDraft({ ...draft, mode: 'selected', features: [...selected], updatedAt: Date.now() });
}
function startDownload(all) {
  if (download.active || saveDataEnabled()) return;
  const next = all
    ? { ...draft, mode: 'all', features: features().map((feature) => feature.id), updatedAt: Date.now() }
    : draft;
  const urls = optionalUrls(next);
  if (!urls.length) {
    setStatus(t('ui.offlinePartial'), 'warn');
    return;
  }
  draft = next;
  render();
  const jobId = newJobId();
  if (!setProfile(storage(), draft)
    || !postToSw({ type: 'CACHE_OPTIONAL', jobId, urls, version: ENGINE_VERSION })) {
    setStatus(t('ui.offlinePartial'), 'warn');
    showToast(t('ui.offlinePartial'), 'error');
    render();
    return;
  }
  download = {
    active: true, jobId, state: 'queued', cached: 0, failed: 0, total: urls.length, bytes: 0, totalBytes: 0,
  };
  if (refs) refs.progress.hidden = false;
  renderProgress();
  setStatus(t('ui.engineDownloadQueued'));
  render();
  resetInactivity();
}
function retryDownload() {
  if (download.active || !TERMINAL_STATES.has(download.state)) return;
  startDownload(false);
}
function cancelDownload() {
  if (!download.active || !download.jobId) return;
  const jobId = download.jobId;
  postToSw({ type: 'CANCEL_OPTIONAL', jobId, version: ENGINE_VERSION });
  endDownload('cancelled', t('ui.engineDownloadCancelled'), 'info');
}
function clearOptional() {
  if (download.active) return;
  if (!postToSw({ type: 'CLEAR_OPTIONAL', version: ENGINE_VERSION })) {
    setStatus(t('ui.offlinePartial'), 'warn');
    showToast(t('ui.offlinePartial'), 'error');
    return;
  }
  setStatus(t('ui.engineLoadingMetadata'));
}
function buildDialog() {
  if (dialog) return dialog;
  const title = el('h2', { id: 'offlineSettingsTitle', className: 'offline-settings__title' });
  bindText(title, () => t('ui.storageOffline'));
  const closeBtn = el('button', {
    className: 'offline-settings__close icon-button',
    type: 'button',
    on: { click: () => requestClose() },
  }, '\u00d7');
  bindTranslation(closeBtn, 'aria-label', () => t('ui.close'));
  const note = el('p', { className: 'offline-settings__note', hidden: true });
  bindText(note, () => t('ui.offlineSaveDataNote'));
  const modeInputs = {};
  const modes = el('fieldset', { className: 'offline-settings__modes' });
  for (const mode of Object.keys(MODE_KEYS)) {
    const input = el('input', {
      type: 'radio',
      name: 'offlineMode',
      value: mode,
      id: `offlineMode-${mode}`,
      on: { change: () => onModeChange(mode) },
    });
    modeInputs[mode] = input;
    const name = el('strong');
    bindText(name, () => t(`ui.offline${MODE_KEYS[mode]}`));
    const hint = el('small');
    bindText(hint, () => t(`ui.offline${MODE_KEYS[mode]}Hint`));
    modes.append(el('label', {
      className: `offline-settings__option is-${mode}`,
      for: input.id,
    }, input, el('span', { className: 'offline-settings__option-text' }, name, hint)));
  }
  const featureInputs = new Map();
  const featureHeading = el('h3', { className: 'offline-settings__features-title' });
  const featureHeadingLabel = el('span');
  bindText(featureHeadingLabel, () => t('ui.offlineSelected'));
  const estimate = el('span', { className: 'offline-settings__estimate' });
  featureHeading.append(featureHeadingLabel, document.createTextNode(' · '), estimate);
  const featureList = el('div', { className: 'offline-settings__features', hidden: true }, featureHeading);
  for (const feature of features()) {
    const input = el('input', {
      type: 'checkbox',
      value: feature.id,
      id: `offlineFeature-${feature.id}`,
      on: { change: () => onFeatureChange(feature.id, input.checked) },
    });
    featureInputs.set(feature.id, input);
    const name = el('span', { className: 'offline-settings__feature-name' });
    bindText(name, () => t(feature.labelKey));
    const ready = el('span', { className: 'offline-settings__feature-status' });
    bindText(ready, () => t(featureReady(feature) ? 'ui.offlineFeatureReady' : 'ui.offlineFeatureNotReady'));
    featureList.append(el('label', {
      className: 'offline-settings__feature',
      for: input.id,
    }, input, name, ready, el('span', {
      className: 'offline-settings__feature-size',
      textContent: formatBytes(feature.bytes),
    })));
  }
  const status = el('p', { className: 'offline-settings__status', role: 'status', 'aria-live': 'polite' });
  const progressText = el('span', { className: 'offline-settings__progress-text', role: 'status', 'aria-live': 'polite' });
  const fill = el('span', { className: 'offline-settings__fill' });
  const progress = el('div', { className: 'offline-settings__progress', hidden: true },
    progressText,
    el('span', { className: 'offline-settings__bar', 'aria-hidden': 'true' }, fill),
  );
  const clearBtn = el('button', {
    className: 'button ghost offline-settings__clear',
    type: 'button',
    on: { click: clearOptional },
  });
  bindText(clearBtn, () => t('ui.offlineClearOptional'));
  const cancelBtn = el('button', {
    className: 'button ghost offline-settings__cancel',
    type: 'button',
    hidden: true,
    on: { click: cancelDownload },
  });
  bindText(cancelBtn, () => t('ui.cancel'));
  const retryBtn = el('button', {
    className: 'button ghost offline-settings__retry',
    type: 'button',
    hidden: true,
    on: { click: retryDownload },
  });
  bindText(retryBtn, () => t('ui.retry'));
  const downloadBtn = el('button', {
    className: 'button primary offline-settings__download',
    type: 'button',
    on: { click: () => startDownload(false) },
  });
  bindText(downloadBtn, () => t('ui.offlineDownload'));
  const downloadAllBtn = el('button', {
    className: 'button offline-settings__download-all',
    type: 'button',
    on: { click: () => startDownload(true) },
  });
  bindText(downloadAllBtn, () => t('ui.offlineDownloadAll'));
  dialog = el('dialog', {
    id: 'offlineSettingsDialog',
    className: 'offline-settings',
    role: 'dialog',
    'aria-labelledby': 'offlineSettingsTitle',
    'aria-modal': 'false',
  }, el('div', { className: 'offline-settings__panel' },
    el('header', { className: 'offline-settings__head' }, title, closeBtn),
    el('div', { className: 'offline-settings__body' }, note, modes, featureList, status, progress),
    el('footer', { className: 'offline-settings__actions' }, clearBtn, cancelBtn, retryBtn, downloadBtn, downloadAllBtn),
  ));
  dialog.addEventListener('close', () => {
    cancelClose();
    if (download.active && download.jobId) {
      postToSw({ type: 'CANCEL_OPTIONAL', jobId: download.jobId, version: ENGINE_VERSION });
    }
    clearInactivity();
    download.active = false;
    download.jobId = '';
    download.state = 'idle';
    trigger?.setAttribute('aria-expanded', 'false');
    lastFocused?.focus?.();
  });
  document.body.append(dialog);
  refs = {
    closeBtn, note, modeInputs, featureInputs, featureList, estimate, status, progress,
    progressText, fill, clearBtn, cancelBtn, retryBtn, downloadBtn, downloadAllBtn,
  };
  return dialog;
}
function render() {
  if (!refs || !draft) return;
  const saveData = saveDataEnabled();
  if (saveData && draft.mode !== 'frugal') {
    draft = { mode: 'frugal', features: [], updatedAt: Date.now() };
    setProfile(storage(), draft);
  }
  refs.note.hidden = !saveData;
  for (const [mode, input] of Object.entries(refs.modeInputs)) {
    input.checked = draft.mode === mode;
    input.disabled = saveData && mode !== 'frugal';
  }
  refs.featureList.hidden = draft.mode !== 'selected';
  refs.estimate.textContent = formatBytes(estimatedBytes(draft));
  for (const [id, input] of refs.featureInputs) {
    input.checked = draft.features.includes(id);
    input.disabled = saveData;
  }
  refs.clearBtn.disabled = download.active;
  refs.cancelBtn.hidden = !download.active;
  refs.retryBtn.hidden = download.active || !TERMINAL_STATES.has(download.state);
  refs.downloadBtn.disabled = saveData || download.active || optionalUrls(draft).length === 0;
  refs.downloadAllBtn.disabled = saveData || download.active;
  renderProgress();
}
function trapFocus(event) {
  const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((node) => node.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function onGlobalKeydown(event) {
  if (!dialog?.open) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    requestClose();
  } else if (event.key === 'Tab') {
    trapFocus(event);
  }
}
export function initOfflineSettings() {
  if (typeof document === 'undefined' || typeof globalThis.addEventListener !== 'function') return;
  if (!listening) {
    listening = true;
    globalThis.addEventListener('meinsert:open-settings', () => openOfflineSettings());
    globalThis.addEventListener('storage', (event) => {
      if (event.key !== OFFLINE_PROFILE_KEY || download.active) return;
      draft = getProfile(storage());
      if (dialog?.open) render();
    });
    globalThis.addEventListener('pagehide', () => {
      if (download.active && download.jobId) {
        postToSw({ type: 'CANCEL_OPTIONAL', jobId: download.jobId, version: ENGINE_VERSION });
      }
      clearInactivity();
      download.active = false;
      download.jobId = '';
    });
    document.addEventListener('keydown', onGlobalKeydown);
  }
  const page = document.body?.dataset?.page;
  if (page && !PAGES.has(page)) return;
  const actions = document.querySelector('.header-actions');
  if (!actions || document.getElementById('settingsBtn')) return;
  trigger = el('button', {
    id: 'settingsBtn',
    className: 'icon-button offline-settings__trigger',
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    on: { click: () => openOfflineSettings() },
  });
  bindTranslation(trigger, 'aria-label', () => t('ui.settings'));
  bindTranslation(trigger, 'title', () => t('ui.settings'));
  trigger.append(gearIcon());
  const about = document.getElementById('aboutLink');
  if (about && about.parentNode === actions) actions.insertBefore(trigger, about);
  else actions.append(trigger);
}
export function openOfflineSettings() {
  initOfflineSettings();
  if (typeof document === 'undefined') return;
  cancelClose();
  const instance = buildDialog();
  if (!instance.isConnected) document.body.append(instance);
  lastFocused = document.activeElement;
  draft = getProfile(storage());
  render();
  if (instance.open) {
    instance.focus();
    return;
  }
  instance.show();
  trigger?.setAttribute('aria-expanded', 'true');
  const first = refs.modeInputs[saveDataEnabled() ? 'frugal' : draft.mode] || refs.closeBtn;
  first.focus();
  askOptionalStatus();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initOfflineSettings(), { once: true });
  } else {
    initOfflineSettings();
  }
}