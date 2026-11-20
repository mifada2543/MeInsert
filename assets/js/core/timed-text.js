/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Ported from MEeL — https://github.com/mifada2543/MEeL-HUB @ 95e4937c
 * Copyright (C) 2026 Mifada (mifada2543) — AGPL-3.0-or-later
 * Source: modules/core/helpers/lyrics.php, modules/core/helpers/subtitle.php,
 *         assets/js/music/lrc-editor.js
 * Modified for MeInsert: plain JS ESM, ms-based state, no PHP/DOM/global deps,
 * watermark added. */
const TS_PATTERN = '\\d{1,3}:\\d{2}(?::\\d{2})?[.,:]\\d{1,3}';
const LRC_TAG_RE = new RegExp(`\\[(${TS_PATTERN})\\]`, 'g');
const TIMING_RE = new RegExp(`^(${TS_PATTERN})\\s*-->\\s*(${TS_PATTERN})(.*)$`);
const TS_TOKEN_RE = /^(\d{1,3}):(\d{2})(?::(\d{2}))?[.,:](\d{1,3})$/;
const NUMERIC_ID_RE = /^\d+$/;
const VTT_BLOCK_RE = /^(NOTE|STYLE|REGION)(?:\s|$)/;
const ARROW_GLYPH_RE = /-*[\u2192\u21A6\u21D2\u25B6\u27A4\u2794\u279C\u279D\u279E\u27F6\u27F9]\s*/g;
const DASH_ARROW_RE = /-*[\u2013\u2014]\s*>/g;
const HYPHEN_ARROW_RE = /-{1,}\s*>/g;
const BOM_RE = /^\uFEFF/;
const CRLF_RE = /\r\n?/g;
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(BOM_RE, '').replace(CRLF_RE, '\n');
}
function normalizeArrows(text) {
  return text
    .replace(ARROW_GLYPH_RE, '-->')
    .replace(DASH_ARROW_RE, '-->')
    .replace(HYPHEN_ARROW_RE, '-->');
}
function tokenToMs(token) {
  const match = TS_TOKEN_RE.exec(token);
  if (!match) return 0;
  const fraction = parseInt(match[4].padEnd(3, '0'), 10);
  if (match[3] !== undefined) {
    return Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + fraction;
  }
  return Number(match[1]) * 60000 + Number(match[2]) * 1000 + fraction;
}
function toMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
function prettyText(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}
function pad(number, width) {
  return String(number).padStart(width, '0');
}
export function parseLrc(text) {
  const lines = [];
  for (const raw of normalizeText(text).split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('[')) continue;
    let rest = line;
    const stamps = [];
    LRC_TAG_RE.lastIndex = 0;
    let match;
    while ((match = LRC_TAG_RE.exec(rest)) !== null) {
      if (match.index !== 0) break;
      stamps.push(tokenToMs(match[1]));
      rest = rest.slice(match[0].length);
      LRC_TAG_RE.lastIndex = 0;
    }
    if (stamps.length === 0) continue;
    const lyric = rest.trim();
    if (!lyric) continue;
    for (const time of stamps) lines.push({ time, text: lyric });
  }
  lines.sort((a, b) => a.time - b.time);
  return { lines };
}
export function serializeLrc(lines) {
  if (!Array.isArray(lines)) return '';
  const out = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const time = toMs(line.time);
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const centiseconds = Math.floor((time % 1000) / 10);
    out.push(`[${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}] ${prettyText(line.text)}`);
  }
  return out.join('\n');
}
export function parseSrt(text) {
  const lines = normalizeText(text).split('\n');
  const cues = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].trim() === '') {
      index++;
      continue;
    }
    let id = null;
    if (NUMERIC_ID_RE.test(lines[index].trim())) {
      id = lines[index].trim();
      index++;
    }
    if (index >= lines.length) break;
    const timing = TIMING_RE.exec(normalizeArrows(lines[index].trim()));
    if (!timing) {
      index++;
      continue;
    }
    const start = tokenToMs(timing[1]);
    const end = tokenToMs(timing[2]);
    index++;
    const body = [];
    while (index < lines.length && lines[index].trim() !== '') {
      body.push(lines[index].trim());
      index++;
    }
    cues.push({ id, start, end, text: body.join('\n'), settings: '' });
  }
  return { cues };
}
export function parseVtt(text) {
  const lines = normalizeText(text).split('\n');
  const cues = [];
  let index = 0;
  if (lines.length > 0 && lines[0].trimStart().startsWith('WEBVTT')) index = 1;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed === '') {
      index++;
      continue;
    }
    if (VTT_BLOCK_RE.test(trimmed)) {
      index++;
      while (index < lines.length && lines[index].trim() !== '') index++;
      continue;
    }
    let id = null;
    let timingLine = trimmed;
    if (!TIMING_RE.test(trimmed) && index + 1 < lines.length) {
      const candidate = lines[index + 1].trim();
      if (TIMING_RE.test(candidate)) {
        id = trimmed;
        index++;
        timingLine = candidate;
      }
    }
    const timing = TIMING_RE.exec(timingLine);
    if (!timing) {
      index++;
      continue;
    }
    const start = tokenToMs(timing[1]);
    const end = tokenToMs(timing[2]);
    const settings = timing[3].trim();
    index++;
    const body = [];
    while (index < lines.length && lines[index].trim() !== '') {
      body.push(lines[index].trim());
      index++;
    }
    cues.push({ id, start, end, text: body.join('\n'), settings });
  }
  return { cues };
}
function formatVttTime(value) {
  const time = toMs(value);
  const hours = Math.floor(time / 3600000);
  const minutes = Math.floor((time % 3600000) / 60000);
  const seconds = Math.floor((time % 60000) / 1000);
  const millis = time % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}
export function serializeVtt(cues) {
  if (!Array.isArray(cues)) return 'WEBVTT\n\n';
  const blocks = [];
  for (const cue of cues) {
    if (!cue || typeof cue !== 'object') continue;
    const settings = typeof cue.settings === 'string' ? cue.settings.trim() : '';
    const timing = `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}${settings ? ` ${settings}` : ''}`;
    const id = cue.id === null || cue.id === undefined ? '' : prettyText(cue.id).trim();
    const text = prettyText(cue.text);
    const block = [];
    if (id) block.push(id);
    block.push(timing);
    if (text) block.push(text);
    blocks.push(block.join('\n'));
  }
  return `WEBVTT\n\n${blocks.join('\n\n')}`;
}
export function toSyltPairs(lines) {
  if (!Array.isArray(lines)) return [];
  const pairs = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const text = prettyText(line.text);
    if (!text) continue;
    pairs.push([text, toMs(line.time)]);
  }
  return pairs;
}
export function formatTimestamp(ms) {
  const time = toMs(ms);
  const minutes = Math.floor(time / 60000);
  const seconds = Math.floor((time % 60000) / 1000);
  return `${pad(minutes, 2)}:${pad(seconds, 2)}`;
}