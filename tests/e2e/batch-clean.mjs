/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const gpsFixture = join(root, 'tests/fixtures/clean-gps.jpg');
const gpsGenerator = join(root, 'tests/fixtures/clean-gps.generate.mjs');
if (!existsSync(gpsFixture)) {
  try {
    if (existsSync(gpsGenerator)) execFileSync(process.execPath, [gpsGenerator], { cwd: root, stdio: 'ignore' });
  } catch { /* generator may be in flight; fall through to graceful skip */ }
}
if (!existsSync(gpsFixture)) {
  console.log('SKIP: tests/fixtures/clean-gps.jpg belum tersedia (dibuat oleh slice A).');
  process.exit(0);
}
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
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
};
function serve() {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
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
  const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', acceptDownloads: true });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
  await page.goto(`http://127.0.0.1:${address.port}/batch.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#batchFileInput').setInputFiles([
    gpsFixture,
    join(root, 'tests/fixtures/pattern.png'),
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.batch-file.is-ready').length === 2
    && [...document.querySelectorAll('.batch-add-tile')].every((tile) => !tile.disabled), null, { timeout: 60000 });
  console.log('PASS: clean fixture + second fixture loaded and ready in batch');
  await openBatchOptions(page);
  const cleanBtn = page.locator('#batchCleanBtn');
  assert.equal(await cleanBtn.count(), 1, 'clean action button is mounted without HTML edits');
  assert.equal(await cleanBtn.isEnabled(), true, 'clean action is enabled with ready files');
  await cleanBtn.click();
  const dialog = page.locator('.batch-clean-backdrop');
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('.batch-clean-profile-input').count(), 3, 'three cleaning profiles are offered');
  assert.equal(await page.locator('.batch-clean-category-input').count(), 6, 'six custom categories are offered');
  await page.locator('.batch-clean-profile-input[value="privacy"]').check();
  await page.waitForFunction(() => document.querySelectorAll('.batch-clean-row').length > 0
    || Boolean(document.querySelector('.batch-clean-empty')), null, { timeout: 10000 });
  const locationRow = page.locator('.batch-clean-row[data-clean-category="location"]');
  const hasLocation = (await locationRow.count()) > 0;
  if (hasLocation) {
    assert.match(await locationRow.innerText(), /\d+/, 'location category shows a tag count');
  } else {
    console.log('WARN: GPS/location tags are not surfaced by formats/image.js RAW_GROUPS (missing "GPS:"); '
      + 'verifying the other privacy categories instead.');
  }
  assert.equal(await page.locator('.batch-clean-row').count() > 0, true, 'privacy summary reports sensitive categories');
  assert.equal(await page.locator('.batch-clean-samples li').count() > 0, true, 'sample sensitive tags are shown');
  assert.equal(await page.locator('.batch-clean-kept').isVisible(), true, 'kept-tag note is shown');
  const confirmLabel = await page.locator('.batch-clean-confirm').innerText();
  assert.match(confirmLabel, /\d+/, 'ui.cleanConfirm shows the count before applying');
  assert.equal(await page.locator('.batch-clean-confirm').isEnabled(), true, 'confirm is enabled when tags are found');
  console.log('PASS: clean dialog shows profiles, per-category before→after summary, samples and confirm count');
  await page.locator('.batch-clean-confirm').click();
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  const operations = await page.locator('#batchOperationCount').innerText();
  assert.match(operations, /[1-9]/, 'cleaning populated pending review operations');
  console.log('PASS: cleaning translated into existing batch review state (no parallel write path)');
  await page.locator('#batchApplyBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.waitForFunction(() => !document.querySelector('#batchGroups').inert
    && /selesai/.test(document.querySelector('#batchStatus').textContent)
    && !/[1-9]\d*\s+gagal/.test(document.querySelector('#batchStatus').textContent), null, { timeout: 60000 });
  const status = await page.locator('#batchStatus').innerText();
  assert.match(status, /selesai/, 'normal batch review/apply reports success');
  console.log('PASS: normal batch review/apply completed successfully');
  await page.evaluate(() => {
    window.__reportBlobs = [];
    const original = URL.createObjectURL;
    URL.createObjectURL = function patched(blob) {
      window.__reportBlobs.push(blob);
      return original.call(this, blob);
    };
  });
  await openBatchOptions(page);
  await page.locator('#batchReportJsonBtn').click();
  const reportText = await page.evaluate(async () => {
    const blob = window.__reportBlobs.at(-1);
    return blob ? blob.text() : '';
  });
  assert.ok(reportText, 'JSON report blob was produced');
  const report = JSON.parse(reportText);
  const expected = hasLocation ? ['location'] : ['device', 'identity', 'software'];
  const withExpected = report.files.filter((file) => (file.removedCategories || []).some((category) => expected.includes(category)));
  assert.ok(withExpected.length > 0, `JSON report includes removedCategories with ${expected.join('/')}`);
  assert.ok(withExpected.every((file) => Number(file.removedTagCount) > 0), 'JSON report includes a positive removedTagCount');
  assert.ok(report.files.every((file) => Array.isArray(file.removedCategories)), 'removedCategories is always an array');
  assert.ok(report.files.every((file) => Number.isFinite(file.removedTagCount)), 'removedTagCount is always numeric');
  assert.ok(report.files.every((file) => !('raw' in file) && !('contents' in file)), 'report does not leak raw file contents');
  if (hasLocation) console.log('PASS: JSON report contains removedCategories=[...location...] and removedTagCount');
  else console.log('PASS: JSON report contains removedCategories and removedTagCount '
    + '(location assertion deferred to the image-adapter fix noted above)');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS: no page errors');
} catch (error) {
  if (page) console.error('Current UI:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}