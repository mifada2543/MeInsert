/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { fileExtension } from './tag-utils.js';
import { readZipDirectory } from './zip-directory.js';
const EXTENSIONS = {
  jpg: { id: 'image', subtype: 'jpeg', label: 'JPEG', mime: 'image/jpeg' },
  jpeg: { id: 'image', subtype: 'jpeg', label: 'JPEG', mime: 'image/jpeg' },
  png: { id: 'image', subtype: 'png', label: 'PNG', mime: 'image/png' },
  webp: { id: 'image', subtype: 'webp', label: 'WebP', mime: 'image/webp' },
  tif: { id: 'image', subtype: 'tiff', label: 'TIFF', mime: 'image/tiff' },
  tiff: { id: 'image', subtype: 'tiff', label: 'TIFF', mime: 'image/tiff' },
  pdf: { id: 'pdf', subtype: 'pdf', label: 'PDF', mime: 'application/pdf' },
  mp3: { id: 'mp3', subtype: 'mp3', label: 'MP3', mime: 'audio/mpeg' },
  flac: { id: 'flac', subtype: 'flac', label: 'FLAC', mime: 'audio/flac' },
  ogg: { id: 'ogg', subtype: 'vorbis', label: 'Ogg Vorbis', mime: 'audio/ogg' },
  oga: { id: 'ogg', subtype: 'vorbis', label: 'Ogg Vorbis', mime: 'audio/ogg' },
  opus: { id: 'ogg', subtype: 'opus', label: 'Opus', mime: 'audio/opus' },
  mkv: { id: 'mkv', subtype: 'mkv', label: 'MKV', mime: 'video/x-matroska' },
  webm: { id: 'mkv', subtype: 'webm', label: 'WebM', mime: 'video/webm' },
  mp4: { id: 'mp4', subtype: 'mp4', label: 'MP4', mime: 'video/mp4' },
  m4v: { id: 'mp4', subtype: 'mp4', label: 'M4V', mime: 'video/mp4' },
  m4a: { id: 'mp4', subtype: 'm4a', label: 'M4A', mime: 'audio/mp4' },
  mov: { id: 'mp4', subtype: 'mov', label: 'MOV', mime: 'video/quicktime' },
  docx: { id: 'office', subtype: 'docx', label: 'DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  docm: { id: 'office', subtype: 'docm', label: 'DOCM', mime: 'application/vnd.ms-word.document.macroEnabled.12' },
  xlsx: { id: 'office', subtype: 'xlsx', label: 'XLSX', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xlsm: { id: 'office', subtype: 'xlsm', label: 'XLSM', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
  pptx: { id: 'office', subtype: 'pptx', label: 'PPTX', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  pptm: { id: 'office', subtype: 'pptm', label: 'PPTM', mime: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12' },
  odt: { id: 'office', subtype: 'odt', label: 'ODT', mime: 'application/vnd.oasis.opendocument.text' },
  ods: { id: 'office', subtype: 'ods', label: 'ODS', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  odp: { id: 'office', subtype: 'odp', label: 'ODP', mime: 'application/vnd.oasis.opendocument.presentation' },
};
function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
function sniffMp4Brand(bytes) {
  if (bytes.length < 12) return null;
  if (ascii(bytes, 4, 4) !== 'ftyp') return null;
  const brand = ascii(bytes, 8, 4);
  if (/^(M4A|M4B|M4P)/.test(brand)) return { id: 'mp4', subtype: 'm4a', label: 'M4A', mime: 'audio/mp4' };
  if (brand === 'qt  ') return { id: 'mp4', subtype: 'mov', label: 'MOV', mime: 'video/quicktime' };
  return { id: 'mp4', subtype: 'mp4', label: 'MP4', mime: 'video/mp4' };
}
function sniffEbml(bytes) {
  if (!(bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)) return null;
  const text = ascii(bytes, 0, Math.min(bytes.length, 96));
  if (text.includes('webm')) return { id: 'mkv', subtype: 'webm', label: 'WebM', mime: 'video/webm' };
  return { id: 'mkv', subtype: 'mkv', label: 'MKV', mime: 'video/x-matroska' };
}
function sniffOgg(bytes) {
  if (ascii(bytes, 0, 4) !== 'OggS') return null;
  const text = ascii(bytes, 0, Math.min(bytes.length, 128));
  if (text.includes('OpusHead')) return { id: 'ogg', subtype: 'opus', label: 'Opus', mime: 'audio/opus' };
  if (text.includes('\u0001vorbis')) return { id: 'ogg', subtype: 'vorbis', label: 'Ogg Vorbis', mime: 'audio/ogg' };
  if (text.includes('\u007fFLAC')) return { id: 'ogg', subtype: 'flac', label: 'FLAC in Ogg', mime: 'audio/ogg' };
  return { id: 'ogg', subtype: 'unknown', label: 'Ogg', mime: 'audio/ogg' };
}
const ZIP_SNIFF_BYTES = 65536;
const ZIP_FULL_READ_LIMIT = 128 * 1024 * 1024;
function isZipLocalHeader(bytes, offset) {
  return bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b
    && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04;
}
function zipU16(bytes, offset) {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function zipU32(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}
function scanZipHead(bytes) {
  const names = [];
  let mimetype = '';
  for (let offset = 0; offset + 30 <= bytes.length; offset += 1) {
    if (!isZipLocalHeader(bytes, offset)) continue;
    const nameLen = zipU16(bytes, offset + 26);
    if (nameLen < 1 || nameLen > 256 || offset + 30 + nameLen > bytes.length) continue;
    const name = ascii(bytes, offset + 30, nameLen);
    if (!/^[\x20-\x7e]+$/.test(name)) continue;
    names.push(name);
    if (name === 'mimetype') {
      const method = zipU16(bytes, offset + 8);
      const extraLen = zipU16(bytes, offset + 28);
      const size = zipU32(bytes, offset + 18);
      const start = offset + 30 + nameLen + extraLen;
      // Entri `mimetype` ODF wajib stored (tanpa kompresi) dan pertama.
      if (method === 0 && size > 0 && size < 512 && start + size <= bytes.length) {
        mimetype = ascii(bytes, start, size).trim();
      }
    }
    if (names.length >= 64) break;
  }
  return { names, mimetype };
}
function sniffZip(bytes, zipBytes = null) {
  let names = null;
  let mimetype = '';
  try {
    const zip = readZipDirectory(zipBytes || bytes);
    names = zip.entries.map((entry) => entry.name);
    const odfEntry = zip.entries.find((entry) => entry.name === 'mimetype');
    if (odfEntry && odfEntry.method === 0 && odfEntry.compressedData.length
        && odfEntry.compressedData.length < 512) {
      mimetype = ascii(odfEntry.compressedData, 0, odfEntry.compressedData.length).trim();
    }
  } catch { /* fall back to a bounded local-header scan */ }
  if (!names) {
    const found = scanZipHead(bytes);
    if (!found.names.length) return null;
    ({ names, mimetype } = found);
  }
  const has = (name) => names.includes(name);
  if (has('mimetype')) {
    const odf = {
      'application/vnd.oasis.opendocument.text': { id: 'office', subtype: 'odt', label: 'ODT', mime: 'application/vnd.oasis.opendocument.text' },
      'application/vnd.oasis.opendocument.spreadsheet': { id: 'office', subtype: 'ods', label: 'ODS', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
      'application/vnd.oasis.opendocument.presentation': { id: 'office', subtype: 'odp', label: 'ODP', mime: 'application/vnd.oasis.opendocument.presentation' },
    };
    if (odf[mimetype]) return odf[mimetype];
  }
  if (!has('[Content_Types].xml')) return null;
  const macro = names.some((name) => /(^|\/)vbaProject\.bin$/i.test(name));
  const parts = [
    { main: 'word/document.xml', plain: 'docx', macro: 'docm', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', macroMime: 'application/vnd.ms-word.document.macroEnabled.12' },
    { main: 'xl/workbook.xml', plain: 'xlsx', macro: 'xlsm', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', macroMime: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
    { main: 'ppt/presentation.xml', plain: 'pptx', macro: 'pptm', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', macroMime: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12' },
  ];
  for (const part of parts) {
    if (!has(part.main)) continue;
    const subtype = macro ? part.macro : part.plain;
    return {
      id: 'office',
      subtype,
      label: subtype.toUpperCase(),
      mime: macro ? part.macroMime : part.mime,
    };
  }
  return null;
}
function sniff(bytes, zipBytes = null) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { id: 'image', subtype: 'jpeg', label: 'JPEG', mime: 'image/jpeg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a) {
    return { id: 'image', subtype: 'png', label: 'PNG', mime: 'image/png' };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return { id: 'image', subtype: 'webp', label: 'WebP', mime: 'image/webp' };
  }
  if (bytes.length >= 4 && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))) {
    return { id: 'image', subtype: 'tiff', label: 'TIFF', mime: 'image/tiff' };
  }
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') {
    return { id: 'pdf', subtype: 'pdf', label: 'PDF', mime: 'application/pdf' };
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'fLaC') {
    return { id: 'flac', subtype: 'flac', label: 'FLAC', mime: 'audio/flac' };
  }
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === 'ID3') {
    return { id: 'mp3', subtype: 'mp3', label: 'MP3', mime: 'audio/mpeg' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { id: 'mp3', subtype: 'mp3', label: 'MP3', mime: 'audio/mpeg' };
  }
  const ebml = sniffEbml(bytes);
  if (ebml) return ebml;
  const mp4 = sniffMp4Brand(bytes);
  if (mp4) return mp4;
  const ogg = sniffOgg(bytes);
  if (ogg) return ogg;
  const zip = sniffZip(bytes, zipBytes);
  if (zip) return zip;
  return null;
}
function extensionMatches(ext, byExt, byMagic) {
  if (byExt.id !== byMagic.id) return false;
  if (byExt.subtype === byMagic.subtype) return true;
  if (byExt.id === 'office') return false;
  if ((ext === 'ogg' || ext === 'oga') && byMagic.id === 'ogg') return true;
  if ((ext === 'mp4' || ext === 'm4v') && byMagic.id === 'mp4') return true;
  return false;
}
const EXT_BY_SUBTYPE = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  tiff: 'tif',
  pdf: 'pdf',
  mp3: 'mp3',
  flac: 'flac',
  vorbis: 'ogg',
  opus: 'opus',
  mkv: 'mkv',
  webm: 'webm',
  mp4: 'mp4',
  m4a: 'm4a',
  mov: 'mov',
  docx: 'docx',
  docm: 'docm',
  xlsx: 'xlsx',
  xlsm: 'xlsm',
  pptx: 'pptx',
  pptm: 'pptm',
  odt: 'odt',
  ods: 'ods',
  odp: 'odp',
};
export async function detectFile(file) {
  let head = new Uint8Array(await file.slice(0, 128).arrayBuffer());
  const ext = fileExtension(file.name);
  const candidateZip = (head.length >= 4 && isZipLocalHeader(head, 0)) || EXTENSIONS[ext]?.id === 'office';
  let zipBytes = null;
  if (candidateZip && file.size <= ZIP_FULL_READ_LIMIT) {
    try {
      zipBytes = new Uint8Array(await file.arrayBuffer());
    } catch { /* keep the bounded head */ }
  }
  if (candidateZip && !zipBytes) {
    const wider = new Uint8Array(await file.slice(0, ZIP_SNIFF_BYTES).arrayBuffer());
    if (wider.length > head.length) head = wider;
  }
  const byMagic = sniff(head, zipBytes);
  const byExt = EXTENSIONS[ext];
  if (byMagic) {
    const actualExt = EXT_BY_SUBTYPE[byMagic.subtype] || ext || 'bin';
    if (byExt && !extensionMatches(ext, byExt, byMagic)) {
      return {
        ...byMagic,
        ext: actualExt,
        warning: `Ekstensi .${ext} tidak cocok dengan isi file; terdeteksi ${byMagic.label}. Jenis file mengikuti isi.`,
      };
    }
    if (!byExt && ext) {
      return {
        ...byMagic,
        ext: actualExt,
        warning: `Ekstensi .${ext} tidak dikenal; terdeteksi ${byMagic.label}. Jenis file mengikuti isi.`,
      };
    }
    return { ...byMagic, ext: actualExt };
  }
  if (byExt) {
    return { ...byExt, ext, warning: 'Jenis file dikenali dari ekstensi; isi file tidak dikenali.' };
  }
  return null;
}
export function supportedExtensionList() {
  return [...new Set(Object.values(EXTENSIONS).map((v) => v.label))];
}
export { EXTENSIONS };