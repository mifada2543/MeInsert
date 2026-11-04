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
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'],
  mime: 'image/*',
};

function cameraFieldsSupported(subtype) {
  return subtype === 'jpeg' || subtype === 'tiff';
}

export function sectionsFor(subtype) {
  const base = [
    {
      id: 'umum',
      title: 'Metadata umum',
      description: 'Ditulis sebagai XMP dan EXIF agar terbaca di banyak aplikasi.',
    },
  ];
  if (cameraFieldsSupported(subtype)) {
    base.push({
      id: 'kamera',
      title: 'Info kamera',
      description: 'Field EXIF opsional. Kosongkan jika tidak ingin mengubahnya.',
    });
  }
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
    { id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: 'XMP-xmp:CreatorTool + EXIF:Software', placeholder: 'Meinsert', maxLength: 200 },
  ];
  if (subtype === 'png' || subtype === 'webp') return common;
  const withComment = [
    ...common,
    { id: 'comment', section: 'umum', label: 'Komentar', type: 'textarea', native: 'EXIF:UserComment', placeholder: 'Catatan tambahan…', maxLength: 2000 },
  ];
  if (subtype !== 'jpeg' && subtype !== 'tiff') return withComment;
  return [
    ...withComment,
    { id: 'make', section: 'kamera', label: 'Merek kamera', type: 'text', native: 'EXIF:Make', placeholder: 'Canon', maxLength: 100 },
    { id: 'model', section: 'kamera', label: 'Model kamera', type: 'text', native: 'EXIF:Model', placeholder: 'EOS R6', maxLength: 100 },
    { id: 'lens', section: 'kamera', label: 'Lensa', type: 'text', native: 'EXIF:LensModel', placeholder: 'RF 24-70mm F2.8 L IS USM', maxLength: 150 },
    { id: 'dateTaken', section: 'kamera', label: 'Tanggal pengambilan', type: 'date', native: 'EXIF:DateTimeOriginal' },
  ];
}

// Legacy exports for registry
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
  make: ['EXIF:Make', 'IFD0:Make'],
  model: ['EXIF:Model', 'IFD0:Model'],
  lens: ['EXIF:LensModel', 'ExifIFD:LensModel'],
  dateTaken: ['EXIF:DateTimeOriginal', 'ExifIFD:DateTimeOriginal'],
};

function supportedFields(subtype) {
  const fields = ['title', 'creator', 'description', 'keywords', 'rights', 'date', 'software'];
  if (subtype !== 'png' && subtype !== 'webp') fields.push('comment');
  if (subtype === 'jpeg' || subtype === 'tiff') fields.push('make', 'model', 'lens', 'dateTaken');
  return new Set(fields);
}

function withSafeName(file, extension) {
  const ext = extension || 'jpg';
  return new File([file], `input.${ext}`, { type: file.type || meta.mime });
}

export function mapTags(tags, subtype) {
  const supported = supportedFields(subtype);
  const out = {};
  for (const [id, keys] of Object.entries(READ_MAP)) {
    if (!supported.has(id)) continue;
    const value = pick(tags, keys);
    if (id === 'date' || id === 'dateTaken') out[id] = toDateInput(value);
    else if (id === 'keywords') out[id] = asArray(value);
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

const RAW_GROUPS = /^(XMP|EXIF|IFD0|ExifIFD|IPTC|ICC_Profile|PNG|RIFF|Photoshop)/i;

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

function buildTagMap(payload, subtype) {
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  const tags = {};
  const add = (key, value) => {
    if (value !== undefined) tags[key] = value;
  };
  const clear = (keys) => keys.forEach((key) => add(key, ''));

  const map = {
    title: ['XMP-dc:Title'],
    creator: ['XMP-dc:Creator', 'EXIF:Artist'],
    description: ['XMP-dc:Description', 'EXIF:ImageDescription'],
    keywords: ['XMP-dc:Subject'],
    rights: ['XMP-dc:Rights', 'EXIF:Copyright'],
    date: ['XMP-xmp:CreateDate'],
    software: ['XMP-xmp:CreatorTool', 'EXIF:Software'],
    comment: ['EXIF:UserComment'],
    make: ['EXIF:Make'],
    model: ['EXIF:Model'],
    lens: ['EXIF:LensModel'],
    dateTaken: ['EXIF:DateTimeOriginal'],
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
      add('EXIF:DateTimeOriginal', toExifDate(value));
    } else if (id === 'creator' || id === 'description') {
      add(keys[0], asString(value));
      if (keys[1]) add(keys[1], asString(value));
    } else {
      add(keys[0], asString(value));
      if (keys[1]) add(keys[1], asString(value));
    }
  }

  // IPTC improves compatibility for JPEG/TIFF, but is non-standard in PNG.
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
    warnings: [],
  };
}

export async function write(file, payload, options = {}, report = () => {}) {
  const { writeTags, readTags } = await import('../engines/exiftool.js');
  const safeFile = withSafeName(file, options.extension);
  const tags = buildTagMap(payload, options.subtype);
  if (!Object.keys(tags).length) {
    throw new AppError('NO_CHANGES', 'Tidak ada metadata yang perlu ditulis.');
  }

  report({ stage: 'Menulis metadata ke gambar…', pct: 35 });
  let bytes;
  try {
    bytes = await writeTags(safeFile, tags);
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

export default { meta, sections, fields, sectionsFor, fieldsFor, read, write, dispose };
