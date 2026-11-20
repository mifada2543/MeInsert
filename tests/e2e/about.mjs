/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleCss } from '../../scripts/build-css.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.woff2', 'font/woff2'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.md', 'text/plain; charset=utf-8'],
]);
const freshCss = await bundleCss();
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/assets/css/app.bundle.css') {
    response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
    response.end(freshCss);
    return;
  }
  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': types.get(extname(filePath)) || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
});
await new Promise((resolve, reject) => {
  server.on('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const executablePath = [process.env.CHROME_BIN, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find(existsSync);
const browser = await getBrowser({ executablePath, headless: true, args: ['--disable-dev-shm-usage'] });
const errors = [];
let desktopContext;
let mobileContext;
try {
  desktopContext = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block' });
  desktopContext.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  const page = await desktopContext.newPage();
  const response = await page.goto(`${base}/about.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => document.documentElement.lang === 'id');
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  console.log('PASS: about.html loads without page errors and declares the CSP meta');
  assert.equal(await page.locator('#aboutLink').getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('main a[href="./privacy.html"]').count() > 0, true);
  assert.equal(await page.locator('main a[href="./Terms.html"]').count() > 0, true);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://meinsert.my.id/about.html');
  console.log('PASS: About chrome, canonical URL and policy links are present');
  const desktop = await page.evaluate(() => {
    const hero = document.querySelector('.hero-copy').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.about-card')].map((card) => {
      const rect = card.getBoundingClientRect();
      return { x: Math.round(rect.x), width: Math.round(rect.width) };
    });
    const format = document.querySelector('.about-card-formats').getBoundingClientRect();
    return {
      heroWidth: Math.round(hero.width),
      columns: new Set(cards.map((card) => card.x)).size,
      formatFullWidth: format.width > hero.width,
      batchIcon: document.querySelector('[data-nav="batch"] .nav-icon path')?.getAttribute('d') || '',
    };
  });
  assert.ok(desktop.heroWidth > 600, 'hero uses the full desktop width');
  assert.ok(desktop.columns >= 3, 'cards spread across the page instead of stacking on the right');
  assert.ok(desktop.formatFullWidth, 'the format card spans the full row');
  assert.match(desktop.batchIcon, /M14 3H7/, 'batch icon shows overlapping files, not layers');
  console.log('PASS: desktop About layout spreads cards and the batch icon reads as multiple files');
  const introBefore = await page.locator('#aboutIntro').innerText();
  assert.match(introBefore, /editor metadata lokal/);
  await page.locator('[data-language-toggle]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  const introAfter = await page.locator('#aboutIntro').innerText();
  assert.match(introAfter, /local metadata editor/);
  assert.notEqual(introBefore, introAfter);
  console.log('PASS: language toggle translates ui.aboutIntro from ID to EN');
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('#themeToggle').click();
  await page.waitForFunction((previous) => document.documentElement.dataset.theme !== previous, themeBefore);
  const contrast = await page.evaluate(() => {
    const text = getComputedStyle(document.querySelector('#aboutIntro'));
    const surface = getComputedStyle(document.querySelector('.about-card-intro'));
    return { color: text.color, background: surface.backgroundColor };
  });
  assert.notEqual(contrast.color, contrast.background);
  console.log('PASS: theme toggle keeps About text readable');
  mobileContext = await browser.newContext({ locale: 'id-ID', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  mobileContext.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${base}/about.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mobile.evaluate(async () => {
    const module = await import('/assets/js/ui/mobile-menu.js');
    module.initMobileMenu();
    module.initMobileMenu();
  });
  assert.equal(await mobile.locator('#menuToggle').isVisible(), true);
  assert.equal(await mobile.locator('#aboutLink').isVisible(), false);
  console.log('PASS: hamburger is visible and header About link is hidden at 390px');
  await mobile.locator('#menuToggle').click();
  await mobile.locator('#mobileMenu').waitFor({ state: 'visible' });
  assert.equal(await mobile.locator('#menuToggle').getAttribute('aria-expanded'), 'true');
  assert.equal(await mobile.evaluate(() => Boolean(document.activeElement?.closest('#mobileMenu'))), true);
  const aboutItem = mobile.locator('#mobileMenu a[href="./about.html"]');
  assert.equal(await aboutItem.count(), 1);
  assert.equal(await aboutItem.getAttribute('aria-current'), 'page');
  console.log('PASS: opening the menu moves focus inside and marks About aria-current="page"');
  await mobile.keyboard.press('ArrowDown');
  assert.equal(await mobile.evaluate(() => document.activeElement?.getAttribute('href')), './about.html');
  console.log('PASS: menu items are keyboard navigable');
  await mobile.evaluate(() => {
    window.__openSettingsCount = 0;
    window.addEventListener('meinsert:open-settings', () => { window.__openSettingsCount += 1; });
  });
  await mobile.locator('#mobileSettings').click();
  assert.equal(await mobile.evaluate(() => window.__openSettingsCount), 1);
  console.log('PASS: offline settings item dispatches meinsert:open-settings');
  await mobile.locator('#menuToggle').click();
  await mobile.locator('#mobileMenu').waitFor({ state: 'visible' });
  await mobile.waitForTimeout(250);
  const toggleShape = await mobile.evaluate(() => ({
    top: getComputedStyle(document.querySelector('.menu-line--top')).transform,
    middle: getComputedStyle(document.querySelector('.menu-line--middle')).opacity,
    gear: document.querySelector('#mobileSettings svg path:last-child')?.getAttribute('d')?.slice(0, 6),
    language: document.querySelector('#mobileLanguage svg path')?.getAttribute('d')?.slice(0, 6),
  }));
  assert.notEqual(toggleShape.top, 'none', 'hamburger morphs into an X when open');
  assert.equal(toggleShape.middle, '0', 'middle line fades out');
  assert.notEqual(toggleShape.gear, toggleShape.language, 'settings and language icons are distinct');
  console.log('PASS: hamburger morphs into X and menu action icons are distinct');
  await mobile.keyboard.press('Escape');
  await mobile.locator('#mobileMenu').waitFor({ state: 'hidden' });
  assert.equal(await mobile.locator('#menuToggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await mobile.evaluate(() => document.activeElement?.id), 'menuToggle');
  await mobile.locator('#menuToggle').click();
  await mobile.locator('#mobileMenu').waitFor({ state: 'visible' });
  await mobile.locator('body').click({ position: { x: 4, y: 400 } });
  await mobile.locator('#mobileMenu').waitFor({ state: 'hidden' });
  console.log('PASS: Escape and outside clicks close the menu and restore focus');
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (mobileContext) await mobileContext.close();
  if (desktopContext) await desktopContext.close();
  await browser.close();
  server.close();
}