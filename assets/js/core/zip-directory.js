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
function parseDirectory(bytes, eocd, limits) {
  let count = readU16(bytes, eocd + 10);
  let cdSize = readU32(bytes, eocd + 12);
  let cdOffset = readU32(bytes, eocd + 16);
  const zip64 = readZip64Values(bytes, eocd);
  if (zip64) {
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
  const entries = [];
  let totalUncompressed = 0;
  let p = cdStart;
  for (let index = 0; index < count; index += 1) {
    if (p + 46 > cdEnd || readU32(bytes, p) !== SIG_CENTRAL) throw badZip('Central directory header tidak valid.');
    const flags = readU16(bytes, p + 8);
    if (flags & 1) {
      throw new AppError('ENCRYPTED_OFFICE', 'Dokumen Office terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.');
    }
    const method = readU16(bytes, p + 10);
    const modTime = readU16(bytes, p + 12);
    const modDate = readU16(bytes, p + 14);
    const crc = readU32(bytes, p + 16);
    let compressedSize = readU32(bytes, p + 20);
    let uncompressedSize = readU32(bytes, p + 24);
    const nameLen = readU16(bytes, p + 28);
    const extraLen = readU16(bytes, p + 30);
    const commentLen = readU16(bytes, p + 32);
    const versionMadeBy = readU16(bytes, p + 4);
    const versionNeeded = readU16(bytes, p + 6);
    const internalAttrs = readU16(bytes, p + 36);
    const externalAttrs = readU32(bytes, p + 38);
    let localOffset = readU32(bytes, p + 42);
    if (nameLen > limits.maxNameBytes) throw badZip('Nama entri ZIP terlalu panjang.');
    const bodyStart = p + 46;
    const centralEnd = bodyStart + nameLen + extraLen + commentLen;
    if (centralEnd > cdEnd) throw badZip('Central directory entry terpotong.');
    const nameBytes = bytes.slice(bodyStart, bodyStart + nameLen);
    const extraBytes = bytes.slice(bodyStart + nameLen, bodyStart + nameLen + extraLen);
    const commentBytes = bytes.slice(bodyStart + nameLen + extraLen, centralEnd);
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
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
      throw zipBomb(`Entri "${toName(nameBytes)}" melebihi batas ukuran per entri.`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxUncompressedTotal) {
      throw zipBomb('Total ukuran entri ZIP melebihi batas yang diizinkan.');
    }
    if (method === 8 && compressedSize > 0 && uncompressedSize / compressedSize > limits.maxDeflateRatio) {
      throw zipBomb(`Rasio kompresi entri "${toName(nameBytes)}" mencurigakan.`);
    }
    const localOffsetAbs = prefix + localOffset;
    if (!Number.isSafeInteger(localOffsetAbs) || localOffsetAbs < 0 || localOffsetAbs + 30 > cdStart
        || readU32(bytes, localOffsetAbs) !== SIG_LOCAL) {
      throw badZip('Local file header tidak ditemukan pada offset yang tercatat.');
    }
    const localNameLen = readU16(bytes, localOffsetAbs + 26);
    const localExtraLen = readU16(bytes, localOffsetAbs + 28);
    const dataOffset = localOffsetAbs + 30 + localNameLen + localExtraLen;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > cdStart) throw badZip('Data entry melampaui central directory.');
    let localEnd = dataEnd;
    if (flags & 8) {
      let descriptor = dataEnd;
      if (descriptor + 4 <= cdStart && readU32(bytes, descriptor) === SIG_DATA_DESCRIPTOR) descriptor += 4;
      descriptor += 12;
      localEnd = Math.min(descriptor, cdStart);
    }
    entries.push({
      name: toName(nameBytes),
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
      localBytes: bytes.subarray(localOffsetAbs, localEnd),
      compressedData: bytes.subarray(dataOffset, dataEnd),
      extraBytes,
      commentBytes,
      centralOffset: p,
      centralEnd,
      centralBytes: bytes.slice(p, centralEnd),
    });
    p = centralEnd;
  }
  if (p !== cdEnd) throw badZip('Central directory memiliki sisa data yang tidak dikenali.');
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
function toName(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
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
export default { readZipDirectory, findEocd, ZIP_LIMITS };