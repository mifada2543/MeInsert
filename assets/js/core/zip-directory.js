/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { AppError } from './errors.js';
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_LOCATOR64 = 0x07064b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;
export const ZIP_LIMITS = Object.freeze({
  maxEntries: 5000,
  maxCentralDirectoryBytes: 8 * 1024 * 1024,
  maxNameBytes: 256,
  maxUncompressedEntry: 64 * 1024 * 1024,
  maxUncompressedTotal: 256 * 1024 * 1024,
  maxDeflateRatio: 200,
});
export const DETECTION_READ_LIMITS = Object.freeze({
  maxTailBytes: 22 + 0xffff,
  maxPrefixWindowBytes: 64 * 1024,
  maxMimetypeBytes: 512,
});
function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function readU32(bytes, offset) {
  return ((bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0);
}
function readU64(bytes, offset) {
  const low = readU32(bytes, offset);
  const high = readU32(bytes, offset + 4);
  return high * 0x100000000 + low;
}
function badZip(message, detail = '') {
  return new AppError('CORRUPT_OFFICE', message, detail);
}
function zipBomb(message, detail = '') {
  return new AppError('ZIP_BOMB_SUSPECTED', message, detail);
}
function zip64Unsupported() {
  return new AppError('ZIP64_UNSUPPORTED', 'Arsip ZIP64 tidak didukung saat deteksi.');
}
function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  throw badZip('Arsip ZIP tidak bisa dibaca.', 'Input bukan Uint8Array/ArrayBuffer.');
}
function eocdCandidates(bytes) {
  const out = [];
  const floor = Math.max(0, bytes.length - (22 + 0xffff));
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (readU32(bytes, i) !== SIG_EOCD) continue;
    out.push(i);
    if (out.length >= 128) break;
  }
  return out;
}
export function findEocd(input) {
  const bytes = toBytes(input);
  const list = eocdCandidates(bytes);
  for (const offset of list) {
    if (offset + 22 + readU16(bytes, offset + 20) === bytes.length) return offset;
  }
  return list.length ? list[0] : -1;
}
function parseZip64Extra(extraBytes, needs) {
  const out = {};
  if (!extraBytes || extraBytes.length < 4) return out;
  let p = 0;
  while (p + 4 <= extraBytes.length) {
    const id = readU16(extraBytes, p);
    const size = readU16(extraBytes, p + 2);
    const start = p + 4;
    if (start + size > extraBytes.length) break;
    if (id === 0x0001) {
      let q = start;
      if (needs.uncompressed) {
        if (q + 8 > start + size) break;
        out.uncompressedSize = readU64(extraBytes, q);
        q += 8;
      }
      if (needs.compressed) {
        if (q + 8 > start + size) break;
        out.compressedSize = readU64(extraBytes, q);
        q += 8;
      }
      if (needs.localOffset) {
        if (q + 8 > start + size) break;
        out.localOffset = readU64(extraBytes, q);
      }
      break;
    }
    p = start + size;
  }
  return out;
}
function readZip64Values(bytes, eocd) {
  if (eocd < 20 || readU32(bytes, eocd - 20) !== SIG_LOCATOR64) return null;
  const recordOffset = readU64(bytes, eocd - 12);
  if (!Number.isSafeInteger(recordOffset) || recordOffset < 0 || recordOffset + 56 > bytes.length) {
    throw badZip('ZIP64 locator tidak valid.');
  }
  if (readU32(bytes, recordOffset) !== SIG_EOCD64) throw badZip('ZIP64 end record tidak ditemukan.');
  const count = readU64(bytes, recordOffset + 32);
  const cdSize = readU64(bytes, recordOffset + 40);
  const cdOffset = readU64(bytes, recordOffset + 48);
  if (![count, cdSize, cdOffset].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw badZip('Nilai ZIP64 di luar jangkauan yang aman.');
  }
  return { count, cdSize, cdOffset, recordOffset };
}
function resolvePrefix(bytes, cdOffset, cdSize, count, eocd) {
  const fits = (prefix) => {
    const start = prefix + cdOffset;
    if (!Number.isSafeInteger(start) || start < 0 || start + 46 > bytes.length) return false;
    if (readU32(bytes, start) !== SIG_CENTRAL) return false;
    if (start + cdSize > bytes.length) return false;
    if (!count) return true;
    const relativeLocal = readU32(bytes, start + 42);
    if (relativeLocal === 0xffffffff) return true;
    const absolute = prefix + relativeLocal;
    return absolute >= 0 && absolute + 30 <= bytes.length && readU32(bytes, absolute) === SIG_LOCAL;
  };
  if (fits(0)) return 0;
  const ceiling = Math.max(0, Math.min(eocd, bytes.length));
  const floor = Math.max(0, ceiling - cdSize - 0x10000);
  const seen = new Set();
  for (let i = ceiling - 4; i >= floor; i -= 1) {
    if (readU32(bytes, i) !== SIG_CENTRAL) continue;
    const prefix = i - cdOffset;
    if (prefix <= 0 || seen.has(prefix)) continue;
    seen.add(prefix);
    if (fits(prefix)) return prefix;
  }
  throw badZip('Central directory tidak ditemukan atau offset tidak konsisten.');
}
function decodedName(name) {
  let value = String(name).replace(/\\/g, '/');
  try {
    value = decodeURIComponent(value);
  } catch { }
  return value;
}
function normalizeEntryName(name) {
  return decodedName(name).split('/').filter((part) => part && part !== '.').join('/');
}
function assertSafeName(name) {
  const decoded = decodedName(name);
  if (decoded.split('/').includes('..')) {
    throw badZip(`Nama entri ZIP mengandung path traversal: "${name}".`);
  }
  if (decoded.startsWith('/') || /^[A-Za-z]:/.test(decoded) || decoded.includes('\u0000')) {
    throw badZip(`Nama entri ZIP tidak valid: "${name}".`);
  }
}
function assertNoConflicts(entries) {
  const names = new Set();
  const ranges = [];
  for (const entry of entries) {
    assertSafeName(entry.name);
    const key = normalizeEntryName(entry.name);
    if (!key) throw badZip('Nama entri ZIP kosong atau tidak valid.');
    if (names.has(key)) throw badZip(`Nama entri ZIP duplikat: "${entry.name}".`);
    names.add(key);
    ranges.push({ start: entry.localOffsetAbs, end: entry.localEnd, label: `lokal "${entry.name}"` });
    ranges.push({ start: entry.centralOffset, end: entry.centralEnd, label: `central "${entry.name}"` });
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < ranges.length; i += 1) {
    if (ranges[i].start < ranges[i - 1].end) {
      throw badZip(`Rentang ZIP tumpang tindih: ${ranges[i - 1].label} dan ${ranges[i].label}.`);
    }
  }
}
function arrayReader(bytes) {
  return {
    u16: (offset) => readU16(bytes, offset),
    u32: (offset) => readU32(bytes, offset),
    u64: (offset) => readU64(bytes, offset),
    slice: (start, end) => bytes.slice(start, end),
    sub: (start, end) => bytes.subarray(start, end),
  };
}
function windowReader(windows) {
  const find = (start, end) => {
    for (const window of windows) {
      if (start >= window.start && end <= window.start + window.bytes.length) return window;
    }
    throw badZip('Rentang ZIP tidak tersedia dalam potongan file yang dibaca.');
  };
  return {
    u16: (offset) => {
      const window = find(offset, offset + 2);
      return readU16(window.bytes, offset - window.start);
    },
    u32: (offset) => {
      const window = find(offset, offset + 4);
      return readU32(window.bytes, offset - window.start);
    },
    u64: (offset) => {
      const window = find(offset, offset + 8);
      return readU64(window.bytes, offset - window.start);
    },
    slice: (start, end) => {
      const window = find(start, end);
      return window.bytes.slice(start - window.start, end - window.start);
    },
    sub: (start, end) => {
      const window = find(start, end);
      return window.bytes.subarray(start - window.start, end - window.start);
    },
  };
}
function parseCentralEntry(reader, ctx, p) {
  const { cdStart, cdEnd, prefix, limits, verifyLocal } = ctx;
  if (p + 46 > cdEnd || reader.u32(p) !== SIG_CENTRAL) throw badZip('Central directory header tidak valid.');
  const flags = reader.u16(p + 8);
  if (flags & 1) {
    throw new AppError('ENCRYPTED_OFFICE', 'Dokumen Office terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.');
  }
  const method = reader.u16(p + 10);
  const modTime = reader.u16(p + 12);
  const modDate = reader.u16(p + 14);
  const crc = reader.u32(p + 16);
  let compressedSize = reader.u32(p + 20);
  let uncompressedSize = reader.u32(p + 24);
  const nameLen = reader.u16(p + 28);
  const extraLen = reader.u16(p + 30);
  const commentLen = reader.u16(p + 32);
  const versionMadeBy = reader.u16(p + 4);
  const versionNeeded = reader.u16(p + 6);
  const internalAttrs = reader.u16(p + 36);
  const externalAttrs = reader.u32(p + 38);
  let localOffset = reader.u32(p + 42);
  if (nameLen > limits.maxNameBytes) throw badZip('Nama entri ZIP terlalu panjang.');
  const bodyStart = p + 46;
  const centralEnd = bodyStart + nameLen + extraLen + commentLen;
  if (centralEnd > cdEnd) throw badZip('Central directory entry terpotong.');
  const nameBytes = reader.slice(bodyStart, bodyStart + nameLen);
  const extraBytes = reader.slice(bodyStart + nameLen, bodyStart + nameLen + extraLen);
  const commentBytes = reader.slice(bodyStart + nameLen + extraLen, centralEnd);
  const name = toName(nameBytes);
  if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
    if (!verifyLocal) throw zip64Unsupported();
    const z64 = parseZip64Extra(extraBytes, {
      uncompressed: uncompressedSize === 0xffffffff,
      compressed: compressedSize === 0xffffffff,
      localOffset: localOffset === 0xffffffff,
    });
    if (uncompressedSize === 0xffffffff) {
      if (!Number.isSafeInteger(z64.uncompressedSize)) throw badZip('Ukuran ZIP64 tidak valid.');
      uncompressedSize = z64.uncompressedSize;
    }
    if (compressedSize === 0xffffffff) {
      if (!Number.isSafeInteger(z64.compressedSize)) throw badZip('Ukuran ZIP64 tidak valid.');
      compressedSize = z64.compressedSize;
    }
    if (localOffset === 0xffffffff) {
      if (!Number.isSafeInteger(z64.localOffset)) throw badZip('Offset ZIP64 tidak valid.');
      localOffset = z64.localOffset;
    }
  }
  if (uncompressedSize > limits.maxUncompressedEntry) {
    throw zipBomb(`Entri "${name}" melebihi batas ukuran per entri.`);
  }
  if (method === 8 && compressedSize > 0 && uncompressedSize / compressedSize > limits.maxDeflateRatio) {
    throw zipBomb(`Rasio kompresi entri "${name}" mencurigakan.`);
  }
  const localOffsetAbs = prefix + localOffset;
  if (!Number.isSafeInteger(localOffsetAbs) || localOffsetAbs < 0 || localOffsetAbs + 30 > cdStart) {
    throw badZip('Local file header tidak ditemukan pada offset yang tercatat.');
  }
  let dataOffset = localOffsetAbs + 30 + nameLen + extraLen;
  let dataEnd = dataOffset + compressedSize;
  let localEnd = dataEnd;
  let localBytes = new Uint8Array(0);
  let compressedData = new Uint8Array(0);
  if (verifyLocal) {
    if (reader.u32(localOffsetAbs) !== SIG_LOCAL) {
      throw badZip('Local file header tidak ditemukan pada offset yang tercatat.');
    }
    const localNameLen = reader.u16(localOffsetAbs + 26);
    const localExtraLen = reader.u16(localOffsetAbs + 28);
    dataOffset = localOffsetAbs + 30 + localNameLen + localExtraLen;
    dataEnd = dataOffset + compressedSize;
    if (dataEnd > cdStart) throw badZip('Data entry melampaui central directory.');
    localEnd = dataEnd;
    if (flags & 8) {
      let descriptor = dataEnd;
      if (descriptor + 4 <= cdStart && reader.u32(descriptor) === SIG_DATA_DESCRIPTOR) descriptor += 4;
      descriptor += 12;
      localEnd = Math.min(descriptor, cdStart);
    }
    localBytes = reader.sub(localOffsetAbs, localEnd);
    compressedData = reader.sub(dataOffset, dataEnd);
  } else if (dataEnd > cdStart) {
    throw badZip('Data entry melampaui central directory.');
  }
  return {
    name,
    nameBytes,
    flags,
    method,
    modTime,
    modDate,
    crc32: crc,
    compressedSize,
    uncompressedSize,
    nameLen,
    extraLen,
    commentLen,
    versionMadeBy,
    versionNeeded,
    internalAttrs,
    externalAttrs,
    localOffset,
    localOffsetAbs,
    dataOffset,
    dataEnd,
    localEnd,
    localBytes,
    compressedData,
    extraBytes,
    commentBytes,
    centralOffset: p,
    centralEnd,
    centralBytes: reader.slice(p, centralEnd),
  };
}
function parseDirectory(bytes, eocd, limits) {
  if (eocd + 22 + readU16(bytes, eocd + 20) > bytes.length) throw badZip('Komentar EOCD terpotong.');
  let count = readU16(bytes, eocd + 10);
  let cdSize = readU32(bytes, eocd + 12);
  let cdOffset = readU32(bytes, eocd + 16);
  const zip64 = readZip64Values(bytes, eocd);
  if (zip64) {
    const eocdCount = readU16(bytes, eocd + 10);
    const eocdCdSize = readU32(bytes, eocd + 12);
    const eocdCdOffset = readU32(bytes, eocd + 16);
    if ((eocdCount !== 0xffff && eocdCount !== zip64.count)
      || (eocdCdSize !== 0xffffffff && eocdCdSize !== zip64.cdSize)
      || (eocdCdOffset !== 0xffffffff && eocdCdOffset !== zip64.cdOffset)) {
      throw badZip('Nilai EOCD tidak konsisten dengan catatan ZIP64.');
    }
    count = zip64.count;
    cdSize = zip64.cdSize;
    cdOffset = zip64.cdOffset;
  } else if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw badZip('Arsip ZIP64 tanpa locator yang valid.');
  }
  if (count > limits.maxEntries) {
    throw zipBomb(`Arsip memiliki ${count} entri, melebihi batas ${limits.maxEntries}.`);
  }
  if (cdSize > limits.maxCentralDirectoryBytes) {
    throw zipBomb('Central directory melebihi batas ukuran yang diizinkan.');
  }
  if (cdSize > bytes.length || cdOffset > bytes.length) throw badZip('Central directory berada di luar file.');
  const prefix = resolvePrefix(bytes, cdOffset, cdSize, count, eocd);
  const cdStart = prefix + cdOffset;
  const cdEnd = cdStart + cdSize;
  if (cdEnd > bytes.length) throw badZip('Central directory terpotong.');
  if (cdEnd > eocd) throw badZip('Central directory melampaui EOCD.');
  const ctx = { cdStart, cdEnd, prefix, limits, verifyLocal: true };
  const reader = arrayReader(bytes);
  const entries = [];
  let totalUncompressed = 0;
  let p = cdStart;
  for (let index = 0; index < count; index += 1) {
    const entry = parseCentralEntry(reader, ctx, p);
    totalUncompressed += entry.uncompressedSize;
    if (totalUncompressed > limits.maxUncompressedTotal) {
      throw zipBomb('Total ukuran entri ZIP melebihi batas yang diizinkan.');
    }
    entries.push(entry);
    p = entry.centralEnd;
  }
  if (p !== cdEnd) throw badZip('Central directory memiliki sisa data yang tidak dikenali.');
  assertNoConflicts(entries);
  return {
    bytes,
    eocd,
    eocd64: zip64 ? zip64.recordOffset : -1,
    prefix,
    zip64: Boolean(zip64),
    count,
    cdOffset,
    cdStart,
    cdSize,
    cdEnd,
    totalUncompressed,
    limits,
    entries,
  };
}
export function readZipDirectory(input, options = {}) {
  const bytes = toBytes(input);
  if (bytes.length < 22) throw badZip('Arsip ZIP terlalu pendek atau rusak.');
  const limits = { ...ZIP_LIMITS, ...(options?.limits || {}) };
  const candidates = eocdCandidates(bytes);
  if (!candidates.length) throw badZip('End of Central Directory tidak ditemukan.');
  let lastError = null;
  for (const eocd of candidates) {
    try {
      return parseDirectory(bytes, eocd, limits);
    } catch (error) {
      if (error instanceof AppError && error.code === 'CORRUPT_OFFICE') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError || badZip('End of Central Directory tidak valid.');
}
async function resolveBlobPrefix(file, { size, tail, tailStart, cdOffset, cdSize, eocdAbs }) {
  const seeds = [0, eocdAbs - cdSize - cdOffset];
  for (let i = tail.length - 4; i >= 0; i -= 1) {
    if (readU32(tail, i) !== SIG_CENTRAL) continue;
    seeds.push(tailStart + i - cdOffset);
    if (seeds.length > 24) break;
  }
  const seen = new Set();
  for (const prefix of seeds) {
    if (!Number.isSafeInteger(prefix) || prefix < 0 || seen.has(prefix)) continue;
    seen.add(prefix);
    const start = prefix + cdOffset;
    if (start < 0 || start + cdSize > size) continue;
    const probe = new Uint8Array(await file.slice(start, start + 4).arrayBuffer());
    if (probe.length === 4 && readU32(probe, 0) === SIG_CENTRAL) return prefix;
  }
  throw badZip('Central directory tidak ditemukan atau offset tidak konsisten.');
}
async function parseBlobDirectory(file, { size, tail, tailStart, at, limits }) {
  const eocdAbs = tailStart + at;
  if (at >= 20 && readU32(tail, at - 20) === SIG_LOCATOR64) throw zip64Unsupported();
  for (let i = 0; i + 4 <= tail.length; i += 1) {
    if (readU32(tail, i) === SIG_EOCD64) throw zip64Unsupported();
  }
  const count = readU16(tail, at + 10);
  const cdSize = readU32(tail, at + 12);
  const cdOffset = readU32(tail, at + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw zip64Unsupported();
  if (count > limits.maxEntries) {
    throw zipBomb(`Arsip memiliki ${count} entri, melebihi batas ${limits.maxEntries}.`);
  }
  if (cdSize > limits.maxCentralDirectoryBytes) {
    throw zipBomb('Central directory melebihi batas ukuran yang diizinkan.');
  }
  if (cdSize > size || cdOffset > size) throw badZip('Central directory berada di luar file.');
  const prefix = await resolveBlobPrefix(file, { size, tail, tailStart, cdOffset, cdSize, eocdAbs });
  const cdStart = prefix + cdOffset;
  const cdEnd = cdStart + cdSize;
  if (cdEnd > eocdAbs) throw badZip('Central directory melampaui EOCD.');
  const cdBytes = new Uint8Array(await file.slice(cdStart, cdEnd).arrayBuffer());
  if (cdBytes.length !== cdSize) throw badZip('Central directory terpotong.');
  const prefixWindowSize = Math.min(size, DETECTION_READ_LIMITS.maxPrefixWindowBytes);
  const prefixWindow = prefixWindowSize
    ? new Uint8Array(await file.slice(0, prefixWindowSize).arrayBuffer())
    : new Uint8Array(0);
  const reader = windowReader([
    { start: 0, bytes: prefixWindow },
    { start: cdStart, bytes: cdBytes },
    { start: tailStart, bytes: tail },
  ]);
  const ctx = { cdStart, cdEnd, prefix, limits, verifyLocal: false };
  const entries = [];
  let totalUncompressed = 0;
  let p = cdStart;
  for (let index = 0; index < count; index += 1) {
    const entry = parseCentralEntry(reader, ctx, p);
    totalUncompressed += entry.uncompressedSize;
    if (totalUncompressed > limits.maxUncompressedTotal) {
      throw zipBomb('Total ukuran entri ZIP melebihi batas yang diizinkan.');
    }
    entries.push(entry);
    p = entry.centralEnd;
  }
  if (p !== cdEnd) throw badZip('Central directory memiliki sisa data yang tidak dikenali.');
  assertNoConflicts(entries);
  const mimetypeEntry = entries.find((entry) => entry.name === 'mimetype' && entry.method === 0);
  let mimetypeData;
  if (mimetypeEntry && mimetypeEntry.uncompressedSize > 0
      && mimetypeEntry.uncompressedSize <= DETECTION_READ_LIMITS.maxMimetypeBytes) {
    const from = mimetypeEntry.localOffsetAbs;
    const to = mimetypeEntry.dataEnd;
    let record;
    if (from >= 0 && to <= prefixWindow.length) {
      record = prefixWindow.subarray(from, to);
    } else if (from >= tailStart && to <= size) {
      record = tail.subarray(from - tailStart, to - tailStart);
    } else if (from >= 0 && to <= size) {
      record = new Uint8Array(await file.slice(from, to).arrayBuffer());
    }
    if (record && record.length === to - from && readU32(record, 0) === SIG_LOCAL) {
      const dataStart = 30 + readU16(record, 26) + readU16(record, 28);
      if (dataStart + mimetypeEntry.compressedSize <= record.length) {
        mimetypeData = record.slice(dataStart, dataStart + mimetypeEntry.compressedSize);
      }
    }
  }
  return {
    entries: entries.map((entry) => ({
      name: entry.name,
      method: entry.method,
      flags: entry.flags,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      localOffset: entry.localOffset,
      localOffsetAbs: entry.localOffsetAbs,
      data: entry === mimetypeEntry ? (mimetypeData || new Uint8Array(0)) : undefined,
    })),
    count,
    prefix,
    cdStart,
    cdSize,
    eocd: eocdAbs,
    zip64: false,
    totalUncompressed,
  };
}
export async function readZipDirectoryFromBlob(file, options = {}) {
  if (!file || typeof file.slice !== 'function') {
    throw badZip('Arsip ZIP tidak bisa dibaca.', 'Input bukan Blob/File.');
  }
  const size = Number.isFinite(file.size) ? file.size : 0;
  const tailSize = Math.min(size, DETECTION_READ_LIMITS.maxTailBytes);
  if (tailSize < 22) throw badZip('Arsip ZIP terlalu pendek atau rusak.');
  const tailStart = size - tailSize;
  const tail = new Uint8Array(await file.slice(tailStart, size).arrayBuffer());
  const limits = { ...ZIP_LIMITS, ...(options?.limits || {}) };
  const candidates = [];
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (readU32(tail, i) !== SIG_EOCD) continue;
    if (tailStart + i + 22 + readU16(tail, i + 20) > size) continue;
    candidates.push(i);
    if (candidates.length >= 128) break;
  }
  if (!candidates.length) throw badZip('End of Central Directory tidak ditemukan.');
  let lastError = null;
  for (const at of candidates) {
    try {
      return await parseBlobDirectory(file, { size, tail, tailStart, at, limits });
    } catch (error) {
      if (error instanceof AppError && error.code === 'CORRUPT_OFFICE') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError || badZip('End of Central Directory tidak valid.');
}
function toName(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}
export default { readZipDirectory, readZipDirectoryFromBlob, findEocd, ZIP_LIMITS, DETECTION_READ_LIMITS };