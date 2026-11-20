/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Ported from MEeL — https://github.com/mifada2543/MEeL-HUB @ 95e4937c
 * Copyright (C) 2026 Mifada (mifada2543) — AGPL-3.0-or-later
 * Source: assets/js/music/lrc-editor.js, assets/js/music/watch/karaoke.js, assets/css/music/lrc-editor.css
 * Modified for MeInsert: dialog instead of PHP page, object-URL preview, editor state instead of localStorage, MeInsert tokens, watermark added. */
import { bindText, t, translated } from '../i18n/index.js';
import { clear, el, qs } from './dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { beginChange, endChange } from '../core/history.js';
import { setSidecar } from '../editor/editor-state.js';
import { syncActionBar } from '../editor/editor-changes.js';
import {
  formatTimestamp,
  parseLrc,
  parseSrt,
  parseVtt,
  serializeLrc,
  serializeVtt,
} from '../core/timed-text.js';

const EXIT_MS = 160;
const EXIT_SAFETY_MS = EXIT_MS + 100;
const TOLERANCE_MS = 150;
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogm', 'mkv', 'avi']);
const AUDIO_EXTS = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'wav']);
const TIMED_TEXT_EXTS = new Set([...VIDEO_EXTS, ...AUDIO_EXTS]);

/** Extension decides the editor mode: audio files edit lyrics, video files edit subtitles. */
function mediaModeForFile(file) {
  const ext = String(file?.name || '').toLowerCase().split('.').pop();
  return VIDEO_EXTS.has(ext) ? 'subtitles' : 'lyrics';
}

let dialog = null;
let refs = null;
let state = null;
let lastFocused = null;
let listening = false;
let closeTimer = 0;
let closeFinish = null;
let closeAnimationEnd = null;
let draftTimer = 0;

function reduceMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
}

function clone(value) {
  if (value === null || value === undefined) return value;
  try {
    if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  } catch { /* fall through to JSON clone */ }
  return JSON.parse(JSON.stringify(value));
}

