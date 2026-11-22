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
const ACK_KEY = 'meinsert.policyAck';
const DAY = 86400000;
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
function intersects(a, b) {
  if (!a || !b) return false;
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
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
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
const card = page.locator('.policy-notice');
const ackButton = page.locator('.policy-notice__ack');
const visible = async () => (await page.locator('.policy-notice:visible').count()) > 0;
const setAck = (value) => page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [ACK_KEY, value]);
const changeLanguage = (language) => page.evaluate(async (value) => (await import('/assets/js/i18n/index.js')).setLanguage(value), language);
const cardColors = () => card.evaluate((node) => {
  const style = getComputedStyle(node);
  const title = getComputedStyle(node.querySelector('.policy-notice__title'));
  return { background: style.backgroundColor, color: style.color, titleColor: title.color };
});
try {
  await page.goto(`${base}/index.html`);
  await card.waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await card.getAttribute('role'), 'region');
  assert.equal(await card.locator('.policy-notice__title').count(), 1);
  assert.equal(await card.locator('.policy-notice__actions .policy-notice__ack').count(), 1);
  assert.deepEqual(
    await card.locator('.policy-notice__body a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
    ['./privacy.html', './Terms.html'],
  );
  for (const name of ['single.html', 'batch.html']) {
    await page.goto(`${base}/${name}`);
    assert.equal(await visible(), true, `${name} should show the notice before acknowledgement`);
  }
  for (const name of ['privacy.html', 'Terms.html']) {
    await page.goto(`${base}/${name}`);
    assert.equal(await card.count(), 0, `${name} must never mount the notice`);
  }
  console.log('PASS: notice appears on index/single/batch but never on privacy/Terms, with region role, title, two policy links and ack button');
  await page.goto(`${base}/index.html`);
  await card.waitFor({ state: 'visible' });
  await ackButton.click();
  await card.waitFor({ state: 'detached' });
  assert.notEqual(await page.evaluate((key) => localStorage.getItem(key), ACK_KEY), null, 'acknowledgement must be persisted');
  for (const name of ['single.html', 'batch.html']) {
    await page.goto(`${base}/${name}`);
    assert.equal(await visible(), false, `${name} must not show the notice after acknowledgement`);
  }
  console.log('PASS: acknowledging on index hides the notice on single and batch in the same context');
  await page.goto(`${base}/index.html`);
  assert.equal(await visible(), false);
  console.log('PASS: the acknowledgement survives a reload of index');
  await setAck(String(Date.now() - 31 * DAY));
  await page.goto(`${base}/single.html`);
  await card.waitFor({ state: 'visible' });
  await ackButton.click();
  await card.waitFor({ state: 'detached' });
  assert.equal(await visible(), false);
  console.log('PASS: a 31-day-old acknowledgement brings the notice back and can be acknowledged again');
  await setAck('garbage');
  await page.goto(`${base}/single.html`);
  await card.waitFor({ state: 'visible' });
  console.log('PASS: a corrupt acknowledgement value shows the notice without breaking the page');
  assert.equal((await ackButton.innerText()).trim(), 'Mengerti');
  await changeLanguage('en');
  await page.waitForFunction(() => document.querySelector('.policy-notice__ack')?.textContent.trim() === 'Got it');
  assert.equal((await ackButton.innerText()).trim(), 'Got it');
  await changeLanguage('id');
  await page.waitForFunction(() => document.querySelector('.policy-notice__ack')?.textContent.trim() === 'Mengerti');
  console.log('PASS: ack button translates live between ID "Mengerti" and EN "Got it", then restores ID');
  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  const before = await cardColors();
  await page.locator('#themeToggle').click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme !== theme, initialTheme);
  await card.waitFor({ state: 'visible' });
  const after = await cardColors();
  assert.notEqual(after.background, 'rgba(0, 0, 0, 0)', 'the card must have a non-transparent background');
  assert.notEqual(after.background, 'transparent');
  assert.notEqual(after.color, after.background, 'card text must differ from its background');
  assert.ok(
    before.background !== after.background || before.color !== after.color || before.titleColor !== after.titleColor,
    'card colors must follow the theme',
  );
  console.log(`PASS: notice stays visible and readable across themes (${initialTheme} -> ${await page.evaluate(() => document.documentElement.dataset.theme)}); background/color follow the theme`);
  await page.setViewportSize({ width: 390, height: 844 });
  await card.waitFor({ state: 'visible' });
  const boxes = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return { card: rect('.policy-notice'), ack: rect('.policy-notice__ack'), nav: rect('.header-nav') };
  });
  assert.ok(boxes.card.x <= 24, `card must sit on the left edge (x=${boxes.card.x})`);
  assert.ok(boxes.card.width <= 390, 'card must fit the mobile viewport');
  assert.equal(intersects(boxes.card, boxes.nav), false, 'card must not cover the bottom navigation');
  assert.equal(intersects(boxes.ack, boxes.nav), false, 'ack button must not be covered by the bottom navigation');
  await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
  await page.waitForFunction(() => document.body.classList.contains('is-editing'));
  await card.waitFor({ state: 'visible' });
  const editing = await page.evaluate(() => {
    const notice = document.querySelector('.policy-notice');
    const r = notice.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const bar = document.querySelector('.action-bar')?.getBoundingClientRect();
    return {
      hitIsCard: Boolean(hit && (hit === notice || notice.contains(hit))),
      hitClass: typeof hit?.className === 'string' ? hit.className : hit?.tagName || null,
      card: { x: r.x, y: r.y, right: r.right, bottom: r.bottom },
      bar: bar ? { x: bar.x, y: bar.y, right: bar.right, bottom: bar.bottom } : null,
    };
  });
  assert.equal(editing.hitIsCard, true, `card center must not be covered by the sticky action bar (hit: ${editing.hitClass})`);
  assert.equal(intersects(editing.card, editing.bar), false, 'card must not overlap the sticky action bar');
  console.log('PASS: mobile card is left aligned, clear of the bottom nav, and stays clickable above the sticky action bar while editing');
  assert.deepEqual(errors, [], `unexpected page errors: ${errors.join('; ')}`);
  console.log('PASS: no page errors during any policy notice scenario');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error('Current UI:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}