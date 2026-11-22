/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Trim helpers shared by precise/copy conversion paths. The configuration is deliberately normalized into a small, serializable shape: no decoders are invoked here and no bytes are ever uploaded.
import { mp3FrameRangeProof } from './mp3-cut.js';
export const CUT_MODES = Object.freeze({ COPY: 'copy', PRECISE: 'precise' });
const hex = (bytes) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
export function normalizeTrim(input, { duration = Infinity } = {}) {
  if (input === null || input === undefined) return null;
  const start = Number(input.start);
  const end = Number(input.end);
  const mode = input.mode === undefined ? CUT_MODES.COPY : input.mode;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (!(0 <= start && start < end)) return null;
  if (!(end <= duration + 1e-6)) return null;
  if (mode !== CUT_MODES.COPY && mode !== CUT_MODES.PRECISE) return null;
  return { start, end, mode };
}
export function conversionCutOptions(trim, baseCopy = {}) {
  const { start = 0, end = 0, mode = CUT_MODES.COPY } = trim || {};
  const modeOptions = mode === CUT_MODES.PRECISE
    ? { mode: 'preferred', boundaryPolicy: 'shrink', boundaryTolerance: 0 }
    : { mode: 'forced', boundaryPolicy: 'shrink' };
  return { trim: { start, end }, copy: { ...baseCopy, ...modeOptions } };
}
export function expectedCutDuration(trim) {
  const normalized = normalizeTrim(trim);
  return normalized ? normalized.end - normalized.start : 0;
}
export async function mediaRangeProof(file, start, end) {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    const id3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
    const sync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
    if (id3 || sync) return await mp3FrameRangeProof(file, start, end);
    const {
      Input, ALL_FORMATS, BlobSource, EncodedPacketSink,
    } = await import('../../vendor/mediabunny.mjs');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const encoder = new TextEncoder();
    const regions = [];
    try {
      const tracks = (await input.getTracks())
        .filter((track) => track.isVideoTrack?.() || track.isAudioTrack?.());
      if (!tracks.length) throw new Error('No audio/video tracks for range proof');
      for (const track of tracks) {
        const digests = [];
        for await (const packet of new EncodedPacketSink(track).packets()) {
          if (!(packet.timestamp + packet.duration > start && packet.timestamp < end)) continue;
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
    return { valid: true, algorithm: 'av-range-v1', regions };
  } catch (error) {
    return { valid: false, algorithm: 'av-range-v1', error: String(error.message || error) };
  }
}