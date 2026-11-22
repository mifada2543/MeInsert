/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Trimming UI for audio/video files. The requested range is only staged in editor state; no media bytes are decoded or uploaded here. The actual cut is performed later by the write path using core/media-cut.js helpers.
import { bindText, t, translated } from '../i18n/index.js';
import { clear, el, qs } from './dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { beginChange, endChange } from '../core/history.js';
import { setTrim } from '../editor/editor-state.js';
import { syncActionBar } from '../editor/editor-changes.js';
import { CUT_MODES, expectedCutDuration, normalizeTrim } from '../core/media-cut.js';
import { ensureFeatureOffline } from './offline-settings.js';
const EXIT_MS = 160;
const EXIT_SAFETY_MS = EXIT_MS + 100;
const AUDIO_EXTS = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus']);
const VIDEO_EXTS = new Set(['mp4', 'm4a', 'mov', 'mkv', 'webm']);
const SUPPORTED_EXTS = new Set([...AUDIO_EXTS, ...VIDEO_EXTS]);
let dialog = null;
let refs = null;
let state = null;
let lastFocused = null;
let listening = false;
let closeTimer = 0;
let closeFinish = null;
let closeAnimationEnd = null;
function extensionOf(file) {
  return String(file?.name || '').toLowerCase().split('.').pop();
}
function supportsFile(file) {
  return SUPPORTED_EXTS.has(extensionOf(file));
}
function cutModeForFile(file) {
  return VIDEO_EXTS.has(extensionOf(file)) ? 'video' : 'audio';
}
function reduceMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
}
function formatTime(value) {
  const total = Math.max(0, Math.round((Number(value) || 0) * 1000));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
function parseTime(input, fallback = 0) {
  const raw = String(input ?? '').trim().replace(',', '.');
  if (!raw) return fallback;
  if (!raw.includes(':')) {
    const plain = Number(raw);
    return Number.isFinite(plain) && plain >= 0 ? plain : fallback;
  }
  const match = /^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(raw);
  if (!match) return fallback;
  const total = Number(match[1]) * 60 + Number(match[2]) + Number((match[3] || '').padEnd(3, '0')) / 1000;
  return Number.isFinite(total) ? total : fallback;
}
function currentMode() {
  return refs?.modePrecise?.checked ? CUT_MODES.PRECISE : CUT_MODES.COPY;
}
function currentTime() {
  return Math.max(0, Number(state?.mediaEl?.currentTime) || 0);
}
function mediaDuration() {
  const duration = Number(state?.mediaEl?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}
function setStatus(message = '', kind = 'info') {
  if (!refs?.status) return;
  refs.status.textContent = message;
  refs.status.dataset.kind = kind;
}
function invalidRange() {
  const message = t('ui.cutInvalidRange');
  setStatus(message, 'error');
  showToast(message, 'error', 4200);
}
function updateRisks() {
  if (!refs?.risks || !state) return;
  clear(refs.risks);
  const mode = currentMode();
  const rows = [];
  if (mode === CUT_MODES.PRECISE) rows.push(t('ui.cutRiskReencode'));
  else if (state.mode === 'video') rows.push(t('ui.cutRiskChapters'));
  if (extensionOf(state.file) === 'mp3') rows.push(t('ui.cutRiskXing'));
  rows.push(t('ui.cutMemoryHint'));
  for (const text of rows) refs.risks.append(el('li', { className: 'cut-dialog__risk' }, text));
}
function updateModeHint() {
  if (!refs) return;
  const precise = currentMode() === CUT_MODES.PRECISE;
  if (refs.hintCopy) refs.hintCopy.hidden = precise;
  if (refs.hintPrecise) refs.hintPrecise.hidden = !precise;
}
function updateSummary() {
  if (!refs) return;
  const start = parseTime(refs.start.value, 0);
  const end = parseTime(refs.end.value, 0);
  const duration = mediaDuration();
  const mode = currentMode();
  const normalized = normalizeTrim({ start, end, mode }, { duration: duration || Infinity });
  let estimate = expectedCutDuration(normalized || { start, end: Math.max(start, end), mode });
  if (!Number.isFinite(estimate) || estimate < 0) estimate = Math.max(0, end - start);
  refs.duration.textContent = formatTime(estimate);
  if (refs.plan) {
    refs.plan.textContent = t('ui.cutPlanRow', {
      v0: formatTime(start), v1: formatTime(end), v2: formatTime(estimate),
    });
  }
  updateModeHint();
  updateRisks();
}
function setupPreview(file) {
  clear(refs.preview);
  for (const [target, type, handler] of state.mediaListeners || []) target.removeEventListener(type, handler);
  for (const [target, type, handler] of state.rangeListeners || []) target.removeEventListener(type, handler);
  state.mediaListeners = [];
  state.rangeListeners = [];
  if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  state.mediaUrl = '';
  state.mediaEl = null;
  if (!file) return;
  const url = URL.createObjectURL(file);
  state.mediaUrl = url;
  const media = document.createElement(state.mode === 'video' ? 'video' : 'audio');
  media.className = 'cut-dialog__media';
  media.controls = true;
  media.preload = 'metadata';
  if (state.mode === 'video') media.playsInline = true;
  media.src = url;
  const onMeta = () => {
    if (!state.trimProvided && !refs.end.value && mediaDuration()) refs.end.value = formatTime(mediaDuration());
    updateSummary();
  };
  media.addEventListener('loadedmetadata', onMeta);
  media.addEventListener('durationchange', onMeta);
  state.mediaListeners.push([media, 'loadedmetadata', onMeta], [media, 'durationchange', onMeta]);
  refs.preview.append(media);
  state.mediaEl = media;
}
function mark(field) {
  if (!refs?.[field]) return;
  refs[field].value = formatTime(currentTime());
  setStatus('', 'info');
  updateSummary();
}
function playRange() {
  const media = state?.mediaEl;
  if (!media) return;
  const start = parseTime(refs.start.value, 0);
  const end = parseTime(refs.end.value, 0);
  if (!(end > start)) { invalidRange(); return; }
  const stopAtEnd = () => {
    if (Number(media.currentTime) + 0.001 < end) return;
    media.pause();
    media.removeEventListener('timeupdate', stopAtEnd);
    state.rangeListeners = state.rangeListeners.filter((entry) => entry[2] !== stopAtEnd);
  };
  media.addEventListener('timeupdate', stopAtEnd);
  state.rangeListeners.push([media, 'timeupdate', stopAtEnd]);
  try { media.currentTime = Math.min(start, mediaDuration() || start); } catch { /* seek not ready */ }
  const attempt = media.play();
  if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
}
function resetValues() {
  if (!refs) return;
  refs.start.value = formatTime(0);
  refs.end.value = formatTime(mediaDuration());
  refs.modeCopy.checked = true;
  refs.modePrecise.checked = false;
  setStatus('', 'info');
  updateSummary();
}
function applyCut() {
  if (!state) return;
  const duration = mediaDuration();
  const input = {
    start: parseTime(refs.start.value, 0),
    end: parseTime(refs.end.value, 0),
    mode: currentMode(),
  };
  if (extensionOf(state.file) === 'mp3' && input.mode === CUT_MODES.PRECISE) {
    setStatus('Mode presisi belum tersedia untuk MP3; gunakan mode Salin.', 'error');
    return;
  }
  const next = normalizeTrim(input, { duration: duration || Infinity });
  if (!next) { invalidRange(); return; }
  const handler = state.onApply;
  const applied = { start: next.start, end: next.end, mode: next.mode };
  void onRequestClose();
  handler?.(applied);
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
  if (reduceMotion()) { dialog.close(); return; }
  const instance = dialog;
  instance.classList.add('is-closing');
  const finish = () => {
    if (!closeFinish) return;
    cancelClose();
    if (instance.open) instance.close();
  };
  const onEnd = (event) => {
    if (event.target === instance && event.animationName === 'cut-dialog-out') finish();
  };
  closeAnimationEnd = onEnd;
  closeFinish = finish;
  instance.addEventListener('animationend', onEnd);
  closeTimer = setTimeout(finish, EXIT_SAFETY_MS);
}
function onRequestClose() { requestClose(); }
function trapFocus(event) {
  const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((node) => node.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function onGlobalKeydown(event) {
  if (!dialog?.open || !state) return;
  if (event.key === 'Escape') { event.preventDefault(); requestClose(); }
  else if (event.key === 'Tab') trapFocus(event);
}
function cleanupSession() {
  cancelClose();
  if (state) {
    for (const [target, type, handler] of state.mediaListeners || []) target.removeEventListener(type, handler);
    for (const [target, type, handler] of state.rangeListeners || []) target.removeEventListener(type, handler);
    if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
    if (refs) clear(refs.preview);
    state = null;
  }
  if (listening) {
    document.removeEventListener('keydown', onGlobalKeydown);
    listening = false;
  }
  lastFocused?.focus?.();
  lastFocused = null;
}
function actionButton({ id, className = '', iconName, labelKey, onClick }) {
  const label = el('span', { className: 'cut-dialog__btn-label' });
  bindText(label, () => t(labelKey));
  return el('button', {
    id,
    className: `cut-dialog__btn ${className}`.trim(),
    type: 'button',
    on: { click: onClick },
  }, icon(iconName), label);
}
function timeField({ id, key, labelKey, buttonId, buttonKey }) {
  const input = el('input', {
    id,
    className: 'cut-dialog__time',
    type: 'text',
    inputmode: 'decimal',
    spellcheck: 'false',
    autocomplete: 'off',
    pattern: '[0-9]{2}:[0-9]{2}\\.[0-9]{3}',
    on: {
      change: (event) => { event.target.value = formatTime(parseTime(event.target.value)); updateSummary(); },
      input: () => updateSummary(),
      keydown: (event) => event.stopPropagation(),
    },
  });
  const button = actionButton({ id: buttonId, iconName: 'clock', labelKey: buttonKey, onClick: () => mark(key) });
  const label = el('label', { className: 'cut-dialog__label', for: id });
  bindText(label, () => t(labelKey));
  return {
    input,
    row: el('div', { className: 'cut-dialog__field' }, label, el('div', { className: 'cut-dialog__time-row' }, input, button)),
  };
}
function buildDialog() {
  if (dialog) return dialog;
  const title = el('h2', { id: 'cutTitle', className: 'cut-dialog__title' });
  bindText(title, () => t(state?.mode === 'video' ? 'ui.cutTitleVideo' : 'ui.cutTitleAudio'));
  const badge = el('span', { className: 'cut-dialog__badge' });
  bindText(badge, () => t(state?.mode === 'video' ? 'ui.cutOpenVideo' : 'ui.cutOpenAudio'));
  const closeBtn = el('button', {
    className: 'cut-dialog__close',
    type: 'button',
    title: translated(() => t('ui.cutCancel')),
    'aria-label': translated(() => t('ui.cutCancel')),
    on: { click: () => requestClose() },
  }, icon('x'));
  const preview = el('div', { className: 'cut-dialog__preview' });
  const offlineNote = el('p', { className: 'cut-dialog__offline-note' });
  bindText(offlineNote, () => t('ui.cutNeedsOffline'));
  const previewPane = el('section', { className: 'cut-dialog__pane cut-dialog__pane--preview' },
    el('h3', { className: 'cut-dialog__pane-title' }, translated(() => t('ui.cutOpen'))), preview, offlineNote);
  const start = timeField({ id: 'cutStart', key: 'start', labelKey: 'ui.cutStart', buttonId: 'cutSetStart', buttonKey: 'ui.cutSetStart' });
  const end = timeField({ id: 'cutEnd', key: 'end', labelKey: 'ui.cutEnd', buttonId: 'cutSetEnd', buttonKey: 'ui.cutSetEnd' });
  const playBtn = actionButton({ id: 'cutPlayRange', className: 'cut-dialog__btn--play', iconName: 'play', labelKey: 'ui.cutPlayRange', onClick: () => playRange() });
  const modeCopy = el('input', { type: 'radio', name: 'cutMode', id: 'cutModeCopy', value: CUT_MODES.COPY, checked: true, on: { change: () => updateSummary() } });
  const modePrecise = el('input', { type: 'radio', name: 'cutMode', id: 'cutModePrecise', value: CUT_MODES.PRECISE, on: { change: () => updateSummary() } });
  const hintCopy = el('small', { className: 'cut-dialog__hint' });
  bindText(hintCopy, () => t('ui.cutModeCopyHint'));
  const hintPrecise = el('small', { className: 'cut-dialog__hint' });
  bindText(hintPrecise, () => t('ui.cutModePreciseHint'));
  hintPrecise.hidden = true;
  const modeLabelCopy = el('span', { className: 'cut-dialog__mode-name' });
  bindText(modeLabelCopy, () => t('ui.cutModeCopy'));
  const modeLabelPrecise = el('span', { className: 'cut-dialog__mode-name' });
  bindText(modeLabelPrecise, () => t('ui.cutModePrecise'));
  const modeLegend = el('legend', { className: 'cut-dialog__label' });
  bindText(modeLegend, () => t('ui.cutMode'));
  const modes = el('fieldset', { className: 'cut-dialog__modes' }, modeLegend,
    el('label', { className: 'cut-dialog__mode', for: modeCopy.id }, modeCopy, modeLabelCopy),
    el('label', { className: 'cut-dialog__mode', for: modePrecise.id }, modePrecise, modeLabelPrecise),
    hintCopy, hintPrecise);
  const durationLabel = el('span', { className: 'cut-dialog__label' });
  bindText(durationLabel, () => t('ui.cutDuration'));
  const duration = el('output', { id: 'cutDuration', className: 'cut-dialog__duration', for: 'cutStart cutEnd' }, formatTime(0));
  const resultLabel = el('small', { className: 'cut-dialog__hint' });
  bindText(resultLabel, () => t('ui.cutResultEstimate'));
  const plan = el('p', { className: 'cut-dialog__plan' });
  const risks = el('ul', { className: 'cut-dialog__risks' });
  const status = el('p', { id: 'cutStatus', className: 'cut-dialog__status', role: 'status', 'aria-live': 'polite' });
  const formPane = el('section', { className: 'cut-dialog__pane cut-dialog__pane--form' },
    start.row, end.row,
    el('div', { className: 'cut-dialog__time-actions' }, playBtn),
    modes,
    el('div', { className: 'cut-dialog__summary' }, durationLabel, duration, resultLabel, plan),
    risks, status);
  const resetBtn = actionButton({ id: 'cutReset', className: 'cut-dialog__btn--quiet', iconName: 'refresh', labelKey: 'ui.cutReset', onClick: () => resetValues() });
  const cancelBtn = actionButton({ id: 'cutCancel', className: 'cut-dialog__btn--quiet', iconName: 'x', labelKey: 'ui.cutCancel', onClick: () => requestClose() });
  const applyBtn = actionButton({ id: 'cutApply', className: 'cut-dialog__btn--apply', iconName: 'scissors', labelKey: 'ui.cutApply', onClick: () => applyCut() });
  dialog = el('dialog', {
    id: 'cutDialog',
    className: 'cut-dialog',
    role: 'dialog',
    'aria-labelledby': 'cutTitle',
    'aria-modal': 'true',
    on: {
      cancel: (event) => { event.preventDefault(); requestClose(); },
      close: () => cleanupSession(),
    },
  }, el('div', { className: 'cut-dialog__panel' },
    el('header', { className: 'cut-dialog__head' },
      el('div', { className: 'cut-dialog__heading' }, badge, title), closeBtn),
    el('div', { className: 'cut-dialog__body' }, previewPane, formPane),
    el('footer', { className: 'cut-dialog__actions' },
      el('div', { className: 'cut-dialog__actions-left' }, resetBtn, cancelBtn), applyBtn)));
  document.body.append(dialog);
  refs = {
    preview, start: start.input, end: end.input, duration, plan, risks, status,
    modeCopy, modePrecise, hintCopy, hintPrecise, closeBtn,
  };
  return dialog;
}
export function openCutEditor({ file, trim, onApply } = {}) {
  if (typeof document === 'undefined') return;
  cancelClose();
  const instance = buildDialog();
  if (!instance.isConnected) document.body.append(instance);
  if (state?.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  lastFocused = document.activeElement;
  const mode = cutModeForFile(file);
  const trimmed = trim && typeof trim === 'object' ? trim : null;
  state = {
    file: file || null,
    mode,
    onApply: typeof onApply === 'function' ? onApply : null,
    trimProvided: Boolean(trimmed && Number.isFinite(Number(trimmed.start)) && Number.isFinite(Number(trimmed.end))),
    mediaUrl: '',
    mediaEl: null,
    mediaListeners: [],
    rangeListeners: [],
  };
  instance.dataset.mode = mode;
  refs.start.value = state.trimProvided ? formatTime(trimmed.start) : formatTime(0);
  refs.end.value = state.trimProvided ? formatTime(trimmed.end) : '';
  const mp3 = extensionOf(file) === 'mp3';
  refs.modePrecise.disabled = mp3;
  refs.modePrecise.checked = !mp3 && trimmed?.mode === CUT_MODES.PRECISE;
  refs.modeCopy.checked = !refs.modePrecise.checked;
  setStatus('', 'info');
  setupPreview(file);
  updateSummary();
  if (!listening) {
    listening = true;
    document.addEventListener('keydown', onGlobalKeydown);
  }
  if (instance.open) { instance.focus(); return; }
  instance.showModal();
  refs.closeBtn?.focus?.();
}
export function mountCutButton({ container, ctx } = {}) {
  if (typeof document === 'undefined' || !ctx?.state) return null;
  const target = document.getElementById('actionOptions') || container;
  const host = target || qs('.action-bar');
  if (!host) return null;
  const existing = qs('#cutBtn', host);
  if (existing) return existing;
  const buttonIcon = el('span', { className: 'cut-btn__icon' }, icon('scissors'));
  const buttonLabel = el('span', { className: 'cut-btn__label' });
  bindText(buttonLabel, () => t(cutModeForFile(ctx.state?.file) === 'video' ? 'ui.cutOpenVideo' : 'ui.cutOpenAudio'));
  const button = el('button', {
    type: 'button',
    id: 'cutBtn',
    className: 'button ghost small cut-btn',
    title: translated(() => t('ui.cutOpen')),
    'aria-label': translated(() => t('ui.cutOpen')),
  }, buttonIcon, buttonLabel);
  button.hidden = !supportsFile(ctx.state?.file);
  window.addEventListener('meinsert:fileReady', () => {
    button.hidden = !supportsFile(ctx.state?.file);
    if (button.hidden) return;
    const mode = cutModeForFile(ctx.state?.file);
    buttonLabel.textContent = t(mode === 'video' ? 'ui.cutOpenVideo' : 'ui.cutOpenAudio');
    button.title = buttonLabel.textContent;
    button.setAttribute('aria-label', buttonLabel.textContent);
  });
  button.addEventListener('click', () => {
    const editorState = ctx.state;
    const file = editorState?.file;
    if (!file || editorState.status !== 'ready' || !supportsFile(file)) {
      showToast(t('ui.cutUnsupported'), 'info', 4200);
      return;
    }
    const feature = cutModeForFile(file) === 'audio' ? 'audio' : 'image';
    if (!ensureFeatureOffline(feature)) return;
    openCutEditor({
      file,
      trim: editorState.trim,
      onApply: (next) => {
        beginChange(editorState.history, 'trim', t('ui.changeHistoryCut', { v0: formatTime(next.start), v1: formatTime(next.end) }));
        setTrim(editorState, next);
        endChange(editorState.history);
        syncActionBar(ctx.els, editorState);
      },
    });
  });
  host.insertBefore(button, qs('.action-buttons', host) || null);
  return button;
}
export function closeCutEditor() {
  if (!dialog) return;
  if (!dialog.open) {
    cleanupSession();
    dialog.remove();
    dialog = null;
    refs = null;
    return;
  }
  requestClose();
}