function numberMs(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function stringValue(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeLine(value) {
  const line = Array.isArray(value) ? { time: value[0], text: value[1] } : (value && typeof value === 'object' ? value : {});
  return {
    time: numberMs(line.time ?? line.start),
    text: stringValue(line.text),
  };
}

function normalizeCue(value, index) {
  const cue = value && typeof value === 'object' ? value : {};
  const start = numberMs(cue.start ?? cue.time);
  return {
    id: cue.id ?? index + 1,
    start,
    end: Math.max(start, numberMs(cue.end)),
    text: stringValue(cue.text),
    settings: cue.settings === undefined ? '' : cue.settings,
  };
}

function normalizeLyrics(value) {
  if (Array.isArray(value)) return { lang: 'id', lines: value.map(normalizeLine) };
  const root = value && typeof value === 'object' ? (value.lyrics && typeof value.lyrics === 'object' ? value.lyrics : value) : {};
  const lines = Array.isArray(root.lines) ? root.lines : [];
  return { lang: stringValue(root.lang, 'id'), lines: lines.map(normalizeLine) };
}

function normalizeSubtitles(value) {
  if (Array.isArray(value)) return { lang: 'id', cues: value.map(normalizeCue) };
  const root = value && typeof value === 'object' ? (value.subtitles && typeof value.subtitles === 'object' ? value.subtitles : value) : {};
  const cues = Array.isArray(root.cues) ? root.cues : [];
  return { lang: stringValue(root.lang, 'id'), cues: cues.map(normalizeCue) };
}

function normalizeSidecar(sidecar) {
  const source = sidecar && typeof sidecar === 'object' ? sidecar : {};
  return {
    lyrics: source.lyrics ? normalizeLyrics(source.lyrics) : null,
    subtitles: source.subtitles ? normalizeSubtitles(source.subtitles) : null,
  };
}

function draftKey() {
  const file = state?.file;
  const raw = `${file?.name || ''}|${file?.size || 0}|${file?.lastModified || 0}|${state?.mode || 'lyrics'}`;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `meinsert-timed-text-draft-v1-${(hash >>> 0).toString(36)}`;
}
function readDraft() {
  try {
    const raw = globalThis.localStorage?.getItem(draftKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch { return null; }
}
function updateDraftLabel() {
  if (!refs?.draftLabel) return;
  refs.draftLabel.hidden = !readDraft();
}
function writeDraft() {
  if (!state) return;
  try {
    globalThis.localStorage?.setItem(draftKey(), JSON.stringify({ savedAt: Date.now(), data: state.data }));
    updateDraftLabel();
  } catch { /* storage is optional */ }
}
function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => { draftTimer = 0; writeDraft(); }, 220);
}
function flushDraftSave() {
  if (!draftTimer) return;
  clearTimeout(draftTimer);
  draftTimer = 0;
  writeDraft();
}
function clearDraft() {
  clearTimeout(draftTimer);
  draftTimer = 0;
  try { globalThis.localStorage?.removeItem(draftKey()); } catch { /* storage is optional */ }
  updateDraftLabel();
}

function payloadFor(list, data) {
  const source = Array.isArray(list) ? list : [];
  // Accept either (array) or ({ lines, cues, lang }) signatures in core/timed-text.js.
  const payload = source.slice();
  payload.lines = source;
  payload.cues = source;
  payload.lang = data?.lang || 'id';
  payload.lyrics = data;
  payload.subtitles = data;
  return payload;
}

function fallbackStamp(ms, kind) {
  const value = Math.max(0, Math.round(ms));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const millis = value % 1000;
  if (kind === 'lrc') {
    return `${String(minutes + hours * 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(Math.floor(millis / 10)).padStart(2, '0')}`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatStamp(ms, kind = 'vtt') {
  // The core formatTimestamp() is a compact "MM:SS" label for the player UI;
  // exports need centisecond LRC / millisecond WebVTT, so format locally.
  return fallbackStamp(numberMs(ms), kind);
}

function parseStamp(input, fallback = 0) {
  const raw = String(input ?? '').trim().replace(',', '.');
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(':');
  let seconds = 0;
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isFinite(num) || part === '') return fallback;
    seconds = seconds * 60 + num;
  }
  return Math.round(seconds * 1000);
}

function fromCore(kind, text, lang) {
  let parsed = null;
  try {
    if (kind === 'lyrics') parsed = parseLrc(text, lang);
    else if (kind === 'srt') parsed = parseSrt(text, lang);
    else parsed = parseVtt(text, lang);
  } catch { /* empty import */ }
  return kind === 'lyrics' ? normalizeLyrics(parsed) : normalizeSubtitles(parsed);
}

function serialize(kind) {
  const data = kind === 'lyrics' ? state?.data.lyrics : state?.data.subtitles;
  if (!data) return '';
  try {
    const text = kind === 'lyrics'
      ? serializeLrc(payloadFor(data.lines, data), { lang: data.lang })
      : serializeVtt(payloadFor(data.cues, data), { lang: data.lang });
    if (typeof text === 'string' && text.trim()) return text;
  } catch { /* use local serializer */ }
  if (kind === 'lyrics') {
    return data.lines.map((line) => (line.time > 0
      ? `[${formatStamp(line.time, 'lrc')}] ${line.text}`
      : line.text)).join('\n');
  }
  return `WEBVTT\n\n${data.cues.map((cue) => {
    const settings = typeof cue.settings === 'string' ? cue.settings : '';
    const head = `${formatStamp(cue.start, 'vtt')} --> ${formatStamp(cue.end, 'vtt')}${settings ? ` ${settings}` : ''}`;
    return `${head}\n${cue.text}\n`;
  }).join('\n')}`;
}

function readText(file) {
  if (typeof file?.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
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
    if (event.target === instance && event.animationName === 'timed-text-out') finish();
  };
  closeAnimationEnd = onEnd;
  closeFinish = finish;
  instance.addEventListener('animationend', onEnd);
  closeTimer = setTimeout(finish, EXIT_SAFETY_MS);
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

function actionButton({ id, iconName, labelKey, onClick, primary = false }) {
  const label = el('span', { className: 'timed-text__btn-label' });
  bindText(label, () => t(labelKey));
  return el('button', {
    id,
    className: `timed-text__btn${primary ? ' timed-text__btn--save' : ''}`,
    type: 'button',
    on: { click: onClick },
  }, icon(iconName), label);
}

function buildDialog() {
  if (dialog) return dialog;

  const title = el('h2', { id: 'timedTextTitle', className: 'timed-text__title' });
  bindText(title, () => t(state?.mode === 'subtitles' ? 'ui.timedTextTitleSubtitles' : 'ui.timedTextTitleLyrics'));
  const modeBadge = el('span', { className: 'timed-text__badge' });
  bindText(modeBadge, () => t(state?.mode === 'subtitles' ? 'ui.timedTextSubtitles' : 'ui.timedTextLyrics'));
  const closeBtn = el('button', {
    className: 'timed-text__close',
    type: 'button',
    title: translated(() => t('ui.timedTextClose')),
    'aria-label': translated(() => t('ui.timedTextClose')),
    on: { click: () => requestClose() },
  }, icon('x'));

  const mediaWrap = el('div', { className: 'timed-text__media-wrap' });
  const overlayText = el('span', { className: 'timed-text__overlay-text' });
  const overlay = el('div', { className: 'timed-text__overlay', 'aria-hidden': 'true' }, overlayText);
  overlay.hidden = true;
  const playBtn = el('button', {
    className: 'timed-text__ctrl timed-text__ctrl--play',
    type: 'button',
    title: translated(() => t('ui.timedTextPlay')),
    'aria-label': translated(() => t('ui.timedTextPlay')),
    on: { click: () => togglePlay() },
  }, icon('play'));
  const backBtn = el('button', {
    className: 'timed-text__ctrl',
    type: 'button',
    title: translated(() => t('ui.timedTextBackward')),
    'aria-label': translated(() => t('ui.timedTextBackward')),
    on: { click: () => skip(-5) },
  }, icon('rewind'));
  const fwdBtn = el('button', {
    className: 'timed-text__ctrl',
    type: 'button',
    title: translated(() => t('ui.timedTextForward')),
    'aria-label': translated(() => t('ui.timedTextForward')),
    on: { click: () => skip(5) },
  }, icon('forward'));
  const timeLabel = el('span', { className: 'timed-text__time-label', 'aria-live': 'off' });
  const seek = el('input', {
    className: 'timed-text__seek',
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: '0',
    on: { input: () => seekMedia() },
  });
  const fullscreenBtn = el('button', {
    id: 'timedTextFullscreen',
    className: 'timed-text__ctrl timed-text__ctrl--utility',
    type: 'button',
    title: translated(() => t('ui.timedTextFullscreen')),
    'aria-label': translated(() => t('ui.timedTextFullscreen')),
    on: { click: () => toggleFullscreen() },
  }, icon('expand'));
  const compactBtn = el('button', {
    id: 'timedTextCompact',
    className: 'timed-text__ctrl timed-text__ctrl--utility',
    type: 'button',
    title: translated(() => t('ui.timedTextCollapsePreview')),
    'aria-label': translated(() => t('ui.timedTextCollapsePreview')),
    on: { click: () => togglePreviewCompact() },
  }, icon('minimize'));
  const videoFrame = el('div', { className: 'timed-text__video-frame' }, mediaWrap, overlay);
  const player = el('div', { className: 'timed-text__player' },
    videoFrame,
    el('div', { className: 'timed-text__controls' },
      backBtn, playBtn, fwdBtn, seek, timeLabel, compactBtn, fullscreenBtn),
  );
  const screen = el('div', { className: 'timed-text__screen' }, player);
  const rotateHint = el('p', { className: 'timed-text__rotate-hint' });
  bindText(rotateHint, () => t('ui.timedTextRotateHint'));

  const tabs = {
    lyrics: el('button', {
      className: 'timed-text__tab',
      type: 'button',
      id: 'timedTextTabLyrics',
      role: 'tab',
      'aria-controls': 'timedTextPanelLyrics',
      on: { click: () => switchTab('lyrics'), keydown: (event) => onTabKeydown(event) },
    }),
    subtitles: el('button', {
      className: 'timed-text__tab',
      type: 'button',
      id: 'timedTextTabSubtitles',
      role: 'tab',
      'aria-controls': 'timedTextPanelSubtitles',
      on: { click: () => switchTab('subtitles'), keydown: (event) => onTabKeydown(event) },
    }),
  };
  bindText(tabs.lyrics, () => t('ui.timedTextLyrics'));
  bindText(tabs.subtitles, () => t('ui.timedTextSubtitles'));
  const tablist = el('div', { className: 'timed-text__tabs', role: 'tablist' }, tabs.lyrics, tabs.subtitles);

  const addLineBtn = actionButton({ id: 'timedTextAddLine', iconName: 'plus', labelKey: 'ui.timedTextAddLine', onClick: () => addRow('lyrics') });
  const lyricsHint = el('p', { className: 'timed-text__hint' });
  bindText(lyricsHint, () => t(state?.mode === 'subtitles' ? 'ui.timedTextHintVideo' : 'ui.timedTextHintAudio'));
  const lyricsRows = el('div', { className: 'timed-text__rows', id: 'timedTextRowsLyrics' });
  const lyricsPanel = el('section', {
    className: 'timed-text__panel-pane',
    id: 'timedTextPanelLyrics',
    role: 'tabpanel',
    'aria-labelledby': 'timedTextTabLyrics',
  }, el('div', { className: 'timed-text__toolbar' }, addLineBtn), lyricsRows, lyricsHint);

  const addCueBtn = actionButton({ id: 'timedTextAddCue', iconName: 'plus', labelKey: 'ui.timedTextAddLine', onClick: () => addRow('subtitles') });
  const showBtn = el('button', { className: 'timed-text__btn timed-text__show', type: 'button', on: { click: () => toggleOverlayVariant() } }, icon('video'), el('span', { className: 'timed-text__btn-label' }));
  const subtitlesRows = el('div', { className: 'timed-text__rows', id: 'timedTextRowsSubtitles' });
  const subtitlesPanel = el('section', {
    className: 'timed-text__panel-pane',
    id: 'timedTextPanelSubtitles',
    role: 'tabpanel',
    'aria-labelledby': 'timedTextTabSubtitles',
    hidden: true,
  }, el('div', { className: 'timed-text__toolbar' }, addCueBtn, showBtn), subtitlesRows);

  const fileInput = el('input', {
    className: 'timed-text__file',
    type: 'file',
    accept: '.lrc,.srt,.vtt',
    tabindex: '-1',
    on: { change: (event) => onImport(event) },
  });
  const importBtn = actionButton({ id: 'timedTextImport', iconName: 'upload', labelKey: 'ui.timedTextImport', onClick: () => fileInput.click() });
  const exportVttBtn = actionButton({ id: 'timedTextExportVtt', iconName: 'download', labelKey: 'ui.timedTextExportVtt', onClick: () => downloadExport('vtt') });
  const exportLrcBtn = actionButton({ id: 'timedTextExportLrc', iconName: 'download', labelKey: 'ui.timedTextExportLrc', onClick: () => downloadExport('lrc') });
  const embedNote = el('small', { className: 'timed-text__embed' });
  bindText(embedNote, () => t('ui.timedTextEmbed'));
  const draftLabel = el('small', { className: 'timed-text__draft' });
  bindText(draftLabel, () => t('ui.timedTextDraftSaved'));
  draftLabel.hidden = true;
  const credit = el('p', { className: 'timed-text__credit' });
  bindText(credit, () => t('ui.timedTextCredit'));
  const saveBtn = actionButton({ id: 'timedTextSave', iconName: 'check', labelKey: 'ui.timedTextSave', onClick: () => applyChanges(), primary: true });
  const actions = el('footer', { className: 'timed-text__actions' },
    el('div', { className: 'timed-text__actions-left' },
      importBtn, fileInput, exportVttBtn, exportLrcBtn, embedNote, draftLabel),
    saveBtn,
    credit,
  );

  const body = el('div', { className: 'timed-text__body' }, lyricsPanel, subtitlesPanel);
  dialog = el('dialog', {
    id: 'timedTextDialog',
    className: 'timed-text',
    role: 'dialog',
    'aria-labelledby': 'timedTextTitle',
    'aria-modal': 'true',
    on: {
      cancel: (event) => { event.preventDefault(); requestClose(); },
      close: () => cleanupSession(),
    },
  }, el('div', { className: 'timed-text__dialog-panel' },
    el('header', { className: 'timed-text__head' },
      el('div', { className: 'timed-text__heading' }, modeBadge, title, rotateHint), closeBtn),
    el('div', { className: 'timed-text__workspace' }, screen, tablist, body),
    actions,
  ));
  document.body.append(dialog);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('resize', updateRotateHint);
  refs = {
    title, modeBadge, closeBtn, rotateHint, screen, player, videoFrame, fullscreenBtn, compactBtn,
    mediaWrap, overlay, overlayText, playBtn, backBtn, fwdBtn, seek, timeLabel,
    tabs, tablist, panels: { lyrics: lyricsPanel, subtitles: subtitlesPanel },
    rows: { lyrics: lyricsRows, subtitles: subtitlesRows },
    addLineBtn, addCueBtn, showBtn, fileInput,
    exportVttBtn, exportLrcBtn, embedNote, draftLabel, credit, saveBtn,
  };
  return dialog;
}

function showLabel() {
  return `${t('ui.timedTextShow')}: ${t(state?.overlayVariant === 'lyrics' ? 'ui.timedTextLyrics' : 'ui.timedTextSubtitles')}`;
}
function bindShowLabel() {
  bindText(refs.showBtn.querySelector('.timed-text__btn-label'), showLabel);
}

function setupMedia(file) {
  clear(refs.mediaWrap);
  state.mediaUrl = '';
  state.mediaEl = null;
  state.mediaListeners = [];
  state.mediaKind = mediaModeForFile(file) === 'subtitles' ? 'video' : 'audio';
  refs.player.dataset.kind = state.mediaKind;
  if (dialog) dialog.dataset.kind = state.mediaKind;
  if (!file) return;

  const url = URL.createObjectURL(file);
  state.mediaUrl = url;
  const media = document.createElement(state.mediaKind === 'video' ? 'video' : 'audio');
  media.className = 'timed-text__media';
  media.preload = 'metadata';
  if (state.mediaKind === 'video') media.playsInline = true;
  media.src = url;

  const listen = (type, handler) => {
    media.addEventListener(type, handler);
    state.mediaListeners.push([media, type, handler]);
  };
  listen('loadedmetadata', () => {
    updateVideoRatio(media);
    updatePlayer();
  });
  listen('durationchange', () => updatePlayer());
  listen('timeupdate', () => updatePlayer());
  listen('play', () => updatePlayState());
  listen('pause', () => updatePlayState());
  listen('ended', () => updatePlayState());
  listen('seeked', () => updatePlayer());

  refs.mediaWrap.append(media);
  if (state.mediaKind === 'audio') {
    refs.mediaWrap.append(el('div', { className: 'timed-text__audio-art' }, icon('audio')));
  }
  state.mediaEl = media;
}

function currentMs() {
  const media = state?.mediaEl;
  return media ? Math.max(0, (Number(media.currentTime) || 0) * 1000) : 0;
}

function durationMs() {
  const media = state?.mediaEl;
  return media ? Math.max(0, (Number(media.duration) || 0) * 1000) : 0;
}

function updateVideoRatio(media) {
  const width = Number(media?.videoWidth) || 0;
  const height = Number(media?.videoHeight) || 0;
  if (!width || !height) return;
  state.videoRatio = width / height;
  dialog?.style.setProperty('--tt-video-ratio', String(state.videoRatio));
}

function updateRotateHint() {
  if (!refs?.rotateHint) return;
  const portrait = typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(orientation: portrait)').matches;
  refs.rotateHint.hidden = !portrait || state?.mode !== 'subtitles' || Boolean(document.fullscreenElement);
}

function togglePreviewCompact() {
  if (!state || state.mode !== 'subtitles') return;
  state.previewCompact = !state.previewCompact;
  dialog.dataset.preview = state.previewCompact ? 'compact' : 'full';
  const label = t(state.previewCompact ? 'ui.timedTextExpandPreview' : 'ui.timedTextCollapsePreview');
  refs.compactBtn.replaceChildren(icon(state.previewCompact ? 'expand' : 'minimize'));
  refs.compactBtn.title = label;
  refs.compactBtn.setAttribute('aria-label', label);
  updateVideoRatio(state.mediaEl);
}

async function toggleFullscreen() {
  const screen = refs?.screen;
  if (!screen) return;
  try {
    if (document.fullscreenElement === screen) {
      await document.exitFullscreen();
      return;
    }
    if (typeof screen.requestFullscreen !== 'function') {
      showToast(t('ui.timedTextFullscreenUnsupported'), 'info', 4000);
      return;
    }
    await screen.requestFullscreen();
    if (state?.mode === 'subtitles') {
      try { await globalThis.screen?.orientation?.lock?.('landscape'); } catch { /* best effort */ }
    }
    updateRotateHint();
  } catch {
    showToast(t('ui.timedTextFullscreenUnsupported'), 'info', 4000);
  }
}

function onFullscreenChange() {
  if (!refs?.fullscreenBtn) return;
  const active = document.fullscreenElement === refs.screen;
  refs.fullscreenBtn.replaceChildren(icon(active ? 'minimize' : 'expand'));
  const label = t(active ? 'ui.timedTextExitFullscreen' : 'ui.timedTextFullscreen');
  refs.fullscreenBtn.title = label;
  refs.fullscreenBtn.setAttribute('aria-label', label);
  dialog.dataset.fullscreen = active ? 'true' : 'false';
  if (!active) {
    try { globalThis.screen?.orientation?.unlock?.(); } catch { /* best effort */ }
  }
  updateRotateHint();
}

function updatePlayState() {
  if (!state?.mediaEl || !refs) return;
  const playing = !state.mediaEl.paused && !state.mediaEl.ended;
  const nextIcon = playing ? 'pause' : 'play';
  if (refs.playBtn.dataset.icon !== nextIcon) {
    refs.playBtn.replaceChildren(icon(nextIcon));
    refs.playBtn.dataset.icon = nextIcon;
  }
  const label = t(playing ? 'ui.timedTextPause' : 'ui.timedTextPlay');
  refs.playBtn.title = label;
  refs.playBtn.setAttribute('aria-label', label);
  refs.playBtn.dataset.playing = playing ? 'true' : 'false';
}

function updatePlayer() {
  if (!state || !refs) return;
  const ms = currentMs();
  const duration = durationMs();
  refs.timeLabel.textContent = `${formatTimestamp(ms)} / ${formatTimestamp(duration)}`;
  refs.seek.max = duration > 0 ? String(duration) : '100';
  refs.seek.value = String(Math.min(duration || 100, ms));
  updatePlayState();
  syncHighlights();
}

function seekMedia() {
  const media = state?.mediaEl;
  if (!media) return;
  const target = numberMs(refs.seek.value) / 1000;
  try { media.currentTime = target; } catch { /* seek not ready */ }
  updatePlayer();
}

function seekTo(ms) {
  const media = state?.mediaEl;
  if (!media) return;
  const duration = Number(media.duration) || 0;
  const target = Math.max(0, duration ? Math.min(ms / 1000, duration) : ms / 1000);
  try { media.currentTime = target; } catch { /* seek not ready */ }
  updatePlayer();
}

function togglePlay() {
  const media = state?.mediaEl;
  if (!media) return;
  if (media.paused) media.play().catch(() => {});
  else media.pause();
  updatePlayState();
}

function skip(seconds) {
  const media = state?.mediaEl;
  if (!media) return;
  const duration = Number(media.duration) || 0;
  let next = (Number(media.currentTime) || 0) + seconds;
  next = Math.max(0, duration ? Math.min(next, duration) : next);
  try { media.currentTime = next; } catch { /* seek not ready */ }
  updatePlayer();
}

function centerRow(row, container) {
  if (!row || !container) return;
  const rowRect = row.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset = container.scrollTop + (rowRect.top - containerRect.top);
  const top = offset - container.clientHeight / 2 + rowRect.height / 2;
  const behavior = reduceMotion() ? 'auto' : 'smooth';
  if (typeof container.scrollTo === 'function') container.scrollTo({ top, behavior });
  else container.scrollTop = top;
}

function syncHighlights() {
  if (!state) return;
  syncLyrics();
  syncCues();
  renderOverlay();
}

function syncLyrics() {
  const lines = state.data.lyrics?.lines || [];
  const ms = currentMs();
  let index = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].time > 0 && ms >= lines[i].time - TOLERANCE_MS) { index = i; break; }
  }
  if (index === state.active.lyrics) return;
  state.active.lyrics = index;
  state.rows.lyrics.forEach((row, i) => row.classList.toggle('is-active', i === index));
  centerRow(state.rows.lyrics[index], refs.rows.lyrics);
}

