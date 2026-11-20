import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cssIsUpToDate } from '../../scripts/build-css.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML_PAGES = ['index.html', 'single.html', 'batch.html', 'privacy.html', 'Terms.html'];
async function read(relativePath) {
  return readFile(join(root, relativePath), 'utf8');
}
async function exists(relativePath) {
  try {
    await stat(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}
async function walk(dir, filter) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, filter));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}
test('service worker: every precached URL exists on disk', async () => {
  const sw = await read('sw.js');
  const block = sw.match(/const SHELL_URLS = \[([\s\S]*?)\];/);
  assert.ok(block, 'SHELL_URLS tidak ditemukan di sw.js');
  const urls = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.ok(urls.length > 20, 'SHELL_URLS terlalu sedikit');
  const missing = [];
  for (const url of urls) {
    if (url === './') continue;
    const relative = url.replace(/^\.\//, '');
    if (!(await exists(relative))) missing.push(url);
  }
  assert.deepEqual(missing, [], `Aset di precache tapi tidak ada: ${missing.join(', ')}`);
});
test('service worker: precache mencakup modul inti yang diimpor app.js', async () => {
  const sw = await read('sw.js');
  const app = await read('assets/js/app.js');
  const block = sw.match(/const SHELL_URLS = \[([\s\S]*?)\];/);
  const urls = new Set([...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
  const imports = [...app.matchAll(/from\s+'(\.\/[^']+)'/g)].map((match) => match[1]);
  assert.ok(imports.length > 5, 'app.js tidak punya import statis — cek regex test');
  const missing = [];
  for (const spec of imports) {
    const target = `assets/js/${spec.replace(/^\.\//, '')}`;
    if (!urls.has(`./${target}`)) missing.push(target);
  }
  assert.deepEqual(missing, [], `Modul inti tidak di-precache: ${missing.join(', ')}`);
});
test('halaman HTML: seluruh referensi aset lokal ada', async () => {
  const missing = [];
  for (const page of HTML_PAGES) {
    const html = await read(page);
    const refs = [
      ...html.matchAll(/<link[^>]+href="([^"]+)"/g),
      ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
      ...html.matchAll(/<img[^>]+src="([^"]+)"/g),
    ].map((match) => match[1])
      .filter((ref) => !/^(https?:|data:|#|mailto:|\/\/)/.test(ref));
    for (const ref of refs) {
      if (!(await exists(ref))) missing.push(`${page} → ${ref}`);
    }
  }
  assert.deepEqual(missing, [], `Referensi aset hilang: ${missing.join(', ')}`);
});
test('halaman HTML: memuat bundel CSS, bukan rantai @import', async () => {
  for (const page of HTML_PAGES) {
    const html = await read(page);
    assert.match(html, /assets\/css\/app\.bundle\.css/, `${page} tidak memakai app.bundle.css`);
    assert.doesNotMatch(html, /href="assets\/css\/app\.css"/, `${page} masih memakai app.css`);
  }
});
test('bundel CSS sinkron dengan sumber (jalankan npm run build:css)', async () => {
  assert.ok(await cssIsUpToDate(), 'app.bundle.css basi — jalankan `npm run build:css`');
});
test('app.css mengimpor seluruh modul CSS yang ada', async () => {
  const appCss = await read('assets/css/app.css');
  const imported = new Set([...appCss.matchAll(/@import\s+"([^"]+)"/g)].map((match) => match[1].replace(/^\.\//, '')));
  const onDisk = (await walk(join(root, 'assets', 'css'), (name) => name.endsWith('.css')))
    .map((file) => file.slice(join(root, 'assets', 'css').length + 1))
    .filter((file) => file !== 'app.css' && file !== 'app.bundle.css');
  const missing = onDisk.filter((file) => !imported.has(file));
  assert.deepEqual(missing, [], `Modul CSS tidak di-@import: ${missing.join(', ')}`);
});
test('grafik import JS: semua impor statis resolve ke file yang ada', async () => {
  const jsDir = join(root, 'assets', 'js');
  const files = await walk(jsDir, (name) => name.endsWith('.js'));
  const missing = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const specs = [
      ...source.matchAll(/from\s+'(\.[^']+)'/g),
      ...source.matchAll(/import\s+'(\.[^']+)'/g),
    ].map((match) => match[1]);
    for (const spec of specs) {
      const target = resolve(dirname(file), spec);
      if (!(await exists(target.slice(root.length + 1)))) missing.push(`${file.slice(root.length + 1)} → ${spec}`);
    }
  }
  assert.deepEqual(missing, [], `Impor JS tidak resolve: ${missing.join(', ')}`);
});
test('daftar frame ID3 lengkap hanya didefinisikan di satu tempat', async () => {
  const jsDir = join(root, 'assets', 'js');
  const files = await walk(jsDir, (name) => name.endsWith('.js'));
  const definitions = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (/'CHAP',\s*'CTOC',\s*'SYLT',\s*'IPLS'/.test(source)) definitions.push(file.slice(root.length + 1));
  }
  assert.deepEqual(definitions, ['assets/js/core/integrity-rules.js']);
});
test('service worker: tidak precache vendor berat & WASM ExifTool', async () => {
  const sw = await read('sw.js');
  const block = sw.match(/const SHELL_URLS = \[([\s\S]*?)\];/);
  const urls = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const heavy = urls.filter((url) => /vendor\/|\.wasm$|icon-512|icon-maskable/.test(url));
  assert.deepEqual(heavy, [], `Aset berat seharusnya on-demand: ${heavy.join(', ')}`);
});
test('service worker: fetch handler menolak non-GET dan origin lain', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /if \(request\.method !== 'GET'\) return;/, 'only GET requests may reach the cache');
  assert.match(sw, /if \(url\.origin !== self\.location\.origin\) return;/, 'cross-origin requests must bypass the SW');
  const optional = sw.match(/async function cacheOptional\(event\) \{[\s\S]*?\n\}/);
  assert.ok(optional, 'cacheOptional must exist');
  assert.match(optional[0], /url\.origin === self\.location\.origin/, 'optional URLs must be same-origin only');
  assert.match(optional[0], /new URL\(raw, self\.registration\.scope\)/, 'optional URLs must resolve inside the SW scope');
});
test('security e2e: audit method, body dan query — bukan hanya origin', async () => {
  const source = await read('tests/e2e/security.mjs');
  assert.match(source, /checkPolicy\(policy, pageName\)/, 'the CSP guard must stay in place');
  assert.match(source, /request\.method\(\)/, 'the audit must inspect the request method');
  assert.match(source, /request\.postData\(\)/, 'the audit must inspect the request body');
  assert.match(source, /parsed\.searchParams/, 'the audit must inspect query parameters');
  assert.match(source, /POST.*PUT.*PATCH/s, 'mutating methods must be denied explicitly');
});
test('offline e2e: suite SW nyata mengukur request dan Cache Storage', async () => {
  const source = await read('tests/e2e/offline-real.mjs');
  assert.match(source, /serviceWorkers:\s*'allow'/, 'the real SW suite must allow service workers');
  assert.doesNotMatch(source, /serviceWorkers:\s*'block'/, 'the real SW suite must not block service workers');
  assert.match(source, /context\.on\('request'/, 'downloads must be measured via Playwright request events');
  assert.match(source, /caches\.keys\(\)/, 'Cache Storage must be inspected directly');
  assert.match(source, /blob:/, 'object URLs in Cache Storage must be rejected');
  assert.match(source, /SKIP:/, 'infeasible scenarios must be reported as SKIP, not PASS');
  for (const marker of ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)']) {
    assert.ok(source.includes(marker), `offline scenario ${marker} must be covered`);
  }
});