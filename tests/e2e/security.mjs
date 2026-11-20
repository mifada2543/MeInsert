/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pages = ['index.html', 'single.html', 'batch.html', 'privacy.html', 'Terms.html'];
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.pdf', 'application/pdf'],
]);

function serve() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream' });
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

function directive(policy, name) {
  const entry = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  return entry ? entry.slice(name.length + 1).trim() : '';
}

function checkPolicy(policy, pageName) {
  const where = `CSP on ${pageName}`;
  assert.ok(policy, `${where}: meta Content-Security-Policy is missing`);
  assert.equal(directive(policy, 'default-src'), "'self'", `${where}: default-src`);
  assert.ok(policy.includes('script-src'), `${where}: script-src is missing`);
  assert.match(directive(policy, 'script-src'), /'wasm-unsafe-eval'/, `${where}: wasm-unsafe-eval is missing`);
  assert.equal(directive(policy, 'connect-src'), "'self'", `${where}: connect-src`);
  assert.match(directive(policy, 'frame-src'), /blob:/, `${where}: frame-src must allow blob: PDF previews`);
  assert.equal(directive(policy, 'object-src'), "'none'", `${where}: object-src`);
  assert.equal(directive(policy, 'form-action'), "'none'", `${where}: form-action`);
  assert.doesNotMatch(policy, /'unsafe-inline'/, `${where}: 'unsafe-inline' must not be allowed`);
}
const ALLOWED_SCHEMES = new Set(['blob:', 'data:', 'about:', 'chrome:', 'chrome-extension:', 'devtools:']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UPLOAD_CONTENT_TYPES = /^(multipart\/form-data|application\/octet-stream|application\/x-www-form-urlencoded)$/i;
const SENSITIVE_QUERY_KEYS = /^(file|files|data|content|metadata|meta|blob|upload|payload|title|artist|album|filename|name)$/i;
const AUDIT_MARKERS = ['Security audit title', 'Batch security audit', 'document.pdf', 'pattern.png'];
function isAllowed(url, baseOrigin) {
  const parsed = new URL(url);
  if (ALLOWED_SCHEMES.has(parsed.protocol)) return true;
  return parsed.origin === baseOrigin;
}
function assertNoExternal(requests, baseOrigin, label) {
  const offenders = [...new Set(requests.map((request) => request.url()))]
    .filter((url) => !isAllowed(url, baseOrigin));
  assert.deepEqual(offenders, [], `${label}: external requests observed:\n${offenders.join('\n')}`);
}
function assertNoUpload(requests, baseOrigin, label) {
  const problems = [];
  const containsMarker = (text) => AUDIT_MARKERS.some((marker) => text.toLowerCase().includes(marker.toLowerCase()));
  for (const request of requests) {
    const href = request.url();
    let parsed;
    try { parsed = new URL(href); } catch { continue; }
    if (!/^https?:$/.test(parsed.protocol) || !isAllowed(href, baseOrigin)) continue;
    const method = request.method().toUpperCase();
    if (MUTATING_METHODS.has(method)) problems.push(`${label}: mutating method ${method} → ${href}`);
    const body = request.postData() || '';
    if (body) {
      problems.push(`${label}: request carries a body (${method}) → ${href}`);
      if (containsMarker(body)) problems.push(`${label}: request body contains edited/file data → ${href}`);
    }
    const contentType = request.headers()['content-type'] || '';
    if (UPLOAD_CONTENT_TYPES.test(contentType)) {
      problems.push(`${label}: upload-style content-type "${contentType}" → ${href}`);
    }
    for (const [key, value] of parsed.searchParams) {
      if (SENSITIVE_QUERY_KEYS.test(key) || containsMarker(key) || containsMarker(value)) {
        problems.push(`${label}: query parameter carries metadata → ${href}`);
      }
    }
    if (parsed.search) problems.push(`${label}: unexpected query string → ${href}`);
  }
  assert.deepEqual([...new Set(problems)], [], `${label}: request hygiene violations:\n${problems.join('\n')}`);
}
const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const baseOrigin = new URL(base).origin;
const browser = await getBrowser({
  executablePath: findChrome(),
  headless: true,
  args: ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
  for (const pageName of pages) {
    await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const policy = await page.evaluate(() =>
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
    checkPolicy(policy, pageName);
  }
  console.log('PASS: all five HTML pages carry the hardened meta CSP');
  const requests = [];
  page.on('request', (request) => requests.push(request));
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  await page.locator('#field-title').fill('Security audit title');
  await page.locator('#saveBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-download').waitFor({ timeout: 90000 });
  assertNoExternal(requests, baseOrigin, 'single-file save');
  assertNoUpload(requests, baseOrigin, 'single-file save');
  console.log('PASS: single-file open -> edit -> save produced no external requests or uploads');
  requests.length = 0;
  await page.goto(`${base}/batch.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('#batchFileInput').setInputFiles([
    join(root, 'tests/fixtures/pattern.png'),
    join(root, 'tests/fixtures/document.pdf'),
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.batch-group').length === 2
    && [...document.querySelectorAll('.batch-add-tile')].every((tile) => !tile.disabled), null, { timeout: 60000 });
  const imageTitle = page.locator('.batch-group[data-group-key^="image:"] [data-field-id="title"] .field-input');
  await imageTitle.fill('Batch security audit');
  await page.locator('#batchApplyBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.waitForFunction(() => !document.querySelector('#batchGroups').inert
    && /selesai/.test(document.querySelector('#batchStatus')?.textContent || ''), null, { timeout: 90000 });
  assertNoExternal(requests, baseOrigin, 'batch save');
  assertNoUpload(requests, baseOrigin, 'batch save');
  console.log('PASS: batch open -> edit -> save produced no external requests or uploads');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS: no external requests, no uploads and no page errors during editing');
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}