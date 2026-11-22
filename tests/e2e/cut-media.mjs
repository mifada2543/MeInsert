/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Media range cut: MP3/MP4 trim, precise-mode re-encode risk, undo/redo, offline guard.
// Downloaded files are measured with the vendored MediaBunny reader in Node — no ffprobe.
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { Input, ALL_FORMATS, BlobSource } from '../../assets/vendor/mediabunny.mjs';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = [process.env.CHROME_BIN, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log('SKIP cut-media: Chrome/Chromium tidak ditemukan.');
  process.exit(0);
}
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.gz', 'application/gzip'], ['.mp3', 'audio/mpeg'], ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'], ['.png', 'image/png'], ['.woff2', 'font/woff2'],
]);
const server = await createStaticServer({ root, contentTypes, traversalStatus: 403 });
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = await getBrowser({
  executablePath: chrome,
  headless: true,
  args: ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  locale: 'id-ID', acceptDownloads: true, serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
const rawWasmRequests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
page.on('request', (request) => {
  if (/\.wasm(?:[?#]|$)/i.test(request.url())) rawWasmRequests.push(request.url());
});
const tempDir = mkdtempSync(join(tmpdir(), 'meinsert-cut-'));
const audio = join(tempDir, 'tone.mp3');
const video = join(tempDir, 'clip.mp4');
const longVideo = join(tempDir, 'clip-long-cover.mp4');
const webm = join(tempDir, 'clip.webm');
async function openActionOptions() {
  const toggle = page.locator('#actionOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#actionOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}
async function loadFile(file) {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#fileInput').setInputFiles(file);
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''),
    null, { timeout: 120000 });
  await openActionOptions();
  await page.locator('#cutBtn').waitFor({ state: 'visible', timeout: 15000 });
}
async function openCut(file) {
  await loadFile(file);
  await page.locator('#cutBtn').click();
  await page.locator('#cutDialog[open]').waitFor({ timeout: 10000 });
}
async function setRange(start, end) {
  await page.locator('#cutStart').fill(start);
  await page.locator('#cutStart').blur();
  await page.locator('#cutEnd').fill(end);
  await page.locator('#cutEnd').blur();
  assert.ok(await page.locator('#cutDuration').count(), 'cut duration readout is present');
}
async function applyCut() {
  await page.locator('#cutApply').click();
  await page.locator('#cutDialog[open]').waitFor({ state: 'hidden', timeout: 15000 });
}
async function dirtyCount() {
  return page.locator('#dirtyState').evaluate((node) => {
    const raw = `${node.getAttribute('data-count') || ''} ${node.textContent || ''}`;
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : 0;
  });
}
async function waitForDirtyChange(previous, direction) {
  await page.waitForFunction(({ value, sign }) => {
    const node = document.querySelector('#dirtyState');
    const raw = `${node?.getAttribute('data-count') || ''} ${node?.textContent || ''}`;
    const match = raw.match(/\d+/);
    const current = match ? Number(match[0]) : 0;
    return sign > 0 ? current > value : current < value;
  }, { value: previous, sign: direction }, { timeout: 15000 });
}
async function saveAndDownload(label, { expectReview = false } = {}) {
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
  await page.locator('#saveBtn').click();
  const confirm = page.locator('.review-btn-confirm');
  const resultLink = page.locator('.result-download').first();
  if (expectReview) {
    await page.locator('.review-card').waitFor({ state: 'visible', timeout: 30000 });
  }
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      break;
    }
    if (await resultLink.isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await resultLink.waitFor({ state: 'visible', timeout: 120000 });
  await resultLink.evaluate((node) => node.click());
  const download = await downloadPromise;
  if (!download) {
    const status = await page.locator('#readStatus').textContent().catch(() => '(no status)');
    await page.evaluate(() => { const node = document.querySelector('.result-integrity'); if (node) node.open = true; });
    const details = await page.locator('.result-card').innerText().catch(() => '(no result card)');
    throw new Error(`download not captured for ${label}; status=${status}; page errors=${errors.join(' | ') || '(none)'}\n${details}`);
  }
  const saved = join(tempDir, `${label}-result${extname(download.suggestedFilename()) || '.bin'}`);
  await download.saveAs(saved);
  return saved;
}
async function inspect(path) {
  const input = new Input({ source: new BlobSource(new Blob([readFileSync(path)])), formats: ALL_FORMATS });
  const duration = await input.computeDuration();
  const tags = await input.getMetadataTags();
  return { duration, title: tags.title };
}
try {
  copyFileSync(join(root, 'tests/fixtures/tone.mp3'), audio);
  copyFileSync(join(root, 'tests/fixtures/clip.mp4'), video);
  copyFileSync(join(root, 'tests/fixtures/clip-long-cover.mp4'), longVideo);
  copyFileSync(join(root, 'tests/fixtures/clip.webm'), webm);
  await openCut(audio);
  await setRange('00:00.000', '00:00.150');
  await applyCut();
  const audioResult = await inspect(await saveAndDownload('audio', { expectReview: true }));
  assert.ok(Math.abs(audioResult.duration - 0.15) <= 0.06,
    `audio cut duration out of range: ${audioResult.duration}`);
  assert.ok(typeof audioResult.title === 'string' && audioResult.title.trim().length > 0,
    'audio title metadata is still readable');
  console.log(`PASS: MP3 cut 0–0.15 → ${audioResult.duration.toFixed(3)}s, title="${audioResult.title}"`);
  await openCut(longVideo);
  await setRange('00:00.000', '00:01.000');
  await applyCut();
  const videoResult = await inspect(await saveAndDownload('video'));
  assert.ok(Math.abs(videoResult.duration - 1) <= 0.08,
    `video cut duration out of range: ${videoResult.duration}`);
  assert.deepEqual(rawWasmRequests, [], `raw .wasm requested: ${rawWasmRequests.join(', ')}`);
  console.log(`PASS: MP4 cut 0–1 → ${videoResult.duration.toFixed(3)}s, no raw WASM request`);
  await openCut(webm);
  await page.locator('input[name="cutMode"][value="precise"]').check();
  await setRange('00:00.000', '00:00.200');
  await applyCut();
  await page.locator('#saveBtn').click();
  await page.locator('.review-card').waitFor({ state: 'visible', timeout: 30000 });
  const reviewText = await page.locator('.review-card').innerText();
  assert.match(reviewText, /transcod|transkode|transnod|re-?encode|CUT_TRANSNODE|risiko|risk/i,
    `precise cut did not surface the re-encode risk: ${reviewText}`);
  await page.locator('.review-btn-confirm').click();
  try {
    await page.locator('.result-card').waitFor({ timeout: 120000 });
  } catch {
    const status = await page.locator('#readStatus').textContent().catch(() => '(no status)');
    const toast = await page.locator('.toast').allInnerTexts().catch(() => []);
    throw new Error(`precise WebM cut produced no result; status=${status}; toasts=${toast.join(' | ')}; errors=${errors.join(' | ') || '(none)'}`);
  }
  console.log('PASS: WebM precise cut warns about transcoding in review');
  await openCut(video);
  const beforeCut = await dirtyCount();
  await setRange('00:00.000', '00:00.150');
  await applyCut();
  const afterCut = await dirtyCount();
  assert.ok(afterCut > beforeCut, `dirty count did not grow after cut: ${beforeCut} → ${afterCut}`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await waitForDirtyChange(afterCut, -1);
  const afterUndo = await dirtyCount();
  await page.keyboard.press('Control+Shift+z');
  await waitForDirtyChange(afterUndo, 1);
  console.log(`PASS: cut undo/redo dirty count ${beforeCut} → ${afterCut} → ${afterUndo} → ${await dirtyCount()}`);
  await loadFile(audio);
  await context.setOffline(true);
  assert.equal(await page.locator('#cutBtn').isVisible(), true, 'cut button remains visible offline');
  await page.locator('#cutBtn').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#cutDialog[open]').count(), 0, 'offline click must not open the cut dialog');
  const toastText = await page.locator('#toastRegion').innerText().catch(() => '');
  assert.match(toastText, /offline|luring|koneksi|jaringan|network|terhubung|online/i,
    `offline cut toast is missing: ${toastText}`);
  await context.setOffline(false);
  console.log('PASS: offline cut click is blocked with an offline toast');
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
  console.log('ALL cut-media scenarios passed');
} finally {
  await context.close();
  await browser.close();
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}