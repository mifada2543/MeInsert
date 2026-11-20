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
function staticImports(source) {
  return [
    ...source.matchAll(/\bfrom\s+'([^']+)'/g),
    ...source.matchAll(/\bimport\s+'([^']+)'/g),
  ].map((match) => match[1]).filter((specifier) => specifier.startsWith('.'));
}
function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
test('offline profile drives the optional URL list and byte estimate', () => {
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
  assert.equal(estimatedBytes(all), OFFLINE_FEATURES.reduce((sum, feature) => sum + feature.bytes, 0));
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
    assert.doesNotMatch(url, /vendor\/|\.wasm$/, `vendored asset leaked into the shared shell: ${url}`);
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
test('worker entry points are part of the precached shell', async () => {
  const shell = await shellUrls();
  const missing = OFFLINE_FEATURES
    .flatMap((feature) => feature.urls)
    .filter((url) => /\/workers\/[^/]+\.worker\.js$/.test(url))
    .filter((url) => !shell.has(url));
  assert.deepEqual(missing, [], `Workers must be in the shell so engines can start offline: ${missing.join(', ')}`);
});
test('static import closure of every optional engine is available offline', async () => {
  const shell = await shellUrls();
  const shared = new Set(SHARED_SHELL_URLS);
  for (const feature of OFFLINE_FEATURES) {
    const own = new Set(feature.urls);
    const queue = [...feature.urls];
    const seen = new Set();
    const problems = [];
    while (queue.length) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);
      const disk = toDiskPath(url);
      if (/\/vendor\//.test(disk) || /\.wasm$/i.test(disk)) continue;
      let source;
      try {
        source = await read(disk);
      } catch {
        problems.push(`${url} is unreadable`);
        continue;
      }
      for (const specifier of staticImports(source)) {
        const targetDisk = resolveImport(disk, specifier);
        const targetUrl = `./${targetDisk}`;
        if (!(await exists(targetDisk))) {
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
    assert.deepEqual(problems, [], `${feature.id} offline dependency closure is incomplete: ${problems.join(', ')}`);
  }
});