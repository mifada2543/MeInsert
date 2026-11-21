/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asString, rawValue, sameValue, toYear } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { coverFromTags } from '../core/image-utils.js';
import { KNOWN_ID3 } from '../core/integrity-rules.js';
import { toSyltPairs } from '../core/timed-text.js';
import { readSylt, toWriterSylt } from '../core/id3-sylt.js';
import { parseId3Tag, patchId3Tag, frameIdentity } from '../core/id3-passthrough.js';
import { expectedCutDuration, mediaRangeProof } from '../core/media-cut.js';
import { sliceMp3Range } from '../core/mp3-cut.js';
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
function frame(tags, id) {
  const raw = tags?.raw || {};
  return raw[id];
}
function tagsToFields(tags) {
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
function warningsFor(tags, { preserveUnknown = false } = {}) {
  const raw = tags?.raw || {};
  const unknown = Object.keys(raw).filter((id) => /^[A-Z0-9]{4}$/.test(id) && !KNOWN_ID3.has(id));
  if (!unknown.length || preserveUnknown) return [];
  return [`${unknown.length} frame ID3 tidak didukung dan akan hilang saat metadata ditulis: ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}.`];
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
      unknownFrames: Object.keys(tags.raw || {}).filter((id) => /^[A-Z0-9]{4}$/.test(id) && !KNOWN_ID3.has(id)),
    };
    const sylt = await readSylt(file);
    const sidecar = sylt
      ? {
        lyrics: {
          lang: (typeof sylt.language === 'string' && sylt.language.slice(0, 2)) || 'id',
          lines: sylt.pairs.map((pair) => ({ time: pair.time, text: pair.text })),
        },
        subtitles: null,
      }
      : null;
    return {
      fields: tagsToFields(tags),
      custom: customTags(tags),
      raw: rawRows(tags),
      info,
      ...coverFromTags(tags),
      sidecar,
      warnings: warningsFor(tags),
    };
  } catch (error) {
    throw new AppError('READ_FAILED', 'File MP3 tidak bisa dibaca.', error.message || String(error));
  }
}
export async function write(file, payload, _options = {}, report = () => {}) {
  const { Input, ALL_FORMATS, BlobSource } = await mediaLib();
  const { ID3Writer } = await import('../../vendor/browser-id3-writer.mjs');
  const trim = payload?.trim || null;
  const sliceWarnings = [];
  let baseFile = file;
  if (trim) {
    const slice = await sliceMp3Range(file, trim.start, trim.end);
    if (!slice) {
      throw new AppError('UNSUPPORTED_CODEC', 'Potongan MP3 tidak bisa dibuat.', 'Rentang tidak berada pada batas frame MP3 yang valid.');
    }
    baseFile = new File([slice.blob], 'cut.mp3', { type: file.type || 'audio/mpeg' });
    if (Array.isArray(slice.warnings)) sliceWarnings.push(...slice.warnings);
  }
  // A cut changes the duration, so cached TLEN/chapter frames must not survive.
  const effectivePayload = trim
    ? {
      ...payload,
      rawRemove: [...new Set([...(payload?.rawRemove || []), 'TLEN', 'CHAP', 'CTOC'])],
    }
    : payload;
  const set = effectivePayload?.set || {};
  const remove = new Set(effectivePayload?.remove || []);
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
  const FIELD_FRAME = {
    title: 'TIT2', artist: 'TPE1', album: 'TALB', albumArtist: 'TPE2',
    year: 'TYER', genre: 'TCON', track: 'TRCK', disc: 'TPOS',
    composer: 'TCOM', comment: 'COMM', lyrics: 'USLT', copyright: 'TCOP',
    software: 'TSSE',
  };
  const rawRemove = (effectivePayload?.rawRemove || []).map((item) => asString(item).trim()).filter(Boolean);
  const removeCover = rawRemove.includes('APIC');
  const rawCustomRemove = new Set(effectivePayload?.customRemove || []);
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
    const input = new Input({ source: new BlobSource(baseFile), formats: ALL_FORMATS });
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
  const existingSylt = await readSylt(baseFile);
  const buffer = await baseFile.arrayBuffer();
  const sourceTag = parseId3Tag(buffer);
  const id3Header = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 10));
  const complexId3 = id3Header.length === 10
    && id3Header[0] === 0x49 && id3Header[1] === 0x44 && id3Header[2] === 0x33
    && (id3Header[3] === 3 || id3Header[3] === 4)
    && Boolean(id3Header[5] & (id3Header[3] === 4 ? 0x50 : 0x40));
  if (complexId3 && !sourceTag) {
    throw new AppError('WRITE_FAILED',
      'Extended header atau footer ID3 tidak valid dan tidak aman ditulis ulang.',
      'File asli tidak diubah.');
  }
  if (sourceTag?.unsupportedExtendedHeader) {
    throw new AppError('WRITE_FAILED',
      'Tag ID3 memiliki CRC atau batasan extended header yang belum aman untuk diubah.',
      `${sourceTag.unsupportedExtendedHeader}; file asli tidak diubah.`);
  }
  const canPatch = Boolean(sourceTag);
  const writer = new ID3Writer(buffer);
  writer.padding = 0;
  const firstComm = parseId3Tag(buffer)?.frames.find((frame) => frame.id === 'COMM');
  const commParts = firstComm ? String(frameIdentity('COMM', firstComm.bytes) || '').split('|') : [];
  const primaryComm = {
    language: commParts[0] || 'eng',
    description: commParts.slice(1).join('|'),
  };
  const specs = [];
  const spec = (id, match = 'all', identity = undefined, removeFrame = false) => {
    specs.push({ id, match, identity, removeFrame });
  };
  const writeField = (field, value) => {
    const text = asString(value).trim();
    switch (field) {
      case 'title': writer.setFrame('TIT2', text); break;
      case 'artist': writer.setFrame('TPE1', [text]); break;
      case 'album': writer.setFrame('TALB', text); break;
      case 'albumArtist': writer.setFrame('TPE2', text); break;
      case 'year': {
        const year = Number(text);
        if (Number.isInteger(year) && year >= 1000) writer.setFrame('TYER', year);
        break;
      }
      case 'genre': writer.setFrame('TCON', [text]); break;
      case 'track': writer.setFrame('TRCK', text); break;
      case 'disc': writer.setFrame('TPOS', text); break;
      case 'composer': writer.setFrame('TCOM', [text]); break;
      case 'comment': writer.setFrame('COMM', {
        language: primaryComm.language,
        description: primaryComm.description,
        text,
      }); break;
      case 'lyrics': writer.setFrame('USLT', { description: '', lyrics: text }); break;
      case 'copyright': writer.setFrame('TCOP', text); break;
      case 'software': writer.setFrame('TSSE', text); break;
      default: break;
    }
  };
  const frameMatch = (id) => (id === 'COMM' ? 'first' : 'all');

  if (canPatch) {
    const changedFields = new Set([...Object.keys(set), ...remove]);
    for (const field of changedFields) {
      const frameId = FIELD_FRAME[field];
      if (!frameId) continue;
      const removing = remove.has(field) || !asString(set[field]).trim();
      if (removing) spec(frameId, frameMatch(frameId), undefined, true);
      else writeField(field, set[field]);
      if (!removing) spec(frameId, frameMatch(frameId));
    }
    const existingCustom = customTags(tags);
    for (const key of rawCustomRemove) spec('TXXX', 'identity', key, true);
    for (const item of effectivePayload?.custom || []) {
      const key = asString(item?.key).trim();
      if (!key) continue;
      const value = asString(item?.value);
      if (existingCustom.some((entry) => entry.key === key && entry.value === value)) continue;
      writer.setFrame('TXXX', { description: key, value });
      spec('TXXX', 'identity', key);
    }
    for (const id of rawRemove) {
      if (id === 'APIC' && removeCover) continue;
      if (!FRAME_FIELDS[id] && /^[A-Z0-9]{4}$/.test(id)) spec(id, 'all', undefined, true);
    }
    const syltLines = effectivePayload?.sidecar?.lyrics?.lines;
    if (Array.isArray(syltLines) && syltLines.length) {
      writer.setFrame('SYLT', {
        type: 2,
        timestampFormat: 2,
        language: 'ind',
        description: '',
        text: toSyltPairs(syltLines),
      });
      spec('SYLT');
    }
    const coverAction = removeCover ? 'remove' : (effectivePayload?.cover?.action || 'keep');
    if (coverAction === 'set' && effectivePayload?.cover?.data) {
      const data = effectivePayload.cover.data instanceof Uint8Array ? effectivePayload.cover.data : new Uint8Array(effectivePayload.cover.data);
      writer.setFrame('APIC', {
        description: effectivePayload.cover.name || 'cover',
        data,
        type: effectivePayload.cover.kind === 'coverBack' ? 4 : 3,
      });
      spec('APIC', 'first');
    } else if (coverAction === 'remove') {
      spec('APIC', 'first', undefined, true);
    }
  } else {
    for (const [field, value] of Object.entries(values)) {
      const text = asString(value).trim();
      if (text) writeField(field, text);
    }
    if (existingSylt) {
      const sylt = toWriterSylt(existingSylt);
      if (sylt) writer.setFrame('SYLT', sylt);
    }
    const coverAction = removeCover ? 'remove' : (effectivePayload?.cover?.action || 'keep');
    if (coverAction === 'set' && effectivePayload?.cover?.data) {
      const data = effectivePayload.cover.data instanceof Uint8Array ? effectivePayload.cover.data : new Uint8Array(effectivePayload.cover.data);
      writer.setFrame('APIC', {
        description: effectivePayload.cover.name || 'cover',
        data,
        type: effectivePayload.cover.kind === 'coverBack' ? 4 : 3,
      });
    } else if (coverAction === 'keep') {
      const image = tags.images?.[0];
      if (image?.data) {
        const data = image.data;
        const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        writer.setFrame('APIC', {
          description: image.description || image.name || 'cover',
          data: copy,
          type: image.kind === 'coverBack' ? 4 : 3,
        });
      }
    }
    const existingCustom = customTags(tags);
    const customMap = new Map(existingCustom.map((item) => [item.key, item.value]));
    for (const key of rawCustomRemove) customMap.delete(key);
    for (const item of effectivePayload?.custom || []) {
      const key = asString(item?.key).trim();
      if (key) customMap.set(key, asString(item?.value));
    }
    for (const [description, value] of customMap) {
      if (description && value) writer.setFrame('TXXX', { description, value });
    }
  }
  let generated;
  try {
    generated = writer.addTag();
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Tag ID3 gagal ditulis.', error.message || String(error));
  }
  const generatedFrames = parseId3Tag(generated)?.frames || [];
  const edits = canPatch
    ? specs.map((item) => ({
      id: item.id,
      match: item.match,
      identity: item.identity,
      frames: item.removeFrame ? [] : generatedFrames
        .filter((frame) => frame.id === item.id
          && (!item.identity || frameIdentity(item.id, frame.bytes) === item.identity))
        .map((frame) => frame.bytes),
    }))
    : generatedFrames.map((frame) => ({ id: frame.id, match: 'all', frames: [frame.bytes] }));
  const patched = patchId3Tag(buffer, generated, edits);
  const out = patched || generated;
  const passThroughWarning = patched ? '' : 'Tag ID3 ditulis ulang penuh; frame yang tidak dikenal mungkin hilang.';
  const blob = new Blob([out], { type: 'audio/mpeg' });
  const outputFile = new File([out], 'output.mp3', { type: 'audio/mpeg' });
  // The trimmed file was rebuilt with timestamps starting at zero.
  const rangeProof = trim ? await mediaRangeProof(outputFile, 0, expectedCutDuration(trim)) : null;
  report({ stage: 'Memverifikasi tag baru…', pct: 82 });
  let after;
  try {
    const output = new Input({ source: new BlobSource(outputFile), formats: ALL_FORMATS });
    const afterTags = await output.getMetadataTags();
    after = tagsToFields(afterTags);
    const warnings = [];
    for (const [id, value] of Object.entries(set)) {
      if (id in after && !sameValue(value, after[id])) {
        warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
      }
    }
    warnings.push(...warningsFor(tags, { preserveUnknown: Boolean(patched) }));
    if (passThroughWarning) warnings.push(passThroughWarning);
    let info;
    try {
      info = (await read(outputFile)).info;
    } catch (infoError) {
      info = { kind: 'audio', hasCover: Boolean(afterTags.images?.length) };
      warnings.push(`Info media tidak bisa dibaca ulang setelah penulisan: ${infoError.message || infoError}`);
    }
    return {
      blob,
      fields: after,
      custom: customTags(afterTags),
      raw: rawRows(afterTags),
      info,
      ...coverFromTags(afterTags),
      warnings: [...new Set([...warnings, ...sliceWarnings])],
      ...(trim ? { rangeProof } : {}),
    };
  } catch (error) {
    return {
      blob,
      fields: after,
      custom: [],
      raw: [],
      info: {},
      warnings: [`Tag sudah ditulis, tetapi verifikasi gagal: ${error.message || error}`, ...sliceWarnings],
      ...(trim ? { rangeProof } : {}),
    };
  }
}
export default { meta, sections, fields, read, write };