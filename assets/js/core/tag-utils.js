/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/** Small, dependency-free helpers shared by adapters and UI. */

export function asString(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return '';
  }
  return String(value);
}

export function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(asString).map((v) => v.trim()).filter(Boolean);
  const text = asString(value).trim();
  if (!text) return [];
  return text.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Accepts common EXIF / XMP / ISO date strings and returns YYYY-MM-DD. */
export function toDateInput(value) {
  const text = asString(value).trim();
  if (!text) return '';
  let m = text.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})/);
  if (!m) m = text.match(/^D:(\d{4})(\d{2})(\d{2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return '';
  }
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  return '';
}

export function toExifDate(value) {
  const date = toDateInput(value);
  if (!date) return '';
  return `${date.slice(0, 4)}:${date.slice(5, 7)}:${date.slice(8, 10)} 00:00:00`;
}

export function toIsoDate(value) {
  const date = toDateInput(value);
  return date ? `${date}T00:00:00Z` : '';
}

export function toYear(value) {
  const m = asString(value).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

export function pick(tags, keys) {
  for (const key of keys) {
    const value = tags[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export function uniqueStrings(values) {
  return [...new Set(values.map((v) => asString(v).trim()).filter(Boolean))];
}

export function validateCustomKey(key) {
  if (!key) return 'Nama tag wajib diisi.';
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(key)) {
    return 'Gunakan huruf, angka, titik, garis bawah, titik dua, atau strip (maks. 64 karakter).';
  }
  return '';
}

export function safeOutputName(name, fallback = 'file') {
  const base = String(name || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base || fallback;
}

export function fileBaseName(name) {
  const clean = String(name || 'file');
  const dot = clean.lastIndexOf('.');
  return dot > 0 ? clean.slice(0, dot) : clean;
}

export function fileExtension(name) {
  const clean = String(name || '');
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

export function humanBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function valueForCompare(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(asString));
  return asString(value).trim();
}

export function sameValue(a, b) {
  return valueForCompare(a) === valueForCompare(b);
}

export function binaryLike(value) {
  if (value instanceof Uint8Array) return true;
  if (Array.isArray(value) && value.length > 8 && value.every((v) => typeof v === 'number')) return true;
  return false;
}

export function rawValue(value) {
  if (binaryLike(value)) return '[data biner]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(asString).join(', ');
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 500);
    } catch {
      return '[objek]';
    }
  }
  const text = asString(value);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

export function typeOfFile(file) {
  return file?.type || 'application/octet-stream';
}
