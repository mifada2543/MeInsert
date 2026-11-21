/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Targeted Ogg comment-header rewrite. No remux, no re-encode, no dependencies.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });
const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index << 24;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 0x80000000) ? ((value << 1) ^ 0x04c11db7) : (value << 1);
  }
  CRC_TABLE[index] = value >>> 0;
}
function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function ascii(bytes, start, length) {
  let text = '';
  for (let index = start; index < start + length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}
export function oggCrc32(bytes, start, end, crcOffset) {
  let crc = 0;
  for (let index = start; index < end; index += 1) {
    const byte = index >= crcOffset && index < crcOffset + 4 ? 0 : bytes[index];
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}
function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function parsePages(bytes) {
  const data = view(bytes);
  const pages = [];
  let offset = 0;
  while (offset + 27 <= bytes.length) {
    if (ascii(bytes, offset, 4) !== 'OggS') return null;
    if (bytes[offset + 4] !== 0) return null; // stream structure version must be 0
    const headerType = bytes[offset + 5];
    const granule = data.getBigUint64(offset + 6, true);
    const serial = data.getUint32(offset + 14, true);
    const sequence = data.getUint32(offset + 18, true);
    const storedCrc = data.getUint32(offset + 22, true);
    const segments = bytes[offset + 26];
    if (offset + 27 + segments > bytes.length) return null;
    let bodyLength = 0;
    for (let index = 0; index < segments; index += 1) bodyLength += bytes[offset + 27 + index];
    const bodyStart = offset + 27 + segments;
    const end = bodyStart + bodyLength;
    if (end > bytes.length) return null;
    const actualCrc = oggCrc32(bytes, offset, end, offset + 22);
    if (storedCrc !== actualCrc) return null;
    pages.push({
      start: offset, end, bodyStart,
      lacing: Array.from(bytes.subarray(offset + 27, offset + 27 + segments)),
      headerType, granule, serial, sequence,
    });
    offset = end;
  }
  return offset === bytes.length ? pages : null;
}
function parsePackets(bytes, pages) {
  const packets = [];
  let parts = null;
  let locations = null;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    let position = page.bodyStart;
    for (const size of page.lacing) {
      if (!parts) {
        parts = [];
        locations = [];
      }
      parts.push(bytes.subarray(position, position + size));
      locations.push({ pageIndex, start: position, end: position + size });
      position += size;
      if (size < 255) {
        packets.push({ bytes: concat(parts), locations });
        parts = null;
        locations = null;
      }
    }
  }
  return parts ? null : packets;
}
function signatureOf(packet) {
  const bytes = packet.bytes;
  if (bytes.length >= 7 && bytes[0] === 1 && ascii(bytes, 1, 6) === 'vorbis') {
    return { kind: 'vorbis', comment: '\x03vorbis', commentLength: 7 };
  }
  if (bytes.length >= 8 && ascii(bytes, 0, 8) === 'OpusHead') {
    return { kind: 'opus', comment: 'OpusTags', commentLength: 8 };
  }
  return null;
}
function isComment(packet, format) {
  const bytes = packet.bytes;
  return bytes.length >= format.commentLength && ascii(bytes, 0, format.commentLength) === format.comment;
}
function parseCommentPacket(packet, format) {
  const bytes = packet.bytes;
  const data = view(bytes);
  let offset = format.commentLength;
  if (offset + 4 > bytes.length) return null;
  const vendorLength = data.getUint32(offset, true);
  offset += 4;
  if (vendorLength > bytes.length - offset) return null;
  const vendorBytes = bytes.subarray(offset, offset + vendorLength);
  offset += vendorLength;
  if (offset + 4 > bytes.length) return null;
  const count = data.getUint32(offset, true);
  offset += 4;
  const comments = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 4 > bytes.length) return null;
    const lengthOffset = offset;
    const length = data.getUint32(offset, true);
    offset += 4;
    if (length > bytes.length - offset) return null;
    const raw = bytes.subarray(offset, offset + length);
    offset += length;
    const separator = raw.indexOf(61); // '='
    const key = separator < 0 ? decoder.decode(raw) : decoder.decode(raw.subarray(0, separator));
    const value = separator < 0 ? '' : decoder.decode(raw.subarray(separator + 1));
    comments.push({ key, value, encoded: bytes.subarray(lengthOffset, offset) });
  }
  return { vendorBytes, comments };
}
function commentBytes(key, value) {
  const encoded = encoder.encode(`${key}=${value}`);
  const prefix = new Uint8Array(4);
  view(prefix).setUint32(0, encoded.length, true);
  return concat([prefix, encoded]);
}
function uint32(value) {
  const bytes = new Uint8Array(4);
  view(bytes).setUint32(0, value, true);
  return bytes;
}
function locateComment(pages, packets) {
  let format = null;
  let packet = null;
  for (let index = 0; index < packets.length; index += 1) {
    const detected = signatureOf(packets[index]);
    if (!detected) continue;
    if (format) return null;
    format = detected;
    const candidate = packets[index + 1];
    if (!candidate || !isComment(candidate, detected)) return null;
    packet = candidate;
  }
  if (!format || !packet) return null;
  const { locations } = packet;
  const first = locations[0];
  const last = locations[locations.length - 1];
  if (first.pageIndex !== last.pageIndex) return null; // cross-page packet: bail out
  for (let index = 1; index < locations.length; index += 1) {
    if (locations[index].start !== locations[index - 1].end) return null;
  }
  return { format, packet, page: pages[first.pageIndex], start: first.start, end: last.end };
}
export function inspectOggComment(bytes) {
  const pages = parsePages(bytes);
  if (!pages) return null;
  const packets = parsePackets(bytes, pages);
  if (!packets) return null;
  const found = locateComment(pages, packets);
  if (!found) return null;
  const parsed = parseCommentPacket(found.packet, found.format);
  if (!parsed) return null;
  return {
    kind: found.format.kind,
    vendor: decoder.decode(parsed.vendorBytes),
    comments: parsed.comments.map(({ key, value }) => ({ key, value })),
    packet: found.packet.bytes,
    start: found.start,
    end: found.end,
    page: found.page,
    pages,
  };
}
/**
 * @param {Uint8Array} bytes original file bytes.
 * @param {object} options
 * @param {Record<string, string>} options.changes uppercase raw tag key ->
 *   final value; an empty string removes that key. Keys not present are kept.
 * @param {string} [options.vendor] replacement vendor string.
 * @returns {Uint8Array|null} patched bytes, or null when not safe/possible.
 */
