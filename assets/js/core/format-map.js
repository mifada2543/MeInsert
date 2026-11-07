/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/** Field standar yang punya padanan di beberapa format untuk mode batch. */
import { asString } from './tag-utils.js';
export const STANDARD_FIELDS = [
  { id: 'title', label: 'Judul', type: 'text', placeholder: 'Judul untuk semua format', maxLength: 256 },
  { id: 'artist', label: 'Artis / pembuat', type: 'text', placeholder: 'Nama artis, penulis, atau pembuat', maxLength: 200 },
  { id: 'album', label: 'Album', type: 'text', placeholder: 'Nama album atau koleksi', maxLength: 200 },
  { id: 'date', label: 'Tanggal', type: 'date' },
  { id: 'genre', label: 'Genre', type: 'text', placeholder: 'Pop, dokumenter, tutorial…', maxLength: 100 },
  { id: 'comment', label: 'Komentar', type: 'textarea', placeholder: 'Catatan tambahan…', maxLength: 2000 },
  { id: 'copyright', label: 'Hak cipta', type: 'text', placeholder: '© 2026 Nama Anda', maxLength: 300 },
  { id: 'composer', label: 'Komposer', type: 'text', placeholder: 'Nama komposer', maxLength: 200 },
  { id: 'software', label: 'Perangkat lunak', type: 'text', placeholder: 'MeInsert', maxLength: 200 },
];
const FORMAT_FIELDS = {
  image: {
    title: 'title',
    artist: 'creator',
    date: 'date',
    comment: 'comment',
    copyright: 'rights',
    software: 'software',
  },
  pdf: {
    title: 'title',
    artist: 'author',
    date: 'creationDate',
    software: 'creator',
  },
  mp3: {
    title: 'title',
    artist: 'artist',
    album: 'album',
    date: 'year',
    genre: 'genre',
    comment: 'comment',
    copyright: 'copyright',
    composer: 'composer',
    software: 'software',
  },
  flac: {
    title: 'title',
    artist: 'artist',
    album: 'album',
    date: 'date',
    genre: 'genre',
    comment: 'comment',
    copyright: 'copyright',
    composer: 'composer',
    software: 'software',
  },
  ogg: {
    title: 'title',
    artist: 'artist',
    album: 'album',
    date: 'date',
    genre: 'genre',
    comment: 'comment',
    copyright: 'copyright',
    composer: 'composer',
    software: 'software',
  },
  mp4: {
    title: 'title',
    artist: 'artist',
    album: 'album',
    date: 'date',
    genre: 'genre',
    comment: 'comment',
    copyright: 'copyright',
    software: 'software',
  },
  mkv: {
    title: 'title',
    artist: 'artist',
    album: 'album',
    date: 'date',
    genre: 'genre',
    comment: 'comment',
    copyright: 'copyright',
    software: 'software',
  },
};
export function crossTarget(detectionId, fieldId) {
  return FORMAT_FIELDS[detectionId]?.[fieldId] || '';
}

function crossValue(target, value) {
  const text = asString(value).trim();
  if (target === 'year') {
    const match = text.match(/(?:^|\D)(\d{4})(?:\D|$)/);
    return match ? match[1] : '';
  }
  return text;
}
export function crossFormatPatch({ detectionId, availableFields, values = {}, removed = [] }) {
  const set = {};
  const remove = [];
  const removedSet = new Set(removed);
  for (const field of STANDARD_FIELDS) {
    const target = crossTarget(detectionId, field.id);
    if (!target) continue;
    if (availableFields && !availableFields.has(target)) continue;
    if (removedSet.has(field.id)) {
      remove.push(target);
      continue;
    }
    const value = crossValue(target, values[field.id]);
    if (value) set[target] = value;
  }
  return { set, remove };
}
