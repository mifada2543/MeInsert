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

const TEXT_ENCODINGS = { 0: 'iso-8859-1', 1: 'utf-16le', 2: 'utf-16be', 3: 'utf-8' };
function terminated(body, offset, encoding) {
  const decoder = new TextDecoder(TEXT_ENCODINGS[encoding] || TEXT_ENCODINGS[0]);
  if (encoding === 1 || encoding === 2) {
    let end = offset;
    while (end + 1 < body.length && !(body[end] === 0 && body[end + 1] === 0)) end += 2;
    return { value: decoder.decode(body.slice(offset, end)), end: end + 2 };
  }
  let end = offset;
  while (end < body.length && body[end] !== 0) end += 1;
  return { value: decoder.decode(body.slice(offset, end)), end: end + 1 };
}

/**
 * Distinguishing key for multi-instance frame IDs. Returns null for IDs that
 * are singleton by definition, so callers can preserve every other instance.
 */
export function frameIdentity(id, frameBytes) {
  const body = frameBytes.slice(10);
  if (!body.length) return null;
  const encoding = body[0] || 0;
  if (id === 'COMM' || id === 'USLT') {
    if (body.length < 4) return null;
    const language = String.fromCharCode(...body.slice(1, 4));
    const description = terminated(body, 4, encoding);
    return `${language}|${description.value}`;
  }
  if (id === 'TXXX') {
    const description = terminated(body, 1, encoding);
    return description.value;
  }
  if (id === 'APIC') {
    const mime = terminated(body, 1, 0);
    const type = body[mime.end];
    const description = terminated(body, mime.end + 1, encoding);
    return `${mime.value}|${type}|${description.value}`;
  }
  return null;
}

function isTarget(spec, frame, seen) {
  if (spec.match === 'all') return true;
  if (spec.match === 'first') {
    if (seen.has(spec.id)) return false;
    seen.add(spec.id);
    return true;
  }
  if (spec.match === 'identity') return frameIdentity(spec.id, frame.bytes) === spec.identity;
  if (typeof spec.match === 'function') return Boolean(spec.match(frame.bytes));
  return false;
}

/**
 * Patch the source tag with operation-aware frame edits.
 *
 * `edits` is either an array of frame IDs (legacy behaviour: replace every
 * instance of those IDs) or an array of specs:
 *   { id, match: 'all' | 'first' | 'identity' | fn, identity?, frames? }
 * A spec with `frames: []` removes the targeted instance(s). Frames that are
 * not targeted are copied byte-for-byte, including unknown/binary frames.
 */
export function patchId3Tag(source, generated, edits) {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source || []);
  const src = parseId3Tag(bytes);
  const gen = parseId3Tag(generated);
  if (!src || !gen) return null;

  const generatedBy = new Map();
  for (const frame of gen.frames) {
    if (!generatedBy.has(frame.id)) generatedBy.set(frame.id, []);
    generatedBy.get(frame.id).push(rewriteFrameSize(frame.bytes, gen.version[0], src.version[0]));
  }
  const specs = (Array.isArray(edits) ? edits : []).map((item) => {
    if (typeof item === 'string') {
      return { id: item, match: 'all', frames: generatedBy.get(item) || [] };
    }
    return {
      id: item.id,
      match: item.match || 'all',
      identity: item.identity,
      frames: item.frames || generatedBy.get(item.id) || [],
    };
  }).filter((spec) => /^[A-Z0-9]{4}$/.test(spec.id || ''));
  const byId = new Map();
  for (const spec of specs) {
    if (!byId.has(spec.id)) byId.set(spec.id, []);
    byId.get(spec.id).push(spec);
  }

  const consumed = new Set();
  const seenFirst = new Set();
  const merged = [];
  for (const frame of src.frames) {
    const candidates = byId.get(frame.id) || [];
    let target = null;
    for (const spec of candidates) {
      if (consumed.has(spec)) continue;
      if (isTarget(spec, frame, seenFirst)) { target = spec; break; }
    }
    if (target) {
      for (const replacement of target.frames) merged.push(replacement);
      consumed.add(target);
      continue;
    }
    // A frame may still be a "first" candidate for an unconsumed spec whose
    // identity did not match; do not consume it, but do not duplicate it.
    merged.push(frame.bytes);
  }
  for (const spec of specs) {
    if (consumed.has(spec)) continue;
    for (const replacement of spec.frames) merged.push(replacement);
  }

  let body = concat([...merged, new Uint8Array(Math.max(src.paddingLength, 1024))]);
  if (src.unsynchronisation) body = unsynchronise(body);
  const fullHeader = new Uint8Array(10);
  fullHeader.set(Uint8Array.from(encoder.encode('ID3')), 0);
  fullHeader[3] = src.version[0];
  fullHeader[4] = src.version[1];
  // Drop extended-header/footer/experimental bits; keep unsynchronisation.
  fullHeader[5] = src.unsynchronisation ? 0x80 : 0;
  intToSyncSafe(body.length, fullHeader, 6);
  return concat([fullHeader, body, bytes.slice(src.tagEnd)]);
}

export default { parseId3Tag, patchId3Tag, frameIdentity };