export function rewriteOggComment(bytes, options = {}) {
  const pages = parsePages(bytes);
  if (!pages) return null;
  const packets = parsePackets(bytes, pages);
  if (!packets) return null;
  const found = locateComment(pages, packets);
  if (!found) return null;
  const { format, page, start } = found;
  const parsed = parseCommentPacket(found.packet, format);
  if (!parsed) return null;
  const changes = options.changes && typeof options.changes === 'object' ? options.changes : {};
  if (Object.keys(changes).length === 0 && options.vendor === undefined) {
    return bytes.slice();
  }
  const nextVendor = options.vendor === undefined ? parsed.vendorBytes : encoder.encode(String(options.vendor));
  const replacements = new Map();
  for (const [key, value] of Object.entries(changes)) {
    if (value === '' || value === undefined || value === null) {
      replacements.set(key.toUpperCase(), []);
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    if (!values.every((item) => typeof item === 'string')) return null;
    replacements.set(key.toUpperCase(), values.length ? values : []);
  }
  const emitted = new Set();
  const rebuilt = [];
  for (const entry of parsed.comments) {
    const key = entry.key.toUpperCase();
    if (!replacements.has(key)) {
      rebuilt.push(entry.encoded);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    for (const value of replacements.get(key)) rebuilt.push(commentBytes(entry.key, value));
  }
  for (const [key, values] of replacements) {
    if (emitted.has(key)) continue;
    for (const value of values) rebuilt.push(commentBytes(key, value));
  }
  const core = concat([
    found.packet.bytes.subarray(0, format.commentLength),
    uint32(nextVendor.length),
    nextVendor,
    uint32(rebuilt.length),
    ...rebuilt,
  ]);
  const trailer = format.kind === 'vorbis' ? 1 : 0;
  const grown = core.length + trailer > found.packet.bytes.length;
  if (!grown) {
    const padding = found.packet.bytes.length - core.length - trailer;
    const parts = [core];
    if (padding) parts.push(new Uint8Array(padding));
    if (trailer) parts.push(Uint8Array.of(1));
    const replacement = concat(parts);
    if (replacement.length !== found.packet.bytes.length) return null;
    const result = bytes.slice();
    result.set(replacement, start);
    const crcOffset = page.start + 22;
    view(result).setUint32(crcOffset, 0, true);
    view(result).setUint32(crcOffset, oggCrc32(result, page.start, page.end, crcOffset), true);
    return result;
  }
  const parts = [core];
  if (trailer) parts.push(Uint8Array.of(1));
  return growCommentPage(bytes, found, concat(parts));
}
function lacingFor(body) {
  const lacing = [];
  let remaining = body.length;
  while (remaining >= 255) {
    lacing.push(255);
    remaining -= 255;
  }
  lacing.push(remaining);
  return lacing;
}
function rebuildPage(bytes, page, body, lacing) {
  if (!lacing || lacing.length > 255) return null;
  const header = new Uint8Array(27 + lacing.length);
  header.set(bytes.subarray(page.start, page.start + 26), 0);
  header[26] = lacing.length;
  header.set(lacing, 27);
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  view(out).setUint32(22, oggCrc32(out, 0, out.length, 22), true);
  return out;
}
function growCommentPage(bytes, found, packet) {
  const { page, packet: oldPacket } = found;
  let cursor = page.bodyStart;
  let index = 0;
  while (cursor < found.start && index < page.lacing.length) {
    cursor += page.lacing[index];
    index += 1;
  }
  const lacing = [
    ...page.lacing.slice(0, index),
    ...lacingFor(packet),
    ...page.lacing.slice(index + oldPacket.locations.length),
  ];
  const prefix = bytes.subarray(page.bodyStart, found.start);
  const suffix = bytes.subarray(found.end, page.end);
  const body = concat([prefix, packet, suffix]);
  const rebuilt = rebuildPage(bytes, page, body, lacing);
  if (!rebuilt) return null;
  return concat([bytes.subarray(0, page.start), rebuilt, bytes.subarray(page.end)]);
}
function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
// How many leading pages we buffer while locating the comment packet. The
// identification and comment packets live in the first pages of a real stream;
// anything beyond this limit takes the full-remux path.
const MAX_HEADER_PAGES = 64;
/**
 * Range-based counterpart of {@link rewriteOggComment}. Every Ogg page is
 * walked once with bounded memory (structure, CRC and chain checks), but only
 * the leading pages up to the comment page are buffered. The comment page is
 * rebuilt with the exact same byte-level rewriter and the output Blob is
 * assembled from `Blob.slice()` ranges, so the audio payload is never copied
 * into one big Uint8Array.
 *
 * `patchedBytes` is the small rebuilt comment page (the only region whose
 * bytes change); `blob` is the full, ready-to-write output.
 *
 * @param {Blob} file source Ogg/Opus file.
 * @param {object} options same options as rewriteOggComment (an optional
 *   `mime` is used as the output Blob's MIME type).
 * @returns {Promise<{blob: Blob, patchedBytes: Uint8Array}|null>} patched
 *   output, or null whenever a safe single-page range patch is not possible
 *   (the caller then uses the existing full-remux fallback).
 */
export async function rewriteOggCommentBlob(file, options = {}) {
  if (!file || typeof file.slice !== 'function') return null;
  const read = async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());
  let prefix = new Uint8Array(0);
  let offset = 0;
  let pageIndex = 0;
  let found = null;
  // Walk EVERY page once: validate framing and CRC, reject chained streams,
  // and buffer only the leading pages up to the one holding the comment.
  while (offset + 27 <= file.size) {
    const head = await read(offset, offset + 27);
    if (head.length < 27 || ascii(head, 0, 4) !== 'OggS' || head[4] !== 0) return null;
    if (pageIndex > 0 && (head[5] & 0x02)) return null; // chained stream BOS page
    const segments = head[26];
    const headerLength = 27 + segments;
    const withLacing = await read(offset, offset + headerLength);
    if (withLacing.length < headerLength) return null;
    let bodyLength = 0;
    for (let index = 0; index < segments; index += 1) bodyLength += withLacing[27 + index];
    const pageLength = headerLength + bodyLength;
    const pageBytes = await read(offset, offset + pageLength);
    if (pageBytes.length < pageLength) return null;
    const crcOffset = 22;
    if (view(pageBytes).getUint32(crcOffset, true) !== oggCrc32(pageBytes, 0, pageLength, crcOffset)) return null;
    if (!found && pageIndex < MAX_HEADER_PAGES) {
      const merged = new Uint8Array(prefix.length + pageLength);
      merged.set(prefix, 0);
      merged.set(pageBytes, prefix.length);
      prefix = merged;
      const inspected = inspectOggComment(prefix);
      if (inspected) found = inspected;
    }
    offset += pageLength;
    pageIndex += 1;
  }
  if (offset !== file.size || !found) return null;
  const { page } = found;
  // inspectOggComment's locateComment already rejects cross-page packets, so
  // a positive match means the whole comment lives inside this single page.
  if (found.start < page.bodyStart || found.end > page.end || page.start < 0 || page.end > file.size) return null;
  // Reuse the byte rewriter on the buffered header prefix. This keeps vendor
  // handling, comment count, framing bit, granule/sequence numbers and CRC
  // recalculation byte-for-byte identical to the full-buffer path.
  const patchedPrefix = rewriteOggComment(prefix, options);
  if (!patchedPrefix || !inspectOggComment(patchedPrefix)) return null;
  // rewriteOggComment only touches the comment page; derive its new length from
  // the unchanged trailing bytes and require the surrounding bytes to match.
  const beforeLength = page.start;
  const afterLength = prefix.length - page.end;
  const patchedPageLength = patchedPrefix.length - beforeLength - afterLength;
  if (patchedPageLength <= 0) return null;
  if (!equalBytes(prefix.subarray(0, beforeLength), patchedPrefix.subarray(0, beforeLength))) return null;
  if (!equalBytes(prefix.subarray(page.end), patchedPrefix.subarray(beforeLength + patchedPageLength))) return null;
  const patchedBytes = patchedPrefix.subarray(beforeLength, beforeLength + patchedPageLength);
  const blob = new Blob([
    file.slice(0, page.start),
    patchedBytes,
    file.slice(page.end),
  ], { type: options.mime || file.type || '' });
  return { blob, patchedBytes };
}