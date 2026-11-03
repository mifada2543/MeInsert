/** Shared implementation for Vorbis-comment based adapters (FLAC, OGG/Opus). */

import { asString, rawValue, sameValue, toDateInput } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { applyCoverImages, coverFromTags, mimeOf, scrubPrimaryCoverRaw } from '../core/image-utils.js';

export const KNOWN_RAW = new Set([
  'vendor', 'ENCODER', 'TITLE', 'ARTIST', 'ALBUM', 'ALBUMARTIST', 'DATE',
  'GENRE', 'TRACKNUMBER', 'TRACKTOTAL', 'DISCNUMBER', 'DISCTOTAL',
  'COMPOSER', 'COMMENT', 'COPYRIGHT', 'LYRICS', 'DESCRIPTION',
]);

export function toFields(tags) {
  const raw = tags.raw || {};
  return {
    title: asString(tags.title ?? raw.TITLE),
    artist: asString(tags.artist ?? raw.ARTIST),
    album: asString(tags.album ?? raw.ALBUM),
    albumArtist: asString(tags.albumArtist ?? raw.ALBUMARTIST),
    date: toDateInput(tags.date ?? raw.DATE),
    genre: asString(tags.genre ?? raw.GENRE),
    trackNumber: asString(tags.trackNumber ?? raw.TRACKNUMBER),
    trackTotal: asString(tags.tracksTotal ?? raw.TRACKTOTAL),
    discNumber: asString(tags.discNumber ?? raw.DISCNUMBER),
    discTotal: asString(tags.discsTotal ?? raw.DISCTOTAL),
    composer: asString(raw.COMPOSER),
    comment: asString(tags.comment ?? raw.COMMENT),
    copyright: asString(raw.COPYRIGHT),
    software: asString(raw.ENCODER),
    lyrics: asString(tags.lyrics ?? raw.LYRICS),
  };
}

export function customFrom(tags) {
  return Object.entries(tags.raw || {})
    .filter(([key]) => !KNOWN_RAW.has(key))
    .map(([key, value]) => ({ key, value: asString(value), originalKey: key }));
}

export function rawRows(tags) {
  return Object.entries(tags.raw || {})
    .filter(([, value]) => value != null && !(value instanceof Uint8Array))
    .map(([tag, value]) => ({ group: 'Vorbis', tag, value: rawValue(value) }))
    .filter((row) => row.value)
    .slice(0, 200);
}

export const fields = [
  { id: 'title', section: 'umum', label: 'Judul', type: 'text', native: 'TITLE', placeholder: 'Judul lagu', maxLength: 256 },
  { id: 'artist', section: 'umum', label: 'Artis', type: 'text', native: 'ARTIST', placeholder: 'Nama artis', maxLength: 200 },
  { id: 'album', section: 'umum', label: 'Album', type: 'text', native: 'ALBUM', placeholder: 'Nama album', maxLength: 200 },
  { id: 'albumArtist', section: 'umum', label: 'Album artist', type: 'text', native: 'ALBUMARTIST', placeholder: 'Artis album', maxLength: 200 },
  { id: 'date', section: 'umum', label: 'Tanggal', type: 'date', native: 'DATE' },
  { id: 'genre', section: 'umum', label: 'Genre', type: 'text', native: 'GENRE', placeholder: 'Jazz, Klasik…', maxLength: 100 },
  { id: 'trackNumber', section: 'umum', label: 'Track', type: 'number', native: 'TRACKNUMBER', placeholder: '1', min: 0, max: 9999 },
  { id: 'trackTotal', section: 'umum', label: 'Total track', type: 'number', native: 'TRACKTOTAL', placeholder: '10', min: 0, max: 9999 },
  { id: 'discNumber', section: 'umum', label: 'Disc', type: 'number', native: 'DISCNUMBER', placeholder: '1', min: 0, max: 9999 },
  { id: 'discTotal', section: 'umum', label: 'Total disc', type: 'number', native: 'DISCTOTAL', placeholder: '1', min: 0, max: 9999 },
  { id: 'composer', section: 'umum', label: 'Komposer', type: 'text', native: 'COMPOSER', placeholder: 'Nama komposer', maxLength: 200 },
  { id: 'comment', section: 'umum', label: 'Komentar', type: 'textarea', native: 'COMMENT', placeholder: 'Catatan tentang audio…', maxLength: 2000 },
  { id: 'copyright', section: 'umum', label: 'Hak cipta', type: 'text', native: 'COPYRIGHT', placeholder: '© 2026 Nama Anda', maxLength: 300 },
  { id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: 'ENCODER', placeholder: 'Meinsert', maxLength: 200 },
  { id: 'lyrics', section: 'umum', label: 'Lirik', type: 'textarea', native: 'LYRICS', placeholder: 'Lirik lagu…', maxLength: 10000 },
];

