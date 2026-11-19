/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
export const jobs = [
  { id: 'jpeg', fixtures: ['pattern.jpg'] },
  { id: 'png', fixtures: ['pattern.png', 'mislabeled.jpg'] },
  { id: 'webp', fixtures: ['pattern.webp'] },
  { id: 'tiff', fixtures: ['pattern.tif'] },
  { id: 'mp3', fixtures: ['tone.mp3'], covers: ['tone.mp3'] },
  { id: 'flac', fixtures: ['tone.flac'], covers: ['tone.flac'] },
  { id: 'opus', fixtures: ['tone.opus'], covers: ['tone.opus'] },
  { id: 'vorbis', fixtures: ['tone.ogg'], covers: ['tone.ogg'] },
  { id: 'mp4', fixtures: ['clip.mp4'], mp4Policy: true },
  { id: 'mkv', fixtures: ['clip.mkv'], covers: ['clip.mkv'] },
  { id: 'webm', fixtures: ['clip.webm'] },
  { id: 'mov', fixtures: ['clip.mov'] },
  { id: 'm4a', fixtures: ['tone.m4a'] },
  { id: 'pdf', fixtures: ['document.pdf', 'signed.pdf'] },
  { id: 'office', fixtures: ['sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.docm', 'sample.xlsm', 'sample.pptm', 'sample.odt', 'sample.ods', 'sample.odp'] },
  { id: 'unsupported-ogg', fixtures: ['reject-flac.ogg', 'reject-speex.ogg'] },
  { id: 'ui-id', fixtures: [], locale: 'id-ID' },
  { id: 'ui-en', fixtures: [], locale: 'en-US' },
  { id: 'mkv-timing', fixtures: [], suite: 'mkv-duration.mjs' },
  { id: 'vorbis-pictures', fixtures: [], suite: 'vorbis-preservation.mjs' },
  { id: 'office-preservation', fixtures: [], suite: 'office-preservation.mjs' },
];
export function concurrency(value = '2') {
  if (!/^[1-8]$/.test(String(value))) throw new Error('Compatibility concurrency must be an integer from 1 to 8');
  return Number(value);
}
