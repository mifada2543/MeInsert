/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from '../../vendor/fflate.mjs';
import { NS, parseXml } from './office-xml.js';
import { normalizePart } from './office-package.js';
import { AppError } from './errors.js';
import { readZipDirectory, ZIP_LIMITS } from './zip-directory.js';
export const OFFICE_METADATA_PARTS = ['docProps/core.xml', 'docProps/app.xml', 'meta.xml'];
export const OFFICE_READ_ENTRIES = Object.freeze(new Set([
  '[Content_Types].xml',
  '_rels/.rels',
  'docProps/core.xml',
  'docProps/app.xml',
  'docProps/custom.xml',
  'meta.xml',
  'META-INF/manifest.xml',
  'mimetype',
  'word/document.xml',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'ppt/presentation.xml',
  'xl/sharedStrings.xml',
  'ppt/slides/slide1.xml',
  'content.xml',
]));
export const OFFICE_PREVIEW_LIMITS = Object.freeze({ maxPreviewEntry: 2 * 1024 * 1024 });
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const FIXED_TIME = 0;
const FIXED_DATE = 0x0021;
function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function writeU16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}
function writeU32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
function badZip(message, detail = '') {
  return new AppError('CORRUPT_OFFICE', message, detail);
}
function zipBomb(message, detail = '') {
  return new AppError('ZIP_BOMB_SUSPECTED', message, detail);
}
async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  if (Array.isArray(input)) return new Uint8Array(input);
  throw badZip('Arsip Office tidak bisa dibaca.', 'Input bukan Blob/File/Uint8Array.');
}
function toU8(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') return strToU8(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  throw new AppError('INVALID_REPLACEMENT', 'Isi pengganti bukan Uint8Array.', String(value));
}
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
export function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function parseZip(bytes, inflate = true, options = {}) {
  const zip = readZipDirectory(bytes);
  const { inflateAll = false, mainPart = '' } = options || {};
  const required = new Set(['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml', 'meta.xml', 'META-INF/manifest.xml', 'mimetype', 'word/document.xml', 'xl/workbook.xml', 'ppt/presentation.xml', 'content.xml', mainPart]);
  const entries = [];
  const findings = [];
  const skipped = [];
  let valid = true;
  let inflatedTotal = 0;
  for (const meta of zip.entries) {
    const {
      name, nameBytes, method, flags, modTime, modDate,
      crc32: crc, compressedSize, uncompressedSize, versionMadeBy, versionNeeded,
      internalAttrs, externalAttrs, localOffset, localEnd, localBytes,
      compressedData, extraBytes, commentBytes, centralBytes, centralEnd,
    } = meta;
    let data = new Uint8Array(0);
    const cap = inflateAll || required.has(name) ? ZIP_LIMITS.maxUncompressedEntry : OFFICE_PREVIEW_LIMITS.maxPreviewEntry;
    if (inflate && (inflateAll || required.has(name) || OFFICE_READ_ENTRIES.has(name))) {
      if (uncompressedSize > cap) {
        skipped.push(`Entri "${name}" (${uncompressedSize} byte) melebihi batas pratinjau ${cap} byte; isi tidak dibaca.`);
      } else {
        if (uncompressedSize > ZIP_LIMITS.maxUncompressedEntry
            || uncompressedSize / Math.max(1, compressedSize) > ZIP_LIMITS.maxDeflateRatio) {
          throw zipBomb(`Entri "${name}" memiliki ukuran/rasio kompresi mencurigakan.`);
        }
        inflatedTotal += uncompressedSize;
        if (inflatedTotal > ZIP_LIMITS.maxUncompressedTotal) {
          throw zipBomb('Total ukuran hasil dekompresi melebihi batas yang diizinkan.');
        }
        const out = new Uint8Array(Math.min(uncompressedSize + 1, cap));
        let raw;
        try {
          if (method === 0) raw = compressedData.slice(0, out.length);
          else if (method === 8) raw = inflateSync(compressedData, { out });
          else {
            throw new AppError(
              'UNSUPPORTED_COMPRESSION',
              `Metode kompresi ZIP ${method} tidak didukung.`,
            );
          }
        } catch (error) {
          if (error instanceof AppError && error.code === 'UNSUPPORTED_COMPRESSION') throw error;
          throw badZip(`Entri "${name}" gagal didekompresi: ${error?.message || String(error)}`);
        }
        if (raw.length > uncompressedSize) {
          if (method === 8) {
            throw zipBomb(`Dekompresi entri "${name}" melebihi ukuran yang dinyatakan.`);
          }
          throw badZip(`Ukuran data entri "${name}" tidak sesuai.`);
        }
        if (raw.length !== uncompressedSize || crc32(raw) !== crc) {
          throw badZip(`CRC atau ukuran entri "${name}" tidak sesuai.`);
        }
        data = raw;
      }
    }
    const localFlags = readU16(bytes, meta.localOffsetAbs + 6);
    const localMethod = readU16(bytes, meta.localOffsetAbs + 8);
    if (localFlags !== flags || localMethod !== method) valid = false;
    entries.push({
      name,
      nameBytes,
      method,
      flags,
      crc32: crc,
      compressedSize,
      uncompressedSize,
      modTime,
      modDate,
      versionMadeBy,
      versionNeeded,
      internalAttrs,
      externalAttrs,
      localOffset,
      localEnd,
      localBytes,
      compressedData,
      data,
      extraBytes,
      commentBytes,
      centralBytes,
      centralEnd,
    });
  }
  return {
    bytes,
    entries,
    findings,
    skipped,
    eocd: zip.eocd,
    prefix: zip.prefix,
    zip64: zip.zip64,
    cdOffset: zip.cdStart,
    cdSize: zip.cdSize,
    valid,
  };
}
export async function inspectZip(fileOrBytes) {
  const bytes = await toBytes(fileOrBytes);
  let zip = parseZip(bytes, true);
  let mainPart = '';
  const rels = zip.entries.find((entry) => entry.name === '_rels/.rels');
  if (rels?.data.length) {
    try {
      const doc = parseXml(strFromU8(rels.data), '_rels/.rels');
      const rel = doc.findAll(NS.rels, 'Relationship').find((node) => /\/officeDocument$/i.test(doc.attribute(node, 'Type')));
      mainPart = normalizePart(doc.attribute(rel, 'Target')) || '';
    } catch {}
  }
  if (mainPart && !OFFICE_READ_ENTRIES.has(mainPart)) zip = parseZip(bytes, true, { mainPart });
  const names = zip.entries.map((entry) => entry.name);
  const has = (name) => names.includes(name);
  const signed = names.some((name) => /(^|\/)_xmlsignatures\//i.test(name)
    || /(^|\/)META-INF\/documentsignatures\.xml$/i.test(name));
  const mimetypeEntry = zip.entries.find((entry) => entry.name === 'mimetype');
  const odf = Boolean(mimetypeEntry);
  const mimetype = odf ? strFromU8(mimetypeEntry.data).trim() : '';
  let macros = names.some((name) => /(^|\/)vbaproject\.bin$/i.test(name));
  if (!macros) {
    const contentTypes = zip.entries.find((entry) => entry.name === '[Content_Types].xml');
    if (contentTypes) macros = /macroenabled/i.test(strFromU8(contentTypes.data));
  }
  const previewSkipped = [...(zip.skipped || [])];
  const findings = [...previewSkipped];
  if (odf) {
    if (zip.entries[0]?.name !== 'mimetype') {
      findings.push('ODF: entri mimetype bukan entri pertama.');
    }
    if (mimetypeEntry.method !== 0) {
      findings.push('ODF: entri mimetype tidak disimpan tanpa kompresi (STORED).');
    }
    if (!/^application\/vnd\.oasis\.opendocument\./i.test(mimetype)) {
      findings.push('ODF: nilai mimetype tidak dikenali.');
    }
    if (!has('META-INF/manifest.xml')) {
      findings.push('ODF: META-INF/manifest.xml tidak ditemukan.');
    }
  } else {
    if (!has('[Content_Types].xml')) {
      findings.push('OOXML: [Content_Types].xml tidak ditemukan.');
    }
    if (!(mainPart && has(mainPart)) && !['word/document.xml', 'xl/workbook.xml', 'ppt/presentation.xml'].some(has)) {
      findings.push('OOXML: tidak ada part dokumen utama (word/document.xml, xl/workbook.xml, atau ppt/presentation.xml).');
    }
  }
  if (!zip.valid) findings.push('Arsip memiliki ketidaksesuaian header/CRC pada salah satu entri.');
  const packageValid = findings.length === 0;
  return {
    entries: zip.entries.map((entry) => ({
      name: entry.name,
      data: entry.data,
      method: entry.method,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      crc32: entry.crc32,
      flags: entry.flags,
    })),
    signed,
    macros,
    odf,
    mimetype,
    valid: zip.valid,
    packageValid,
    findings,
    previewSkipped,
    prefix: zip.prefix,
    zip64: zip.zip64,
  };
}
function buildLocalHeader(entry, method, flags, compressedSize, uncompressedSize, crc) {
  const extra = entry.extraBytes || new Uint8Array(0);
  const header = new Uint8Array(30 + entry.nameBytes.length + extra.length);
  writeU32(header, 0, SIG_LOCAL);
  writeU16(header, 4, entry.versionNeeded || 20);
  writeU16(header, 6, flags);
  writeU16(header, 8, method);
  writeU16(header, 10, Number.isFinite(entry.modTime) ? entry.modTime : FIXED_TIME);
  writeU16(header, 12, Number.isFinite(entry.modDate) ? entry.modDate : FIXED_DATE);
  writeU32(header, 14, crc);
  writeU32(header, 18, compressedSize);
  writeU32(header, 22, uncompressedSize);
  writeU16(header, 26, entry.nameBytes.length);
  writeU16(header, 28, extra.length);
  header.set(entry.nameBytes, 30);
  header.set(extra, 30 + entry.nameBytes.length);
  return header;
}
function buildCentralHeader(entry, method, flags, compressedSize, uncompressedSize, crc, offset) {
  const nameBytes = entry.nameBytes;
  const extra = entry.extraBytes || new Uint8Array(0);
  const comment = entry.commentBytes || new Uint8Array(0);
  const header = new Uint8Array(46 + nameBytes.length + extra.length + comment.length);
  writeU32(header, 0, SIG_CENTRAL);
  writeU16(header, 4, entry.versionMadeBy || 20);
  writeU16(header, 6, entry.versionNeeded || 20);
  writeU16(header, 8, flags);
  writeU16(header, 10, method);
  writeU16(header, 12, FIXED_TIME);
  writeU16(header, 14, FIXED_DATE);
  writeU32(header, 16, crc);
  writeU32(header, 20, compressedSize);
  writeU32(header, 24, uncompressedSize);
  writeU16(header, 28, nameBytes.length);
  writeU16(header, 30, extra.length);
  writeU16(header, 32, comment.length);
  writeU16(header, 34, 0);
  writeU16(header, 36, entry.internalAttrs || 0);
  writeU32(header, 38, entry.externalAttrs || 0);
  writeU32(header, 42, offset);
  header.set(nameBytes, 46);
  header.set(extra, 46 + nameBytes.length);
  header.set(comment, 46 + nameBytes.length + extra.length);
  return header;
}
export async function patchZip(original, replacements) {
  const bytes = await toBytes(original);
  const zip = parseZip(bytes, false);
  if (zip.zip64) {
    throw new AppError('ZIP64_UNSUPPORTED', 'Arsip Office dengan ZIP64 tidak dapat ditulis ulang.');
  }
  const repl = replacements instanceof Map
    ? replacements
    : new Map(Object.entries(replacements || {}));
  const mimetypeIndex = zip.entries.findIndex((entry) => entry.name === 'mimetype');
  const odf = mimetypeIndex >= 0;
  if (odf) {
    if (mimetypeIndex !== 0 || zip.entries[0].method !== 0) {
      throw new AppError(
        'ODF_MIMETYPE_LAYOUT',
        'File ODF tidak memiliki entri mimetype pertama yang tersimpan tanpa kompresi.',
      );
    }
    if (repl.has('mimetype')) {
      throw new AppError('ODF_MIMETYPE_LAYOUT', 'Entri mimetype ODF tidak boleh diubah atau dihapus.');
    }
  }
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of zip.entries) {
    if (!repl.has(entry.name)) {
      chunks.push(entry.localBytes);
      const cd = entry.centralBytes.slice();
      writeU32(cd, 42, offset);
      central.push(cd);
      offset += entry.localBytes.length;
      continue;
    }
    const value = repl.get(entry.name);
    if (value === null) continue;
    const data = toU8(value);
    const method = entry.method;
    if (method !== 0 && method !== 8) {
      throw new AppError('UNSUPPORTED_COMPRESSION', `Metode kompresi ZIP ${method} tidak didukung.`);
    }
    const compressed = method === 0 ? data : deflateSync(data);
    const crc = crc32(data);
    const flags = entry.flags & ~8;
    const local = buildLocalHeader(entry, method, flags, compressed.length, data.length, crc);
    chunks.push(local, compressed);
    const cd = entry.centralBytes.slice();
    writeU16(cd, 8, flags);
    writeU16(cd, 10, method);
    writeU32(cd, 16, crc);
    writeU32(cd, 20, compressed.length);
    writeU32(cd, 24, data.length);
    writeU32(cd, 42, offset);
    central.push(cd);
    offset += local.length + compressed.length;
  }
  const existing = new Set(zip.entries.map((entry) => entry.name));
  for (const [name, value] of repl) {
    if (value === null || existing.has(name)) continue;
    if (name === 'mimetype') {
      throw new AppError('ODF_MIMETYPE_LAYOUT', 'Entri mimetype ODF tidak boleh ditambahkan.');
    }
    const data = toU8(value);
    const nameBytes = strToU8(name);
    const flags = /[^\x20-\x7e]/.test(name) ? 0x0800 : 0;
    const crc = crc32(data);
    const entry = {
      nameBytes,
      extraBytes: new Uint8Array(0),
      commentBytes: new Uint8Array(0),
      versionMadeBy: 20,
      versionNeeded: 20,
      internalAttrs: 0,
      externalAttrs: 0,
      modTime: FIXED_TIME,
      modDate: FIXED_DATE,
    };
    const local = buildLocalHeader(entry, 0, flags, data.length, data.length, crc);
    chunks.push(local, data);
    central.push(buildCentralHeader(entry, 0, flags, data.length, data.length, crc, offset));
    offset += local.length + data.length;
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of central) {
    chunks.push(cd);
    cdSize += cd.length;
  }
  if (central.length > 0xffff || cdOffset > 0xffffffff || cdSize > 0xffffffff) {
    throw new AppError('ZIP64_UNSUPPORTED', 'Hasil patch memerlukan ZIP64 yang tidak didukung.');
  }
  const eocd = new Uint8Array(22);
  writeU32(eocd, 0, SIG_EOCD);
  writeU16(eocd, 8, central.length);
  writeU16(eocd, 10, central.length);
  writeU32(eocd, 12, cdSize);
  writeU32(eocd, 16, cdOffset);
  chunks.push(eocd);
  const out = new Uint8Array(cdOffset + cdSize + 22);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  const type = (original && typeof original.type === 'string' && original.type)
    ? original.type
    : 'application/octet-stream';
  return new Blob([out], { type });
}
export async function hashZipEntries(bytes) {
  const data = await toBytes(bytes);
  const zip = parseZip(data, true, { inflateAll: true });
  const map = new Map();
  for (const entry of zip.entries) map.set(entry.name, await sha256Hex(entry.data));
  return map;
}
async function sha256Hex(data) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  const view = new Uint8Array(digest);
  let out = '';
  for (const byte of view) out += byte.toString(16).padStart(2, '0');
  return out;
}
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
function centralIdentity(entry) {
  const copy = entry.centralBytes.slice();
  writeU32(copy, 42, 0);
  return copy;
}
export async function verifyZipPreserved(beforeBytes, afterBytes, allowedNames) {
  const before = parseZip(await toBytes(beforeBytes), false);
  const after = parseZip(await toBytes(afterBytes), false);
  const allowed = allowedNames instanceof Set ? allowedNames : new Set(allowedNames || []);
  const beforeEntries = before.entries.filter((entry) => !allowed.has(entry.name));
  const afterEntries = after.entries.filter((entry) => !allowed.has(entry.name));
  const changed = [];
  const counts = new Map();
  for (const entry of beforeEntries) counts.set(entry.name, (counts.get(entry.name) || 0) + 1);
  for (const entry of afterEntries) counts.set(entry.name, (counts.get(entry.name) || 0) - 1);
  for (const [name, delta] of counts) if (delta !== 0) changed.push(name);
  if (beforeEntries.length === afterEntries.length) {
    for (let i = 0; i < beforeEntries.length; i += 1) {
      const a = beforeEntries[i];
      const b = afterEntries[i];
      if (a.name !== b.name) {
        if (!changed.includes(a.name)) changed.push(a.name);
        if (!changed.includes(b.name)) changed.push(b.name);
        continue;
      }
      if (!sameBytes(a.localBytes, b.localBytes) || !sameBytes(centralIdentity(a), centralIdentity(b))) {
        if (!changed.includes(a.name)) changed.push(a.name);
      }
    }
  }
  return { ok: changed.length === 0, changed };
}