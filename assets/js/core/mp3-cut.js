/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Frame-accurate MP3 (MPEG Layer III) range slicing. ID3v2 bytes are copied
// verbatim; only whole frames inside the requested window are emitted.
import { parseId3Tag } from './id3-passthrough.js';
const BITRATES = {
  3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  0: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
const SAMPLE_RATES = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};
const XING_WARNING = 'Xing/Info header dibuang karena jumlah frame/durasi sumber tidak berlaku setelah pemotongan.';
const RESERVOIR_WARNING = 'Mode salin MP3 memotong pada batas frame; bit reservoir dapat menyebabkan artefak singkat di awal potongan.';
function readFrameHeader(bytes, offset) {
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;
  const version = (bytes[offset + 1] >> 3) & 3;
  const layer = (bytes[offset + 1] >> 1) & 3;
  if (!(version in SAMPLE_RATES) || layer !== 1) return null; // Layer III only
  const bitrateIndex = (bytes[offset + 2] >> 4) & 0xf;
  const sampleRateIndex = (bytes[offset + 2] >> 2) & 3;
  const padding = (bytes[offset + 2] >> 1) & 1;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;
  const sampleRate = SAMPLE_RATES[version][sampleRateIndex];
  const bitrate = BITRATES[version][bitrateIndex] * 1000;
  const mpeg1 = version === 3;
  const mono = (bytes[offset + 3] >> 6) === 3;
  const crc = (bytes[offset + 1] & 1) === 0;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  return {
    offset,
    length: Math.floor((mpeg1 ? 144 : 72) * bitrate / sampleRate) + padding,
    duration: (mpeg1 ? 1152 : 576) / sampleRate,
    sampleRate,
    mono,
    crc,
    sideInfo,
  };
}
function scanFrames(bytes, start) {
  const frames = [];
  let offset = start;
  let timestamp = 0;
  while (offset < bytes.length) {
    const frame = readFrameHeader(bytes, offset);
    if (!frame || offset + frame.length > bytes.length) { offset += 1; continue; }
    const nextAt = offset + frame.length;
    const next = readFrameHeader(bytes, nextAt);
    const id3v1 = bytes[nextAt] === 0x54 && bytes[nextAt + 1] === 0x41 && bytes[nextAt + 2] === 0x47;
    if (!next && !id3v1 && nextAt < bytes.length - 4) { offset += 1; continue; }
    frames.push({ ...frame, timestamp });
    timestamp += frame.duration;
    offset = nextAt;
  }
  return frames;
}
function hasXingInfo(bytes, frame) {
  const expected = frame.offset + 4 + (frame.crc ? 2 : 0) + frame.sideInfo;
  const end = frame.offset + frame.length;
  const magicAt = (at) => at + 4 <= end ? String.fromCharCode(...bytes.subarray(at, at + 4)) : '';
  for (let at = Math.max(frame.offset + 4, expected - 4); at <= Math.min(end - 4, expected + 4); at += 1) {
    const magic = magicAt(at);
    if (magic === 'Xing' || magic === 'Info') return true;
  }
  return false;
}
export async function selectMp3Frames(file, start, end) {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || from >= to) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tagEnd = parseId3Tag(bytes)?.tagEnd || 0;
  const sourceFrames = scanFrames(bytes, tagEnd);
  if (!sourceFrames.length) return null;
  const hasXing = hasXingInfo(bytes, sourceFrames[0]);
  const playable = hasXing ? sourceFrames.slice(1) : sourceFrames;
  let timestamp = 0;
  const frames = playable.map((frame) => {
    const rebased = { ...frame, timestamp };
    timestamp += frame.duration;
    return rebased;
  });
  const tailTolerance = (frames[0]?.duration || 0) * 2 + 1e-6;
  const throughTail = Math.abs(timestamp - to) <= tailTolerance;
  const selected = frames.filter((frame) => frame.timestamp + frame.duration > from && (throughTail || frame.timestamp < to));
  if (!selected.length) return null;
  return { bytes, tagEnd, selected, hasXing };
}
export async function mp3FrameRangeProof(file, start, end) {
  const selected = await selectMp3Frames(file, start, end);
  if (!selected) return { valid: false, algorithm: 'mp3-frames-v1', error: 'No MP3 frames in range' };
  try {
    const hashes = [];
    for (const frame of selected.selected) {
      const bytes = selected.bytes.subarray(frame.offset, frame.offset + frame.length);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      hashes.push(Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join(''));
    }
    const joined = new TextEncoder().encode(hashes.join(':'));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', joined));
    const hash = Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
    return { valid: true, algorithm: 'mp3-frames-v1', regions: [{ length: hashes.length, hash }] };
  } catch (error) {
    return { valid: false, algorithm: 'mp3-frames-v1', error: String(error?.message || error) };
  }
}
export async function sliceMp3Range(file, start, end, mode = 'copy') {
  if (mode === 'precise') return null;
  const selection = await selectMp3Frames(file, start, end);
  if (!selection) return null;
  const { bytes, tagEnd, selected, hasXing } = selection;
  const warnings = [RESERVOIR_WARNING];
  if (hasXing) warnings.push(XING_WARNING);
  const parts = [bytes.slice(0, tagEnd), ...selected.map((frame) => bytes.slice(frame.offset, frame.offset + frame.length))];
  return {
    blob: new Blob(parts, { type: 'audio/mpeg' }),
    frameCount: selected.length,
    duration: selected.reduce((sum, frame) => sum + frame.duration, 0),
    warnings,
  };
}