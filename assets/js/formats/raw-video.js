/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asString, pick, toDateInput } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { t } from '../i18n/index.js';
import { collectRaw } from './image.js';
export const meta = {
  id: 'rawVideo',
  engine: 'exiftool',
  label: 'RAW Video',
  description: 'BRAW, R3D, ARRIRAW',
  extensions: ['braw', 'r3d', 'ari', 'mxf'],
  mime: 'video/*',
  readOnly: true,
};
export function sectionsFor(subtype) {
  return [
    {
      id: 'umum',
      title: 'Metadata umum',
      description: `Metadata ${subtype || 'video'} hanya bisa dibaca dan tidak diubah.`,
    },
  ];
}
export function fieldsFor(subtype) {
  void subtype;
  return [
    { id: 'title', section: 'umum', label: 'Judul', type: 'text', native: 'XMP-dc:Title', readOnly: true },
    { id: 'creator', section: 'umum', label: 'Pembuat', type: 'text', native: 'XMP-dc:Creator', readOnly: true },
    { id: 'description', section: 'umum', label: 'Deskripsi', type: 'textarea', native: 'XMP-dc:Description', readOnly: true },
    { id: 'date', section: 'umum', label: 'Tanggal', type: 'date', native: 'XMP-xmp:CreateDate', readOnly: true },
    { id: 'rights', section: 'umum', label: 'Hak cipta', type: 'text', native: 'XMP-dc:Rights', readOnly: true },
    { id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: 'XMP-xmp:CreatorTool', readOnly: true },
  ];
}
export const sections = sectionsFor('braw');
export const fields = fieldsFor('braw');
const READ_MAP = {
  title: ['XMP-dc:Title', 'EXIF:Title'],
  creator: ['XMP-dc:Creator', 'EXIF:Artist', 'IPTC:By-line'],
  description: ['XMP-dc:Description', 'EXIF:ImageDescription', 'IPTC:Caption-Abstract'],
  date: ['XMP-xmp:CreateDate', 'EXIF:CreateDate', 'IFD0:DateTime'],
  rights: ['XMP-dc:Rights', 'EXIF:Copyright', 'IPTC:CopyrightNotice'],
  software: ['XMP-xmp:CreatorTool', 'EXIF:Software', 'IFD0:Software'],
};
function extensionFor(subtype) {
  if (subtype === 'r3d') return 'r3d';
  if (subtype === 'arriraw') return 'ari';
  return meta.extensions[0];
}
function withSafeName(file, extension) {
  return new File([file], `input.${extension}`, { type: file.type || meta.mime });
}
export function mapTags(tags) {
  const out = {};
  for (const [id, keys] of Object.entries(READ_MAP)) {
    const value = pick(tags, keys);
    out[id] = id === 'date' ? toDateInput(value) : asString(value);
  }
  return out;
}
export async function read(file, options = {}) {
  const { readTags } = await import('../engines/exiftool.js');
  const extension = options.extension || extensionFor(options.subtype);
  const tags = await readTags(withSafeName(file, extension));
  return {
    fields: mapTags(tags),
    raw: collectRaw(tags),
    custom: [],
    info: { kind: 'video' },
    warnings: [t('ui.rawVideoReadOnly')],
  };
}
export async function write() {
  throw new AppError('UNSUPPORTED_WRITE', t('ui.rawVideoWriteBlocked'));
}
export async function dispose() {
  const engine = await import('../engines/exiftool.js');
  if (typeof engine.disposeExifToolRuntime === 'function') {
    await engine.disposeExifToolRuntime();
  }
}
export default { meta, sections, fields, sectionsFor, fieldsFor, read, write, dispose };
