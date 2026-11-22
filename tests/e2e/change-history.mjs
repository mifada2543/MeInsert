/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Change history: field / lyric / cut entries, undoable rollback, distinct 16px action icons.
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const chrome = [process.env.CHROME_BIN, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((candidate) => existsSync(candidate));
if (!chrome) {
  console.log('SKIP change-history: Chrome/Chromium tidak ditemukan.');
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
const browser = await getBrowser();
const context = await browser.newContext({
  locale: 'id-ID', acceptDownloads: true, serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
const tempDir = mkdtempSync(join(tmpdir(), 'meinsert-change-history-'));
const audio = join(tempDir, 'tone.mp3');

async function openActionOptions() {
  const toggle = page.locator('#actionOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#actionOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function loadFile() {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#fileInput').setInputFiles(audio);
  await page.waitForFunction(() => /tag terbaca/.test(document.querySelector('#readStatus')?.textContent || ''),
    null, { timeout: 120000 });
  await openActionOptions();
}

async function openHistory() {
  const dialog = page.locator('.history-dialog[open]');
  if (!(await dialog.count())) await page.locator('#historyBtn').click();
  await dialog.waitFor({ timeout: 10000 });
}

async function closeHistory() {
  const dialog = page.locator('.history-dialog[open]');
  if (!(await dialog.count())) return;
  await page.keyboard.press('Escape');
  try {
    await dialog.waitFor({ state: 'hidden', timeout: 3000 });
  } catch {
    const close = page.locator('.history-dialog .history-close, .history-dialog [data-action="close"], .history-dialog button[aria-label*="utup"], .history-dialog button[aria-label*="lose"]').first();
    if (await close.count()) await close.click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  }
}

async function historyEntryTexts() {
  return page.locator('.history-entry').allInnerTexts();
}

async function dirtySnapshot() {
  return page.locator('#dirtyState').evaluate((node) => `${node.getAttribute('data-count') || ''}|${node.textContent || ''}`);
}

async function waitForDirtyChange(previous) {
  await page.waitForFunction((prev) => {
    const node = document.querySelector('#dirtyState');
    return `${node?.getAttribute('data-count') || ''}|${node?.textContent || ''}` !== prev;
  }, previous, { timeout: 15000 });
}

try {
  copyFileSync(join(root, 'tests/fixtures/tone.mp3'), audio);
  await loadFile();
  const initialTitle = await page.locator('#field-title').inputValue();

  // 1. Field change is recorded in the history dialog.
  await page.locator('#field-title').fill('Judul Histori');
  await page.locator('#field-title').blur();
  await openHistory();
  assert.equal(await page.locator('.history-dialog').isVisible(), true, 'history dialog opens');
  const fieldTexts = await historyEntryTexts();
  assert.ok(fieldTexts.length > 0, 'history has at least one entry after a field change');
  assert.ok(fieldTexts.some((text) => /judul|field/i.test(text)),
    `field-change entry is missing: ${JSON.stringify(fieldTexts)}`);
  console.log('PASS: perubahan field tercatat di dialog riwayat');
  await closeHistory();

  // 2. Lyric / subtitle change is recorded.
  await page.locator('#timedTextBtn').click();
  await page.locator('#timedTextDialog[open]').waitFor({ timeout: 10000 });
  await page.locator('#timedTextAddLine').click();
  await page.locator('#timedTextRowsLyrics .timed-text__row .timed-text__text').first().waitFor({ timeout: 10000 });
  await page.locator('#timedTextRowsLyrics .timed-text__row .timed-text__text').first().fill('Lirik histori uji coba');
  await page.locator('#timedTextSave').click();
  await page.locator('#timedTextDialog[open]').waitFor({ state: 'hidden', timeout: 10000 });
  await openHistory();
  const lyricTexts = await historyEntryTexts();
  assert.ok(lyricTexts.some((text) => /lirik|lyric|subtitle/i.test(text)),
    `lyric/subtitle entry is missing: ${JSON.stringify(lyricTexts)}`);
  console.log('PASS: perubahan lirik/subtitle tercatat di dialog riwayat');

  // 3. Cut change is recorded.
  await closeHistory();
  await page.locator('#cutBtn').click();
  await page.locator('#cutDialog[open]').waitFor({ timeout: 10000 });
  await page.locator('#cutStart').fill('00:00.000');
  await page.locator('#cutStart').blur();
  await page.locator('#cutEnd').fill('00:00.150');
  await page.locator('#cutEnd').blur();
  await page.locator('#cutApply').click();
  await page.locator('#cutDialog[open]').waitFor({ state: 'hidden', timeout: 15000 });
  await openHistory();
  const cutTexts = await historyEntryTexts();
  assert.ok(cutTexts.some((text) => /potong|cut|trim/i.test(text)),
    `cut entry is missing: ${JSON.stringify(cutTexts)}`);
  console.log('PASS: perubahan potong tercatat di dialog riwayat');

  // 4. Undoable rollback of the oldest (field) entry.
  const fieldEntry = page.locator('.history-entry').filter({ hasText: /judul|field/i }).first();
  assert.ok(await fieldEntry.count(), 'field entry is available for rollback');
  const dirtyBeforeRollback = await dirtySnapshot();
  await fieldEntry.locator('.history-rollback').click();
  const confirmCard = page.locator('.confirm-card');
  await confirmCard.waitFor({ state: 'visible', timeout: 10000 });
  assert.match(await confirmCard.innerText(), /konfirmasi|confirm|rollback|kembal|yakin/i,
    'rollback confirmation card shows a confirmation message');
  await confirmCard.locator('.confirm-btn-confirm').click();
  await page.waitForFunction((original) => document.querySelector('#field-title')?.value === original,
    initialTitle, { timeout: 15000 });
  assert.equal(await page.locator('#field-title').inputValue(), initialTitle,
    'rollback restores the original field value');
  await waitForDirtyChange(dirtyBeforeRollback);
  console.log('PASS: rollback entri field mengembalikan nilai awal dan mengubah dirty state');

  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => document.querySelector('#field-title')?.value === 'Judul Histori',
    null, { timeout: 15000 });
  assert.equal(await page.locator('#field-title').inputValue(), 'Judul Histori',
    'Ctrl+Z undoes the rollback and restores the pre-rollback field value');
  await openHistory();
  const undoneTexts = await historyEntryTexts();
  assert.ok(undoneTexts.some((text) => /lirik|lyric|subtitle/i.test(text)),
    `lyrics still present after undo: ${JSON.stringify(undoneTexts)}`);
  assert.ok(undoneTexts.some((text) => /potong|cut|trim/i.test(text)),
    `cut still present after undo: ${JSON.stringify(undoneTexts)}`);
  console.log('PASS: Ctrl+Z membatalkan rollback; lirik dan potong tetap ada');
  await closeHistory();

  // 5. Action icons are distinct and both render at 16x16.
  await openActionOptions();
  const icons = await page.evaluate(() => ({
    lyric: document.querySelector('#timedTextBtn .icon')?.innerHTML ?? null,
    cut: document.querySelector('#cutBtn .icon')?.innerHTML ?? null,
  }));
  assert.ok(icons.lyric, '#timedTextBtn .icon exists');
  assert.ok(icons.cut, '#cutBtn .icon exists');
  assert.notEqual(icons.lyric, icons.cut, 'lyric and cut action icons use different markup');
  for (const selector of ['#timedTextBtn .icon', '#cutBtn .icon']) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box, `${selector} has a bounding box`);
    assert.ok(Math.abs(box.width - 16) <= 0.5, `${selector} width ~16px (got ${box.width})`);
    assert.ok(Math.abs(box.height - 16) <= 0.5, `${selector} height ~16px (got ${box.height})`);
  }
  console.log('PASS: ikon lirik dan potong berbeda dan berukuran 16x16');

  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
  console.log('ALL change-history scenarios passed');
} finally {
  await context.close();
  await browser.close();
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
}
