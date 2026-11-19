/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from '../../vendor/fflate.mjs';
import { AppError } from './errors.js';

export const OFFICE_METADATA_PARTS = ['docProps/core.xml', 'docProps/app.xml', 'meta.xml'];

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;

// DOS timestamp for 1980-01-01 00:00:00 — deterministic for freshly added entries.
const FIXED_TIME = 0;
const FIXED_DATE = 0x0021;

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return ((bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0);
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

// Standard CRC-32 (IEEE 802.3), built once.
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

function findEocd(bytes) {
  const floor = Math.max(0, bytes.length - (22 + 0xffff));
  let loose = -1;
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (readU32(bytes, i) !== SIG_EOCD) continue;
    if (loose < 0) loose = i;
    const commentLen = readU16(bytes, i + 20);
    if (i + 22 + commentLen === bytes.length) return i;
  }
  return loose;
}

/**
 * Parse the ZIP central directory and local headers. Untouched entries keep a
 * verbatim slice of their local record; changed entries are re-emitted by patchZip.
 * When `inflate` is false, no entry payload is decompressed (bounded memory).
 */
function parseZip(bytes, inflate = true) {
  if (bytes.length < 22) throw badZip('Arsip Office terlalu pendek atau rusak.');
  const eocd = findEocd(bytes);
  if (eocd < 0) throw badZip('End of Central Directory tidak ditemukan.');

  // ZIP64 needs 64-bit offset handling we deliberately do not fake.
  if (eocd >= 20 && readU32(bytes, eocd - 20) === SIG_ZIP64_LOCATOR) {
    throw new AppError('ZIP64_UNSUPPORTED', 'Arsip Office memakai ZIP64 yang tidak didukung.');
  }

  const count = readU16(bytes, eocd + 10);
  const cdSize = readU32(bytes, eocd + 12);
  const cdOffset = readU32(bytes, eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new AppError('ZIP64_UNSUPPORTED', 'Arsip Office memakai ZIP64 yang tidak didukung.');
  }
  if (cdOffset + cdSize > bytes.length) throw badZip('Central directory berada di luar file.');

  const entries = [];
  let valid = true;
  let p = cdOffset;
  for (let index = 0; index < count; index += 1) {
    if (p + 46 > bytes.length || readU32(bytes, p) !== SIG_CENTRAL) {
      throw badZip('Central directory header tidak valid.');
    }
    const flags = readU16(bytes, p + 8);
    if (flags & 1) {
      throw new AppError(
        'ENCRYPTED_OFFICE',
        'Dokumen Office terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.',
      );
    }
    const method = readU16(bytes, p + 10);
    const modTime = readU16(bytes, p + 12);
    const modDate = readU16(bytes, p + 14);
    const crc = readU32(bytes, p + 16);
    const compressedSize = readU32(bytes, p + 20);
    const uncompressedSize = readU32(bytes, p + 24);
    const nameLen = readU16(bytes, p + 28);
    const extraLen = readU16(bytes, p + 30);
    const commentLen = readU16(bytes, p + 32);
    const versionMadeBy = readU16(bytes, p + 4);
    const versionNeeded = readU16(bytes, p + 6);
    const internalAttrs = readU16(bytes, p + 36);
    const externalAttrs = readU32(bytes, p + 38);
    const localOffset = readU32(bytes, p + 42);
    const bodyStart = p + 46;
    const centralEnd = bodyStart + nameLen + extraLen + commentLen;
    if (centralEnd > cdOffset + cdSize) throw badZip('Central directory entry terpotong.');

    const nameBytes = bytes.subarray(bodyStart, bodyStart + nameLen);
    const extraBytes = bytes.subarray(bodyStart + nameLen, bodyStart + nameLen + extraLen);
    const commentBytes = bytes.subarray(bodyStart + nameLen + extraLen, centralEnd);
    const centralBytes = bytes.slice(p, centralEnd);

    if (localOffset + 30 > cdOffset || readU32(bytes, localOffset) !== SIG_LOCAL) {
      throw badZip('Local file header tidak ditemukan pada offset yang tercatat.');
    }
    const localFlags = readU16(bytes, localOffset + 6);
    const localMethod = readU16(bytes, localOffset + 8);
    if (localFlags !== flags || localMethod !== method) valid = false;
    const localNameLen = readU16(bytes, localOffset + 26);
    const localExtraLen = readU16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > cdOffset) throw badZip('Data entry melampaui central directory.');

    let localEnd = dataEnd;
    if (flags & 8) {
      let descriptor = dataEnd;
      if (descriptor + 4 <= cdOffset && readU32(bytes, descriptor) === SIG_DATA_DESCRIPTOR) descriptor += 4;
      descriptor += 12;
      localEnd = Math.min(descriptor, cdOffset);
    }

    const compressedData = bytes.subarray(dataStart, dataEnd);
    let data = new Uint8Array(0);
    if (inflate) {
      try {
        if (method === 0) data = compressedData.slice();
        else if (method === 8) data = inflateSync(compressedData);
        else {
          throw new AppError(
            'UNSUPPORTED_COMPRESSION',
            `Metode kompresi ZIP ${method} tidak didukung.`,
          );
        }
        if (crc32(data) !== crc || data.length !== uncompressedSize) valid = false;
      } catch (error) {
        if (error instanceof AppError && error.code === 'UNSUPPORTED_COMPRESSION') throw error;
        valid = false;
      }
    }

    entries.push({
      name: strFromU8(nameBytes),
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
      localBytes: bytes.subarray(localOffset, localEnd),
      compressedData,
      data,
      extraBytes,
      commentBytes,
      centralBytes,
      centralEnd,
    });
    p = centralEnd;
  }
  if (p !== cdOffset + cdSize) valid = false;
  return { bytes, entries, eocd, cdOffset, cdSize, valid };
}

