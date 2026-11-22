/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReuseMedia,
  captureMediaSession,
  restoreMediaSession,
} from '../../assets/js/ui/media-session.js';
function createFakeMedia(overrides = {}) {
  const listeners = [];
  const media = {
    getAttribute: () => 'blob:preview',
    src: 'blob:preview',
    currentTime: 0,
    paused: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    duration: NaN,
    readyState: 4,
    playCalls: 0,
    addEventListener: (type, fn) => { listeners.push([type, fn]); },
    removeEventListener: () => {},
    play: () => {
      media.playCalls += 1;
      media.paused = false;
      return Promise.resolve();
    },
  };
  Object.assign(media, overrides);
  media.fire = (type) => {
    for (const [name, fn] of listeners.slice()) if (name === type) fn();
  };
  media.listenerCount = (type) => listeners.filter(([name]) => name === type).length;
  return media;
}
function createRoot(media) {
  return { querySelector: () => media };
}
test('a failed seek does not prevent playback from resuming', () => {
  const media = createFakeMedia({ currentTime: 3, paused: false });
  const session = captureMediaSession(createRoot(media));
  Object.defineProperty(media, 'currentTime', {
    get: () => 3,
    set: () => { throw new Error('not seekable'); },
  });
  media.paused = true;
  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(media.playCalls, 1);
  assert.equal(media.paused, false);
});
test('captureMediaSession reads the live media element', () => {
  const media = createFakeMedia({
    currentTime: 12.5,
    paused: false,
    muted: true,
    volume: 0.4,
    playbackRate: 1.5,
  });
  const session = captureMediaSession(createRoot(media));
  assert.equal(session.element, media);
  assert.equal(session.src, 'blob:preview');
  assert.equal(session.currentTime, 12.5);
  assert.equal(session.paused, false);
  assert.equal(session.muted, true);
  assert.equal(session.volume, 0.4);
  assert.equal(session.playbackRate, 1.5);
  assert.equal(session.wasPlaying, true);
});
test('captureMediaSession returns null when the page has no media element', () => {
  assert.equal(captureMediaSession({ querySelector: () => null }), null);
  assert.equal(captureMediaSession({}), null);
  assert.equal(captureMediaSession(null), null);
});
test('captureMediaSession falls back to the element src property', () => {
  const media = createFakeMedia({ getAttribute: () => null, src: 'blob:fallback' });
  const session = captureMediaSession(createRoot(media));
  assert.equal(session.src, 'blob:fallback');
});
test('captureMediaSession marks a paused element as not playing', () => {
  const media = createFakeMedia({ paused: true, currentTime: 0 });
  const session = captureMediaSession(createRoot(media));
  assert.equal(session.paused, true);
  assert.equal(session.wasPlaying, false);
  assert.equal(session.currentTime, 0);
});
test('canReuseMedia only accepts the very same source', () => {
  const media = createFakeMedia();
  const session = captureMediaSession(createRoot(media));
  assert.equal(canReuseMedia(session, 'blob:preview'), true);
  assert.equal(canReuseMedia(session, 'blob:lain'), false);
  assert.equal(canReuseMedia(session, ''), false);
  assert.equal(canReuseMedia(null, 'blob:preview'), false);
  assert.equal(canReuseMedia({ element: media, src: '' }, 'blob:preview'), false);
  assert.equal(canReuseMedia({ element: null, src: 'blob:preview' }, 'blob:preview'), false);
});
test('restoreMediaSession re-applies the settings and resumes playback', () => {
  const media = createFakeMedia({
    currentTime: 30,
    paused: false,
    muted: true,
    volume: 0.3,
    playbackRate: 2,
  });
  const session = captureMediaSession(createRoot(media));
  media.currentTime = 0;
  media.muted = false;
  media.volume = 1;
  media.playbackRate = 1;
  media.paused = true;
  media.playCalls = 0;
  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(media.currentTime, 30);
  assert.equal(media.muted, true);
  assert.equal(media.volume, 0.3);
  assert.equal(media.playbackRate, 2);
  assert.equal(media.playCalls, 1);
});
test('restoreMediaSession leaves a paused session paused', () => {
  const media = createFakeMedia({ currentTime: 12, paused: true });
  const session = captureMediaSession(createRoot(media));
  media.currentTime = 0;
  media.playCalls = 0;
  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(media.currentTime, 12);
  assert.equal(media.playCalls, 0);
});
test('restoreMediaSession waits for loadedmetadata when metadata is not ready', () => {
  const media = createFakeMedia({ currentTime: 30, paused: false, readyState: 0 });
  const session = captureMediaSession(createRoot(media));
  media.currentTime = 0;
  media.playCalls = 0;
  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(media.currentTime, 0);
  assert.equal(media.playCalls, 0);
  assert.equal(media.listenerCount('loadedmetadata'), 1);
  media.fire('loadedmetadata');
  assert.equal(media.currentTime, 30);
  assert.equal(media.playCalls, 1);
});
test('restoreMediaSession applies the settings but does not resume a different source', () => {
  const media = createFakeMedia({
    currentTime: 30,
    paused: false,
    muted: true,
    volume: 0.3,
    playbackRate: 2,
  });
  const session = captureMediaSession(createRoot(media));
  media.currentTime = 0;
  media.muted = false;
  media.volume = 1;
  media.playbackRate = 1;
  media.playCalls = 0;
  restoreMediaSession(session, { src: 'blob:lain' });
  assert.equal(media.muted, true);
  assert.equal(media.volume, 0.3);
  assert.equal(media.playbackRate, 2);
  assert.equal(media.currentTime, 0);
  assert.equal(media.playCalls, 0);
});
test('a rejected play() promise is swallowed without an unhandled rejection', async () => {
  const rejections = [];
  const onUnhandled = (reason) => { rejections.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const media = createFakeMedia({
      currentTime: 5,
      paused: false,
      play: () => {
        media.playCalls += 1;
        return Promise.reject(new Error('NotAllowedError'));
      },
    });
    const session = captureMediaSession(createRoot(media));
    restoreMediaSession(session, { src: 'blob:preview' });
    assert.equal(media.playCalls, 1);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    assert.equal(rejections.length, 0);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
test('restoreMediaSession attaches a catch handler to the play() promise', () => {
  let catchCalls = 0;
  const media = createFakeMedia({
    paused: false,
    play: () => ({
      catch: (fn) => {
        catchCalls += 1;
        fn(new Error('NotAllowedError'));
      },
    }),
  });
  const session = captureMediaSession(createRoot(media));
  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(catchCalls, 1);
});
test('restoreMediaSession clamps currentTime to a known shorter duration', () => {
  const media = createFakeMedia({ currentTime: 30, paused: true, duration: 10 });
  const session = captureMediaSession(createRoot(media));
  media.currentTime = 0;

  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(media.currentTime, 10);
});
test('restoreMediaSession keeps the position when the duration is unknown', () => {
  const media = createFakeMedia({ currentTime: 30, paused: true, duration: Infinity });
  const session = captureMediaSession(createRoot(media));
  media.currentTime = 0;
  restoreMediaSession(session, { src: 'blob:preview' });
  assert.equal(media.currentTime, 30);
});
test('restoreMediaSession ignores a session without an element', () => {
  assert.equal(restoreMediaSession(null, { src: 'blob:preview' }), undefined);
  assert.equal(restoreMediaSession({ element: null }, { src: 'blob:preview' }), undefined);
});