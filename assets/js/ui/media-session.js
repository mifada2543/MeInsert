/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Playback continuity for the media preview.
export function captureMediaSession(root) {
  const media = root?.querySelector?.('video, audio');
  if (!media) return null;
  return {
    element: media,
    src: media.getAttribute('src') || media.src || '',
    currentTime: Number(media.currentTime) || 0,
    paused: media.paused !== false,
    muted: Boolean(media.muted),
    volume: Number.isFinite(media.volume) ? media.volume : 1,
    playbackRate: Number.isFinite(media.playbackRate) ? media.playbackRate : 1,
    wasPlaying: media.paused === false,
  };
}
export function canReuseMedia(session, src) {
  return Boolean(session?.element && src && session.src && session.src === src);
}
export function restoreMediaSession(session, { src = '' } = {}) {
  if (!session?.element) return;
  const media = session.element;
  const sameSource = !src || !session.src || session.src === src;
  try {
    media.muted = session.muted;
    media.volume = session.volume;
    media.playbackRate = session.playbackRate;
  } catch {}
  if (!sameSource) return;
  const apply = () => {
    if (session.currentTime > 0) {
      try {
        const duration = Number(media.duration);
        media.currentTime = Number.isFinite(duration) && duration > 0
          ? Math.min(session.currentTime, duration)
          : session.currentTime;
      } catch {}
    }
    if (session.wasPlaying) {
      try {
        const started = media.play();
        if (started?.catch) started.catch(() => {});
      } catch {}
    }
  };
  if (media.readyState >= 1) apply();
  else media.addEventListener('loadedmetadata', apply, { once: true });
}