function syncCues() {
  const cues = state.data.subtitles?.cues || [];
  const ms = currentMs();
  let index = -1;
  for (let i = cues.length - 1; i >= 0; i -= 1) {
    if (ms >= cues[i].start - TOLERANCE_MS && ms <= cues[i].end) { index = i; break; }
  }
  if (index === state.active.subtitles) return;
  state.active.subtitles = index;
  state.rows.subtitles.forEach((row, i) => row.classList.toggle('is-active', i === index));
  centerRow(state.rows.subtitles[index], refs.rows.subtitles);
}

function renderOverlay() {
  if (!state || !refs) return;
  const variant = state.overlayVariant;
  const index = variant === 'lyrics' ? state.active.lyrics : state.active.subtitles;
  const source = variant === 'lyrics' ? state.data.lyrics?.lines : state.data.subtitles?.cues;
  const text = source?.[index]?.text || '';
  refs.overlayText.textContent = text;
  refs.overlay.dataset.variant = variant;
  refs.overlay.hidden = state.mediaKind !== 'video' || !text;
}

function toggleOverlayVariant() {
  state.overlayVariant = state.overlayVariant === 'lyrics' ? 'subtitle' : 'lyrics';
  bindShowLabel();
  syncHighlights();
}

function renderTabs() {
  // Mode follows the file extension: audio files get lyrics, video files get
  // subtitles. The other panel is removed from the layout entirely.
  const mode = state?.mode === 'subtitles' ? 'subtitles' : 'lyrics';
  refs.tablist.hidden = true;
  for (const [kind, button] of Object.entries(refs.tabs)) {
    const active = kind === mode;
    button.hidden = !active;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
    refs.panels[kind].hidden = !active;
  }
}