export const sections = [
  {
    id: 'umum',
    title: 'Metadata Vorbis',
    description: 'Audio disalin lossless; hanya container metadata yang ditulis ulang.',
  },
];

export async function readVorbis(file) {
  const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const tags = await input.getMetadataTags();
    let duration = '';
    try {
      duration = await input.computeDuration();
    } catch {
      duration = '';
    }
    const audio = await input.getPrimaryAudioTrack().catch(() => null);
    if (!audio) {
      throw new AppError('UNSUPPORTED', 'Codec di container Ogg ini tidak didukung. Gunakan OGG Vorbis atau OGG Opus.');
    }
    const info = {
      kind: 'audio',
      duration,
      sampleRate: audio ? await audio.getSampleRate().catch(() => '') : '',
      channels: audio ? await audio.getNumberOfChannels().catch(() => '') : '',
      codec: audio ? await audio.getCodec().catch(() => '') : '',
      hasCover: Boolean(tags.images?.length),
    };
    return {
      fields: toFields(tags),
      custom: customFrom(tags),
      raw: rawRows(tags),
      info,
      ...coverFromTags(tags),
      warnings: [],
    };
  } catch (error) {
    throw new AppError('READ_FAILED', 'File audio tidak bisa dibaca.', error.message || String(error));
  }
}

