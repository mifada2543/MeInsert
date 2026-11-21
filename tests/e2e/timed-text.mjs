/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Editor lirik/subtitle: add, mark, seek, preview, export and mobile layout.
// No upload: all media previews come from blob: URLs of the local file.
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log('SKIP timed-text: Chrome/Chromium tidak ditemukan.');
  process.exit(0);
}
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.gz', 'application/gzip'], ['.mp3', 'audio/mpeg'], ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
]);
const server = await createStaticServer({ root, contentTypes, traversalStatus: 403 });
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = await getBrowser({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ locale: 'id-ID', acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const tempDir = mkdtempSync(join(tmpdir(), 'meinsert-timed-text-'));
const audio = join(tempDir, 'tone.mp3');
const video = join(tempDir, 'clip.mp4');
const image = join(tempDir, 'pattern.png');
async function open(file) {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#fileInput').setInputFiles(file);
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''),
    null, { timeout: 120000 });
  await page.locator('#timedTextBtn').click();
  await page.locator('#timedTextDialog[open]').waitFor({ timeout: 10000 });
}
try {
  copyFileSync(join(root, 'tests/fixtures/tone.mp3'), audio);
  copyFileSync(join(root, 'tests/fixtures/clip.mp4'), video);
  copyFileSync(join(root, 'tests/fixtures/pattern.png'), image);
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('#fileInput').setInputFiles(image);
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''),
    null, { timeout: 120000 });
  if (!(await page.locator('#timedTextBtn').isHidden())) {
    throw new Error('Tombol Song lyrics masih muncul untuk berkas gambar.');
  }
  console.log('PASS: tombol Song lyrics tersembunyi untuk format bukan audio/video');

  await open(audio);
  const audioMode = await page.evaluate(() => ({
    mode: document.querySelector('#timedTextDialog')?.dataset.mode,
    badge: document.querySelector('.timed-text__badge')?.textContent,
    visibleTabs: [...document.querySelectorAll('.timed-text__tab')].filter((node) => !node.hidden).length,
    hasSvgControls: document.querySelectorAll('.timed-text__ctrl svg').length,
    accept: document.querySelector('.timed-text__file')?.accept,
  }));
  if (audioMode.mode !== 'lyrics' || audioMode.visibleTabs !== 1 || audioMode.hasSvgControls < 3 || !audioMode.accept.includes('.lrc')) {
    throw new Error(`Mode audio tidak sesuai: ${JSON.stringify(audioMode)}`);
  }
  const duplicateMarks = await page.evaluate(() => ['timedTextMarkTime', 'timedTextMarkStart', 'timedTextMarkEnd']
    .filter((id) => document.getElementById(id)));
  if (duplicateMarks.length) throw new Error(`Tombol mark duplikat masih ada: ${duplicateMarks.join(', ')}`);
  console.log('PASS: editor lirik terbuka, tanpa tombol mark duplikat', audioMode.badge);
  await page.locator('#timedTextAddLine').click();
  await page.locator('#timedTextRowsLyrics .timed-text__row').first().waitFor({ timeout: 5000 });
  const lineCount = await page.locator('#timedTextRowsLyrics .timed-text__row').count();
  if (lineCount < 1) throw new Error('Baris lirik tidak dibuat.');
  await page.locator('#timedTextRowsLyrics .timed-text__row .timed-text__text').first().fill('Lirik uji coba');
  const text = await page.locator('#timedTextRowsLyrics .timed-text__row .timed-text__text').first().inputValue();
  if (text !== 'Lirik uji coba') throw new Error('Teks lirik tidak tersimpan di state editor.');
  console.log('PASS: baris lirik bisa ditambah dan diedit');
  const seek = page.locator('.timed-text__seek');
  await seek.fill('50');
  await page.locator('#timedTextRowsLyrics .timed-text__row [data-action="mark-time"]').first().click();
  const stamp = await page.locator('#timedTextRowsLyrics .timed-text__time').first().inputValue();
  if (!/^\d{2}:\d{2}\.\d{2}$/.test(stamp)) throw new Error(`Stempel LRC tidak valid: ${stamp}`);
  console.log(`PASS: tombol mark di baris menulis stempel ${stamp}`);
  await page.locator('.timed-text__draft').waitFor({ state: 'visible', timeout: 5000 });
  console.log('PASS: draf tersimpan otomatis');
  await page.locator('.timed-text__close').click();
  await page.locator('#timedTextDialog[open]').waitFor({ state: 'hidden' });
  await open(audio);
  const restored = await page.locator('#timedTextRowsLyrics .timed-text__row .timed-text__text').first().inputValue();
  if (restored !== 'Lirik uji coba') throw new Error(`Draf tidak dipulihkan: ${restored}`);
  console.log('PASS: draf dipulihkan setelah dialog ditutup');

  const audioGear = await page.locator('#timedTextStyleLyrics').isVisible();
  if (audioGear) throw new Error('Tombol preferensi masih muncul pada format audio/LRC.');
  if ((await page.locator('#timedTextSave').innerText()).trim() !== 'Terapkan') {
    throw new Error('Tombol utama audio bukan Terapkan.');
  }
  console.log('PASS: audio/LRC tidak memiliki tombol preferensi warna');
  await page.locator('#timedTextSave').click();
  await page.locator('#timedTextDialog[open]').waitFor({ state: 'hidden' });
  console.log('PASS: Apply menutup dialog dan mengembalikan state ke editor');
  await open(video);
  const videoMode = await page.evaluate(() => ({
    mode: document.querySelector('#timedTextDialog')?.dataset.mode,
    badge: document.querySelector('.timed-text__badge')?.textContent,
    visibleTabs: [...document.querySelectorAll('.timed-text__tab')].filter((node) => !node.hidden).length,
    accept: document.querySelector('.timed-text__file')?.accept,
    exportVttHidden: document.querySelector('#timedTextExportVtt')?.hidden,
    exportLrcHidden: document.querySelector('#timedTextExportLrc')?.hidden,
  }));
  if (videoMode.mode !== 'subtitles' || videoMode.visibleTabs !== 1 || !videoMode.accept.includes('.vtt')
    || videoMode.exportVttHidden !== false || videoMode.exportLrcHidden !== true) {
    throw new Error(`Mode video tidak sesuai: ${JSON.stringify(videoMode)}`);
  }
  await page.locator('#timedTextAddCue').click();
  await page.locator('#timedTextRowsSubtitles .timed-text__row').first().waitFor({ timeout: 10000 });
  await page.locator('#timedTextRowsSubtitles .timed-text__row .timed-text__text').first().fill('Aku tunggu di halte tua');
  const layout = await page.evaluate(() => {
    const workspace = document.querySelector('.timed-text__workspace');
    const media = document.querySelector('.timed-text__video-frame video');
    const frame = document.querySelector('.timed-text__video-frame');
    const columns = getComputedStyle(workspace).gridTemplateColumns.trim().split(/\s+/);
    const ratio = media?.videoWidth && media?.videoHeight
      ? media.videoWidth / media.videoHeight : 0;
    const boxRatio = frame ? frame.getBoundingClientRect().width / frame.getBoundingClientRect().height : 0;
    return {
      columns: columns.length,
      ratio,
      boxRatio,
      fullscreen: Boolean(document.querySelector('#timedTextFullscreen')),
      compact: Boolean(document.querySelector('#timedTextCompact')),
    };
  });
  if (layout.columns !== 2 || !layout.fullscreen || !layout.compact) {
    throw new Error(`Layout video tidak sesuai: ${JSON.stringify(layout)}`);
  }
  if (layout.ratio && Math.abs(layout.boxRatio - layout.ratio) > 0.12) {
    throw new Error(`Rasio frame tidak adaptif: ${JSON.stringify(layout)}`);
  }
  console.log('PASS: workspace dua kolom adaptif + layar penuh', JSON.stringify(layout));
  await page.locator('#timedTextCompact').click();
  if (!(await page.locator('.timed-text__video-frame').isHidden())) throw new Error('Ciutkan pratinjau gagal.');
  await page.locator('#timedTextCompact').click();
  if (await page.locator('.timed-text__video-frame').isHidden()) throw new Error('Buka pratinjau gagal.');
  console.log('PASS: tombol ciutkan/buka pratinjau berfungsi');
  const overlay = page.locator('.timed-text__overlay');
  await overlay.waitFor({ state: 'attached' });
  await page.waitForFunction(() => !document.querySelector('.timed-text__overlay')?.hidden, null, { timeout: 5000 });
  const overlayText = await page.locator('.timed-text__overlay-text').innerText();
  if (!overlayText) throw new Error('Overlay subtitle kosong.');
  console.log('PASS: overlay subtitle tampil di pratinjau', JSON.stringify(overlayText));
  const panel = page.locator('.timed-text__style-panel');
  const confirm = page.locator('.timed-text__unsaved-notice');
  await page.locator('#timedTextStyleSubtitles').click();
  await panel.waitFor({ state: 'visible' });
  if (!(await page.locator('.timed-text__style-card').isVisible())) {
    throw new Error('Kartu preferensi tidak tampil.');
  }
  if (!(await page.locator('#timedTextAddCue').isVisible()) || !(await page.locator('#timedTextStyleSubtitles').isVisible())) {
    throw new Error('Toolbar + Baris/gear tidak tetap terlihat saat mode preferensi.');
  }
  const backdropStyle = await page.locator('.timed-text__style-backdrop').evaluate((node) => getComputedStyle(node).backdropFilter);
  if (backdropStyle !== 'none') throw new Error(`Backdrop seharusnya hanya gelap, bukan blur: ${backdropStyle}`);
  if ((await page.locator('#timedTextSave').innerText()).trim() !== 'Simpan preferensi') {
    throw new Error('Tombol utama tidak berubah menjadi Simpan preferensi.');
  }
  await panel.locator('[data-theme="yellow"]').click();
  const cueColor = await page.locator('.timed-text__video-frame').evaluate((node) => node.style.getPropertyValue('--tt-cue-color'));
  if (cueColor !== '#FFE066') throw new Error(`Pratinjau tidak mengikuti tema: ${cueColor}`);
  console.log('PASS: preferensi subtitle membuka card + backdrop gelap', cueColor);
  await page.locator('#timedTextSave').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('meinsert-timed-text-style-v1') || '{}'));
  if (saved.subtitles?.theme !== 'yellow') throw new Error(`Preferensi tidak tersimpan: ${JSON.stringify(saved)}`);
  if (await panel.isHidden()) throw new Error('Panel tertutup setelah Simpan preferensi.');
  console.log('PASS: tombol utama menyimpan preferensi subtitle dan panel tetap terbuka');
  await page.locator('#timedTextStyleSubtitles').click();
  if ((await page.locator('#timedTextSave').innerText()).trim() !== 'Terapkan') {
    throw new Error('Tombol utama tidak kembali menjadi Terapkan.');
  }
  await page.locator('#timedTextStyleSubtitles').click();
  await panel.locator('[data-theme="plain"]').click();
  const screenBox = await page.locator('.timed-text__screen').boundingBox();
  await page.mouse.click(screenBox.x + screenBox.width / 2, screenBox.y + screenBox.height / 2);
  await confirm.waitFor({ state: 'visible' });
  if (!/belum tersimpan/i.test(await confirm.innerText())) throw new Error('Konfirmasi belum tersimpan tidak muncul.');
  await confirm.locator('.timed-text__btn:not(.timed-text__btn--save)').click();
  await confirm.waitFor({ state: 'hidden' });
  const reverted = await page.locator('.timed-text__video-frame').evaluate((node) => node.style.getPropertyValue('--tt-cue-color'));
  if (reverted !== '#FFE066') throw new Error(`Batalkan tidak mengembalikan preferensi: ${reverted}`);
  console.log('PASS: klik di luar card meminta konfirmasi; Batalkan memulihkan preferensi');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => (
    globalThis.matchMedia?.('(orientation: portrait)')?.matches
    && !document.querySelector('.timed-text__rotate-hint')?.hidden
  ), null, { timeout: 5000 });
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    dialogWidth: document.querySelector('.timed-text')?.getBoundingClientRect().width || 0,
    columns: getComputedStyle(document.querySelector('.timed-text__workspace')).gridTemplateColumns.trim().split(/\s+/).length,
    portrait: globalThis.matchMedia?.('(orientation: portrait)')?.matches || false,
    rotateHint: !document.querySelector('.timed-text__rotate-hint')?.hidden,
  }));
  if (mobile.overflow > 1) throw new Error(`Horizontal scroll saat mobile: ${mobile.overflow}px`);
  if (mobile.columns !== 2 || !mobile.rotateHint) throw new Error(`Tampilan lanskap paksa gagal: ${JSON.stringify(mobile)}`);
  console.log('PASS: layout lanskap 2 kolom di HP portrait tanpa horizontal scroll', mobile);
  await open(audio);
  const reopened = await page.evaluate(() => ({
    mode: document.querySelector('#timedTextDialog')?.dataset.mode,
    styleMode: document.querySelector('#timedTextDialog')?.dataset.styleMode,
    panelHidden: document.querySelector('.timed-text__style-panel')?.hidden,
    backdropHidden: document.querySelector('.timed-text__style-backdrop')?.hidden,
    primary: document.querySelector('#timedTextSave')?.textContent.trim(),
    gearHidden: document.querySelector('#timedTextStyleLyrics')?.hidden,
  }));
  if (reopened.mode !== 'lyrics' || reopened.styleMode !== 'false' || !reopened.panelHidden
    || !reopened.backdropHidden || reopened.primary !== 'Terapkan' || !reopened.gearHidden) {
    throw new Error(`Preferensi video terbawa ke audio: ${JSON.stringify(reopened)}`);
  }
  console.log('PASS: preferensi tidak terbawa saat membuka audio setelah video');
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
  console.log('ALL timed-text editor scenarios passed');
} finally {
  await context.close();
  await browser.close();
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}