function switchTab(kind) {
  if (!state || kind !== state.mode) return;
  state.tab = kind;
  renderTabs();
  refs.tabs[kind].focus();
}

function onTabKeydown(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const next = state.tab === 'lyrics' ? 'subtitles' : 'lyrics';
  switchTab(next);
}

function selectRow(kind, index) {
  state.selected[kind] = index;
  state.rows[kind].forEach((row, i) => row.classList.toggle('is-selected', i === index));
}

function makeTimeInput(kind, index, field, value) {
  const input = el('input', {
    className: 'timed-text__time',
    type: 'text',
    inputmode: 'numeric',
    spellcheck: 'false',
    value: formatStamp(value, kind === 'lyrics' ? 'lrc' : 'vtt'),
    on: {
      click: (event) => event.stopPropagation(),
      change: (event) => {
        const next = parseStamp(event.target.value, numberMs(value));
        const item = kind === 'lyrics' ? state.data.lyrics.lines[index] : state.data.subtitles.cues[index];
        if (!item) return;
        if (field === 'time') item.time = next;
        else if (field === 'start') { item.start = next; item.end = Math.max(item.end, next); }
        else item.end = Math.max(next, item.start);
        event.target.value = formatStamp(next, kind === 'lyrics' ? 'lrc' : 'vtt');
        state.active.lyrics = -1;
        state.active.subtitles = -1;
        syncHighlights();
        scheduleDraftSave();
      },
      keydown: (event) => event.stopPropagation(),
    },
  });
  return input;
}

