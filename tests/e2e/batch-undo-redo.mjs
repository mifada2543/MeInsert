/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
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
async function openBatchOptions(page) {
  const toggle = page.locator('#batchOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#batchOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}
const server = await serve();
let browser;
let page;
try {
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'local server started');
  browser = await getBrowser({
    executablePath: findChrome(),
    headless: true,
    args: ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block' });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
  await page.goto(`http://127.0.0.1:${address.port}/batch.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#batchFileInput').setInputFiles([
    join(root, 'tests/fixtures/pattern.png'),
    join(root, 'tests/fixtures/document.pdf'),
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.batch-group').length === 2
    && document.querySelectorAll('.batch-file.is-ready').length === 2
    && [...document.querySelectorAll('.batch-add-tile')].every((tile) => !tile.disabled), null, { timeout: 60000 });
  const png = page.locator('.batch-group[data-group-key^="image:"]');
  const pdf = page.locator('.batch-group[data-group-key^="pdf:"]');
  const title = (group) => group.locator('[data-field-id="title"] .field-input');
  const undo = (group) => group.locator('[data-group-action="undo"]');
  const redo = (group) => group.locator('[data-group-action="redo"]');
  const remove = png.locator('[data-field-id="title"] .batch-remove-toggle');
  for (const group of [png, pdf]) {
    assert.equal(await undo(group).isDisabled(), true, 'undo starts disabled');
    assert.equal(await redo(group).isDisabled(), true, 'redo starts disabled');
  }
  await title(png).fill('PNG edit');
  await title(pdf).fill('PDF edit');
  await title(pdf).evaluate((input) => { window.__pdfTitle = input; });
  await undo(png).click();
  assert.equal(await title(png).inputValue(), '');
  assert.equal(await title(pdf).inputValue(), 'PDF edit', 'PNG undo leaves PDF value untouched');
  assert.equal(await title(pdf).evaluate((input) => input === window.__pdfTitle), true, 'PDF form was not rebuilt');
  await redo(png).click();
  assert.equal(await title(png).inputValue(), 'PNG edit');
  await undo(pdf).click();
  assert.equal(await title(pdf).inputValue(), '');
  assert.equal(await title(png).inputValue(), 'PNG edit', 'PDF undo leaves PNG value untouched');
  await redo(pdf).click();
  console.log('PASS: PNG and PDF undo/redo stacks are independent');
  await remove.click();
  await remove.click();
  assert.equal(await remove.getAttribute('aria-pressed'), 'false');
  await undo(png).click();
  assert.equal(await remove.getAttribute('aria-pressed'), 'true', 'undo second click restores removal');
  assert.equal(await title(png).isDisabled(), true);
  await undo(png).click();
  assert.equal(await remove.getAttribute('aria-pressed'), 'false', 'undo first click restores original flag');
  assert.equal(await title(png).isEnabled(), true);
  assert.equal(await title(png).inputValue(), 'PNG edit');
  console.log('PASS: repeated remove clicks are separate history entries');
  await title(png).fill('First typing session');
  await title(png).fill('First typing session complete');
  await title(png).blur();
  await title(png).fill('Second typing session');
  await title(png).blur();
  await undo(png).click();
  assert.equal(await title(png).inputValue(), 'First typing session complete', 'blur separates typing sessions');
  await undo(png).click();
  assert.equal(await title(png).inputValue(), 'PNG edit', 'typing within a session stays coalesced');
  assert.equal(await title(pdf).inputValue(), 'PDF edit');
  console.log('PASS: blur closes typing coalescing');
  const clear = png.locator('.batch-form-head button');
  await clear.click();
  assert.equal(await title(png).inputValue(), '');
  await undo(png).click();
  assert.equal(await title(png).inputValue(), 'PNG edit', 'clear input is undoable');
  await redo(png).click();
  await clear.click();
  await undo(png).click();
  assert.equal(await title(png).inputValue(), '', 'repeated clear is a separate discrete action');
  await undo(png).click();
  assert.equal(await title(png).inputValue(), 'PNG edit');
  console.log('PASS: clear actions remain discrete and undoable');
  await page.evaluate(() => {
    window.__busyHistoryStates = [];
    const groups = document.querySelector('#batchGroups');
    new MutationObserver(() => {
      if (groups.inert) window.__busyHistoryStates.push(
        [...groups.querySelectorAll('[data-group-action]')].every((button) => button.disabled),
      );
    }).observe(groups, { attributes: true, subtree: true, attributeFilter: ['inert', 'disabled'] });
  });
  await page.locator('#batchApplyBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.waitForFunction(() => !document.querySelector('#batchGroups').inert
    && /2 selesai/.test(document.querySelector('#batchStatus').textContent), null, { timeout: 60000 });
  assert.equal(await page.locator('#batchGroups').evaluate((node) => node.inert), false);
  const busyStates = await page.evaluate(() => window.__busyHistoryStates);
  assert.ok(busyStates.length > 0 && busyStates.every(Boolean), 'busy syncApply disables all history buttons');
  for (const group of [png, pdf]) {
    assert.equal(await undo(group).isDisabled(), true, 'successful save clears undo');
    assert.equal(await redo(group).isDisabled(), true, 'successful save clears redo');
  }
  await title(png).fill('Edit after saving');
  assert.equal(await undo(png).isEnabled(), true, 'history re-enables after busy state');
  assert.equal(await undo(pdf).isDisabled(), true);
  console.log('PASS: successful saves clear histories and busy transitions refresh buttons');
  await title(pdf).fill('PDF retry edit');
  await page.evaluate(async () => {
    const { BatchProcessor } = await import('/assets/js/batch/batch-processor.js');
    const writeItem = BatchProcessor.prototype.writeItem;
    BatchProcessor.prototype.writeItem = function (item, ...args) {
      if (item.detection.id === 'pdf') throw new Error('Intentional PDF write failure');
      return writeItem.call(this, item, ...args);
    };
  });
  await page.locator('#batchApplyBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.waitForFunction(() => !document.querySelector('#batchGroups').inert
    && /1 selesai · 1 gagal/.test(document.querySelector('#batchStatus').textContent), null, { timeout: 60000 });
  assert.equal(await undo(png).isDisabled(), true, 'successful PNG group history is cleared');
  assert.equal(await undo(pdf).isEnabled(), true, 'failed PDF group history is retained');
  assert.equal(await title(pdf).inputValue(), 'PDF retry edit', 'failure leaves pending input intact');
  await undo(pdf).click();
  assert.equal(await title(pdf).inputValue(), 'PDF edit', 'failed edit remains undoable');
  assert.equal(await pdf.locator('.batch-file.is-error').count(), 1, 'undo does not hide file failure');
  await openBatchOptions(page);
  assert.equal(await page.locator('#batchRetryBtn').isVisible(), true, 'failure remains available for retry');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS: partial failures retain affected histories and visible errors; no page errors');
} catch (error) {
  if (page) console.error('Current UI:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}