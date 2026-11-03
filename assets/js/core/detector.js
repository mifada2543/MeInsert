import { fileExtension } from './tag-utils.js';

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

function sniff(bytes) {
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
  // MPEG audio frame sync (no ID3 header).
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { id: 'mp3', subtype: 'mp3', label: 'MP3', mime: 'audio/mpeg' };
  }
  const ebml = sniffEbml(bytes);
  if (ebml) return ebml;
  const mp4 = sniffMp4Brand(bytes);
  if (mp4) return mp4;
  const ogg = sniffOgg(bytes);
  if (ogg) return ogg;
  return null;
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
};

export async function detectFile(file) {
  const head = new Uint8Array(await file.slice(0, 128).arrayBuffer());
  const byMagic = sniff(head);
  const ext = fileExtension(file.name);
  const byExt = EXTENSIONS[ext];
  if (byMagic) {
    if (byExt && byExt.id !== byMagic.id) {
      return { ...byMagic, ext: EXT_BY_SUBTYPE[byMagic.subtype] || ext, warning: `Ekstensi .${ext} tidak cocok dengan isi file; jenis file mengikuti isi.` };
    }
    return { ...byMagic, ext: EXT_BY_SUBTYPE[byMagic.subtype] || ext || 'bin' };
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