export async function inspectZip(fileOrBytes) {
  const bytes = await toBytes(fileOrBytes);
  const zip = parseZip(bytes, true);
  const names = zip.entries.map((entry) => entry.name);
  const signed = names.some((name) => /(^|\/)_xmlsignatures\//i.test(name));
  const mimetypeEntry = zip.entries.find((entry) => entry.name === 'mimetype');
  const odf = Boolean(mimetypeEntry);
  const mimetype = odf ? strFromU8(mimetypeEntry.data).trim() : '';
  let macros = names.some((name) => /(^|\/)vbaproject\.bin$/i.test(name));
  if (!macros) {
    const contentTypes = zip.entries.find((entry) => entry.name === '[Content_Types].xml');
    if (contentTypes) macros = /macroenabled/i.test(strFromU8(contentTypes.data));
  }
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

/**
 * Targeted ZIP patch: copy every untouched local record verbatim, re-emit only
 * replaced entries, and fix local-header offsets in the central directory.
 * `replacements` is a Map<name, Uint8Array|null>; null removes the entry.
 */
export async function patchZip(original, replacements) {
  const bytes = await toBytes(original);
  const zip = parseZip(bytes, false);
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
    if (value === null) continue; // deleted entry
    const data = toU8(value);
    const method = entry.method;
    if (method !== 0 && method !== 8) {
      throw new AppError('UNSUPPORTED_COMPRESSION', `Metode kompresi ZIP ${method} tidak didukung.`);
    }
    const compressed = method === 0 ? data : deflateSync(data);
    const crc = crc32(data);
    const flags = entry.flags & ~8; // sizes live in the header; no data descriptor
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
  const zip = parseZip(data, true);
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
  writeU32(copy, 42, 0); // the local-header offset is expected to move
  return copy;
}

/**
 * Prove that every entry outside `allowedNames` is byte-identical: same order,
 * same local record (header, flags, method, CRC, sizes, compressed bytes) and
 * the same central-directory metadata apart from the relocated offset.
 */
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
