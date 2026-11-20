/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
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
function barGeometry(page, selector) {
  return page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      visible: rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0,
      scrollY: window.scrollY,
    };
  }, selector);
}
async function scrollToEnd(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
}
const server = await serve();
let browser;
try {
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'local server started');
  const base = `http://127.0.0.1:${address.port}`;
  browser = await getBrowser({
    executablePath: findChrome(),
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ locale: 'id-ID', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.querySelector('#actionBar')).position),
    'fixed',
    'the single editor action bar is pinned on mobile',
  );
  const actionToggle = page.locator('#actionOptionsToggle');
  assert.equal(await actionToggle.isVisible(), true, 'the Options toggle is visible in the compact bar');
  assert.equal(await page.locator('#actionOptions').isVisible(), false, 'the Options panel starts hidden');
  assert.equal(await actionToggle.getAttribute('aria-expanded'), 'false', 'the toggle starts collapsed');
  assert.equal(await page.locator('#saveBtn').isVisible(), true, 'Save stays visible in the compact bar');
  assert.equal(await page.locator('.action-summary').isVisible(), true, 'the compact status stays visible');
  console.log('PASS: single action bar is compact/pinned, options folded, save + summary visible');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const singleTop = await barGeometry(page, '#actionBar');
  await scrollToEnd(page);
  const singleBottom = await barGeometry(page, '#actionBar');
  assert.ok(singleTop && singleBottom, 'the action bar exists at both scroll positions');
  assert.ok(singleTop.scrollY === 0 && singleBottom.scrollY > 0, 'the editor page actually scrolled');
  assert.ok(
    Math.abs(singleTop.bottom - singleBottom.bottom) <= 2,
    `the action bar bottom moved while scrolling (${singleTop.bottom} -> ${singleBottom.bottom})`,
  );
  assert.equal(singleTop.visible, true, 'the action bar is visible at the top of the page');
  assert.equal(singleBottom.visible, true, 'the action bar is visible at the bottom of the page');
  console.log('PASS: single action bar stays pinned and visible from top to bottom of the page');
  await actionToggle.click();
  assert.equal(await page.locator('#actionOptions').isVisible(), true, 'the Options panel opens');
  assert.equal(await actionToggle.getAttribute('aria-expanded'), 'true', 'the toggle reports expanded');
  assert.equal(await page.locator('#actionOptions.is-open').count(), 1, 'the open panel carries .is-open');
  assert.equal(await page.locator('#resetBtn').isVisible(), true, 'Reset is reachable inside the panel');
  assert.equal(await page.locator('#outputBase').isVisible(), true, 'the output name field is reachable inside the panel');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.support-item')).transform), 'none');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.policy-notice')).visibility), 'hidden');
  console.log('PASS: Options panel opens cleanly with no overlapping layers');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#actionOptions').isVisible(), false, 'Escape closes the Options panel');
  assert.equal(await actionToggle.getAttribute('aria-expanded'), 'false', 'Escape collapses the toggle');
  await page.waitForFunction(
    () => document.activeElement?.id === 'actionOptionsToggle',
    null,
    { timeout: 3000 },
  );
  console.log('PASS: Escape closes the Options panel and restores focus to its toggle');
  await actionToggle.click();
  assert.equal(await page.locator('#actionOptions').isVisible(), true, 'the Options panel reopens');
  await page.locator('#readStatus').click();
  assert.equal(await page.locator('#actionOptions').isVisible(), false, 'an outside click closes the Options panel');
  console.log('PASS: clicking outside closes the Options panel');
  await scrollToEnd(page);
  const singleOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    singleOverflow.scrollWidth <= singleOverflow.innerWidth,
    `single editor overflows horizontally (${JSON.stringify(singleOverflow)})`,
  );
  const lastControl = await page.evaluate(() => {
    const bar = document.querySelector('#actionBar');
    const controls = [
      ...document.querySelectorAll('#panel input:not([type="hidden"]), #panel textarea, #panel select'),
    ].filter((node) => !node.disabled && node.getClientRects().length > 0);
    if (!controls.length) return { error: 'no editor controls found' };
    const target = controls[controls.length - 1];
    return {
      bottom: target.getBoundingClientRect().bottom,
      barTop: bar.getBoundingClientRect().top,
      scrollY: window.scrollY,
    };
  });
  assert.ok(!lastControl.error, lastControl.error);
  assert.ok(lastControl.scrollY > 0, 'the page scrolled to its end');
  assert.ok(
    lastControl.bottom <= lastControl.barTop + 2,
    `the last editor control is covered by the pinned bar (${JSON.stringify(lastControl)})`,
  );
  console.log('PASS: no horizontal overflow and bottom padding keeps the last editor control above the pinned bar');
  await page.goto(`${base}/batch.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#batchFileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
  await page.waitForSelector('.batch-group', { timeout: 60000 });
  assert.equal(
    await page.locator('.batch-footer').evaluate((node) => getComputedStyle(node).position),
    'fixed',
    'the batch footer is pinned on mobile',
  );
  const batchToggle = page.locator('#batchOptionsToggle');
  const apply = page.locator('#batchApplyBtn');
  assert.equal(await batchToggle.isVisible(), true, 'the batch Options toggle is visible');
  assert.equal(await page.locator('#batchOptions').isVisible(), false, 'the batch Options panel starts hidden');
  assert.equal(await batchToggle.getAttribute('aria-expanded'), 'false', 'the batch toggle starts collapsed');
  assert.equal(await apply.isVisible(), true, 'Apply stays visible while options are folded');
  console.log('PASS: batch footer is compact/pinned, options folded, Apply visible');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const batchTop = await barGeometry(page, '.batch-footer');
  await scrollToEnd(page);
  const batchBottom = await barGeometry(page, '.batch-footer');
  assert.ok(batchTop && batchBottom, 'the batch footer exists at both scroll positions');
  assert.ok(
    Math.abs(batchTop.bottom - batchBottom.bottom) <= 2,
    `the batch footer bottom moved while scrolling (${batchTop.bottom} -> ${batchBottom.bottom})`,
  );
  assert.equal(batchBottom.visible, true, 'the batch footer remains visible while scrolling');
  console.log('PASS: batch footer stays pinned and visible from top to bottom of the page');
  await batchToggle.click();
  assert.equal(await page.locator('#batchOptions').isVisible(), true, 'the batch Options panel opens');
  assert.equal(await batchToggle.getAttribute('aria-expanded'), 'true', 'the batch toggle reports expanded');
  assert.equal(await page.locator('#batchOptions.is-open').count(), 1, 'the open batch panel carries .is-open');
  assert.equal(await page.locator('#batchStopAfter').isVisible(), true, 'the stop-after input is reachable in the panel');
  assert.equal(await apply.isVisible(), true, 'Apply stays visible while the panel is open');
  console.log('PASS: batch Options panel opens with aria-expanded, .is-open and Apply still visible');
  await batchToggle.click();
  assert.equal(await page.locator('#batchOptions').isVisible(), false, 'the batch Options panel closes');
  assert.equal(await apply.isVisible(), true, 'Apply is still visible after the panel closes');
  console.log('PASS: batch Options panel closes and Apply remains visible');
  const batchOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    batchOverflow.scrollWidth <= batchOverflow.innerWidth,
    `batch page overflows horizontally (${JSON.stringify(batchOverflow)})`,
  );
  console.log('PASS: no horizontal overflow on the batch page (mobile)');
  assert.deepEqual(errors, [], `page errors:\n${errors.join('\n')}`);
  console.log('PASS: no page errors during the compact action bar checks');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}