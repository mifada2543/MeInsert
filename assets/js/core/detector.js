/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t } from '../i18n/index.js';
import { fileExtension } from './tag-utils.js';
import { readZipDirectoryFromBlob } from './zip-directory.js';
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
  heic: { id: 'image', subtype: 'heic', label: 'HEIC', mime: 'image/heic' },
  heif: { id: 'image', subtype: 'heic', label: 'HEIC', mime: 'image/heic' },
  dng: { id: 'image', subtype: 'dng', label: 'DNG', mime: 'image/x-dng' },
  cr2: { id: 'image', subtype: 'cr2', label: 'CR2', mime: 'image/x-cr2' },
  cr3: { id: 'image', subtype: 'cr3', label: 'CR3', mime: 'image/x-cr3' },
  nef: { id: 'image', subtype: 'nef', label: 'NEF', mime: 'image/x-nef' },
  arw: { id: 'image', subtype: 'arw', label: 'ARW', mime: 'image/x-arw' },
  orf: { id: 'image', subtype: 'orf', label: 'ORF', mime: 'image/x-orf' },
  rw2: { id: 'image', subtype: 'rw2', label: 'RW2', mime: 'image/x-rw2' },
  raf: { id: 'image', subtype: 'raf', label: 'RAF', mime: 'image/x-raf' },
  braw: { id: 'rawVideo', subtype: 'braw', label: 'BRAW', mime: 'video/x-braw' },
  r3d: { id: 'rawVideo', subtype: 'r3d', label: 'R3D', mime: 'video/x-r3d' },
  ari: { id: 'rawVideo', subtype: 'arriraw', label: 'ARRIRAW', mime: 'video/x-arriraw' },
  mxf: { id: 'rawVideo', subtype: 'arriraw', label: 'ARRIRAW', mime: 'video/x-arriraw' },
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
const RAW_IMAGE_SUBTYPES = new Set(['heic', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf']);
const TIFF_BASED_RAW = new Set(['dng', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'raf']);
function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
function sniffMp4Brand(bytes) {
  if (bytes.length < 12) return null;
  if (ascii(bytes, 4, 4) !== 'ftyp') return null;
  const brand = ascii(bytes, 8, 4);
  if (/^(heic|heix|hevc|mif1|msf1)$/.test(brand)) return { id: 'image', subtype: 'heic', label: 'HEIC', mime: 'image/heic' };
  if (brand === 'crx ') return { id: 'image', subtype: 'cr3', label: 'CR3', mime: 'image/x-cr3' };
  if (/^(M4A|M4B|M4P)/.test(brand)) return { id: 'mp4', subtype: 'm4a', label: 'M4A', mime: 'audio/mp4' };
  if (brand === 'qt  ') return { id: 'mp4', subtype: 'mov', label: 'MOV', mime: 'video/quicktime' };
  return { id: 'mp4', subtype: 'mp4', label: 'MP4', mime: 'video/mp4' };
}
const MXF_MAGIC = [0x06, 0x0e, 0x2b, 0x34, 0x02, 0x05, 0x01, 0x01, 0x0d, 0x01, 0x02, 0x01, 0x01, 0x02, 0x04];
function hasTiffMagic(bytes) {
  return bytes.length >= 4 && ((ascii(bytes, 0, 4) === 'II*\x00')
    || (ascii(bytes, 0, 4) === 'MM\x00*'));
}
function sniffTiffRaw(bytes) {
  if (!hasTiffMagic(bytes)) return null;
  const subtype = ascii(bytes, 8, 4) === 'CR\x02\x00' ? 'cr2' : null;
  if (subtype) return { id: 'image', subtype, label: 'CR2', mime: 'image/x-cr2' };
  if (bytes.length < 16) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[0] === 0x49;
  const ifd = view.getUint32(4, little);
  if (ifd < 8 || ifd + 2 > bytes.length) return null;
  const count = view.getUint16(ifd, little);
  if (count > 128 || ifd + 2 + count * 12 > bytes.length) return null;
  for (let i = 0; i < count; i += 1) {
    if (view.getUint16(ifd + 2 + i * 12, little) === 0xc612) {
      return { id: 'image', subtype: 'dng', label: 'DNG', mime: 'image/x-dng' };
    }
  }
  return null;
}
function sniffRaw(bytes) {
  const tiffRaw = sniffTiffRaw(bytes);
  if (tiffRaw) return tiffRaw;
  if (bytes.length >= 15 && ascii(bytes, 0, 15) === 'FUJIFILMCCD-RAW') {
    return { id: 'image', subtype: 'raf', label: 'RAF', mime: 'image/x-raf' };
  }
  if (bytes.length >= 4 && (ascii(bytes, 0, 4) === 'IIRO' || ascii(bytes, 0, 4) === 'IIRS')) {
    return { id: 'image', subtype: 'orf', label: 'ORF', mime: 'image/x-orf' };
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'IIU\x00') {
    return { id: 'image', subtype: 'rw2', label: 'RW2', mime: 'image/x-rw2' };
  }

  if (bytes.length >= 3 && ascii(bytes, 0, 3) === 'R3D') {
    return { id: 'rawVideo', subtype: 'r3d', label: 'R3D', mime: 'video/x-r3d' };
  }
  if (bytes.length >= 8 && (ascii(bytes, 0, 4) === 'braw' || ascii(bytes, 4, 4) === 'braw')) {
    return { id: 'rawVideo', subtype: 'braw', label: 'BRAW', mime: 'video/x-braw' };
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'ARRI') {
    return { id: 'rawVideo', subtype: 'arriraw', label: 'ARRIRAW', mime: 'video/x-arriraw' };
  }
  if (bytes.length >= MXF_MAGIC.length && MXF_MAGIC.every((byte, index) => bytes[index] === byte)
      && ascii(bytes, 0, Math.min(bytes.length, 128)).includes('ARRI')) {
    return { id: 'rawVideo', subtype: 'arriraw', label: 'ARRIRAW', mime: 'video/x-arriraw' };
  }
  return null;
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
      if (method === 0 && size > 0 && size < 512 && start + size <= bytes.length) {
        mimetype = ascii(bytes, start, size).trim();
      }
    }
    if (names.length >= 64) break;
  }
  return { names, mimetype };
}
function sniffZip(head, zipInfo = null) {
  let names = null;
  let mimetype = '';
  if (zipInfo?.entries) {
    names = zipInfo.entries.map((entry) => entry.name);
    const odfEntry = zipInfo.entries.find((entry) => entry.name === 'mimetype');
    if (odfEntry && odfEntry.method === 0 && odfEntry.data?.length && odfEntry.data.length < 512) {
      mimetype = ascii(odfEntry.data, 0, odfEntry.data.length).trim();
    }
  }
  if (!names) {
    const found = scanZipHead(head);
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
function sniff(bytes, zipInfo = null) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { id: 'image', subtype: 'jpeg', label: 'JPEG', mime: 'image/jpeg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a) {
    return { id: 'image', subtype: 'png', label: 'PNG', mime: 'image/png' };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return { id: 'image', subtype: 'webp', label: 'WebP', mime: 'image/webp' };
  }
  const raw = sniffRaw(bytes);
  if (raw) return raw;
  if (hasTiffMagic(bytes)) {
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
  const zip = sniffZip(bytes, zipInfo);
  if (zip) return zip;
  return null;
}
function extensionMatches(ext, byExt, byMagic) {
  if (byExt.id !== byMagic.id) return false;
  if (byExt.subtype === byMagic.subtype) return true;
  if (byExt.id === 'office') return false;
  if ((ext === 'ogg' || ext === 'oga') && byMagic.id === 'ogg') return true;
  if ((ext === 'mp4' || ext === 'm4v') && byMagic.id === 'mp4') return true;
  if (byExt.id === 'image' && RAW_IMAGE_SUBTYPES.has(byExt.subtype)
      && RAW_IMAGE_SUBTYPES.has(byMagic.subtype)) return byExt.subtype === byMagic.subtype;
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
  heic: 'heic',
  dng: 'dng',
  cr2: 'cr2',
  cr3: 'cr3',
  nef: 'nef',
  arw: 'arw',
  orf: 'orf',
  rw2: 'rw2',
  raf: 'raf',
  braw: 'braw',
  r3d: 'r3d',
  arriraw: 'ari',
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
  let zipInfo = null;
  let zipRejected = false;
  if (candidateZip) {
    try {
      zipInfo = await readZipDirectoryFromBlob(file);
    } catch (error) {
      if (error?.code === 'ZIP64_UNSUPPORTED') zipRejected = true;
    }
  }
  if (zipRejected) return null;
  if (candidateZip && !zipInfo) {
    const wider = new Uint8Array(await file.slice(0, ZIP_SNIFF_BYTES).arrayBuffer());
    if (wider.length > head.length) head = wider;
  }
  const byMagic = sniff(head, zipInfo);
  const byExt = EXTENSIONS[ext];
  if (byMagic) {
    const actualExt = EXT_BY_SUBTYPE[byMagic.subtype] || ext || 'bin';
    if (byExt?.id === 'image' && TIFF_BASED_RAW.has(byExt.subtype)
        && byMagic.id === 'image' && byMagic.subtype === 'tiff') {
      return {
        ...byExt, ext,
        warning: t('ui.rawUncertain', { v0: ext }),
      };
    }
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
  if (byExt && !(candidateZip && !zipInfo)) {
    return { ...byExt, ext, warning: 'Jenis file dikenali dari ekstensi; isi file tidak dikenali.' };
  }
  return null;
}
export { EXTENSIONS };