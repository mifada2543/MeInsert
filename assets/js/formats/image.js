/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import {
  asArray,
  asString,
  binaryLike,
  pick,
  rawValue,
  sameValue,
  toDateInput,
  toExifDate,
  toIsoDate,
} from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
export const meta = {
  id: 'image',
  engine: 'exiftool',
  label: 'Gambar',
  description: 'JPG, PNG, WebP, dan TIFF',
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'heic', 'heif', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf'],
  mime: 'image/*',
};
const XMP_ONLY_SUBTYPES = new Set([
  'png', 'webp', 'heic', 'heif', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf',
]);
export function xmpOnly(subtype) {
  return XMP_ONLY_SUBTYPES.has(String(subtype || '').toLowerCase());
}
function xmpCamera(subtype) {
  return xmpOnly(subtype);
}
export function sectionsFor(subtype) {
  const base = [
    {
      id: 'umum',
      title: 'Metadata umum',
      description: 'Ditulis sebagai XMP dan EXIF agar terbaca di banyak aplikasi.',
    },
  ];
  base.push({
    id: 'kamera',
    title: 'Info kamera',
    description: xmpCamera(subtype)
      ? 'Field XMP opsional (tanpa EXIF biner). Kosongkan jika tidak ingin mengubahnya.'
      : 'Field EXIF opsional. Kosongkan jika tidak ingin mengubahnya.',
  });
  base.push({
    id: 'lokasi',
    title: 'Metadata GPS',
    description: 'Disimpan sebagai EXIF GPS; tidak ditulis ke field lain.',
  });
  return base;
}
export function fieldsFor(subtype) {
  const common = [
    { id: 'title', section: 'umum', label: 'Judul', type: 'text', native: 'XMP-dc:Title', placeholder: 'Contoh: Sunset di Pantai Kuta', maxLength: 256 },
    { id: 'creator', section: 'umum', label: 'Pembuat / kreator', type: 'text', native: 'XMP-dc:Creator + EXIF:Artist', placeholder: 'Nama fotografer atau pembuat', maxLength: 200 },
    { id: 'description', section: 'umum', label: 'Deskripsi', type: 'textarea', native: 'XMP-dc:Description + EXIF:ImageDescription', placeholder: 'Ceritakan isi gambar…', maxLength: 2000 },
    { id: 'keywords', section: 'umum', label: 'Kata kunci', type: 'tags', native: 'XMP-dc:Subject', placeholder: 'pantai, sunset, bali', helper: 'Pisahkan dengan koma.', maxLength: 1000 },
    { id: 'rights', section: 'umum', label: 'Hak cipta', type: 'text', native: 'XMP-dc:Rights + EXIF:Copyright', placeholder: '© 2026 Nama Anda', maxLength: 300 },
    { id: 'date', section: 'umum', label: 'Tanggal dibuat', type: 'date', native: 'XMP-xmp:CreateDate' },
    { id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: 'XMP-xmp:CreatorTool + EXIF:Software', placeholder: 'MeInsert', maxLength: 200 },
    { id: 'gpsLatitude', section: 'lokasi', label: 'Lintang', type: 'text', native: 'GPS:GPSLatitude/GPSLatitudeRef', placeholder: 'Contoh: -6.2088', helper: 'Desimal derajat; negatif untuk selatan.', maxLength: 32 },
    { id: 'gpsLongitude', section: 'lokasi', label: 'Bujur', type: 'text', native: 'GPS:GPSLongitude/GPSLongitudeRef', placeholder: 'Contoh: 106.8456', helper: 'Desimal derajat; negatif untuk barat.', maxLength: 32 },
    { id: 'gpsAltitude', section: 'lokasi', label: 'Ketinggian', type: 'text', native: 'GPS:GPSAltitude', placeholder: 'Contoh: 12.5', maxLength: 32 },
    { id: 'gpsDate', section: 'lokasi', label: 'Tanggal GPS', type: 'date', native: 'GPS:GPSDateStamp' },
    { id: 'credit', section: 'umum', label: 'Kredit', type: 'text', native: 'XMP-photoshop:Credit', placeholder: 'Nama kredit', maxLength: 200 },
    { id: 'source', section: 'umum', label: 'Sumber', type: 'text', native: 'XMP-iptcCore:Source + XMP-photoshop:Source', placeholder: 'Sumber gambar', maxLength: 200 },
    { id: 'captionWriter', section: 'umum', label: 'Penulis caption', type: 'text', native: 'XMP-photoshop:CaptionWriter', placeholder: 'Nama penulis caption', maxLength: 200 },
    { id: 'jobTitle', section: 'umum', label: 'Jabatan penulis', type: 'text', native: 'XMP-iptcCore:AuthorsPosition + XMP-photoshop:AuthorsPosition', placeholder: 'Contoh: Fotografer', maxLength: 200 },
    { id: 'copyrightOwner', section: 'umum', label: 'Pemilik hak cipta', type: 'text', native: 'XMP-iptcExt:CopyrightOwner + XMP-plus:CopyrightOwnerName', placeholder: 'Nama pemilik', maxLength: 200 },
    { id: 'rating', section: 'umum', label: 'Peringkat', type: 'text', native: 'Xmp.xmp.Rating + XMP-xmp:Rating', placeholder: '0–5', maxLength: 8 },
    { id: 'label', section: 'umum', label: 'Label', type: 'text', native: 'Xmp.xmp.Label + XMP-xmp:Label', placeholder: 'Contoh: Pilihan', maxLength: 100 },
    { id: 'identifier', section: 'umum', label: 'Identifikator', type: 'text', native: 'XMP-dc:Identifier', placeholder: 'ID unik', maxLength: 200 },
    { id: 'location', section: 'umum', label: 'Lokasi', type: 'text', native: 'XMP-iptcCore:Location', placeholder: 'Contoh: Jakarta', maxLength: 200 },
  ];
  const camera = xmpCamera(subtype)
    ? [
        { id: 'make', section: 'kamera', label: 'Merek kamera', type: 'text', native: 'XMP-tiff:Make', placeholder: 'Canon', maxLength: 100 },
        { id: 'model', section: 'kamera', label: 'Model kamera', type: 'text', native: 'XMP-tiff:Model', placeholder: 'EOS R6', maxLength: 100 },
        { id: 'lens', section: 'kamera', label: 'Lensa', type: 'text', native: 'XMP-aux:Lens', placeholder: 'RF 24-70mm F2.8 L IS USM', maxLength: 150 },
        { id: 'dateTaken', section: 'kamera', label: 'Tanggal pengambilan', type: 'date', native: 'XMP-exif:DateTimeOriginal' },
      ]
    : [
        { id: 'make', section: 'kamera', label: 'Merek kamera', type: 'text', native: 'EXIF:Make', placeholder: 'Canon', maxLength: 100 },
        { id: 'model', section: 'kamera', label: 'Model kamera', type: 'text', native: 'EXIF:Model', placeholder: 'EOS R6', maxLength: 100 },
        { id: 'lens', section: 'kamera', label: 'Lensa', type: 'text', native: 'EXIF:LensModel', placeholder: 'RF 24-70mm F2.8 L IS USM', maxLength: 150 },
        { id: 'dateTaken', section: 'kamera', label: 'Tanggal pengambilan', type: 'date', native: 'EXIF:DateTimeOriginal' },
      ];
  if (xmpOnly(subtype)) return [...common, ...camera];
  const withComment = [
    ...common,
    { id: 'comment', section: 'umum', label: 'Komentar', type: 'textarea', native: 'EXIF:UserComment', placeholder: 'Catatan tambahan…', maxLength: 2000 },
  ];
  return [...withComment, ...camera];
}
export const sections = sectionsFor('jpeg');
export const fields = fieldsFor('jpeg');
const READ_MAP = {
  title: ['XMP-dc:Title'],
  creator: ['XMP-dc:Creator', 'EXIF:Artist', 'IPTC:By-line', 'IFD0:Artist'],
  description: ['XMP-dc:Description', 'EXIF:ImageDescription', 'IPTC:Caption-Abstract', 'IFD0:ImageDescription'],
  keywords: ['XMP-dc:Subject', 'IPTC:Keywords'],
  rights: ['XMP-dc:Rights', 'EXIF:Copyright', 'IPTC:CopyrightNotice', 'IFD0:Copyright'],
  date: ['XMP-xmp:CreateDate', 'EXIF:CreateDate', 'IFD0:DateTime'],
  software: ['XMP-xmp:CreatorTool', 'EXIF:Software', 'IFD0:Software'],
  comment: ['EXIF:UserComment', 'ExifIFD:UserComment'],
  make: ['EXIF:Make', 'IFD0:Make', 'XMP-tiff:Make'],
  model: ['EXIF:Model', 'IFD0:Model', 'XMP-tiff:Model'],
  lens: ['EXIF:LensModel', 'ExifIFD:LensModel', 'XMP-aux:Lens'],
  dateTaken: ['EXIF:DateTimeOriginal', 'ExifIFD:DateTimeOriginal', 'XMP-exif:DateTimeOriginal'],
  gpsLatitude: ['GPS:GPSLatitude', 'GPS:GPSLatitudeRef', 'EXIF:GPSLatitude', 'ExifIFD:GPSLatitude', 'Composite:GPSLatitude'],
  gpsLongitude: ['GPS:GPSLongitude', 'GPS:GPSLongitudeRef', 'EXIF:GPSLongitude', 'ExifIFD:GPSLongitude', 'Composite:GPSLongitude'],
  gpsAltitude: ['GPS:GPSAltitude', 'EXIF:GPSAltitude', 'Composite:GPSAltitude'],
  gpsDate: ['GPS:GPSDateStamp', 'EXIF:GPSDateStamp'],
  credit: ['XMP-photoshop:Credit', 'IPTC:Credit'],
  source: ['XMP-iptcCore:Source', 'XMP-photoshop:Source', 'IPTC:Source'],
  captionWriter: ['XMP-photoshop:CaptionWriter', 'IPTC:CaptionWriter', 'IPTC:Writer'],
  jobTitle: ['XMP-iptcCore:AuthorsPosition', 'XMP-photoshop:AuthorsPosition', 'IPTC:AuthorsPosition'],
  copyrightOwner: ['XMP-iptcExt:CopyrightOwner', 'XMP-plus:CopyrightOwnerName', 'IPTC:CopyrightOwner'],
  rating: ['Xmp.xmp.Rating', 'XMP-xmp:Rating'],
  label: ['Xmp.xmp.Label', 'XMP-xmp:Label'],
  identifier: ['XMP-dc:Identifier', 'IPTC:ObjectName'],
  location: ['XMP-iptcCore:Location', 'IPTC:Location'],
};
const GPS_LAT_REF = ['GPS:GPSLatitudeRef', 'EXIF:GPSLatitudeRef', 'ExifIFD:GPSLatitudeRef'];
const GPS_LON_REF = ['GPS:GPSLongitudeRef', 'EXIF:GPSLongitudeRef', 'ExifIFD:GPSLongitudeRef'];
const CAMERA_XMP_READ = {
  make: ['XMP-tiff:Make', 'EXIF:Make', 'IFD0:Make'],
  model: ['XMP-tiff:Model', 'EXIF:Model', 'IFD0:Model'],
  lens: ['XMP-aux:Lens', 'EXIF:LensModel', 'ExifIFD:LensModel'],
  dateTaken: ['XMP-exif:DateTimeOriginal', 'EXIF:DateTimeOriginal', 'ExifIFD:DateTimeOriginal'],
};
function gpsDecimal(value, ref) {
  const text = asString(value).trim();
  if (!text) return '';
  let degrees;
  const dms = text.match(/(-?\d+(?:\.\d+)?)\s*(?:deg|°)\s*(\d+(?:\.\d+)?)\s*['’]?\s*(\d+(?:\.\d+)?)\s*["”]?/i);
  if (dms) {
    degrees = Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600;
    if (dms[1].startsWith('-')) degrees = -degrees;
  } else {
    const number = text.match(/-?\d+(?:\.\d+)?/);
    if (!number) return '';
    degrees = Number(number[0]);
  }
  if (!Number.isFinite(degrees)) return '';
  const direction = asString(ref).trim().toUpperCase();
  const suffix = text.replace(/["”'’]/g, '').trim().toUpperCase();
  const southOrWest = direction === 'S' || direction === 'SOUTH' || direction === 'W' || direction === 'WEST'
    || /(?:SOUTH|WEST|S|W)$/.test(suffix);
  const northOrEast = direction === 'N' || direction === 'NORTH' || direction === 'E' || direction === 'EAST'
    || /(?:NORTH|EAST|N|E)$/.test(suffix);
  if (southOrWest) degrees = -Math.abs(degrees);
  else if (northOrEast) degrees = Math.abs(degrees);
  return String(Number(degrees.toFixed(6)));
}
function gpsNumber(value) {
  const match = asString(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return '';
  const number = Number(match[0]);
  return Number.isFinite(number) ? String(number) : '';
}
function toDms(value) {
  const number = gpsNumber(value);
  if (!number) return '';
  const absolute = Math.abs(Number(number));
  const degrees = Math.floor(absolute);
  const minutesValue = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesValue);
  const seconds = Number(((minutesValue - minutes) * 60).toFixed(5));
  return `${degrees} deg ${minutes}' ${seconds}"`;
}
function gpsRef(value, negative, positive) {
  const number = gpsNumber(value);
  if (!number) return '';
  return Number(number) < 0 ? negative : positive;
}
function toGpsDate(value) {
  const date = toDateInput(value);
  return date ? date.replace(/-/g, ':') : '';
}
const NEW_FIELD_IDS = [
  'gpsLatitude', 'gpsLongitude', 'gpsAltitude', 'gpsDate', 'credit', 'source',
  'captionWriter', 'jobTitle', 'copyrightOwner', 'rating', 'label', 'identifier', 'location',
];
const WRITE_ALIASES = {
  'XMP-iptcCore:Source': 'XMP-photoshop:Source',
  'XMP-iptcCore:AuthorsPosition': 'XMP-photoshop:AuthorsPosition',
  'XMP-iptcExt:CopyrightOwner': 'XMP-plus:CopyrightOwnerName',
  'Xmp.xmp.Rating': 'XMP-xmp:Rating',
  'Xmp.xmp.Label': 'XMP-xmp:Label',
};
function supportedFields(subtype) {
  const fields = ['title', 'creator', 'description', 'keywords', 'rights', 'date', 'software', ...NEW_FIELD_IDS];
  if (!xmpOnly(subtype)) fields.push('comment');
  fields.push('make', 'model', 'lens', 'dateTaken');
  return new Set(fields);
}
function withSafeName(file, extension) {
  const ext = extension || 'jpg';
  return new File([file], `input.${ext}`, { type: file.type || meta.mime });
}
export function mapTags(tags, subtype) {
  const supported = supportedFields(subtype);
  const out = {};
  for (const [id, baseKeys] of Object.entries(READ_MAP)) {
    if (!supported.has(id)) continue;
    const keys = xmpCamera(subtype) && CAMERA_XMP_READ[id] ? CAMERA_XMP_READ[id] : baseKeys;
    const value = pick(tags, keys);
    if (id === 'date' || id === 'dateTaken' || id === 'gpsDate') out[id] = toDateInput(value);
    else if (id === 'keywords') out[id] = asArray(value);
    else if (id === 'gpsLatitude') out[id] = gpsDecimal(value, pick(tags, GPS_LAT_REF));
    else if (id === 'gpsLongitude') out[id] = gpsDecimal(value, pick(tags, GPS_LON_REF));
    else if (id === 'gpsAltitude' || id === 'rating') out[id] = gpsNumber(value);
    else out[id] = asString(value);
  }
  return out;
}
export function describeFile(tags) {
  return {
    format: asString(tags['File:FileType']),
    width: tags['File:ImageWidth'] || tags['EXIF:ImageWidth'] || '',
    height: tags['File:ImageHeight'] || tags['EXIF:ImageHeight'] || '',
    kind: 'image',
  };
}
const RAW_GROUPS = /^(XMP|EXIF|GPS|IFD0|ExifIFD|IPTC|ICC_Profile|PNG|RIFF|Photoshop)/i;
export function collectRaw(tags) {
  const rows = [];
  for (const [key, value] of Object.entries(tags)) {
    if (!RAW_GROUPS.test(key)) continue;
    if (binaryLike(value)) continue;
    const text = rawValue(value);
    if (!text) continue;
    rows.push({ group: key.split(':')[0] || '', tag: key, value: text });
  }
  return rows.sort((a, b) => a.tag.localeCompare(b.tag));
}
export function buildTagMap(payload, subtype) {
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  const tags = {};
  const add = (key, value) => {
    if (value !== undefined) tags[key] = value;
  };
  const clear = (keys) => keys.forEach((key) => add(key, ''));
  const xmp = xmpCamera(subtype);
  const map = {
    title: ['XMP-dc:Title'],
    creator: ['XMP-dc:Creator', 'EXIF:Artist'],
    description: ['XMP-dc:Description', 'EXIF:ImageDescription'],
    keywords: ['XMP-dc:Subject'],
    rights: ['XMP-dc:Rights', 'EXIF:Copyright'],
    date: ['XMP-xmp:CreateDate'],
    software: ['XMP-xmp:CreatorTool', 'EXIF:Software'],
    comment: ['EXIF:UserComment'],
    make: [xmp ? 'XMP-tiff:Make' : 'EXIF:Make'],
    model: [xmp ? 'XMP-tiff:Model' : 'EXIF:Model'],
    lens: [xmp ? 'XMP-aux:Lens' : 'EXIF:LensModel'],
    dateTaken: [xmp ? 'XMP-exif:DateTimeOriginal' : 'EXIF:DateTimeOriginal'],
    gpsLatitude: ['GPS:GPSLatitude', 'GPS:GPSLatitudeRef'],
    gpsLongitude: ['GPS:GPSLongitude', 'GPS:GPSLongitudeRef'],
    gpsAltitude: ['GPS:GPSAltitude'],
    gpsDate: ['GPS:GPSDateStamp'],
    credit: ['XMP-photoshop:Credit'],
    source: ['XMP-iptcCore:Source'],
    captionWriter: ['XMP-photoshop:CaptionWriter'],
    jobTitle: ['XMP-iptcCore:AuthorsPosition'],
    copyrightOwner: ['XMP-iptcExt:CopyrightOwner'],
    rating: ['Xmp.xmp.Rating'],
    label: ['Xmp.xmp.Label'],
    identifier: ['XMP-dc:Identifier'],
    location: ['XMP-iptcCore:Location'],
  };
  const supported = supportedFields(subtype);
  for (const [id, keys] of Object.entries(map)) {
    if (!supported.has(id)) continue;
    if (remove.has(id)) {
      clear(keys);
      continue;
    }
    if (!(id in set)) continue;
    const value = set[id];
    if (id === 'keywords') {
      const arr = asArray(value);
      add(keys[0], arr);
    } else if (id === 'date') {
      add('XMP-xmp:CreateDate', toIsoDate(value));
    } else if (id === 'dateTaken') {
      add(keys[0], toExifDate(value));
    } else if (id === 'gpsLatitude') {
      add(keys[0], toDms(value));
      add(keys[1], gpsRef(value, 'S', 'N'));
    } else if (id === 'gpsLongitude') {
      add(keys[0], toDms(value));
      add(keys[1], gpsRef(value, 'W', 'E'));
    } else if (id === 'gpsAltitude' || id === 'rating') {
      add(keys[0], gpsNumber(value));
    } else if (id === 'gpsDate') {
      add(keys[0], toGpsDate(value));
    } else if (id === 'creator' || id === 'description') {
      add(keys[0], asString(value));
      if (keys[1]) add(keys[1], asString(value));
    } else {
      add(keys[0], asString(value));
      if (keys[1]) add(keys[1], asString(value));
    }
  }
  if (subtype === 'jpeg' || subtype === 'tiff') {
    if (remove.has('keywords')) add('IPTC:Keywords', '');
    else if ('keywords' in set) add('IPTC:Keywords', asArray(set.keywords));
    if (remove.has('creator')) add('IPTC:By-line', '');
    else if ('creator' in set) add('IPTC:By-line', asString(set.creator));
    if (remove.has('description')) add('IPTC:Caption-Abstract', '');
    else if ('description' in set) add('IPTC:Caption-Abstract', asString(set.description));
    if (remove.has('rights')) add('IPTC:CopyrightNotice', '');
    else if ('rights' in set) add('IPTC:CopyrightNotice', asString(set.rights));
  }
  for (const item of payload?.custom || []) {
    const key = asString(item?.key).trim();
    if (!key) continue;
    add(key, asString(item?.value));
  }
  for (const key of payload?.customRemove || []) {
    if (key) add(key, '');
  }
  for (const key of payload?.rawRemove || []) {
    if (key) add(asString(key).trim(), '');
  }
  return tags;
}
export async function read(file, options = {}) {
  const { readTags } = await import('../engines/exiftool.js');
  const safeFile = withSafeName(file, options.extension);
  const tags = await readTags(safeFile);
  return {
    fields: mapTags(tags, options.subtype),
    raw: collectRaw(tags),
    info: describeFile(tags),
    mediaProof: options.subtype === 'tiff' ? await (await import('../core/media-proof.js')).mediaProof(file, 'tiff') : undefined,
    warnings: [],
  };
}
export async function write(file, payload, options = {}, report = () => {}) {
  const { writeTags, readTags } = await import('../engines/exiftool.js');
  const safeFile = withSafeName(file, options.extension);
  const tags = buildTagMap(payload, options.subtype);
  const engineTags = {};
  for (const [key, value] of Object.entries(tags)) {
    engineTags[WRITE_ALIASES[key] || key] = value;
  }
  if (!Object.keys(engineTags).length) {
    throw new AppError('NO_CHANGES', 'Tidak ada metadata yang perlu ditulis.');
  }
  report({ stage: 'Menulis metadata ke gambar…', pct: 35 });
  let bytes;
  try {
    bytes = await writeTags(safeFile, engineTags);
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Gagal menulis metadata gambar.', error.message || String(error));
  }
  report({ stage: 'Memverifikasi hasil…', pct: 78 });
  const blob = new Blob([bytes], { type: options.mime || file.type || 'application/octet-stream' });
  const outputFile = new File([bytes], `output.${options.extension || 'jpg'}`, { type: blob.type });
  const tagsAfter = await readTags(outputFile);
  const after = mapTags(tagsAfter, options.subtype);
  const warnings = verify(payload, after, options.subtype);
  return {
    blob,
    fields: after,
    raw: collectRaw(tagsAfter),
    info: describeFile(tagsAfter),
    mediaProof: options.subtype === 'tiff' ? await (await import('../core/media-proof.js')).mediaProof(outputFile, 'tiff') : undefined,
    warnings,
  };
}
function verify(payload, after, subtype) {
  const warnings = [];
  const supported = supportedFields(subtype);
  for (const [id, value] of Object.entries(payload?.set || {})) {
    if (!supported.has(id)) continue;
    if (!(id in after)) continue;
    if (!sameValue(value, after[id])) {
      warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
    }
  }
  for (const id of payload?.remove || []) {
    if (!supported.has(id)) continue;
    if (after[id] && asString(after[id]).trim()) {
      warnings.push(`Field "${id}" belum sepenuhnya terhapus.`);
    }
  }
  return warnings;
}
async function dispose() {
  const { disposeExifToolRuntime } = await import('../engines/exiftool.js');
  await disposeExifToolRuntime();
}
export default { meta, sections, fields, sectionsFor, fieldsFor, xmpOnly, read, write, dispose };