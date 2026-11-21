/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Byte-level ID3v2 patching: keep untouched frames verbatim so an edit to one
// field cannot silently drop the rest of the tag. Pure JS, no dependencies.

const encoder = new TextEncoder();
function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
function syncSafeToInt(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f);
}
function intToSyncSafe(value, bytes, offset) {
  bytes[offset] = (value >> 21) & 0x7f;
  bytes[offset + 1] = (value >> 14) & 0x7f;
  bytes[offset + 2] = (value >> 7) & 0x7f;
  bytes[offset + 3] = value & 0x7f;
}
function deunsynchronise(bytes) {
  const out = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0x00) {
      out.push(0xff);
      index += 1;
    } else out.push(bytes[index]);
  }
  return Uint8Array.from(out);
}
function unsynchronise(bytes) {
  const out = [];
  for (const value of bytes) {
    out.push(value);
    if (value === 0xff) out.push(0x00);
  }
  return Uint8Array.from(out);
}

/** Parse an ID3v2.3/2.4 tag. Returns null for missing, v2.2 or malformed tags. */
export function parseId3Tag(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const version = bytes[3];
  const revision = bytes[4];
  // ID3 header stores the version major directly: 3 = v2.3, 4 = v2.4.
  if (version !== 3 && version !== 4) return null;
  const flags = bytes[5];
  const tagSize = syncSafeToInt(bytes, 6);
  const tagEnd = 10 + tagSize;
  if (tagSize < 0 || tagEnd > bytes.length) return null;

  const rawBody = bytes.slice(10, tagEnd);
  const unsynchronisation = Boolean(flags & 0x80);
  const body = unsynchronisation ? deunsynchronise(rawBody) : rawBody;
  let offset = 0;
  if (flags & 0x40) {
    if (version === 3) {
      if (body.length < 4) return null;
      offset = 4 + ((body[0] << 24) | (body[1] << 16) | (body[2] << 8) | body[3]);
    } else {
      offset = syncSafeToInt(body, 0);
    }
    if (offset < 0 || offset > body.length) return null;
  }

  const frames = [];
  while (offset + 10 <= body.length) {
    const id = String.fromCharCode(...body.slice(offset, offset + 4));
    if (id === '\u0000\u0000\u0000\u0000') break;
    const size = version === 4 ? syncSafeToInt(body, offset + 4)
      : ((body[offset + 4] << 24) | (body[offset + 5] << 16) | (body[offset + 6] << 8) | body[offset + 7]);
    const end = offset + 10 + size;
    if (!/^[A-Z0-9]{4}$/.test(id) || size < 0 || end > body.length) return null;
    frames.push({ id, bytes: body.slice(offset, end) });
    offset = end;
  }
  return {
    version: [version, revision],
    flags,
    tagEnd,
    frames,
    paddingStart: offset,
    paddingLength: Math.max(0, body.length - offset),
    unsynchronisation,
  };
}

function rewriteFrameSize(frame, fromVersion, toVersion) {
  if (fromVersion === toVersion) return frame;
  const out = frame.slice();
  const size = fromVersion === 4 ? syncSafeToInt(out, 4)
    : ((out[4] << 24) | (out[5] << 16) | (out[6] << 8) | out[7]);
  if (toVersion === 4) intToSyncSafe(size, out, 4);
  else {
    out[4] = (size >>> 24) & 0xff;
    out[5] = (size >>> 16) & 0xff;
    out[6] = (size >>> 8) & 0xff;
    out[7] = size & 0xff;
  }
  out[8] = 0;
  out[9] = 0;
  return out;
}

/**
 * Replace only the listed frame IDs from `generated` inside the source tag.
 * Every other frame is copied byte-for-byte, including unknown/binary frames.
 * Returns null when the source cannot be patched safely (caller falls back).
 */
export function patchId3Tag(source, generated, editedIds) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source || []);
  const src = parseId3Tag(bytes);
  const gen = parseId3Tag(generated);
  if (!src || !gen) return null;
  const edited = new Set(editedIds || []);
  const generatedBy = new Map();
  for (const frame of gen.frames) {
    if (!generatedBy.has(frame.id)) generatedBy.set(frame.id, []);
    generatedBy.get(frame.id).push(rewriteFrameSize(frame.bytes, gen.version[0], src.version[0]));
  }

  const inserted = new Set();
  const merged = [];
  for (const frame of src.frames) {
    if (edited.has(frame.id)) {
      if (!inserted.has(frame.id)) {
        for (const bytes of generatedBy.get(frame.id) || []) merged.push(bytes);
        inserted.add(frame.id);
      }
      continue;
    }
    merged.push(frame.bytes);
  }
  for (const [id, list] of generatedBy) {
    if (!edited.has(id) || inserted.has(id)) continue;
    for (const bytes of list) merged.push(bytes);
  }

  let body = concat([...merged, new Uint8Array(Math.max(src.paddingLength, 1024))]);
  if (src.unsynchronisation) body = unsynchronise(body);
  const header = Uint8Array.from(encoder.encode('ID3'));
  const fullHeader = new Uint8Array(10);
  fullHeader.set(header, 0);
  fullHeader[3] = src.version[0];
  fullHeader[4] = src.version[1];
  // Drop extended-header/footer/experimental bits; keep unsynchronisation.
  fullHeader[5] = src.unsynchronisation ? 0x80 : 0;
  intToSyncSafe(body.length, fullHeader, 6);
  return concat([fullHeader, body, bytes.slice(src.tagEnd)]);
}

export default { parseId3Tag, patchId3Tag };
