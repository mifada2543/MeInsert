/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
test('stream progress precedes cache completion and lazy cache is reused', async () => {
  const entries = new Map();
  const cache = { match: async (url) => entries.get(typeof url === 'string' ? url : url.url)?.clone(), put: async (url, response) => { const bytes = await response.arrayBuffer(); entries.set(typeof url === 'string' ? url : url.url, new Response(bytes, { headers: response.headers })); } };
  let calls = 0;
  let stream;
  const context = vm.createContext({ URL, Response, Headers, ReadableStream, AbortController, caches: { open: async () => cache }, self: { registration: { scope: 'https://test.local/' }, location: { origin: 'https://test.local' }, addEventListener() {} }, fetch: async () => { calls++; return new Response(new ReadableStream({ start(controller) { stream = controller; } })); } });
  vm.runInContext(source + '\nthis.api = { fetchAndStore, cachedOptionalResponse, cacheFirst };', context);
  const url = 'https://test.local/assets/vendor/browser-id3-writer.mjs';
  const seen = [];
  const first = context.api.fetchAndStore(cache, url, undefined, (bytes) => seen.push(bytes));
  const second = context.api.fetchAndStore(cache, url);
  await new Promise((resolve) => setImmediate(resolve));
  stream.enqueue(new Uint8Array([1,2,3]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, [3]);
  assert.equal(entries.size, 0);
  stream.enqueue(new Uint8Array([4]));
  stream.close();
  assert.equal(await first, 4);
  assert.equal(await second, 4);
  assert.equal(calls, 1);
  assert.equal((await context.api.cacheFirst({ url })).headers.get('x-meinsert-engine-version'), 'meinsert-engine-v4');
  assert.equal(calls, 1);
  entries.set(url, new Response('legacy cached engine'));
  assert.ok(await context.api.cachedOptionalResponse(cache, url));
});
test('migrating the v3 engine cache to v4 refreshes Brotli assets and is idempotent', async () => {
  const scope = 'https://test.local/';
  const url = (path) => new URL(path, scope).href;
  const prefix = 'assets/vendor/exiftool-wasm/';
  const gz = url(`${prefix}zeroperl-522d094a89cc.wasm.gz`);
  const raw = url(`${prefix}zeroperl-522d094a89cc.wasm`);
  const br = url(`${prefix}zeroperl-522d094a89cc.wasm.br`);
  const wrapper = url(`${prefix}index.js`);
  const library = url('assets/vendor/mediabunny.mjs');
  const bridge = url('assets/js/engines/exiftool.js');
  const decoder = url('assets/vendor/brotli-decode.mjs');
  const legacy = new Map([
    [gz, new Response('old gzip engine')],
    [raw, new Response('old raw WASM')],
    [wrapper, new Response('old loader')],
    [library, new Response('reusable library', { headers: { 'x-meinsert-engine-version': 'meinsert-engine-v3' } })],
  ]);
  const current = new Map();
  const requests = [];
  const cache = (entries) => ({
    match: async (key) => entries.get(typeof key === 'string' ? key : key.url)?.clone(),
    keys: async () => [...entries.keys()].map((href) => ({ url: href })),
    put: async (key, response) => entries.set(typeof key === 'string' ? key : key.url,
      new Response(await response.arrayBuffer(), { headers: response.headers })),
    delete: async (key) => entries.delete(typeof key === 'string' ? key : key.url),
  });
  const context = vm.createContext({
    URL, Response, Headers, ReadableStream, AbortController, setTimeout, clearTimeout,
    caches: {
      keys: async () => ['meinsert-engine-v3'],
      open: async (name) => cache(name === 'meinsert-engine-v3' ? legacy : current),
    },
    self: { registration: { scope }, location: { origin: 'https://test.local' }, addEventListener() {} },
    fetch: async (href) => { requests.push(href); return new Response('built asset'); },
  });
  vm.runInContext(source + '\nthis.migrate = migratePreviousEngineCache;', context);
  await context.migrate();
  assert.deepEqual(requests.sort(), [br, wrapper, decoder, bridge].sort());
  assert.equal(await current.get(library).text(), 'reusable library');
  assert.equal(current.get(library).headers.get('x-meinsert-engine-version'), 'meinsert-engine-v4');
  assert.equal(current.has(gz), false);
  assert.equal(current.has(raw), false);
  requests.length = 0;
  await context.migrate();
  assert.deepEqual(requests, []);
});
test('upgrading a previously installed image engine refreshes the changed assets', async () => {
  const scope = 'https://test.local/';
  const url = (path) => new URL(path, scope).href;
  const prefix = 'assets/vendor/exiftool-wasm/';
  const oldWasm = url(`${prefix}zeroperl-twnm61dk.wasm.gz`);
  const newWasm = url(`${prefix}${exiftoolBuild.name}.br`);
  const library = url('assets/vendor/mediabunny.mjs');
  const wrapper = url(`${prefix}index.js`);
  const bridge = url('assets/js/engines/exiftool.js');
  const decoder = url('assets/vendor/brotli-decode.mjs');
  const legacy = new Map([
    [oldWasm, new Response('old WASM')],
    [wrapper, new Response('old loader')],
    [library, new Response('reusable library', { headers: { 'x-meinsert-engine-version': 'meinsert-engine-v3' } })],
  ]);
  const current = new Map();
  const requests = [];
  const cache = (entries) => ({
    match: async (key) => entries.get(typeof key === 'string' ? key : key.url)?.clone(),
    keys: async () => [...entries.keys()].map((href) => ({ url: href })),
    put: async (key, response) => entries.set(typeof key === 'string' ? key : key.url,
      new Response(await response.arrayBuffer(), { headers: response.headers })),
    delete: async (key) => entries.delete(typeof key === 'string' ? key : key.url),
  });
  const context = vm.createContext({
    URL, Response, Headers, ReadableStream, AbortController, setTimeout, clearTimeout,
    caches: {
      keys: async () => ['meinsert-engine-v3'],
      open: async (name) => cache(name === 'meinsert-engine-v3' ? legacy : current),
    },
    self: { registration: { scope }, location: { origin: 'https://test.local' }, addEventListener() {} },
    fetch: async (href) => { requests.push(href); return new Response('built asset'); },
  });
  vm.runInContext(source + '\nthis.migrate = migratePreviousEngineCache;', context);
  await context.migrate();
  assert.deepEqual(requests.sort(), [newWasm, wrapper, bridge, decoder].sort());
  assert.equal(await current.get(library).text(), 'reusable library');
  assert.equal(current.get(library).headers.get('x-meinsert-engine-version'), 'meinsert-engine-v4');
  assert.equal(await current.get(wrapper).text(), 'built asset');
  assert.equal(current.has(oldWasm), false);
});
