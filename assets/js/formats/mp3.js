/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString, pick, rawValue, sameValue, toYear } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { coverFromTags } from '../core/image-utils.js';
export const meta = {
  id: 'mp3',
  engine: 'media',
  label: 'MP3',
  description: 'Audio MPEG dengan tag ID3v2',
  extensions: ['mp3'],
  mime: 'audio/mpeg',
  cover: true,
};
export const sections = [
  {
    id: 'umum',
    title: 'Metadata ID3',
    description: 'Ditulis sebagai ID3v2.3. Audio MP3 tidak diubah.',
  },
];
export const fields = [
  { id: 'title', section: 'umum', label: 'Judul', type: 'text', native: 'TIT2', placeholder: 'Judul lagu', maxLength: 256 },
  { id: 'artist', section: 'umum', label: 'Artis', type: 'text', native: 'TPE1', placeholder: 'Nama artis', maxLength: 200 },
  { id: 'album', section: 'umum', label: 'Album', type: 'text', native: 'TALB', placeholder: 'Nama album', maxLength: 200 },
  { id: 'albumArtist', section: 'umum', label: 'Album artist', type: 'text', native: 'TPE2', placeholder: 'Artis album', maxLength: 200 },
  { id: 'year', section: 'umum', label: 'Tahun', type: 'number', native: 'TYER', placeholder: '2026', min: 1000, max: 3000 },
  { id: 'genre', section: 'umum', label: 'Genre', type: 'text', native: 'TCON', placeholder: 'Pop, Jazz, Soundtrack…', maxLength: 100 },
  { id: 'track', section: 'umum', label: 'Track', type: 'text', native: 'TRCK', placeholder: '1/10', maxLength: 20 },
  { id: 'disc', section: 'umum', label: 'Disc', type: 'text', native: 'TPOS', placeholder: '1/2', maxLength: 20 },
  { id: 'composer', section: 'umum', label: 'Komposer', type: 'text', native: 'TCOM', placeholder: 'Nama komposer', maxLength: 200 },
  { id: 'comment', section: 'umum', label: 'Komentar', type: 'textarea', native: 'COMM', placeholder: 'Catatan tentang lagu…', maxLength: 2000 },
  { id: 'lyrics', section: 'umum', label: 'Lirik', type: 'textarea', native: 'USLT', placeholder: 'Lirik lagu…', maxLength: 10000 },
  { id: 'copyright', section: 'umum', label: 'Hak cipta', type: 'text', native: 'TCOP', placeholder: '© 2026 Nama Anda', maxLength: 300 },
  { id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: 'TSSE', placeholder: 'MeInsert', maxLength: 200 },
];
const KNOWN_FRAMES = new Set([
  'TIT2', 'TPE1', 'TALB', 'TPE2', 'TYER', 'TCON', 'TRCK', 'TPOS', 'TCOM',
  'COMM', 'USLT', 'TCOP', 'TSSE', 'TENC', 'TXXX', 'APIC', 'TDRC', 'TDAT',
  'TIME', 'TRDA', 'TEXT', 'TIT1', 'TIT3', 'TPUB', 'TBPM', 'TKEY', 'TLAN',
  'TCMP', 'TSRC', 'TLEN', 'WXXX', 'WCOM', 'WCOP', 'WOAF', 'WOAR', 'WOAS',
  'WORS', 'WPAY', 'WPUB', 'PRIV', 'CHAP', 'CTOC', 'SYLT', 'IPLS',
]);
function frame(tags, id) {
  const raw = tags?.raw || {};
  return raw[id];
}
function tagsToFields(tags) {
  const raw = tags?.raw || {};
  return {
    title: asString(tags.title ?? frame(tags, 'TIT2')),
    artist: asString(tags.artist ?? frame(tags, 'TPE1')),
    album: asString(tags.album ?? frame(tags, 'TALB')),
    albumArtist: asString(tags.albumArtist ?? frame(tags, 'TPE2')),
    year: tags.date ? String(tags.date.getUTCFullYear?.() ?? toYear(tags.date) ?? '') : asString(frame(tags, 'TYER')),
    genre: asString(tags.genre ?? frame(tags, 'TCON')),
    track: asString(frame(tags, 'TRCK')),
    disc: asString(frame(tags, 'TPOS')),
    composer: asString(frame(tags, 'TCOM')),
    comment: asString(tags.comment ?? (typeof frame(tags, 'COMM') === 'object' ? frame(tags, 'COMM')?.text : frame(tags, 'COMM'))),
    lyrics: asString(tags.lyrics ?? (typeof frame(tags, 'USLT') === 'object' ? frame(tags, 'USLT')?.lyrics : frame(tags, 'USLT'))),
    copyright: asString(frame(tags, 'TCOP')),
    software: asString(frame(tags, 'TSSE') ?? frame(tags, 'TENC')),
  };
}
function customTags(tags) {
  const txxx = tags?.raw?.TXXX;
  if (!txxx || typeof txxx !== 'object') return [];
  return Object.entries(txxx).map(([key, value]) => ({ key, value: asString(value), originalKey: key }));
}
function rawRows(tags) {
  return Object.entries(tags?.raw || {})
    .flatMap(([tag, value]) => {
      if (value == null || value instanceof Uint8Array) return [];
      if (tag === 'TXXX' && value && typeof value === 'object') {
        return Object.entries(value).map(([description, itemValue]) => ({
          group: 'ID3',
          tag: `TXXX:${description}`,
          value: rawValue(itemValue),
        }));
      }
      return [{ group: 'ID3', tag, value: rawValue(value) }];
    })
    .filter((row) => row.value);
}
function warningsFor(tags) {
  const raw = tags?.raw || {};
  const unknown = Object.keys(raw).filter((id) => /^[A-Z0-9]{4}$/.test(id) && !KNOWN_FRAMES.has(id));
  return unknown.length
    ? [`${unknown.length} frame ID3 tidak didukung dan akan hilang saat metadata ditulis: ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}.`]
    : [];
}
async function mediaLib() {
  return import('../../vendor/mediabunny.mjs');
}
export async function read(file) {
  const { Input, ALL_FORMATS, BlobSource } = await mediaLib();
  let input;
  try {
    input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const tags = await input.getMetadataTags();
    let duration = '';
    try {
      duration = await input.computeDuration();
    } catch {
      duration = '';
    }
    const audio = await input.getPrimaryAudioTrack().catch(() => null);
    const info = {
      kind: 'audio',
      duration,
      sampleRate: audio ? await audio.getSampleRate().catch(() => '') : '',
      channels: audio ? await audio.getNumberOfChannels().catch(() => '') : '',
      codec: audio ? await audio.getCodec().catch(() => '') : '',
      hasCover: Boolean(tags.images?.length),
      unknownFrames: Object.keys(tags.raw || {}).filter((id) => /^[A-Z0-9]{4}$/.test(id) && !KNOWN_FRAMES.has(id)),
    };
    return {
      fields: tagsToFields(tags),
      custom: customTags(tags),
      raw: rawRows(tags),
      info,
      ...coverFromTags(tags),
      warnings: warningsFor(tags),
    };
  } catch (error) {
    throw new AppError('READ_FAILED', 'File MP3 tidak bisa dibaca.', error.message || String(error));
  }
}
export async function write(file, payload, options = {}, report = () => {}) {
  const { Input, ALL_FORMATS, BlobSource } = await mediaLib();
  const { ID3Writer } = await import('../../vendor/browser-id3-writer.mjs');
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  const FRAME_FIELDS = {
    TIT2: 'title',
    TPE1: 'artist',
    TALB: 'album',
    TPE2: 'albumArtist',
    TYER: 'year',
    TDRC: 'year',
    TCON: 'genre',
    TRCK: 'track',
    TPOS: 'disc',
    TCOM: 'composer',
    COMM: 'comment',
    USLT: 'lyrics',
    TCOP: 'copyright',
    TSSE: 'software',
  };
  const rawRemove = (payload?.rawRemove || []).map((item) => asString(item).trim()).filter(Boolean);
  const removeCover = rawRemove.includes('APIC');
  const rawCustomRemove = new Set(payload?.customRemove || []);
  for (const item of rawRemove) {
    if (item.startsWith('TXXX:')) {
      const key = item.slice(5).trim();
      if (key) rawCustomRemove.add(key);
      continue;
    }
    const field = FRAME_FIELDS[item];
    if (field) remove.add(field);
  }
  report({ stage: 'Membaca tag ID3 lama…', pct: 15 });
  let tags;
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    tags = await input.getMetadataTags();
  } catch (error) {
    throw new AppError('READ_FAILED', 'Tag MP3 lama tidak bisa dibaca.', error.message || String(error));
  }
  const values = tagsToFields(tags);
  for (const [id, value] of Object.entries(set)) {
    if (id in values) values[id] = asString(value);
  }
  for (const id of remove) {
    if (id in values) values[id] = '';
  }
  report({ stage: 'Menulis ulang tag ID3…', pct: 45 });
  const buffer = await file.arrayBuffer();
  const writer = new ID3Writer(buffer);
  writer.padding = 0;
  const str = (id, frameId) => {
    const value = asString(values[id]).trim();
    if (value) writer.setFrame(frameId, value);
  };
  const list = (id, frameId) => {
    const value = asString(values[id]).trim();
    if (value) writer.setFrame(frameId, [value]);
  };
  str('title', 'TIT2');
  list('artist', 'TPE1');
  str('album', 'TALB');
  str('albumArtist', 'TPE2');
  const year = Number(values.year);
  if (Number.isInteger(year) && year >= 1000) writer.setFrame('TYER', year);
  list('genre', 'TCON');
  str('track', 'TRCK');
  str('disc', 'TPOS');
  list('composer', 'TCOM');
  if (asString(values.comment).trim()) {
    writer.setFrame('COMM', { description: '', text: asString(values.comment) });
  }
  if (asString(values.lyrics).trim()) {
    writer.setFrame('USLT', { description: '', lyrics: asString(values.lyrics) });
  }
  str('copyright', 'TCOP');
  str('software', 'TSSE');
  const coverAction = removeCover ? 'remove' : (payload?.cover?.action || 'keep');
  const writeCover = (imgData, name, kind) => {
    writer.setFrame('APIC', {
      description: name || 'cover',
      data: imgData,
      type: kind === 'coverBack' ? 4 : 3,
    });
  };
  if (coverAction === 'set' && payload?.cover?.data) {
    const data = payload.cover.data instanceof Uint8Array ? payload.cover.data : new Uint8Array(payload.cover.data);
    writeCover(data, payload.cover.name, payload.cover.kind);
  } else if (coverAction === 'keep') {
    const image = tags.images?.[0];
    if (image?.data) {
      const data = image.data;
      const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      writeCover(copy, image.description || image.name, image.kind);
    }
  }
  const custom = [...(payload?.custom || [])];
  const removedCustom = rawCustomRemove;
  const existingCustom = customTags(tags);
  const customMap = new Map(existingCustom.map((item) => [item.key, item.value]));
  for (const key of removedCustom) customMap.delete(key);
  for (const item of custom) {
    const key = asString(item?.key).trim();
    if (key) customMap.set(key, asString(item?.value));
  }
  for (const [description, value] of customMap) {
    if (description && value) writer.setFrame('TXXX', { description, value });
  }
  let out;
  try {
    out = writer.addTag();
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Tag ID3 gagal ditulis.', error.message || String(error));
  }
  const blob = new Blob([out], { type: 'audio/mpeg' });
  report({ stage: 'Memverifikasi tag baru…', pct: 82 });
  let after;
  try {
    const output = new Input({ source: new BlobSource(new File([out], 'output.mp3', { type: 'audio/mpeg' })), formats: ALL_FORMATS });
    const afterTags = await output.getMetadataTags();
    after = tagsToFields(afterTags);
    const warnings = [];
    for (const [id, value] of Object.entries(set)) {
      if (id in after && !sameValue(value, after[id])) {
        warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
      }
    }
    warnings.push(...warningsFor(tags));
    return {
      blob,
      fields: after,
      custom: customTags(afterTags),
      raw: rawRows(afterTags),
      info: { kind: 'audio', hasCover: Boolean(afterTags.images?.length) },
      ...coverFromTags(afterTags),
      warnings: [...new Set(warnings)],
    };
  } catch (error) {
    return {
      blob,
      fields: after,
      custom: [],
      raw: [],
      info: {},
      warnings: [`Tag sudah ditulis, tetapi verifikasi gagal: ${error.message || error}`],
    };
  }
}
export default { meta, sections, fields, read, write };
