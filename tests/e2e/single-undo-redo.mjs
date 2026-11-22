/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = join(root, 'tests/fixtures');
const audioFixture = join(fixtures, 'tone-long.mp3');
const videoFixture = join(fixtures, 'clip-long-cover.mp4');
const coverFixture = join(fixtures, 'pattern.png');
const pdfFixture = join(fixtures, 'document.pdf');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
};
function serve() {
  return createStaticServer({ root, contentTypes, traversalStatus: 404 });
}
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to the browser executable path.');
  return found;
}
function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
function prepareFixtures() {
  const ffmpeg = hasFfmpeg();
  if (!existsSync(audioFixture) && ffmpeg) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=20',
      '-i', coverFixture,
      '-map', '0:a', '-map', '1:v', '-c:v', 'mjpeg', '-c:a', 'libmp3lame', '-id3v2_version', '3',
      '-metadata', 'title=MeInsert fixture', '-metadata', 'artist=MeInsert fixture',
      '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)',
      audioFixture], { stdio: 'ignore' });
  }
  if (!existsSync(videoFixture) && ffmpeg) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=teal:size=320x240:rate=25:duration=20',
      '-i', coverFixture,
      '-map', '0:v', '-map', '1:v', '-c:v:0', 'libx264', '-pix_fmt:v:0', 'yuv420p',
      '-c:v:1', 'mjpeg', '-disposition:v:1', 'attached_pic',
      '-metadata', 'title=MeInsert fixture', videoFixture], { stdio: 'ignore' });
  }
  return {
    audio: existsSync(audioFixture),
    video: existsSync(videoFixture),
    ffmpeg,
  };
}
async function openActionOptions(page) {
  const toggle = page.locator('#actionOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#actionOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}
const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await getBrowser({
  executablePath: findChrome(),
  headless: true,
  args: ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
async function openFixture(file) {
  await openActionOptions(page);
  const resetBtn = page.locator('#resetBtn');
  if (await resetBtn.count() && await resetBtn.isEnabled()) {
    await resetBtn.click();
    await page.waitForTimeout(200);
  }
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#fileInput').setInputFiles(file);
  await page.locator('#field-title').waitFor({ timeout: 60000 });
}
async function startMedia(selector) {
  const result = await page.evaluate(async (target) => {
    const media = document.querySelector(target);
    if (!media) return { error: 'media element not found' };
    window.__mediaNode = media;
    window.__frameNode = document.querySelector('#previewFrame');
    try {
      await media.play();
    } catch (error) {
      return { error: String(error) };
    }
    return { paused: media.paused, duration: media.duration };
  }, selector);
  assert.equal(result.error, undefined, `playback failed: ${result.error}`);
  await page.waitForFunction((target) => {
    const media = document.querySelector(target);
    return media && !media.paused && media.currentTime > 0.2;
  }, selector, { timeout: 30000 });
}
async function mediaState(selector) {
  return page.evaluate((target) => {
    const media = document.querySelector(target);
    return {
      same: media === window.__mediaNode,
      frameRebuilt: document.querySelector('#previewFrame') !== window.__frameNode,
      paused: media?.paused,
      time: media?.currentTime || 0,
    };
  }, selector);
}
try {
  const ready = prepareFixtures();
  const canPlayAudio = await page.evaluate(() => document.createElement('audio').canPlayType('audio/mpeg'));
  const canPlayVideo = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'));
  await openFixture(pdfFixture);
  assert.equal(await page.locator('#undoBtn').isDisabled(), true, 'undo starts disabled');
  assert.equal(await page.locator('#redoBtn').isDisabled(), true, 'redo starts disabled');
  const original = await page.locator('#field-title').inputValue();
  await page.locator('#field-title').fill('Judul hasil undo');
  await page.locator('#undoBtn').click();
  assert.equal(await page.locator('#field-title').inputValue(), original, 'undo restores the previous value');
  await page.locator('#redoBtn').click();
  assert.equal(await page.locator('#field-title').inputValue(), 'Judul hasil undo', 'redo re-applies the change');
  console.log('PASS: undo/redo buttons restore and re-apply a metadata field');
  await page.locator('#newFileBtn').click();
  await page.locator('.confirm-btn-confirm').waitFor({ timeout: 15000 });
  await page.locator('.confirm-btn-confirm').click();
  await page.locator('#fileInput').setInputFiles(pdfFixture);
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('#undoBtn').isDisabled(), true, 'a new file starts with an empty history');
  console.log('PASS: a new file starts with an empty undo history');
  const base = await page.locator('#field-title').inputValue();
  await page.locator('#field-title').fill('Judul keyboard');
  await page.locator('#field-title').blur();
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('#field-title').inputValue(), base, 'Ctrl+Z undoes the last change');
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await page.locator('#field-title').inputValue(), 'Judul keyboard', 'Ctrl+Shift+Z redoes the change');
  await page.locator('#field-title').fill('Judul kedua');
  await page.locator('#field-title').blur();
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('#field-title').inputValue(), 'Judul keyboard', 'Ctrl+Z undoes the second change');
  await page.keyboard.press('Control+y');
  assert.equal(await page.locator('#field-title').inputValue(), 'Judul kedua', 'Ctrl+Y redoes the undone change');
  console.log('PASS: Ctrl/Cmd+Z, Ctrl+Shift+Z and Ctrl+Y drive the undo stack');
  await page.locator('#field-title').fill('Teks lain');
  await page.locator('#field-title').focus();
  await page.evaluate(() => { window.__fieldNode = document.querySelector('#field-title'); });
  await page.keyboard.press('Control+z');
  assert.equal(
    await page.evaluate(() => document.querySelector('#field-title') === window.__fieldNode),
    true,
    'Ctrl+Z inside a field is left to the browser',
  );
  console.log('PASS: Ctrl+Z inside a field is not intercepted by the editor');
  await openFixture(pdfFixture);
  await openActionOptions(page);
  const originalName = await page.locator('#outputBase').inputValue();
  await page.locator('#outputBase').fill('renamed-output');
  assert.equal(await page.locator('#undoBtn').isEnabled(), true);
  await page.locator('#undoBtn').click();
  assert.equal(await page.locator('#outputBase').inputValue(), originalName);
  await page.locator('#redoBtn').click();
  assert.equal(await page.locator('#outputBase').inputValue(), 'renamed-output');
  const originalRows = await page.locator('.custom-row').count();
  await page.locator('.custom-head button').click();
  await page.locator('.custom-head button').click();
  assert.equal(await page.locator('.custom-row').count(), originalRows + 2);
  await page.locator('#undoBtn').click();
  assert.equal(await page.locator('.custom-row').count(), originalRows + 1);
  await page.locator('#undoBtn').click();
  assert.equal(await page.locator('.custom-row').count(), originalRows);
  console.log('PASS: filename-only edits enable Undo and repeated add-tag clicks undo independently');
  if (!ready.audio) {
    console.log('SKIP: no playable audio fixture (ffmpeg is unavailable and tests/fixtures/tone-long.mp3 is missing); the media playback checks did not run.');
  } else if (!canPlayAudio) {
    console.log('SKIP: this browser cannot decode audio/mpeg; the media playback checks did not run.');
  } else {
    await openFixture(audioFixture);
    assert.equal(await page.locator('.audio-cover img').count(), 1, 'the audio fixture carries a thumbnail');
    await startMedia('#fileCard audio');
    const before = await mediaState('#fileCard audio');
    await page.locator('#field-title').fill('Uji playback');
    await openActionOptions(page);
    await page.locator('#resetBtn').click();
    await page.waitForTimeout(400);
    const after = await mediaState('#fileCard audio');
    assert.equal(after.frameRebuilt, true, 'the preview card was rebuilt');
    assert.equal(after.same, true, 'the same <audio> node is still in the document');
    assert.equal(after.paused, false, 'the audio keeps playing after the discard');
    assert.ok(after.time >= before.time - 0.05, `the position did not jump backwards (${before.time} -> ${after.time})`);
    console.log('PASS: the audio element survives "Batalkan perubahan" and keeps playing');
    await page.locator('.audio-stage input[type=file]').setInputFiles(coverFixture);
    await page.waitForTimeout(400);
    const afterCover = await mediaState('#fileCard audio');
    assert.equal(afterCover.same, true, 'the same <audio> node survives a thumbnail change');
    assert.equal(afterCover.paused, false, 'the audio keeps playing after the thumbnail change');
    assert.ok(afterCover.time >= after.time - 0.05, 'the position did not jump backwards after the thumbnail change');
    console.log('PASS: changing the thumbnail does not stop the playback');
    await page.locator('#fileInput').setInputFiles(videoFixture);
    await page.locator('#fileCard video').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => /terbaca/.test(document.querySelector('#readStatus')?.textContent || ''), null, { timeout: 60000 });
    const switched = await page.evaluate(() => {
      const media = document.querySelector('#fileCard video, #fileCard audio');
      return { same: media === window.__mediaNode, paused: media.paused, time: media.currentTime };
    });
    assert.equal(switched.same, false, 'another file gets a new media element');
    assert.equal(switched.paused, true, 'the new media element starts paused');
    assert.equal(switched.time, 0, 'the new media element starts at the beginning');
    console.log('PASS: opening another file creates a fresh media element');
  }
  if (!ready.video) {
    console.log('SKIP: no playable video fixture (ffmpeg is unavailable and tests/fixtures/clip-long-cover.mp4 is missing); the video playback check did not run.');
  } else if (!canPlayVideo) {
    console.log('SKIP: this browser cannot decode H.264/MP4; the video playback check did not run.');
  } else {
    await openFixture(videoFixture);
    await startMedia('#fileCard video');
    const before = await mediaState('#fileCard video');
    await page.locator('#field-title').fill('Uji video');
    await openActionOptions(page);
    await page.locator('#resetBtn').click();
    await page.waitForTimeout(400);
    const after = await mediaState('#fileCard video');
    assert.equal(after.frameRebuilt, true, 'the preview card was rebuilt');
    assert.equal(after.same, true, 'the same <video> node is still in the document');
    assert.equal(after.paused, false, 'the video keeps playing after the discard');
    assert.ok(after.time >= before.time - 0.05, `the position did not jump backwards (${before.time} -> ${after.time})`);
    console.log('PASS: the video element survives "Batalkan perubahan" and keeps playing');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: single-file undo/redo and media continuity');
} catch (error) {
  console.error('Current UI:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}