/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Bounded-memory evidence for relocation, NOT a decoder or authenticity certificate.
const CHUNK = 1024 * 1024;
const MAX_REGIONS = 65536;
const hex = (bytes) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
async function bytesAt(file, offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > file.size) throw new Error('Invalid media range');
  const bytes = await file.slice(offset, offset + length).arrayBuffer();
  if (bytes.byteLength !== length) throw new Error('Truncated media range');
  return new DataView(bytes);
}
async function digestRegions(file, kind, regions) {
  if (!regions.length || regions.length > MAX_REGIONS) throw new Error('Missing or excessive media regions');
  const records = [];
  for (const [offset, length] of regions) {
    if (!length) throw new Error('Empty media region');
    const hashes = [];
    for (let pos = 0; pos < length; pos += CHUNK) {
      const data = await bytesAt(file, offset + pos, Math.min(CHUNK, length - pos));
      hashes.push(hex(await crypto.subtle.digest('SHA-256', data.buffer)));
    }
    records.push({ length, hash: hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashes.join(':')))) });
  }
  return { valid: true, kind, algorithm: 'sha256-chunks-v1', regions: records };
}
async function mp4Regions(file) {
  const regions = [];
  for (let offset = 0, boxes = 0; offset < file.size; boxes++) {
    if (boxes > MAX_REGIONS) throw new Error('Too many boxes');
    const head = await bytesAt(file, offset, 8);
    let size = head.getUint32(0), headerSize = 8;
    const type = String.fromCharCode(...new Uint8Array(head.buffer, 4, 4));
    if (size === 1) {
      const big = await bytesAt(file, offset + 8, 8);
      const value = big.getBigUint64(0);
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Oversized box');
      size = Number(value); headerSize = 16;
    } else if (size === 0) size = file.size - offset;
    if (size < headerSize || offset + size > file.size) throw new Error('Invalid box size');
    if (type === 'mdat') regions.push([offset + headerSize, size - headerSize]);
    offset += size;
  }
  return regions;
}
async function tiffRegions(file) {
  const header = await bytesAt(file, 0, 8);
  const order = header.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) throw new Error('Invalid TIFF byte order');
  const little = order === 0x4949;
  if (header.getUint16(2, little) !== 42) throw new Error('Only classic TIFF supported');
  const pending = [header.getUint32(4, little)], seen = new Set(), regions = [];
  const array = async (entry) => {
    const type = entry.getUint16(2, little), count = entry.getUint32(4, little);
    const width = type === 3 ? 2 : type === 4 || type === 13 ? 4 : 0;
    if (!width || !count || count > MAX_REGIONS) throw new Error('Unsupported TIFF array');
    const data = count * width <= 4 ? new DataView(entry.buffer, entry.byteOffset + 8, 4)
      : await bytesAt(file, entry.getUint32(8, little), count * width);
    return Array.from({ length: count }, (_, index) => width === 2 ? data.getUint16(index * width, little) : data.getUint32(index * width, little));
  };
  while (pending.length) {
    const offset = pending.shift();
    if (!offset) continue;
    if (seen.has(offset) || seen.size > 256) throw new Error('Cyclic/excessive TIFF directories');
    seen.add(offset);
    const count = (await bytesAt(file, offset, 2)).getUint16(0, little);
    const table = await bytesAt(file, offset + 2, count * 12 + 4);
    const tags = new Map();
    for (let index = 0; index < count; index++) {
      const entry = new DataView(table.buffer, index * 12, 12);
      const tag = entry.getUint16(0, little);
      if ([273, 279, 324, 325, 330].includes(tag)) tags.set(tag, await array(entry));
    }
    for (const [offsetTag, countTag] of [[273, 279], [324, 325]]) {
      const offsets = tags.get(offsetTag), lengths = tags.get(countTag);
      if (!offsets && !lengths) continue;
      if (!offsets || offsets.length !== lengths?.length) throw new Error('Invalid TIFF strips/tiles');
      offsets.forEach((start, index) => regions.push([start, lengths[index]]));
    }
    pending.push(...(tags.get(330) || []), table.getUint32(count * 12, little));
    if (regions.length > MAX_REGIONS) throw new Error('Too many TIFF strips');
  }
  return regions;
}
export async function mediaProof(file, kind) {
  try {
    const regions = await (kind === 'tiff' ? tiffRegions(file) : mp4Regions(file));
    return await digestRegions(file, kind, regions);
  } catch (error) {
    return { valid: false, kind, error: String(error.message || error) };
  }
}
export async function mediaPacketProof(file) {
  try {
    const {
      Input, ALL_FORMATS, BlobSource, EncodedPacketSink,
    } = await import('../../vendor/mediabunny.mjs');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const encoder = new TextEncoder();
    const regions = [];
    try {
      const tracks = (await input.getTracks())
        .filter((track) => track.isVideoTrack?.() || track.isAudioTrack?.());
      if (!tracks.length) throw new Error('No audio/video tracks for packet proof');
      for (const track of tracks) {
        const digests = [];
        for await (const packet of new EncodedPacketSink(track).packets()) {
          const data = packet.data instanceof Uint8Array ? packet.data : new Uint8Array(packet.data || []);
          const duration = encoder.encode(String(packet.duration));
          const sample = new Uint8Array(data.byteLength + duration.byteLength);
          sample.set(data);
          sample.set(duration, data.byteLength);
          digests.push(hex(await crypto.subtle.digest('SHA-256', sample)));
        }
        regions.push({
          length: digests.length,
          hash: hex(await crypto.subtle.digest('SHA-256', encoder.encode(digests.join(':')))),
        });
      }
    } finally {
      input.dispose?.();
    }
    return { valid: true, kind: 'mp4', algorithm: 'av-packets-v1', regions };
  } catch (error) {
    return { valid: false, kind: 'mp4', algorithm: 'av-packets-v1', error: String(error.message || error) };
  }
}
export function sameMediaProof(before, after) {
  if (before?.valid !== true || after?.valid !== true || before.kind !== after.kind
    || before.algorithm !== after.algorithm
    || (before.algorithm !== 'sha256-chunks-v1' && before.algorithm !== 'av-packets-v1')
    || before.regions?.length <= 0 || before.regions.length !== after.regions?.length) return false;
  return before.regions.every((region, index) => region.length > 0 && region.length === after.regions[index].length
    && /^[a-f0-9]{64}$/.test(region.hash) && region.hash === after.regions[index].hash);
}