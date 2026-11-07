/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import {
  asString,
  pick,
  rawValue,
  sameValue,
  toDateInput,
  toExifDate,
} from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { coverFromTags, mimeOf } from '../core/image-utils.js';

export const meta = {
  id: 'mp4',
  engine: 'exiftool',
  label: 'MP4 / M4A',
  description: 'Video MP4, M4V, MOV, dan audio M4A',
  extensions: ['mp4', 'm4v', 'm4a', 'mov'],
  mime: 'video/mp4',
  cover: true,
};

export const sections = [
  {
    id: 'umum',
    title: 'Metadata umum',
    description: 'Ditulis ke iTunes ItemList dan XMP agar terbaca di pemutar umum.',
  },
];

export const fields = [
  {
    id: 'title',
    section: 'umum',
    label: 'Judul',
    type: 'text',
    native: 'ItemList:Title + XMP-dc:Title',
    placeholder: 'Judul video atau audio',
    maxLength: 256,
  },
  {
    id: 'artist',
    section: 'umum',
    label: 'Artis / pembuat',
    type: 'text',
    native: 'ItemList:Artist + XMP',
    placeholder: 'Nama pembuat',
    maxLength: 200,
  },
  {
    id: 'album',
    section: 'umum',
    label: 'Album',
    type: 'text',
    native: 'ItemList:Album',
    placeholder: 'Nama album atau koleksi',
    maxLength: 200,
  },
  {
    id: 'genre',
    section: 'umum',
    label: 'Genre',
    type: 'text',
    native: 'ItemList:Genre',
    placeholder: 'Dokumenter, musik, tutorial…',
    maxLength: 100,
  },
  {
    id: 'date',
    section: 'umum',
    label: 'Tanggal',
    type: 'date',
    native: 'QuickTime:CreateDate + XMP',
  },
  {
    id: 'description',
    section: 'umum',
    label: 'Deskripsi',
    type: 'textarea',
    native: 'ItemList:Description + XMP-dc:Description',
    placeholder: 'Deskripsi isi media…',
    maxLength: 2000,
  },
  {
    id: 'comment',
    section: 'umum',
    label: 'Komentar',
    type: 'textarea',
    native: 'ItemList:Comment',
    placeholder: 'Catatan tambahan…',
    maxLength: 2000,
  },
  {
    id: 'copyright',
    section: 'umum',
    label: 'Hak cipta',
    type: 'text',
    native: 'ItemList:Copyright + XMP',
    placeholder: '© 2026 Nama Anda',
    maxLength: 300,
  },
  {
    id: 'software',
    section: 'umum',
    label: 'Perangkat lunak',
    type: 'text',
    native: 'XMP-tiff:Software',
    placeholder: 'MeInsert',
    maxLength: 200,
  },
];

const READ_MAP = {
  title: ['ItemList:Title', 'XMP-dc:Title'],
  artist: ['ItemList:Artist', 'XMP-tiff:Artist'],
  album: ['ItemList:Album', 'XMP-xmpDM:Album'],
  genre: ['ItemList:Genre', 'XMP-xmpDM:Genre'],
  date: ['QuickTime:CreateDate', 'XMP-xmp:CreateDate', 'ItemList:ContentCreateDate'],
  description: ['ItemList:Description', 'XMP-dc:Description'],
  comment: ['ItemList:Comment'],
  copyright: ['ItemList:Copyright', 'XMP-tiff:Copyright'],
  software: ['XMP-tiff:Software', 'QuickTime:Software'],
};

const WRITE_MAP = {
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  genre: 'Genre',
  date: 'CreateDate',
  description: 'Description',
  comment: 'Comment',
  copyright: 'Copyright',
  software: 'Software',
};

function safeName(file, extension) {
  return new File([file], `input.${extension || 'mp4'}`, { type: file.type || meta.mime });
}

export function mapTags(tags) {
  const out = {};
  for (const [id, keys] of Object.entries(READ_MAP)) {
    const value = pick(tags, keys);
    out[id] = id === 'date' ? toDateInput(value) : asString(value);
  }
  return out;
}

export function describeFile(tags) {
  return {
    format: asString(tags['File:FileType']),
    duration: tags['QuickTime:Duration'] || tags['Composite:Duration'] || '',
    width: tags['QuickTime:ImageWidth'] || '',
    height: tags['QuickTime:ImageHeight'] || '',
    kind: 'video',
  };
}