function makeTextInput(kind, index, value) {
  return el('input', {
    className: 'timed-text__text',
    type: 'text',
    value,
    on: {
      click: (event) => event.stopPropagation(),
      input: (event) => {
        const item = kind === 'lyrics' ? state.data.lyrics?.lines?.[index] : state.data.subtitles?.cues?.[index];
        if (item) item.text = event.target.value;
        syncHighlights();
        scheduleDraftSave();
      },
      keydown: (event) => event.stopPropagation(),
    },
  });
}

function makeRowButton(labelKey, iconName, onClick, action) {
  return el('button', {
    className: 'timed-text__row-btn',
    type: 'button',
    dataset: { action },
    title: translated(() => t(labelKey)),
    'aria-label': translated(() => t(labelKey)),
    on: { click: (event) => { event.stopPropagation(); onClick(); } },
  }, icon(iconName));
}

function makeRemoveButton(onClick) {
  return el('button', {
    className: 'timed-text__row-btn timed-text__row-btn--remove',
    type: 'button',
    dataset: { action: 'remove' },
    title: translated(() => t('ui.timedTextRemove')),
    'aria-label': translated(() => t('ui.timedTextRemove')),
    on: { click: (event) => { event.stopPropagation(); onClick(); } },
  }, icon('x'));
}

