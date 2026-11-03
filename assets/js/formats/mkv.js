import { asString, rawValue, sameValue, toDateInput } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { coverFromTags, applyCoverImages, mimeOf, scrubPrimaryCoverRaw } from '../core/image-utils.js';

export const meta = {
  id: 'mkv',
  engine: 'media',
  label: 'MKV / WebM',
  description: 'Video Matroska atau WebM',
  extensions: ['mkv', 'webm'],
  mime: 'video/x-matroska',
  cover: true,
};

export const sections = [
  {
    id: 'umum',
    title: 'Metadata Matroska',
    description: 'Container ditulis ulang tanpa transcode. Chapter/attachment mungkin tidak dipertahankan.',
  },
];

export const fields = [
  { id: 'title', section: 'umum', label: 'Judul', type: 'text', native: 'TITLE', placeholder: 'Judul video', maxLength: 256 },
  { id: 'artist', section: 'umum', label: 'Artis / pembuat', type: 'text', native: 'ARTIST', placeholder: 'Nama pembuat', maxLength: 200 },
  { id: 'album', section: 'umum', label: 'Album', type: 'text', native: 'ALBUM', placeholder: 'Nama album atau koleksi', maxLength: 200 },
  { id: 'date', section: 'umum', label: 'Tanggal rilis', type: 'date', native: 'DATE_RELEASED' },
  { id: 'genre', section: 'umum', label: 'Genre', type: 'text', native: 'GENRE', placeholder: 'Dokumenter, musik…', maxLength: 100 },
  { id: 'description', section: 'umum', label: 'Deskripsi', type: 'textarea', native: 'DESCRIPTION', placeholder: 'Deskripsi isi video…', maxLength: 2000 },
  { id: 'comment', section: 'umum', label: 'Komentar', type: 'textarea', native: 'COMMENT', placeholder: 'Catatan tambahan…', maxLength: 2000 },
  { id: 'copyright', section: 'umum', label: 'Hak cipta', type: 'text', native: 'COPYRIGHT', placeholder: '© 2026 Nama Anda', maxLength: 300 },
  { id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: 'ENCODER', placeholder: 'Meinsert', maxLength: 200 },
];

const KNOWN_RAW = new Set([
  'TITLE', 'ARTIST', 'ALBUM', 'DATE_RELEASED', 'DATE', 'GENRE', 'DESCRIPTION',
  'COMMENT', 'COPYRIGHT', 'ENCODER', 'ENCODER_SETTINGS', 'BPS', 'DURATION',
]);

function toFields(tags) {
  const raw = tags.raw || {};
  return {
    title: asString(tags.title ?? raw.TITLE),
    artist: asString(tags.artist ?? raw.ARTIST),
    album: asString(tags.album ?? raw.ALBUM),
    date: toDateInput(tags.date ?? raw.DATE_RELEASED ?? raw.DATE),
    genre: asString(tags.genre ?? raw.GENRE),
    description: asString(raw.DESCRIPTION),
    comment: asString(tags.comment ?? raw.COMMENT),
    copyright: asString(raw.COPYRIGHT),
    software: asString(raw.ENCODER),
  };
}

function customFrom(tags) {
  return Object.entries(tags.raw || {})
    .filter(([key]) => !KNOWN_RAW.has(key))
    .map(([key, value]) => ({ key, value: asString(value), originalKey: key }));
}

function rawRows(tags) {
  return Object.entries(tags.raw || {})
    .filter(([, value]) => value != null && !(value instanceof Uint8Array))
    .map(([tag, value]) => ({ group: 'Matroska', tag, value: rawValue(value) }))
    .filter((row) => row.value)
    .slice(0, 200);
}

async function mediaLib() {
  return import('../../vendor/mediabunny.mjs');
}

export async function read(file) {
  const { Input, ALL_FORMATS, BlobSource } = await mediaLib();
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const tags = await input.getMetadataTags();
    let duration = '';
    try {
      duration = await input.computeDuration();
    } catch {
      duration = '';
    }
    const video = await input.getPrimaryVideoTrack().catch(() => null);
    const audio = await input.getPrimaryAudioTrack().catch(() => null);
    const info = {
      kind: 'video',
      duration,
      width: video ? await video.getDisplayWidth().catch(() => '') : '',
      height: video ? await video.getDisplayHeight().catch(() => '') : '',
      videoCodec: video ? await video.getCodec().catch(() => '') : '',
      audioCodec: audio ? await audio.getCodec().catch(() => '') : '',
      hasCover: Boolean(tags.images?.length),
      rewrite: true,
    };
    return { fields: toFields(tags), custom: customFrom(tags), raw: rawRows(tags), info, ...coverFromTags(tags), warnings: [] };
  } catch (error) {
    throw new AppError('READ_FAILED', 'File MKV/WebM tidak bisa dibaca.', error.message || String(error));
  }
}

