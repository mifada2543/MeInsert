import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const path = normalize(join(root, pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!path.startsWith(root) || !existsSync(path)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (error) => console.log('PAGEERROR', error.message));
await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded' });
await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
await page.locator('#field-title').waitFor({ timeout: 60000 });
const labels = await page.evaluate(() => ({
  undo: document.querySelector('#undoBtn')?.getAttribute('aria-label'),
  undoTitle: document.querySelector('#undoBtn')?.getAttribute('title'),
  redo: document.querySelector('#redoBtn')?.getAttribute('aria-label'),
  redoTitle: document.querySelector('#redoBtn')?.getAttribute('title'),
  icon: Boolean(document.querySelector('#undoBtn .icon svg')),
  order: [...document.querySelector('.editor-head').children].map((n) => n.id || n.className),
}));
console.log('ID', JSON.stringify(labels, null, 2));
await page.evaluate(async () => (await import('/assets/js/i18n/index.js')).setLanguage('en'));
const en = await page.evaluate(() => ({
  undo: document.querySelector('#undoBtn')?.getAttribute('aria-label'),
  redo: document.querySelector('#redoBtn')?.getAttribute('aria-label'),
}));
console.log('EN', JSON.stringify(en, null, 2));
await page.evaluate(async () => (await import('/assets/js/i18n/index.js')).setLanguage('id'));
await page.locator('#field-title').fill('Contoh');
console.log('undo enabled after edit', await page.locator('#undoBtn').isEnabled(), 'redo enabled', await page.locator('#redoBtn').isEnabled());
await page.locator('#undoBtn').click();
console.log('after undo -> undo enabled', await page.locator('#undoBtn').isEnabled(), 'redo enabled', await page.locator('#redoBtn').isEnabled());
await page.locator('#redoBtn').click();
console.log('after redo -> undo enabled', await page.locator('#undoBtn').isEnabled(), 'redo enabled', await page.locator('#redoBtn').isEnabled());
await page.screenshot({ path: '/tmp/opencode/editor-head-desktop.png', clip: { x: 0, y: 0, width: 1280, height: 700 } });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('.editor-head').scrollIntoView({ block: 'start' }));
await page.waitForTimeout(500);
console.log('scrollY', await page.evaluate(() => window.scrollY));
await page.screenshot({ path: '/tmp/opencode/editor-head-mobile.png', fullPage: false });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
console.log('mobile no overflow', overflow);
await browser.close();
await new Promise((resolve) => server.close(resolve));
