/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Keep complete FLAC picture structures: MetadataTags.images deliberately omits
// the numeric picture type, dimensions, depth and palette size.
const encoder = new TextEncoder();
const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const join = (parts) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
export function pictureBase64(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(text);
}
export function commentPictures(raw) {
  const values = raw?.METADATA_BLOCK_PICTURE;
  return (Array.isArray(values) ? values : values ? [values] : [])
    .map((value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
}
function flacBlocks(bytes) {
  if (bytes.length < 4 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'fLaC') {
    throw new Error('Invalid FLAC signature.');
  }
  const blocks = [];
  let offset = 4;
  while (true) {
    if (offset + 4 > bytes.length) throw new Error('Truncated FLAC metadata header.');
    const header = bytes[offset];
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (offset + 4 + length > bytes.length) throw new Error('Truncated FLAC metadata block.');
    blocks.push({ type: header & 127, data: bytes.subarray(offset + 4, offset + 4 + length) });
    offset += 4 + length;
    if (header & 128) return { blocks, audioOffset: offset };
  }
}
export async function flacPictures(file) {
  let offset = 4;
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...signature) !== 'fLaC') throw new Error('Invalid FLAC signature.');
  const pictures = [];
  while (true) {
    const header = new Uint8Array(await file.slice(offset, offset + 4).arrayBuffer());
    if (header.length !== 4) throw new Error('Truncated FLAC metadata header.');
    const length = (header[1] << 16) | (header[2] << 8) | header[3];
    if (offset + 4 + length > file.size) throw new Error('Truncated FLAC metadata block.');
    if ((header[0] & 127) === 6) pictures.push(new Uint8Array(await file.slice(offset + 4, offset + 4 + length).arrayBuffer()));
    offset += 4 + length;
    if (header[0] & 128) return pictures;
  }
}
export function serializePicture(image) {
  const mime = encoder.encode(image.mimeType);
  const description = encoder.encode(image.description || '');
  const bytes = new Uint8Array(32 + mime.length + description.length + image.data.length);
  const data = view(bytes);
  data.setUint32(0, image.kind === 'coverFront' ? 3 : image.kind === 'coverBack' ? 4 : 0);
  data.setUint32(4, mime.length);
  bytes.set(mime, 8);
  data.setUint32(8 + mime.length, description.length);
  bytes.set(description, 12 + mime.length);
  const offset = 12 + mime.length + description.length;
  if (image.mimeType === 'image/png' && image.data.length >= 29) {
    const png = view(image.data);
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[image.data[25]];
    data.setUint32(offset, png.getUint32(16));
    data.setUint32(offset + 4, png.getUint32(20));
    data.setUint32(offset + 8, image.data[24] * (channels || 1));
  }
  data.setUint32(offset + 16, image.data.length);
  bytes.set(image.data, offset + 20);
  return bytes;
}
export function editPictures(pictures, cover, images) {
  if (cover?.action !== 'set' && cover?.action !== 'remove') return pictures;
  const retained = pictures.filter((picture) => view(picture).getUint32(0) === 4);
  if (cover.action === 'set') retained.push(serializePicture(images[images.length - 1]));
  return retained;
}
export function repairFlacMetadata(bytes, pictures, vendor) {
  const { blocks, audioOffset } = flacBlocks(bytes);
  const repaired = blocks.filter((block) => block.type !== 6);
  if (typeof vendor === 'string') {
    for (const block of repaired) {
      if (block.type !== 4) continue;
      if (block.data.length < 4) throw new Error('Truncated Vorbis comment vendor.');
      const length = view(block.data).getUint32(0, true);
      if (length + 4 > block.data.length) throw new Error('Truncated Vorbis comment vendor.');
      const text = encoder.encode(vendor);
      const prefix = new Uint8Array(4);
      view(prefix).setUint32(0, text.length, true);
      block.data = join([prefix, text, block.data.subarray(4 + length)]);
    }
  }
  repaired.push(...pictures.map((data) => ({ type: 6, data })));
  const parts = [bytes.subarray(0, 4)];
  repaired.forEach((block, index) => {
    if (block.data.length > 0xffffff) throw new Error('FLAC metadata block is too large.');
    const length = block.data.length;
    parts.push(Uint8Array.of(block.type | (index === repaired.length - 1 ? 128 : 0), length >>> 16, length >>> 8, length), block.data);
  });
  parts.push(bytes.subarray(audioOffset));
  return join(parts);
}