/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
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
  assert.equal((await context.api.cacheFirst({ url })).headers.get('x-meinsert-engine-version'), 'meinsert-engine-v1');
  assert.equal(calls, 1);
  entries.set(url, new Response('legacy cached engine'));
  assert.ok(await context.api.cachedOptionalResponse(cache, url));
});