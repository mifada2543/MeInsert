/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFLINE_FEATURES, SHARED_SHELL_URLS } from '../../assets/js/core/format-capabilities.js';
import {
  estimatedBytes,
  featuresForProfile,
  getProfile,
  optionalUrls,
  setProfile,
} from '../../assets/js/core/offline-manifest.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPLICIT_OFFLINE_ASSETS = [
  './assets/js/engines/exiftool.js',
  './assets/vendor/browser-id3-writer.mjs',
  './assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm.gz',
];
function toDiskPath(url) {
  return url.replace(/^\.\//, '');
}
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
async function shellUrls() {
  const sw = await read('sw.js');
  const block = sw.match(/const SHELL_URLS = \[([\s\S]*?)\];/);
  assert.ok(block, 'SHELL_URLS tidak ditemukan di sw.js');
  return new Set([...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
}
function resolveImport(fromDiskPath, specifier) {
  return relative(root, resolve(dirname(join(root, fromDiskPath)), specifier)).split(sep).join('/');
}
function moduleSpecifiers(source) {
  const patterns = [
    /\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
    /\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*(['"])([^'"]+)\1/g,
    /\bnew\s+URL\s*\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g,
  ];
  const found = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[2]);
  }
  return [...new Set(found)].filter((specifier) => specifier.startsWith('.'));
}
function isVendored(diskPath) {
  return /\/vendor\//.test(diskPath) || /\.wasm(?:\.gz|\.br)?$/i.test(diskPath);
}
const diskReadSource = async (diskPath) => {
  try { return await read(diskPath); } catch { return null; }
};
async function checkClosure({ features, shell, shared, readSource, fileExists }) {
  const problems = [];
  for (const feature of features) {
    const own = new Set(feature.urls);
    const queue = [...feature.urls];
    const seen = new Set();
    while (queue.length) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);
      const disk = toDiskPath(url);
      if (isVendored(disk)) continue;
      const source = await readSource(disk);
      if (source === null) {
        problems.push(`${url} is unreadable`);
        continue;
      }
      for (const specifier of moduleSpecifiers(source)) {
        const targetDisk = resolveImport(disk, specifier);
        const targetUrl = `./${targetDisk}`;
        if (!(await fileExists(targetDisk))) {
          problems.push(`${url} → ${specifier} (target does not exist)`);
          continue;
        }
        if (own.has(targetUrl) || shell.has(targetUrl) || shared.has(targetUrl)) {
          if (!shell.has(targetUrl) && !shared.has(targetUrl)) queue.push(targetUrl);
        } else {
          problems.push(`${url} → ${specifier} (not in ${feature.id} URLs or the shell)`);
        }
      }
    }
  }
  return problems;
}
function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
test('offline profile drives the optional URL list and byte estimate', async () => {
  const storage = memoryStorage();
  assert.deepEqual(getProfile(storage), { mode: 'frugal', features: [], updatedAt: 0 });
  assert.deepEqual(optionalUrls(getProfile(storage)), []);
  assert.equal(setProfile(storage, { mode: 'all' }), true);
  const all = getProfile(storage);
  assert.equal(all.mode, 'all');
  assert.equal(featuresForProfile(all).length, OFFLINE_FEATURES.length);
  const urls = optionalUrls(all);
  assert.ok(urls.length > 10, 'all mode must cover every optional engine URL');
  assert.deepEqual(urls, [...new Set(urls)], 'optional URLs must be de-duplicated');
  assert.ok(urls.includes('./assets/js/core/zip-directory.js'), 'office feature must include zip-directory.js');
  let uniqueBytes = 0;
  for (const url of urls) uniqueBytes += (await stat(join(root, toDiskPath(url)))).size;
  assert.equal(estimatedBytes(all), uniqueBytes);
  const image = OFFLINE_FEATURES.find((feature) => feature.id === 'image');
  assert.ok(image.urls.includes('./assets/vendor/fflate.mjs'), 'image-only offline mode must include the gzip fallback');
  for (const ids of [['image', 'audio'], ['image', 'office']]) {
    const profile = { mode: 'selected', features: ids };
    let total = 0;
    for (const url of optionalUrls(profile)) total += (await stat(join(root, toDiskPath(url)))).size;
    assert.equal(estimatedBytes(profile), total);
  }
  assert.equal(setProfile(storage, { mode: 'selected', features: ['pdf', 'unknown', 'pdf'] }), true);
  assert.deepEqual(getProfile(storage).features, ['pdf']);
  assert.deepEqual(optionalUrls(getProfile(storage)), [...OFFLINE_FEATURES.find((feature) => feature.id === 'pdf').urls]);
});
test('shared shell modules are precached and free of vendored assets', async () => {
  const shell = await shellUrls();
  assert.ok(SHARED_SHELL_URLS.length >= 5, 'SHARED_SHELL_URLS must list the modules optional engines import');
  for (const url of SHARED_SHELL_URLS) {
    assert.ok(shell.has(url), `shared module is not precached: ${url}`);
    assert.ok(await exists(toDiskPath(url)), `shared module is missing on disk: ${url}`);
    assert.doesNotMatch(url, /vendor\/|\.wasm(?:\.gz|\.br)?$/, `vendored asset leaked into the shared shell: ${url}`);
  }
});
test('every optional engine URL exists on disk', async () => {
  const missing = [];
  for (const feature of OFFLINE_FEATURES) {
    for (const url of feature.urls) {
      if (!(await exists(toDiskPath(url)))) missing.push(`${feature.id} → ${url}`);
    }
  }
  assert.deepEqual(missing, [], `Optional engine assets missing on disk: ${missing.join(', ')}`);
});
test('offline byte estimates match the actual asset sizes on disk', async () => {
  const mismatches = [];
  for (const feature of OFFLINE_FEATURES) {
    let total = 0;
    for (const url of feature.urls) total += (await stat(join(root, toDiskPath(url)))).size;
    if (total !== feature.bytes) {
      mismatches.push(`${feature.id}: manifest ${feature.bytes}, disk ${total}`);
    }
  }
  assert.deepEqual(mismatches, [], `Offline estimates drifted from the shipped assets: ${mismatches.join(', ')}`);
});
test('static imports of precached shell modules are also precached', async () => {
  const shell = await shellUrls();
  const optional = new Set(OFFLINE_FEATURES.flatMap((feature) => feature.urls));
  const staticSpecifiers = (source) => [
    ...[...source.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)].map((match) => match[2]),
    ...[...source.matchAll(/\bimport\s*(['"])([^'"]+)\1/g)].map((match) => match[2]),
  ].filter((specifier) => specifier.startsWith('.'));
  const missing = [];
  for (const url of shell) {
    if (!/^\.\/assets\/js\/.*\.js$/.test(url)) continue;
    const diskPath = toDiskPath(url);
    if (!(await exists(diskPath))) continue;
    for (const specifier of staticSpecifiers(await read(diskPath))) {
      const imported = `./${resolveImport(diskPath, specifier)}`;
      if (isVendored(toDiskPath(imported)) || shell.has(imported) || optional.has(imported)) continue;
      missing.push(`${url} → ${specifier}`);
    }
  }
  assert.deepEqual(missing, [], `shell module import is not available offline: ${missing.join(', ')}`);
});
test('worker entry points are part of the precached shell', async () => {
  const shell = await shellUrls();
  const missing = OFFLINE_FEATURES
    .flatMap((feature) => feature.urls)
    .filter((url) => /\/workers\/[^/]+\.worker\.js$/.test(url))
    .filter((url) => !shell.has(url));
  assert.deepEqual(missing, [], `Workers must be in the shell so engines can start offline: ${missing.join(', ')}`);
});
test('static + dynamic import closure of every optional engine is available offline', async () => {
  const problems = await checkClosure({
    features: OFFLINE_FEATURES,
    shell: await shellUrls(),
    shared: new Set(SHARED_SHELL_URLS),
    readSource: diskReadSource,
    fileExists: exists,
  });
  assert.deepEqual(problems, [], `offline dependency closure is incomplete: ${problems.join(', ')}`);
});
test('runtime-only assets are declared explicitly and exist on disk', async () => {
  const declared = new Set(OFFLINE_FEATURES.flatMap((feature) => feature.urls));
  for (const url of EXPLICIT_OFFLINE_ASSETS) {
    assert.ok(declared.has(url), `runtime asset is not declared in any feature: ${url}`);
    assert.ok(await exists(toDiskPath(url)), `runtime asset is missing on disk: ${url}`);
  }
});
test('the closure test fails when a dynamic dependency is removed from the URL list', async () => {
  const options = {
    shell: await shellUrls(),
    shared: new Set(SHARED_SHELL_URLS),
    readSource: diskReadSource,
    fileExists: exists,
  };
  const removedWriter = OFFLINE_FEATURES.map((feature) => ({
    ...feature,
    urls: feature.urls.filter((url) => url !== './assets/vendor/browser-id3-writer.mjs'),
  }));
  const writerProblems = await checkClosure({ ...options, features: removedWriter });
  assert.ok(writerProblems.some((item) => item.includes('browser-id3-writer.mjs')),
    'removing the ID3 writer from the audio URLs must fail the closure test');
  const removedExiftool = OFFLINE_FEATURES.map((feature) => ({
    ...feature,
    urls: feature.urls.filter((url) => url !== './assets/js/engines/exiftool.js'),
  }));
  const exiftoolProblems = await checkClosure({ ...options, features: removedExiftool });
  assert.ok(exiftoolProblems.some((item) => item.includes('engines/exiftool.js')),
    'removing exiftool.js from the image URLs must fail the closure test');
});
test('nested dynamic imports are followed transitively', async () => {
  const graph = new Map([
    ['root.js', "const a = await import('./a.js');"],
    ['a.js', "export { x } from './b.js';"],
    ['b.js', 'const c = await import("./c.js");'],
    ['c.js', 'export default 1;'],
  ]);
  const urls = ['./root.js', './a.js', './b.js', './c.js'];
  const options = {
    shell: new Set(),
    shared: new Set(),
    readSource: async (diskPath) => graph.get(diskPath) ?? null,
    fileExists: async (diskPath) => graph.has(diskPath),
  };
  assert.deepEqual(await checkClosure({ ...options, features: [{ id: 'nested', urls }] }), [],
    'a complete nested dynamic chain must pass');
  const problems = await checkClosure({
    ...options,
    features: [{ id: 'nested', urls: urls.filter((url) => url !== './c.js') }],
  });
  assert.ok(problems.some((item) => item.includes('c.js')),
    'a deep dynamic import must be reported when it is absent from the URL list');
});
test('service worker optional URL allowlist matches the manifest union', async () => {
  const sw = await read('sw.js');
  const block = sw.match(/const KNOWN_OPTIONAL_URLS = (?:Object\.freeze\()?\[([\s\S]*?)\](?:\))?;/);
  assert.ok(block, 'KNOWN_OPTIONAL_URLS tidak ditemukan di sw.js');
  const fromWorker = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const fromManifest = [...new Set(OFFLINE_FEATURES.flatMap((feature) => feature.urls))].sort();
  assert.deepEqual(fromWorker, fromManifest, 'the SW allowlist and the manifest must list the same URLs');
});
test('optional cache reuses valid entries, deduplicates fetches and bounds payloads', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /const ENGINE_HEADER = 'x-meinsert-engine-version'/);
  assert.match(sw, /response\.headers\.get\(ENGINE_HEADER\) === ENGINE_VERSION/);
  assert.match(sw, /const pendingFetches = new Map\(\)/);
  assert.match(sw, /pendingFetches\.has\(absolute\)/);
  assert.match(sw, /const activeJobs = new Map\(\)/);
  assert.match(sw, /new AbortController\(\)/);
  assert.match(sw, /controller\.abort\(\)/);
  assert.match(sw, /MAX_OPTIONAL_URLS/);
  assert.match(sw, /MAX_OPTIONAL_BYTES/);
  assert.match(sw, /bytes: used, totalBytes: bytes/);
  assert.doesNotMatch(sw, /setTimeout\([^)]*30_?000/);
});
test('service worker messages are typed, job-scoped and refuse object URLs', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /const KNOWN_MESSAGE_TYPES = new Set\(\[/);
  for (const type of ['SKIP_WAITING', 'GET_VERSION', 'CACHE_OPTIONAL', 'CLEAR_OPTIONAL', 'OPTIONAL_STATUS', 'CANCEL_OPTIONAL']) {
    assert.match(sw, new RegExp(`'${type}'`), `${type} must be explicitly allowed`);
  }
  assert.match(sw, /invalid_job/);
  assert.match(sw, /unknown_type/);
  assert.match(sw, /invalid_urls/);
  assert.match(sw, /validJobId\(jobId\)/);
  assert.match(sw, /blob\|data\|file\|filesystem\|javascript/);
});
test('optional download UI uses inactivity only, with job isolation and byte progress', async () => {
  const ui = await read('assets/js/ui/offline-settings.js');
  assert.doesNotMatch(ui, /30_000/, 'a total 30-second download deadline must not exist');
  assert.match(ui, /INACTIVITY_MS = 60_000/);
  assert.match(ui, /matchesJob\(data\)/);
  assert.match(ui, /type: 'CANCEL_OPTIONAL'/);
  assert.match(ui, /function retryDownload/);
  assert.match(ui, /function cancelDownload/);
  assert.match(ui, /ui\.engineDownloadProgressBytes/);
  assert.match(ui, /TERMINAL_STATES/);
});