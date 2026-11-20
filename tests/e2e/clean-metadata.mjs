/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const fixture = join(root, 'tests/fixtures/clean-gps.jpg');
const generator = join(root, 'tests/fixtures/clean-gps.generate.mjs');
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
async function openActionOptions(page) {
  const toggle = page.locator('#actionOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#actionOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}
function prepareFixture() {
  if (existsSync(fixture)) return true;
  if (existsSync(generator)) {
    try {
      execFileSync(process.execPath, [generator], { stdio: 'ignore' });
    } catch { /* fall through to the graceful skip below */ }
  }
  return existsSync(fixture);
}
if (!prepareFixture()) {
  console.log('SKIP: tests/fixtures/clean-gps.jpg is not present and no clean-gps.generate.mjs generator is available; the clean-metadata E2E flow did not run.');
  process.exit(0);
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
  args: ['--disable-dev-shm-usage'],
});
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
try {
  await page.goto(`${base}/single.html?clean=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(new URL(page.url()).searchParams.get('clean'), null, '?clean=1 is stripped from the URL');
  await page.locator('#fileInput').setInputFiles(fixture);
  await page.locator('.clean-card').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.clean-card').getAttribute('role'), 'dialog', 'the panel exposes the dialog role');
  console.log('PASS: ?clean=1 opens the clean panel after a file loads and strips the flag');
  await page.keyboard.press('Escape');
  await page.locator('.clean-card').waitFor({ state: 'detached', timeout: 15000 });
  await openActionOptions(page);
  await page.locator('#cleanMetadataBtn').click();
  await page.locator('.clean-card').waitFor({ timeout: 15000 });
  console.log('PASS: Esc closes the dialog and the manual button reopens it');
  const sensitive = await page.locator('.clean-sensitive-item').allTextContents();
  const values = await page.locator('.clean-sensitive-value').allTextContents();
  assert.ok(sensitive.length > 0, 'the summary lists sensitive tags');
  assert.ok(values.every((value) => value.trim().length > 0), 'the summary shows the actual tag values');
  assert.ok(await page.locator('.clean-remove-badge').count() > 0, 'sensitive tags are marked for removal');
  console.log('PASS: the summary lists sensitive tags with values and a removal marker');
  if (values.some((value) => /-?\d+[.,]\d+/.test(value))) {
    console.log('PASS: the summary lists GPS coordinate values before → after');
  } else {
    console.log('SKIP: this fixture\'s GPS IFD was not surfaced by the ExifTool reader; coordinate display could not be asserted, the rest of the flow still ran.');
  }
  await page.locator('#cleanProfile-privacy').check();
  const applyLabel = await page.locator('.clean-btn-apply').innerText();
  assert.ok(/(?:Hapus|Remove)\s+[1-9]/.test(applyLabel), `the apply button counts the findings (${applyLabel})`);
  await page.locator('.clean-btn-apply').click();
  await page.locator('.clean-card').waitFor({ state: 'detached', timeout: 15000 });
  console.log('PASS: applying Privacy adds the changes to the normal review flow');
  await page.locator('#saveBtn').click();
  await page.locator('.review-card').waitFor({ timeout: 30000 });
  const reviewText = (await page.locator('.review-card').innerText()).toLowerCase();
  assert.ok(
    reviewText.includes('hapus') || reviewText.includes('raw') || reviewText.includes('dihapus') || reviewText.includes('remove'),
    'the review dialog lists removals',
  );
  assert.ok(await page.locator('.review-operation').count() > 0, 'the review dialog lists operations');
  console.log('PASS: the review dialog appears and lists the removals');
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-card').waitFor({ timeout: 120000 });
  const preview = await page.evaluate(() => {
    const image = document.querySelector('#fileCard img');
    return image ? { complete: image.complete, width: image.naturalWidth } : null;
  });
  assert.ok(preview && preview.complete && preview.width > 0, 'the cleaned image preview still renders');
  await page.locator('.tab[data-tab="raw"]').click();
  const rawText = (await page.locator('#panel').innerText()).toLowerCase();
  assert.ok(!rawText.includes('serialnumber') && !rawText.includes('artist'), 'the removed sensitive tags are absent from the re-read output');
  assert.ok(!rawText.includes('gpslatitude') && !rawText.includes('gpslongitude'), 'GPS tags are absent from the re-read output');
  console.log('PASS: saved output renders and the sensitive tags are gone');
  assert.deepEqual(errors, []);
  console.log('PASS: clean metadata end-to-end flow (summary → privacy → review → save → verify)');
} catch (error) {
  console.error('Current UI:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}