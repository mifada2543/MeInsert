/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
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
import { coverFromTags } from '../core/image-utils.js';
import { parseLrc, serializeLrc, serializeVtt } from '../core/timed-text.js';
import { mediaProof, mediaPacketProof, sameMediaProof } from '../core/media-proof.js';
import { conversionCutOptions, expectedCutDuration, mediaRangeProof } from '../core/media-cut.js';
const LRC_LIKE_RE = /\[\d{1,3}:\d{2}[.,:]\d{1,3}\]/;
const WVTT_MARKER = new TextEncoder().encode('wvtt');
function containsMarker(bytes, marker) {
  outer: for (let i = 0; i <= bytes.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) if (bytes[i + j] !== marker[j]) continue outer;
    return true;
  }
  return false;
}
async function hasBytes(file, marker) {
  const CHUNK = 1024 * 1024;
  let carry = new Uint8Array(0);
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    const slice = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + CHUNK)).arrayBuffer());
    const window = carry.length ? new Uint8Array(carry.length + slice.length) : slice;
    if (carry.length) {
      window.set(carry);
      window.set(slice, carry.length);
    }
    if (containsMarker(window, marker)) return true;
    carry = window.subarray(Math.max(0, window.length - (marker.length - 1)));
  }
  return false;
}
function lyricCues(lines) {
  const sorted = (Array.isArray(lines) ? lines : [])
    .filter((line) => line && typeof line === 'object')
    .slice()
    .sort((a, b) => Number(a.time) - Number(b.time));
  return sorted.map((line, index) => {
    const start = Number(line.time) || 0;
    const next = sorted[index + 1];
    let end = next ? Number(next.time) : start + 1000;
    if (!(end > start)) end = start + 1000;
    return { id: String(index + 1), start, end, text: asString(line.text), settings: '' };
  });
}
function mediabunnyFields(tags) {
  return {
    title: asString(tags.title),
    artist: asString(tags.artist),
    album: asString(tags.album),
    genre: asString(tags.genre),
    date: toDateInput(tags.date ?? tags.releaseDate),
    description: asString(tags.description),
    comment: asString(tags.comment),
    copyright: asString(tags.copyright),
    software: asString(tags.encoder ?? tags.software),
  };
}
export const meta = {
  id: 'mp4',
  engine: 'exiftool',
  label: 'MP4 / M4A',
  description: 'Video MP4, M4V, MOV, dan audio M4A',
  extensions: ['mp4', 'm4v', 'm4a', 'mov'],
  mime: 'application/octet-stream',
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
    native: 'ItemList:Title + XMP-dc:Title + UserData:Title',
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
  title: ['ItemList:Title', 'XMP-dc:Title', 'UserData:Title'],
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
function mimeForExtension(extension) {
  return String(extension || '').toLowerCase() === 'm4a' ? 'audio/mp4' : 'video/mp4';
}
export function mapTags(tags) {
  const out = {};
  for (const [id, keys] of Object.entries(READ_MAP)) {
    const value = pick(tags, keys);
    out[id] = id === 'date' ? toDateInput(value) : asString(value);
  }
  return out;
}
function mp4Kind(tags, options = {}) {
  if (options.subtype === 'm4a') return 'audio';
  const fileType = asString(tags?.['File:FileType']).toLowerCase();
  if (fileType === 'm4a' || fileType === 'm4b' || fileType === 'm4p') return 'audio';
  return 'video';
}
export function describeFile(tags, options = {}) {
  return {
    format: asString(tags['File:FileType']),
    duration: tags['QuickTime:Duration'] || tags['Composite:Duration'] || '',
    width: tags['QuickTime:ImageWidth'] || '',
    height: tags['QuickTime:ImageHeight'] || '',
    kind: mp4Kind(tags, options),
    hasCover: Boolean(tags['ItemList:CoverArt'] || tags['CoverArt']),
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
  let mediaTags = null;
  try {
    const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      mediaTags = await input.getMetadataTags();
      const seconds = await input.computeDuration();
      if (Number.isFinite(seconds) && seconds > 0) duration = seconds;
    } finally {
      input.dispose?.();
    }
  } catch {
  }
  const warnings = [];
  let sidecar = null;
  if (typeof mediaTags?.lyrics === 'string' && LRC_LIKE_RE.test(mediaTags.lyrics)) {
    const parsed = parseLrc(mediaTags.lyrics);
    if (parsed.lines.length) sidecar = { lyrics: { lang: 'id', lines: parsed.lines }, subtitles: null };
  }
  if (await hasBytes(file, WVTT_MARKER)) {
    warnings.push('Trek subtitle tersemat tidak bisa dibaca ulang sebagai teks oleh engine, tetapi tetap dipertahankan di container hasil salinan.');
  }
  const hasCoverArt = raw.some((row) => /CoverArt/i.test(row.tag)) || Boolean(tags['ItemList:CoverArt']);
  let cover = null;
  let coverBytes = null;
  if (hasCoverArt || mediaTags?.images?.length) {
    try {
      const coverTags = mediaTags || await (async () => {
        const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
        const probe = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
        try {
          return await probe.getMetadataTags();
        } finally {
          probe.dispose?.();
        }
      })();
      ({ cover, coverBytes } = coverFromTags(coverTags));
    } catch {
      cover = { mimeType: 'image/jpeg', kind: 'coverFront', name: 'cover', size: 0 };
      coverBytes = null;
    }
  }
  const info = describeFile(tags, options);
  if (duration !== '') info.duration = duration;
  return {
    fields: mapTags(tags),
    raw,
    info,
    mediaProof: await mediaProof(file, 'mp4'),
    packetProof: await mediaPacketProof(file),
    cover,
    coverBytes,
    sidecar,
    warnings,
  };
}
async function embedSidecar(baseFile, payload, report) {
  const {
    Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Conversion,
    Mp4OutputFormat, TextSubtitleSource,
  } = await import('../../vendor/mediabunny.mjs');
  const input = new Input({ source: new BlobSource(baseFile), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  let mediaTags = {};
  try {
    mediaTags = await input.getMetadataTags();
  } catch {
    mediaTags = {};
  }
  const lyricLines = payload?.sidecar?.lyrics?.lines;
  const timedLyrics = Array.isArray(lyricLines) ? lyricLines : [];
  const cues = Array.isArray(payload?.sidecar?.subtitles?.cues) ? payload.sidecar.subtitles.cues : [];
  let lyricsValue;
  if (payload?.set?.lyrics != null) lyricsValue = asString(payload.set.lyrics);
  else if (Array.isArray(lyricLines)) lyricsValue = serializeLrc(lyricLines);
  if (lyricsValue !== undefined) output.setMetadataTags({ ...mediaTags, lyrics: lyricsValue });
  else output.setMetadataTags(mediaTags);
  const tracks = [];
  if (timedLyrics.length) {
    tracks.push({ name: 'Lirik', vtt: serializeVtt(lyricCues(timedLyrics)), primary: !cues.length });
  }
  if (cues.length) {
    tracks.push({ name: 'Subtitle', vtt: serializeVtt(cues, payload?.sidecar?.subtitles?.style), primary: true });
  }
  for (const track of tracks) {
    const source = new TextSubtitleSource('webvtt');
    output.addSubtitleTrack(source, {
      languageCode: 'ind',
      name: track.name,
      disposition: { default: track.primary },
    });
    track.source = source;
  }
  let conversion;
  try {
    conversion = await Conversion.init({
      input, output,
      copy: { mode: 'forced' },
      composable: true,
      showWarnings: false,
    });
    if (conversion.isValid === false) throw new Error('Track A/V tidak bisa disalin tanpa transcode.');
  } catch (error) {
    input.dispose?.();
    throw new AppError('WRITE_FAILED', 'Gagal menyiapkan penulisan lirik/subtitle MP4.', error.message || String(error));
  }
  conversion.onProgress = (progress) => {
    report({ stage: `Menyalin container… ${Math.round(progress * 100)}%`, pct: 50 + progress * 25 });
  };
  try {
    await output.start();
    for (const track of tracks) {
      await track.source.add(track.vtt);
      await track.source.close();
    }
    await conversion.execute();
    await output.finalize();
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Gagal menyematkan lirik/subtitle MP4.', error.message || String(error));
  } finally {
    input.dispose?.();
  }
  return new Uint8Array(output.target.buffer);
}
async function cutMp4(file, trim, report) {
  const {
    Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Conversion, Mp4OutputFormat,
  } = await import('../../vendor/mediabunny.mjs');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      ...conversionCutOptions(trim, { mode: 'forced' }),
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const reasons = (conversion.discardedTracks || []).map((track) => track.reason).filter(Boolean).join(', ');
      throw new Error(reasons || 'Track A/V tidak bisa disalin tanpa transcode.');
    }
    conversion.onProgress = (progress) => {
      report({ stage: `Memotong media… ${Math.round(progress * 100)}%`, pct: 20 + progress * 25 });
    };
    await conversion.execute();
    if (output.state !== 'finalized') await output.finalize();
  } finally {
    input.dispose?.();
  }
  return new Uint8Array(output.target.buffer);
}
export async function write(file, payload, options = {}, report = () => {}) {
  const trim = payload?.trim || null;
  let sourceFile = file;
  if (trim) {
    report({ stage: 'Memotong media…', pct: 10 });
    const cutBytes = await cutMp4(file, trim, report);
    sourceFile = new File([cutBytes], 'cut.mp4', { type: file.type || 'video/mp4' });
  }
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
    if (!key || /^(?:[\w-]+:)?(?:lyrics|©lyr)$/i.test(key)) continue;
    tags[key] = asString(item?.value);
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
  const hasExifTags = Object.keys(tags).length > 0;
  const sidecar = payload?.sidecar;
  const needsSidecarPass = payload?.set?.lyrics != null || Boolean(sidecar?.lyrics || sidecar?.subtitles);
  if (!hasExifTags && !needsSidecarPass && !trim) {
    throw new AppError('NO_CHANGES', 'Tidak ada metadata yang perlu ditulis.');
  }
  let bytes;
  if (hasExifTags) {
    report({ stage: 'Menulis metadata ke media…', pct: 35 });
    const { writeTags } = await import('../engines/exiftool.js');
    try {
      bytes = await writeTags(safeName(sourceFile, options.extension), tags);
    } catch (error) {
      throw new AppError('WRITE_FAILED', 'Gagal menulis metadata MP4.', error.message || String(error));
    }
  } else {
    bytes = new Uint8Array(await sourceFile.arrayBuffer());
  }
  if (needsSidecarPass) {
    report({ stage: 'Menyematkan lirik/subtitle…', pct: 55 });
    const baseFile = new File([bytes], `input.${options.extension || 'mp4'}`, { type: sourceFile.type || mimeForExtension(options.extension) });
    bytes = await embedSidecar(baseFile, payload, report);
  }
  report({ stage: 'Memverifikasi hasil…', pct: 78 });
  const mime = options.mime || file.type || mimeForExtension(options.extension);
  const blob = new Blob([bytes], { type: mime });
  const output = new File([bytes], `output.${options.extension || 'mp4'}`, { type: mime });
  const rangeProof = trim ? await mediaRangeProof(output, 0, expectedCutDuration(trim)) : null;
  const warnings = [];
  if (trim) warnings.push('Container MP4 ditulis ulang untuk pemotongan; payload A/V diverifikasi terhadap hasil pemotongan.');
  const finalPacketProof = await mediaPacketProof(output);
  let fields;
  let infoAfter;
  let raw = [];
  let coverAfter = null;
  let coverBytesAfter = null;
  if (needsSidecarPass) {
    const originalProof = await mediaPacketProof(sourceFile);
    if (!sameMediaProof(originalProof, finalPacketProof)) {
      throw new AppError('WRITE_FAILED', 'Payload A/V berubah saat menyematkan lirik/subtitle MP4.');
    }
    const hasSubtitleTracks = (Array.isArray(sidecar?.lyrics?.lines) && sidecar.lyrics.lines.length > 0)
      || (Array.isArray(sidecar?.subtitles?.cues) && sidecar.subtitles.cues.length > 0);
    if (hasSubtitleTracks && !await hasBytes(output, WVTT_MARKER)) {
      throw new AppError('WRITE_FAILED', 'Trek subtitle tidak ditemukan pada container MP4 hasil.');
    }
    warnings.push('Container MP4 ditulis ulang untuk menyematkan lirik/subtitle; payload A/V diverifikasi identik.');
    let finalTags = {};
    try {
      const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
      const probe = new Input({ source: new BlobSource(output), formats: ALL_FORMATS });
      try {
        finalTags = await probe.getMetadataTags();
      } finally {
        probe.dispose?.();
      }
    } catch {
      finalTags = {};
    }
    fields = mediabunnyFields(finalTags);
    infoAfter = { kind: mp4Kind(finalTags, options) };
    ({ cover: coverAfter, coverBytes: coverBytesAfter } = coverFromTags(finalTags));
  } else {
    const { readTags } = await import('../engines/exiftool.js');
    const tagsAfter = await readTags(output);
    fields = mapTags(tagsAfter);
    infoAfter = describeFile(tagsAfter, options);
    raw = collectRaw(tagsAfter);
    if (infoAfter.hasCover) {
      try {
        const { Input, ALL_FORMATS, BlobSource } = await import('../../vendor/mediabunny.mjs');
        const probe = new Input({ source: new BlobSource(output), formats: ALL_FORMATS });
        try {
          ({ cover: coverAfter, coverBytes: coverBytesAfter } = coverFromTags(await probe.getMetadataTags()));
        } finally {
          probe.dispose?.();
        }
      } catch {
        coverAfter = { mimeType: 'image/jpeg', kind: 'coverFront', name: 'cover', size: 0 };
      }
    }
  }
  for (const [id, value] of Object.entries(payload?.set || {})) {
    if (id in fields && !sameValue(value, fields[id])) {
      warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
    }
  }
  return {
    blob,
    fields,
    raw,
    info: infoAfter,
    mediaProof: await mediaProof(output, 'mp4'),
    packetProof: finalPacketProof,
    cover: coverAfter,
    coverBytes: coverBytesAfter,
    warnings,
    ...(trim ? { rangeProof } : {}),
  };
}
async function dispose() {
  const { disposeExifToolRuntime } = await import('../engines/exiftool.js');
  await disposeExifToolRuntime();
}
export default { meta, sections, fields, read, write, dispose };