export async function writeVorbis(file, payload, options, report, config) {
  const lib = await import('../../vendor/mediabunny.mjs');
  const FormatClass = lib[config.formatClass];
  if (!FormatClass) {
    throw new AppError('UNSUPPORTED', `Format ${config.formatClass} tidak tersedia di library.`);
  }
  const format = new FormatClass();
  const { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Conversion } = lib;
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);

  report({ stage: 'Membaca tag lama…', pct: 12 });
  let input;
  let tags;
  try {
    input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    tags = await input.getMetadataTags();
  } catch (error) {
    throw new AppError('READ_FAILED', 'Tag lama tidak bisa dibaca.', error.message || String(error));
  }

  const merged = { ...tags, raw: { ...(tags.raw || {}) } };
  const raw = merged.raw;
  const assign = (id, value) => {
    if (value === '' || value === undefined || value === null) delete merged[id];
    else merged[id] = value;
  };
  const assignRaw = (key, value) => {
    if (value === '' || value === undefined || value === null) delete raw[key];
    else raw[key] = value;
  };

  for (const [id, value] of Object.entries(set)) {
    switch (id) {
      case 'title': merged.title = asString(value); assignRaw('TITLE', asString(value)); break;
      case 'artist': merged.artist = asString(value); assignRaw('ARTIST', asString(value)); break;
      case 'album': merged.album = asString(value); assignRaw('ALBUM', asString(value)); break;
      case 'albumArtist': merged.albumArtist = asString(value); assignRaw('ALBUMARTIST', asString(value)); break;
      case 'date': {
        const date = value ? new Date(`${value}T00:00:00Z`) : null;
        if (date && !Number.isNaN(date.getTime())) {
          merged.date = date;
          assignRaw('DATE', toDateInput(value));
        }
        break;
      }
      case 'genre': merged.genre = asString(value); assignRaw('GENRE', asString(value)); break;
      case 'trackNumber': merged.trackNumber = Number(value) || undefined; assignRaw('TRACKNUMBER', asString(value)); break;
      case 'trackTotal': merged.tracksTotal = Number(value) || undefined; assignRaw('TRACKTOTAL', asString(value)); break;
      case 'discNumber': merged.discNumber = Number(value) || undefined; assignRaw('DISCNUMBER', asString(value)); break;
      case 'discTotal': merged.discsTotal = Number(value) || undefined; assignRaw('DISCTOTAL', asString(value)); break;
      case 'composer': assignRaw('COMPOSER', asString(value)); break;
      case 'comment': merged.comment = asString(value); assignRaw('COMMENT', asString(value)); break;
      case 'copyright': assignRaw('COPYRIGHT', asString(value)); break;
      case 'software': assignRaw('ENCODER', asString(value)); break;
      case 'lyrics': merged.lyrics = asString(value); assignRaw('LYRICS', asString(value)); break;
      default: break;
    }
  }
  for (const id of remove) {
    switch (id) {
      case 'title': assign('title', ''); assignRaw('TITLE', ''); break;
      case 'artist': assign('artist', ''); assignRaw('ARTIST', ''); break;
      case 'album': assign('album', ''); assignRaw('ALBUM', ''); break;
      case 'albumArtist': assign('albumArtist', ''); assignRaw('ALBUMARTIST', ''); break;
      case 'date': assign('date', ''); assignRaw('DATE', ''); break;
      case 'genre': assign('genre', ''); assignRaw('GENRE', ''); break;
      case 'trackNumber': assign('trackNumber', undefined); assignRaw('TRACKNUMBER', ''); break;
      case 'trackTotal': assign('tracksTotal', undefined); assignRaw('TRACKTOTAL', ''); break;
      case 'discNumber': assign('discNumber', undefined); assignRaw('DISCNUMBER', ''); break;
      case 'discTotal': assign('discsTotal', undefined); assignRaw('DISCTOTAL', ''); break;
      case 'composer': assignRaw('COMPOSER', ''); break;
      case 'comment': assign('comment', ''); assignRaw('COMMENT', ''); break;
      case 'copyright': assignRaw('COPYRIGHT', ''); break;
      case 'software': assignRaw('ENCODER', ''); break;
      case 'lyrics': assign('lyrics', ''); assignRaw('LYRICS', ''); break;
      default: break;
    }
  }
  for (const item of payload?.custom || []) {
    const key = asString(item?.key).trim();
    if (key) assignRaw(key.toUpperCase(), asString(item?.value));
  }
  for (const key of payload?.customRemove || []) {
    if (key) assignRaw(key.toUpperCase(), '');
  }

  // Cover / thumbnail handling.
  const coverAction = payload?.cover?.action;
  if (coverAction === 'set' || coverAction === 'remove') {
    scrubPrimaryCoverRaw(raw, merged.images);
    merged.images = applyCoverImages(merged.images, payload.cover);
  }

  const output = new Output({ format, target: new BufferTarget() });
  let conversion;
  try {
    conversion = await Conversion.init({
      input,
      output,
      tags: merged,
      copy: { mode: 'forced', ...(config.copy || {}) },
      showWarnings: false,
    });
  } catch (error) {
    throw new AppError('UNSUPPORTED_CODEC', `${config.label} ini tidak bisa disalin tanpa transcode.`, error.message || String(error));
  }
  if (!conversion.isValid) {
    const reasons = (conversion.discardedTracks || []).map((track) => track.reason).filter(Boolean).join(', ');
    throw new AppError('UNSUPPORTED_CODEC', `${config.label} ini tidak bisa ditulis tanpa transcode.`, reasons);
  }
  conversion.onProgress = (progress) => {
    report({ stage: `Menulis ulang container… ${Math.round(progress * 100)}%`, pct: 20 + progress * 55 });
  };
  try {
    await conversion.execute();
  } catch (error) {
    throw new AppError('WRITE_FAILED', `Gagal menulis ${config.label}.`, error.message || String(error));
  }

  const outExt = options.extension || config.defaultExt;
  const mime = options.mime || config.mime;
  const bytes = new Uint8Array(output.target.buffer);
  const blob = new Blob([bytes], { type: mime });
  report({ stage: 'Memverifikasi hasil…', pct: 82 });
  try {
    const check = new Input({ source: new BlobSource(new File([bytes], `output.${outExt}`, { type: mime })), formats: ALL_FORMATS });
    const afterTags = await check.getMetadataTags();
    const checkFields = toFields(afterTags);
    const warnings = [];
    for (const [id, value] of Object.entries(set)) {
      if (id in checkFields && !sameValue(value, checkFields[id])) {
        warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
      }
    }
    if (coverAction === 'set') {
      const img = afterTags.images?.find((i) => i.kind === 'coverFront') || afterTags.images?.[0];
      if (!img) warnings.push('Cover thumbnail tidak ada setelah penulisan.');
    } else if (coverAction === 'remove') {
      if (afterTags.images?.length) warnings.push('Cover thumbnail belum terhapus.');
    }
    return {
      blob,
      fields: checkFields,
      custom: customFrom(afterTags),
      raw: rawRows(afterTags),
      info: { kind: 'audio', hasCover: Boolean(afterTags.images?.length) },
      warnings,
    };
  } catch (error) {
    return { blob, fields: {}, custom: [], raw: [], info: {}, warnings: [`File sudah ditulis, tetapi verifikasi gagal: ${error.message || error}`] };
  }
}