export async function write(file, payload, options = {}, report = () => {}) {
  const {
    Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Conversion,
    MkvOutputFormat, WebMOutputFormat,
  } = await mediaLib();
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);

  report({ stage: 'Membaca tag Matroska lama…', pct: 12 });
  let input;
  let tags;
  try {
    input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    tags = await input.getMetadataTags();
  } catch (error) {
    throw new AppError('READ_FAILED', 'Tag Matroska lama tidak bisa dibaca.', error.message || String(error));
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
      case 'date': {
        if (value) {
          const date = new Date(`${value}T00:00:00Z`);
          if (!Number.isNaN(date.getTime())) {
            merged.date = date;
            assignRaw('DATE_RELEASED', toDateInput(value));
          }
        }
        break;
      }
      case 'genre': merged.genre = asString(value); assignRaw('GENRE', asString(value)); break;
      case 'description': assignRaw('DESCRIPTION', asString(value)); break;
      case 'comment': merged.comment = asString(value); assignRaw('COMMENT', asString(value)); break;
      case 'copyright': assignRaw('COPYRIGHT', asString(value)); break;
      case 'software': assignRaw('ENCODER', asString(value)); break;
      default: break;
    }
  }
  for (const id of remove) {
    switch (id) {
      case 'title': assign('title', ''); assignRaw('TITLE', ''); break;
      case 'artist': assign('artist', ''); assignRaw('ARTIST', ''); break;
      case 'album': assign('album', ''); assignRaw('ALBUM', ''); break;
      case 'date': assign('date', ''); assignRaw('DATE_RELEASED', ''); assignRaw('DATE', ''); break;
      case 'genre': assign('genre', ''); assignRaw('GENRE', ''); break;
      case 'description': assignRaw('DESCRIPTION', ''); break;
      case 'comment': assign('comment', ''); assignRaw('COMMENT', ''); break;
      case 'copyright': assignRaw('COPYRIGHT', ''); break;
      case 'software': assignRaw('ENCODER', ''); break;
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
  const coverAction = payload?.cover?.action;
  if (coverAction === 'set' || coverAction === 'remove') {
    scrubPrimaryCoverRaw(merged.raw, merged.images);
    merged.images = applyCoverImages(merged.images, payload.cover);
  }

  const format = options.subtype === 'webm' ? new WebMOutputFormat() : new MkvOutputFormat();
  const output = new Output({ format, target: new BufferTarget() });
  let conversion;
  try {
    conversion = await Conversion.init({
      input,
      output,
      tags: merged,
      copy: { mode: 'forced' },
      showWarnings: false,
    });
  } catch (error) {
    throw new AppError('UNSUPPORTED_CODEC', 'File ini tidak bisa disalin tanpa transcode.', error.message || String(error));
  }
  if (!conversion.isValid) {
    const reasons = (conversion.discardedTracks || []).map((track) => track.reason).filter(Boolean).join(', ');
    throw new AppError('UNSUPPORTED_CODEC', 'File ini memakai codec yang tidak bisa disalin tanpa transcode.', reasons);
  }
  conversion.onProgress = (progress) => {
    report({ stage: `Menulis ulang container… ${Math.round(progress * 100)}%`, pct: 20 + progress * 55 });
  };
  try {
    await conversion.execute();
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Gagal menulis MKV/WebM.', error.message || String(error));
  }

  const bytes = new Uint8Array(output.target.buffer);
  const mime = options.mime || (options.subtype === 'webm' ? 'video/webm' : 'video/x-matroska');
  const extension = options.subtype === 'webm' ? 'webm' : 'mkv';
  const blob = new Blob([bytes], { type: mime });
  report({ stage: 'Memverifikasi hasil…', pct: 82 });
  try {
    const check = new Input({ source: new BlobSource(new File([bytes], `output.${extension}`, { type: mime })), formats: ALL_FORMATS });
    const afterTags = await check.getMetadataTags();
    const fields = toFields(afterTags);
    const warnings = ['Container ditulis ulang; chapter/attachment mungkin tidak dipertahankan.'];
    for (const [id, value] of Object.entries(set)) {
      if (id in fields && !sameValue(value, fields[id])) {
        warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
      }
    }
    if (coverAction === 'set' && !afterTags.images?.length) {
      warnings.push('Cover thumbnail tidak ada setelah penulisan.');
    } else if (coverAction === 'remove' && afterTags.images?.some((img) => img.kind !== 'coverBack')) {
      warnings.push('Cover thumbnail belum terhapus.');
    }
    return { blob, fields, custom: customFrom(afterTags), raw: rawRows(afterTags), info: { kind: 'video', hasCover: Boolean(afterTags.images?.length), rewrite: true }, warnings };
  } catch (error) {
    return { blob, fields: {}, custom: [], raw: [], info: {}, warnings: [`File sudah ditulis, tetapi verifikasi gagal: ${error.message || error}`] };
  }
}

export default { meta, sections, fields, read, write };
