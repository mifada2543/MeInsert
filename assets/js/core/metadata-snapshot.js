/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString, toDateInput } from './tag-utils.js';
export const SNAPSHOT_VERSION = 1;
const IGNORED_RAW = /^(File|System|ExifTool|SourceFile|ExifToolVersion|Composite):/i;
const IGNORED_GROUPS = new Set(['File', 'System', 'ExifTool', 'Composite']);
const CASE_INSENSITIVE_CUSTOM = new Set(['flac', 'ogg', 'mkv']);
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .trim();
}
export function normalizeFieldValue(field, value) {
  if (field?.type === 'tags') return JSON.stringify(asArray(value).map(normalizeText).filter(Boolean));
  if (field?.type === 'date') return toDateInput(value);
  return normalizeText(value);
}
export function displayFieldValue(field, value) {
  if (field?.type === 'tags') return asArray(value).join(', ');
  if (field?.type === 'date') return toDateInput(value);
  return normalizeText(value);
}
export function normalizeCustomKey(formatId, key) {
  const text = normalizeText(key);
  return CASE_INSENSITIVE_CUSTOM.has(formatId) ? text.toLowerCase() : text;
}
export function normalizeRawTag(tag) {
  return normalizeText(tag).toLowerCase();
}
export function hashBytes(bytes) {
  const data = bytes instanceof Uint8Array
    ? bytes
    : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : new Uint8Array(bytes || []);
  let hash = 0x811c9dc5;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data[index];
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}:${data.length}`;
}
function fieldDefinitions(adapter, detection) {
  if (!adapter) return [];
  if (typeof adapter.fieldsFor === 'function') return adapter.fieldsFor(detection?.subtype) || [];
  return adapter.fields || [];
}
function coverSnapshot(readResult) {
  const cover = readResult?.cover || null;
  const bytes = readResult?.coverBytes;
  const hasBytes = Boolean(bytes && (bytes.byteLength || bytes.length));
  const present = Boolean(cover || hasBytes || readResult?.info?.hasCover);
  if (!present) {
    return { present: false, mime: '', size: 0, kind: '', hash: null };
  }
  return {
    present: true,
    mime: normalizeText(cover?.mimeType || cover?.mime || ''),
    size: Number(bytes?.byteLength || bytes?.length || cover?.size) || 0,
    kind: normalizeText(cover?.kind || ''),
    hash: hasBytes ? hashBytes(bytes) : null,
  };
}
function structureSnapshot(info = {}) {
  const keys = [
    'format', 'kind', 'pages', 'duration', 'width', 'height', 'codec',
    'videoCodec', 'audioCodec', 'sampleRate', 'channels', 'trackCount',
    'chapterCount', 'attachmentCount', 'signed', 'hasCover', 'rewrite',
  ];
  const out = {};
  for (const key of keys) {
    const value = info?.[key];
    if (value === undefined || value === null || value === '') continue;
    out[key] = typeof value === 'number' && Number.isFinite(value) ? value : value;
  }
  return out;
}
export function createSnapshot({ adapter, detection, readResult } = {}) {
  const formatId = adapter?.meta?.id || detection?.id || 'unknown';
  const fields = {};
  for (const field of fieldDefinitions(adapter, detection)) {
    const rawValue = readResult?.fields?.[field.id];
    fields[field.id] = {
      id: field.id,
      label: field.label || field.id,
      native: field.native || '',
      type: field.type || 'text',
      value: displayFieldValue(field, rawValue),
      normalized: normalizeFieldValue(field, rawValue),
    };
  }
  const custom = (readResult?.custom || [])
    .map((row) => {
      const key = normalizeText(row?.key);
      return {
        key,
        canonicalKey: normalizeCustomKey(formatId, key),
        value: normalizeText(row?.value),
      };
    })
    .filter((row) => row.key && row.value)
    .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey) || a.key.localeCompare(b.key));
  const raw = (readResult?.raw || [])
    .map((row) => {
      const group = normalizeText(row?.group);
      const tag = normalizeText(row?.tag);
      return {
        group,
        tag,
        canonicalTag: normalizeRawTag(tag),
        value: normalizeText(row?.value),
        normalized: normalizeText(row?.value),
      };
    })
    .filter((row) => row.tag && row.value)
    .filter((row) => !IGNORED_GROUPS.has(row.group))
    .filter((row) => !IGNORED_RAW.test(row.tag))
    .sort((a, b) => a.canonicalTag.localeCompare(b.canonicalTag) || a.value.localeCompare(b.value));
  return {
    version: SNAPSHOT_VERSION,
    format: {
      id: formatId,
      subtype: detection?.subtype || '',
      label: detection?.label || adapter?.meta?.label || formatId,
    },
    fields,
    custom,
    raw,
    cover: coverSnapshot(readResult),
    structure: structureSnapshot(readResult?.info),
    warnings: [...(readResult?.warnings || [])],
    counts: {
      fields: Object.values(fields).filter((field) => field.normalized).length,
      custom: custom.length,
      raw: raw.length,
    },
  };
}
export function rawTags(snapshot) {
  return new Set((snapshot?.raw || []).map((row) => row.canonicalTag));
}
export function fieldMap(snapshot) {
  return snapshot?.fields || {};
}
export function customMap(snapshot) {
  return new Map((snapshot?.custom || []).map((row) => [row.canonicalKey, row]));
}
