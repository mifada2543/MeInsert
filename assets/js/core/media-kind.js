/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
export function mediaKind(detection) {
  if (!detection) return 'light';
  if (detection.kind === 'audio' || detection.kind === 'video' || detection.kind === 'light') return detection.kind;
  if (detection.subtype === 'm4a') return 'audio';
  if (detection.id === 'mp3' || detection.id === 'flac' || detection.id === 'ogg') return 'audio';
  if (detection.id === 'mkv' || detection.id === 'mp4' || detection.id === 'rawVideo') return 'video';
  return 'light';
}