function removeRow(kind, index) {
  if (kind === 'lyrics') state.data.lyrics?.lines.splice(index, 1);
  else state.data.subtitles?.cues.splice(index, 1);
  state.selected[kind] = -1;
  state.active[kind] = -1;
  renderRows(kind);
  syncHighlights();
  scheduleDraftSave();
}

function renderRows(kind) {
  const container = refs.rows[kind];
  clear(container);
  state.rows[kind] = [];
  const list = kind === 'lyrics' ? state.data.lyrics?.lines || [] : state.data.subtitles?.cues || [];
  if (!list.length) {
    const empty = el('p', { className: 'timed-text__empty' });
    bindText(empty, () => t('ui.timedTextEmpty'));
    container.append(empty);
    return;
  }

  list.forEach((item, index) => {
    const row = el('div', {
      className: kind === 'lyrics' ? 'timed-text__row' : 'timed-text__row timed-text__row--cue',
      dataset: { idx: String(index) },
      tabindex: '0',
      on: {
        click: () => {
          selectRow(kind, index);
          seekTo(kind === 'lyrics' ? item.time : item.start);
        },
        keydown: (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          selectRow(kind, index);
          seekTo(kind === 'lyrics' ? item.time : item.start);
        },
      },
    });

    if (kind === 'lyrics') {
      row.append(
        makeTimeInput(kind, index, 'time', item.time),
        makeTextInput(kind, index, item.text),
        makeRowButton('ui.timedTextMarkTime', 'clock', () => {
          const ms = currentMs();
          item.time = ms;
          selectRow(kind, index);
          row.firstElementChild.value = formatStamp(ms, 'lrc');
          state.active.lyrics = -1;
          syncHighlights();
          scheduleDraftSave();
        }, 'mark-time'),
        makeRemoveButton(() => removeRow(kind, index)),
      );
    } else {
      const times = el('div', { className: 'timed-text__cue-times' },
        makeTimeInput(kind, index, 'start', item.start),
        el('span', { className: 'timed-text__cue-sep', 'aria-hidden': 'true', textContent: '\u2192' }),
        makeTimeInput(kind, index, 'end', item.end),
      );
      const actions = el('div', { className: 'timed-text__row-actions' },
        makeRowButton('ui.timedTextMarkStart', 'clock', () => {
          item.start = currentMs();
          item.end = Math.max(item.end, item.start);
          selectRow(kind, index);
          row.querySelector('.timed-text__cue-times .timed-text__time').value = formatStamp(item.start, 'vtt');
          state.active.subtitles = -1;
          syncHighlights();
          scheduleDraftSave();
        }, 'mark-start'),
        makeRowButton('ui.timedTextMarkEnd', 'clock', () => {
          item.end = Math.max(currentMs(), item.start);
          selectRow(kind, index);
          row.querySelectorAll('.timed-text__cue-times .timed-text__time')[1].value = formatStamp(item.end, 'vtt');
          state.active.subtitles = -1;
          syncHighlights();
          scheduleDraftSave();
        }, 'mark-end'),
        makeRemoveButton(() => removeRow(kind, index)),
      );
      row.append(times, makeTextInput(kind, index, item.text), actions);
    }
    container.append(row);
    state.rows[kind].push(row);
    if (state.selected[kind] === index) row.classList.add('is-selected');
  });
}