export function collectRaw(tags) {
  const rows = [];
  for (const [key, value] of Object.entries(tags)) {
    if (!/^(ItemList|QuickTime|XMP|Keys|UserData)/i.test(key)) continue;
    const text = rawValue(value);
    if (!text) continue;
    rows.push({ group: key.split(':')[0] || '', tag: key, value: text });
  }
  return rows.sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function read(file, options = {}) {
  const { readTags } = await import('../engines/exiftool.js');
  const tags = await readTags(safeName(file, options.extension));
  const raw = collectRaw(tags);
  let duration = tags['QuickTime:Duration'] || tags['Composite:Duration'] || '';
  try {
    const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const seconds = await input.computeDuration();
    if (Number.isFinite(seconds) && seconds > 0) duration = seconds;
  } catch {
    // Keep the ExifTool duration string if Mediabunny cannot probe the file.
  }
  const hasCoverArt = raw.some((row) => /CoverArt/i.test(row.tag)) || Boolean(tags['ItemList:CoverArt']);
  let cover = null;
  let coverBytes = null;
  if (hasCoverArt) {
    try {
      const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
      const probe = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const coverTags = await probe.getMetadataTags();
      ({ cover, coverBytes } = coverFromTags(coverTags));
    } catch {
      // MP4 cover can be present without a readable MIME; show it as a placeholder.
      cover = { mimeType: 'image/jpeg', kind: 'coverFront', name: 'cover', size: 0 };
      coverBytes = null;
    }
  }
  const info = describeFile(tags);
  if (duration !== '') info.duration = duration;
  return {
    fields: mapTags(tags),
    raw,
    info,
    cover,
    coverBytes,
    warnings: [],
  };
}

export async function write(file, payload, options = {}, report = () => {}) {
  const { writeTags, readTags } = await import('../engines/exiftool.js');
  const tags = {};
  for (const [id, tag] of Object.entries(WRITE_MAP)) {
    if ((payload?.remove || []).includes(id)) {
      tags[tag] = '';
      continue;
    }
    if (!(id in (payload?.set || {}))) continue;
    const value = payload.set[id];
    tags[tag] = id === 'date' ? toExifDate(value) : asString(value);
  }
  for (const item of payload?.custom || []) {
    const key = asString(item?.key).trim();
    if (key) tags[key] = asString(item?.value);
  }
  for (const key of payload?.customRemove || []) {
    if (key) tags[key] = '';
  }
  for (const key of payload?.rawRemove || []) {
    if (key) tags[asString(key).trim()] = '';
  }
  const cover = payload?.cover;
  if (cover?.action === 'set' && cover.data) {
    tags['CoverArt'] = cover.data instanceof Uint8Array ? cover.data : new Uint8Array(cover.data);
  } else if (cover?.action === 'remove') {
    tags['CoverArt'] = '';
  }
  if (!Object.keys(tags).length) {
    throw new AppError('NO_CHANGES', 'Tidak ada metadata yang perlu ditulis.');
  }

  report({ stage: 'Menulis metadata ke media…', pct: 35 });
  let bytes;
  try {
    bytes = await writeTags(safeName(file, options.extension), tags);
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Gagal menulis metadata MP4.', error.message || String(error));
  }

  report({ stage: 'Memverifikasi hasil…', pct: 78 });
  const blob = new Blob([bytes], { type: options.mime || file.type || 'video/mp4' });
  const output = new File([bytes], `output.${options.extension || 'mp4'}`, { type: blob.type });
  const tagsAfter = await readTags(output);
  const fields = mapTags(tagsAfter);
  const warnings = [];
  for (const [id, value] of Object.entries(payload?.set || {})) {
    if (id in fields && !sameValue(value, fields[id])) {
      warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
    }
  }
  return {
    blob,
    fields,
    raw: collectRaw(tagsAfter),
    info: describeFile(tagsAfter),
    warnings,
  };
}

async function dispose() {
  const { disposeExifToolRuntime } = await import('../engines/exiftool.js');
  await disposeExifToolRuntime();
}

export default { meta, sections, fields, read, write, dispose };
