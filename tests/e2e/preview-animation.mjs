/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.md': 'text/plain',
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
  const file = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root) || !existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
if (!chrome) throw new Error('Set CHROME_BIN to Chrome/Chromium executable');
const browser = await getBrowser({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
const errors = [];
async function frameState(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.file-card--top .preview-frame-wrap');
    const frame = document.querySelector('.file-card--top .preview-frame');
    const style = getComputedStyle(frame);
    return { height: wrap.getBoundingClientRect().height, opacity: Number(style.opacity), inert: Boolean(frame.inert) };
  });
}
try {
  const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
  await page.setInputFiles('#fileInput', join(root, 'tests/fixtures/pattern.png'));
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  const initial = await frameState(page);
  assert.ok(initial.height > 200, 'preview starts expanded');
  console.log('PASS: preview starts expanded');
  await page.locator('.preview-toggle').click();
  await page.waitForTimeout(80);
  const collapsing = await frameState(page);
  assert.ok(collapsing.height > 0 && collapsing.height < initial.height, 'height interpolates while closing');
  assert.ok(collapsing.opacity < 1, 'preview fades while closing');
  await page.waitForTimeout(400);
  const collapsed = await frameState(page);
  assert.equal(collapsed.height, 0, 'preview fully collapses');
  assert.equal(collapsed.inert, true, 'collapsed preview is inert (out of tab order)');
  console.log('PASS: closing the preview animates instead of snapping');
  await page.locator('.preview-toggle').click();
  await page.waitForTimeout(80);
  const opening = await frameState(page);
  assert.ok(opening.height > 0 && opening.height < initial.height, 'height interpolates while opening');
  assert.equal(opening.inert, false, 'preview is interactive again while opening');
  await page.waitForTimeout(400);
  const expanded = await frameState(page);
  assert.ok(expanded.height > 200, 'preview returns to full size');
  console.log('PASS: opening the preview animates back to full size');
  const reduced = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const reducedPage = await reduced.newPage();
  reducedPage.on('pageerror', (error) => errors.push(error.message));
  await reducedPage.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
  await reducedPage.setInputFiles('#fileInput', join(root, 'tests/fixtures/pattern.png'));
  await reducedPage.locator('#field-title').waitFor({ timeout: 60000 });
  await reducedPage.locator('.preview-toggle').click();
  const reducedState = await frameState(reducedPage);
  assert.equal(reducedState.height, 0, 'reduced motion collapses instantly');
  console.log('PASS: reduced motion skips the animation');
  for (const fixture of ['document.pdf', 'tone-long.mp3']) {
    const typeContext = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const typePage = await typeContext.newPage();
    typePage.on('pageerror', (error) => errors.push(error.message));
    await typePage.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
    await typePage.setInputFiles('#fileInput', join(root, 'tests/fixtures', fixture));
    await typePage.locator('.preview-toggle').waitFor({ timeout: 60000 });
    await typePage.waitForTimeout(400);
    assert.ok((await frameState(typePage)).height > 100, `${fixture} starts expanded`);
    await typePage.locator('.preview-toggle').click();
    await typePage.waitForTimeout(450);
    const minimized = await frameState(typePage);
    assert.equal(minimized.height, 0, `${fixture} collapses to zero height`);
    const card = await typePage.evaluate(() => Math.round(document.querySelector('.file-card--top').getBoundingClientRect().height));
    assert.ok(card < 90, `${fixture} card stays compact (${card}px)`);
    console.log(`PASS: ${fixture} collapses without a blank box`);
    await typeContext.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS: preview animation suite finished with no page errors');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}