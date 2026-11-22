/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Minimal, dependency-free ID3v2.2/2.3/2.4 frame walker whose only job is to
// find the first synchronised lyrics (SYLT) frame and decode it into the
// ms-based shape used by the timed-text editor. Nothing here throws: every
// malformed/unsupported input resolves to null.
function latin1(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}
function syncSafe(bytes) {
  if (!bytes || bytes.length < 4) return 0;
  return ((bytes[0] & 0x7f) << 21)
    | ((bytes[1] & 0x7f) << 14)
    | ((bytes[2] & 0x7f) << 7)
    | (bytes[3] & 0x7f);
}
function be(bytes) {
  let value = 0;
  for (let i = 0; i < bytes.length; i += 1) value = (value * 256 + bytes[i]) >>> 0;
  return value;
}
function deunsync(bytes) {
  let hasPadding = false;
  for (let i = 0; i + 1 < bytes.length; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) { hasPadding = true; break; }
  }
  if (!hasPadding) return bytes;
  const out = [];
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) { out.push(0xff); i += 1; }
    else out.push(bytes[i]);
  }
  return Uint8Array.from(out);
}
function readString(bytes, offset, encoding, state) {
  if (!Number.isInteger(offset) || offset < 0 || offset > bytes.length) return null;
  let pos = offset;
  let little = state.little;
  if (encoding === 1 && pos + 2 <= bytes.length) {
    if (bytes[pos] === 0xff && bytes[pos + 1] === 0xfe) { little = true; pos += 2; }
    else if (bytes[pos] === 0xfe && bytes[pos + 1] === 0xff) { little = false; pos += 2; }
    state.little = little;
  }
  const unit = (encoding === 1 || encoding === 2) ? 2 : 1;
  let end = pos;
  while (end + unit <= bytes.length) {
    let terminated = true;
    for (let k = 0; k < unit; k += 1) {
      if (bytes[end + k] !== 0) { terminated = false; break; }
    }
    if (terminated) break;
    end += unit;
  }
  if (end + unit > bytes.length) return null;
  let text;
  try {
    if (encoding === 0) text = latin1(bytes.subarray(pos, end));
    else if (encoding === 3) text = new TextDecoder('utf-8').decode(bytes.subarray(pos, end));
    else if (encoding === 2) text = new TextDecoder('utf-16be').decode(bytes.subarray(pos, end));
    else text = new TextDecoder(little ? 'utf-16le' : 'utf-16be').decode(bytes.subarray(pos, end));
  } catch {
    return null;
  }
  return { text, next: end + unit };
}
function decodeSyltBody(body) {
  if (!body || body.length < 7) return null;
  const encoding = body[0];
  if (encoding > 3) return null;
  const language = latin1(body.subarray(1, 4));
  const timestampFormat = body[4];
  const type = body[5];
  const state = { little: true };
  const description = readString(body, 6, encoding, state);
  if (!description) return null;
  let pos = description.next;
  const pairs = [];
  while (pos < body.length) {
    const item = readString(body, pos, encoding, state);
    if (!item) return null;
    pos = item.next;
    if (pos + 4 > body.length) return null;
    const time = be(body.subarray(pos, pos + 4));
    pos += 4;
    pairs.push({ text: item.text, time });
  }
  if (!pairs.length) return null;
  return { type, timestampFormat, language, description: description.text, pairs };
}
function parseId3(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return null;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null; // 'ID3'
  const major = bytes[3];
  if (major < 2 || major > 4) return null;
  const flags = bytes[5];
  let tagSize = syncSafe(bytes.subarray(6, 10));
  if (!tagSize || tagSize > bytes.length - 10) tagSize = bytes.length - 10;
  let offset = 10;
  const tagEnd = offset + tagSize;
  if (flags & 0x40) {
    if (offset + 4 > tagEnd) return null;
    const extSize = major === 4 ? syncSafe(bytes.subarray(offset, offset + 4)) : be(bytes.subarray(offset, offset + 4));
    offset += 4 + extSize;
    if (offset > tagEnd) return null;
  }
  let frameBytes = bytes.subarray(offset, tagEnd);
  if (flags & 0x80) frameBytes = deunsync(frameBytes);
  const idLength = major === 2 ? 3 : 4;
  const frameHeader = major === 2 ? 6 : 10;
  let cursor = 0;
  while (cursor + frameHeader <= frameBytes.length) {
    const id = latin1(frameBytes.subarray(cursor, cursor + idLength));
    let size;
    if (major === 2) size = be(frameBytes.subarray(cursor + 3, cursor + 6));
    else if (major === 4) size = syncSafe(frameBytes.subarray(cursor + 4, cursor + 8));
    else size = be(frameBytes.subarray(cursor + 4, cursor + 8));
    let frameFlags = 0;
    if (major >= 3) frameFlags = (frameBytes[cursor + 8] << 8) | frameBytes[cursor + 9];
    const bodyStart = cursor + frameHeader;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > frameBytes.length) break;
    if (id === 'SYLT' || (major === 2 && id === 'ULT')) {
      let body = frameBytes.subarray(bodyStart, bodyEnd);
      if (major === 4 && (frameFlags & 0x40)) body = deunsync(body);
      return decodeSyltBody(body);
    }
    cursor = bodyEnd;
  }
  return null;
}
/**
 * @returns {Promise<null|{type:number,timestampFormat:number,language:string,description:string,pairs:Array<{text:string,time:number}>}>}
 */
export async function readSylt(file) {
  try {
    let buffer;
    if (file && typeof file.arrayBuffer === 'function') buffer = await file.arrayBuffer();
    else if (file instanceof ArrayBuffer) buffer = file;
    else if (ArrayBuffer.isView(file)) buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    else return null;
    return parseId3(buffer);
  } catch {
    return null;
  }
}
export function toWriterSylt(parsed) {
  if (!parsed || !Array.isArray(parsed.pairs) || !parsed.pairs.length) return null;
  const text = [];
  for (const pair of parsed.pairs) {
    if (!pair || typeof pair.text !== 'string' || !pair.text) continue;
    const time = Number(pair.time);
    text.push([pair.text, Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0]);
  }
  if (!text.length) return null;
  const type = Number.isInteger(parsed.type) && parsed.type >= 0 && parsed.type <= 6 ? parsed.type : 2;
  const timestampFormat = parsed.timestampFormat === 1 ? 1 : 2;
  const language = typeof parsed.language === 'string' && /^[a-z]{3}$/i.test(parsed.language)
    ? parsed.language
    : 'eng';
  const description = typeof parsed.description === 'string' ? parsed.description : '';
  return { type, timestampFormat, language, description, text };
}
export default { readSylt, toWriterSylt };