function addRow(kind) {
  if (kind === 'lyrics') {
    if (!state.data.lyrics) state.data.lyrics = { lang: 'id', lines: [] };
    const lines = state.data.lyrics.lines;
    lines.push({ time: currentMs(), text: '' });
    state.selected.lyrics = lines.length - 1;
  } else {
    if (!state.data.subtitles) state.data.subtitles = { lang: 'id', cues: [] };
    const cues = state.data.subtitles.cues;
    const start = currentMs();
    cues.push({ id: cues.length + 1, start, end: start + 5000, text: '', settings: '' });
    state.selected.subtitles = cues.length - 1;
  }
  renderRows(kind);
  syncHighlights();
  scheduleDraftSave();
  state.rows[kind][state.selected[kind]]?.querySelector('.timed-text__text')?.focus();
}

function markCue(field) {
  let cues = state.data.subtitles?.cues || [];
  let index = state.selected.subtitles;
  if (index < 0 || index >= cues.length) index = state.active.subtitles;
  if (index < 0) {
    if (field !== 'start') return;
    addRow('subtitles');
    cues = state.data.subtitles?.cues || [];
    index = state.selected.subtitles;
  }
  const ms = currentMs();
  if (field === 'start') {
    cues[index].start = ms;
    cues[index].end = Math.max(cues[index].end, ms);
  } else {
    cues[index].end = Math.max(ms, cues[index].start);
  }
  selectRow('subtitles', index);
  const inputs = state.rows.subtitles[index]?.querySelectorAll('.timed-text__time');
  if (inputs?.length) inputs[field === 'start' ? 0 : 1].value = formatStamp(ms, 'vtt');
  state.active.subtitles = -1;
  syncHighlights();
  scheduleDraftSave();
}

async function onImport(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const text = await readText(file);
    const ext = String(file.name || '').toLowerCase().split('.').pop();
    const lang = state.data[ext === 'lrc' ? 'lyrics' : 'subtitles']?.lang || 'id';
    if (ext === 'lrc') {
      const parsed = fromCore('lyrics', text, lang);
      if (!state.data.lyrics) state.data.lyrics = { lang: parsed.lang, lines: [] };
      state.data.lyrics.lang = parsed.lang || state.data.lyrics.lang;
      state.data.lyrics.lines = parsed.lines;
      state.selected.lyrics = -1;
      state.active.lyrics = -1;
      renderRows('lyrics');
      switchTab('lyrics');
    } else if (ext === 'srt' || ext === 'vtt') {
      const parsed = fromCore(ext, text, lang);
      if (!state.data.subtitles) state.data.subtitles = { lang: parsed.lang, cues: [] };
      state.data.subtitles.lang = parsed.lang || state.data.subtitles.lang;
      state.data.subtitles.cues = parsed.cues;
      state.selected.subtitles = -1;
      state.active.subtitles = -1;
      renderRows('subtitles');
      switchTab('subtitles');
    }
    syncHighlights();
    scheduleDraftSave();
  } catch { /* unreadable import file: keep current data */ }
  input.value = '';
}

