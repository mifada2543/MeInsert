/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
export function mimeOf(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return 'image/jpeg';
  if (u.length >= 8 && u[0] === 0x89 && ascii(u, 1, 3) === 'PNG') return 'image/png';
  if (u.length >= 12 && ascii(u, 0, 4) === 'RIFF' && ascii(u, 8, 4) === 'WEBP') return 'image/webp';
  if (u.length >= 6 && /^GIF8[79]a/.test(ascii(u, 0, 6))) return 'image/gif';
  if (u.length >= 14 && ascii(u, 0, 2) === 'BM') return 'image/bmp';
  return 'image/jpeg';
}
export function scrubPrimaryCoverRaw(raw, images = []) {
  if (!raw) return raw;
  delete raw.METADATA_BLOCK_PICTURE;
  const primary = (Array.isArray(images) ? images : [])
    .filter((img) => img && (img.kind === 'coverFront' || img.kind === 'unknown'));
  if (!primary.length) return raw;
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const mime = value.mimeType;
    const data = value.data;
    if (typeof mime !== 'string' || !mime.startsWith('image/') || !(data instanceof Uint8Array)) continue;
    if (primary.some((img) => img.data === data || bytesEqual(img.data, data))) {
      delete raw[key];
    }
  }
  return raw;
}
function bytesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
const BASE_COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const LEGACY_COVER_CONTAINERS = new Set(['mp3', 'flac', 'ogg', 'mkv']);
export function coverFormatsFor(detectionId) {
  const mimes = [...BASE_COVER_MIMES];
  if (LEGACY_COVER_CONTAINERS.has(detectionId)) mimes.push('image/gif', 'image/bmp');
  return mimes;
}
export function coverAcceptFor(detectionId) {
  return coverFormatsFor(detectionId).join(',');
}
export function coverFormatsLabelFor(detectionId) {
  return coverFormatsFor(detectionId)
    .map((mime) => ({ 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'image/bmp': 'BMP' }[mime]))
    .join(', ');
}
export function isSupportedCover(bytes, detectionId) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!u.length) return false;
  const mime = mimeOf(u);
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') return true;
  return (mime === 'image/gif' || mime === 'image/bmp') && LEGACY_COVER_CONTAINERS.has(detectionId);
}
export function coverFromTags(tags) {
  const image = tags?.images?.[0];
  if (!image?.data) return { cover: null, coverBytes: null };
  const data = image.data;
  const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const size = data.byteLength;
  const mimeType = image.mimeType || mimeOf(data);
  return {
    cover: {
      mimeType,
      kind: image.kind || 'coverFront',
      name: image.name || 'cover',
      size,
    },
    coverBytes: bytes,
  };
}
export function applyCoverImages(images, cover) {
  const list = Array.isArray(images) ? [...images] : [];
  if (!cover || cover.action === 'keep') return list;
  const withoutPrimary = list.filter((item) => item.kind !== 'coverFront' && item.kind !== 'unknown');
  if (cover.action === 'remove') return withoutPrimary;
  if (cover.action === 'set') {
    const data = cover.data instanceof Uint8Array ? cover.data : new Uint8Array(cover.data || []);
    const mimeType = cover.mimeType || mimeOf(data);
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    withoutPrimary.push({
      data,
      mimeType,
      kind: 'coverFront',
      name: cover.name || `cover.${ext}`,
    });
  }
  return withoutPrimary;
}
export function coverMetaFromAction(cover) {
  if (!cover || cover.action !== 'set') return null;
  const data = cover.data instanceof Uint8Array ? cover.data : new Uint8Array(cover.data);
  return {
    mimeType: cover.mimeType || mimeOf(data),
    kind: 'coverFront',
    name: cover.name || 'cover',
    size: data.byteLength,
  };
}