function baseName() {
  const name = String(state?.file?.name || 'timed-text');
  return name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadExport(kind) {
  const text = serialize(kind);
  if (!text) return;
  downloadText(text, `${baseName()}.${kind}`, kind === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8');
}

function applyChanges() {
  if (!state) return;
  const handler = state.onApply;
  const next = clone(state.data);
  clearDraft();
  requestClose();
  handler?.(next);
}

function cleanupSession() {
  cancelClose();
  if (state) {
    flushDraftSave();
    for (const [target, type, handler] of state.mediaListeners || []) target.removeEventListener(type, handler);
    if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
    clear(refs.mediaWrap);
    state = null;
  }
  if (listening) {
    document.removeEventListener('keydown', onGlobalKeydown);
    listening = false;
  }
  lastFocused?.focus?.();
  lastFocused = null;
}

function onGlobalKeydown(event) {
  if (!dialog?.open || !state) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key === 'Tab') {
    trapFocus(event);
    return;
  }
  if (event.target instanceof HTMLElement
    && event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault();
    togglePlay();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    skip(-5);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    skip(5);
  } else if (state.mode === 'subtitles' && String(event.key || '').toLowerCase() === 's') {
    event.preventDefault();
    markCue('start');
  } else if (state.mode === 'subtitles' && String(event.key || '').toLowerCase() === 'e') {
    event.preventDefault();
    markCue('end');
  }
}

export function openTimedTextEditor({ file, sidecar, onApply } = {}) {
  if (typeof document === 'undefined') return;
  cancelClose();
  const instance = buildDialog();
  if (!instance.isConnected) document.body.append(instance);
  lastFocused = document.activeElement;

  const mode = mediaModeForFile(file);
  state = {
    data: normalizeSidecar(sidecar),
    file: file || null,
    onApply: typeof onApply === 'function' ? onApply : null,
    mode,
    tab: mode,
    overlayVariant: mode === 'subtitles' ? 'subtitle' : 'lyrics',
    previewCompact: false,
    videoRatio: 16 / 9,
    mediaKind: mode === 'subtitles' ? 'video' : 'audio',
    mediaUrl: '',
    mediaEl: null,
    mediaListeners: [],
    selected: { lyrics: -1, subtitles: -1 },
    active: { lyrics: -1, subtitles: -1 },
    rows: { lyrics: [], subtitles: [] },
  };
  const draft = readDraft();
  if (draft?.data) state.data = normalizeSidecar(draft.data);

  instance.dataset.mode = mode;
  instance.dataset.preview = 'full';
  instance.dataset.fullscreen = 'false';
  instance.style.setProperty('--tt-video-ratio', '1.7777778');
  refs.compactBtn.hidden = mode !== 'subtitles';
  refs.fullscreenBtn.hidden = mode !== 'subtitles';
  refs.title.textContent = t(mode === 'subtitles' ? 'ui.timedTextTitleSubtitles' : 'ui.timedTextTitleLyrics');
  refs.modeBadge.textContent = t(mode === 'subtitles' ? 'ui.timedTextSubtitles' : 'ui.timedTextLyrics');
  refs.fileInput.accept = mode === 'subtitles' ? '.vtt,.srt' : '.lrc';
  refs.exportVttBtn.hidden = mode !== 'subtitles';
  refs.exportLrcBtn.hidden = mode !== 'lyrics';
  refs.showBtn.hidden = mode !== 'subtitles';
  setupMedia(file);
  renderTabs();
  renderRows('lyrics');
  renderRows('subtitles');
  bindShowLabel();
  updateDraftLabel();
  updateRotateHint();
  updatePlayer();

  if (!listening) {
    listening = true;
    document.addEventListener('keydown', onGlobalKeydown);
  }
  if (instance.open) {
    instance.focus();
    return;
  }
  instance.showModal();
  refs.closeBtn.focus();
}

export function mountTimedTextButton({ container, ctx } = {}) {
  if (typeof document === 'undefined' || !ctx?.state) return null;
  const target = document.getElementById('actionOptions') || container;
  const host = target || qs('.action-bar');
  if (!host) return null;
  const existing = qs('#timedTextBtn', host);
  if (existing) return existing;
  const buttonIcon = el('span', { className: 'timed-text-btn__icon' }, icon('audio'));
  const buttonLabel = el('span', { className: 'timed-text-btn__label' });
  bindText(buttonLabel, () => t(mediaModeForFile(ctx.state?.file) === 'subtitles' ? 'ui.timedTextOpenVideo' : 'ui.timedTextOpenAudio'));
  const button = el('button', {
    type: 'button',
    id: 'timedTextBtn',
    className: 'button ghost small timed-text-btn',
    title: translated(() => t('ui.timedTextOpen')),
    'aria-label': translated(() => t('ui.timedTextOpen')),
  }, buttonIcon, buttonLabel);
  // Keep the button icon in sync with the format of the currently open file.
  window.addEventListener('meinsert:fileReady', () => {
    const mode = mediaModeForFile(ctx.state?.file);
    buttonIcon.replaceChildren(icon(mode === 'subtitles' ? 'video' : 'audio'));
    buttonLabel.textContent = t(mode === 'subtitles' ? 'ui.timedTextOpenVideo' : 'ui.timedTextOpenAudio');
    button.title = buttonLabel.textContent;
    button.setAttribute('aria-label', buttonLabel.textContent);
  });
  button.addEventListener('click', () => {
    const { state: editorState } = ctx;
    const ext = String(editorState?.file?.name || '').toLowerCase().split('.').pop();
    if (!editorState?.file || editorState.status !== 'ready' || !TIMED_TEXT_EXTS.has(ext)) {
      showToast(t('ui.timedTextUnsupported'), 'info', 4200);
      return;
    }
    openTimedTextEditor({
      file: editorState.file,
      sidecar: editorState.sidecar,
      onApply: (next) => {
        beginChange(editorState.history, 'sidecar');
        setSidecar(editorState, next);
        endChange(editorState.history);
        syncActionBar(ctx.els, editorState);
      },
    });
  });
  host.insertBefore(button, qs('.action-buttons', host) || null);
  return button;
}

export function closeTimedTextEditor() {
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
